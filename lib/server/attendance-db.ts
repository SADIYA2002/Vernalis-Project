// ---------------------------------------------------------------------------
// Chrono Attendance Portal — Server Database Repository
// In-memory persistent server store with business validation & seed generators
// ---------------------------------------------------------------------------

import {
  type AttendanceRecord,
  type AttendanceStatus,
  type CorrectionRequest,
  type Employee,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  ALL_PEOPLE,
  datesBetween,
  generateAttendance,
  generateLeaveBalances,
  isWorkingDay,
  POLICY,
  seedCorrections,
  seedLeaves,
} from "@/lib/attendance-data"

export interface ServerDatabase {
  employees: Employee[]
  records: AttendanceRecord[]
  corrections: CorrectionRequest[]
  leaves: LeaveRequest[]
  balances: LeaveBalance[]
  lastUpdated: string
}

// Global reference on Node server runtime to persist state across route calls
declare global {
  // eslint-disable-next-line no-var
  var __chrono_db: ServerDatabase | undefined
}

function initDatabase(): ServerDatabase {
  return {
    employees: [...ALL_PEOPLE],
    records: generateAttendance(),
    corrections: seedCorrections(),
    leaves: seedLeaves(),
    balances: generateLeaveBalances(),
    lastUpdated: new Date().toISOString(),
  }
}

export function getDatabase(): ServerDatabase {
  if (!global.__chrono_db) {
    global.__chrono_db = initDatabase()
  }
  return global.__chrono_db
}

export function resetDatabase(): ServerDatabase {
  global.__chrono_db = initDatabase()
  return global.__chrono_db
}

function calculateWorkedHours(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0
  const [ih, im] = checkIn.split(":").map(Number)
  const [oh, om] = checkOut.split(":").map(Number)
  const span = oh * 60 + om - (ih * 60 + im) - 60 // minus 1h unpaid lunch
  return Math.max(0, Math.round((span / 60) * 10) / 10)
}

function calculateLateMinutes(checkIn?: string | null): number {
  if (!checkIn) return 0
  const [ih, im] = checkIn.split(":").map(Number)
  return Math.max(0, ih * 60 + im - 9 * 60)
}

// --- Attendance Operations ---

export function getAttendanceRecords(filters?: {
  employeeId?: string
  start?: string
  end?: string
}): AttendanceRecord[] {
  const db = getDatabase()
  let result = db.records
  if (filters?.employeeId) {
    result = result.filter((r) => r.employeeId === filters.employeeId)
  }
  if (filters?.start) {
    result = result.filter((r) => r.date >= filters.start!)
  }
  if (filters?.end) {
    result = result.filter((r) => r.date <= filters.end!)
  }
  return result
}

export function upsertAttendance(input: {
  employeeId: string
  date: string
  status: AttendanceStatus
  checkIn?: string | null
  checkOut?: string | null
  note?: string
  corrected?: boolean
}): AttendanceRecord {
  const db = getDatabase()
  const workedHours = calculateWorkedHours(input.checkIn, input.checkOut)
  const lateMinutes = calculateLateMinutes(input.checkIn)

  const record: AttendanceRecord = {
    id: `${input.employeeId}-${input.date}`,
    employeeId: input.employeeId,
    date: input.date,
    status: input.status,
    checkIn: input.checkIn ?? null,
    checkOut: input.checkOut ?? null,
    workedHours,
    lateMinutes,
    note: input.note,
    corrected: input.corrected,
  }

  const idx = db.records.findIndex((r) => r.employeeId === input.employeeId && r.date === input.date)
  if (idx === -1) {
    db.records.push(record)
  } else {
    db.records[idx] = record
  }
  db.lastUpdated = new Date().toISOString()
  return record
}

// --- Corrections Operations ---

export function getCorrections(filters?: {
  employeeId?: string
  state?: string
}): CorrectionRequest[] {
  const db = getDatabase()
  let result = db.corrections
  if (filters?.employeeId) {
    result = result.filter((c) => c.employeeId === filters.employeeId)
  }
  if (filters?.state) {
    result = result.filter((c) => c.state === filters.state)
  }
  return result
}

export function createCorrection(input: {
  employeeId: string
  date: string
  fromStatus: AttendanceStatus
  toStatus: AttendanceStatus
  requestedCheckIn: string | null
  requestedCheckOut: string | null
  reason: string
}): CorrectionRequest {
  const db = getDatabase()
  const newCorrection: CorrectionRequest = {
    id: `cor-${Date.now()}`,
    ...input,
    state: "pending",
    submittedAt: new Date().toISOString(),
  }
  db.corrections.unshift(newCorrection)
  db.lastUpdated = new Date().toISOString()
  return newCorrection
}

export function reviewCorrection(
  id: string,
  approve: boolean,
  reviewerId: string,
  comment: string,
): { correction: CorrectionRequest | null; updatedRecord?: AttendanceRecord } {
  const db = getDatabase()
  const cor = db.corrections.find((c) => c.id === id)
  if (!cor) return { correction: null }

  cor.state = approve ? "approved" : "rejected"
  cor.reviewedBy = reviewerId
  cor.reviewComment = comment

  let updatedRecord: AttendanceRecord | undefined
  if (approve) {
    updatedRecord = upsertAttendance({
      employeeId: cor.employeeId,
      date: cor.date,
      status: cor.toStatus,
      checkIn: cor.requestedCheckIn,
      checkOut: cor.requestedCheckOut,
      corrected: true,
      note: `Correction approved by ${reviewerId}`,
    })
  }

  db.lastUpdated = new Date().toISOString()
  return { correction: cor, updatedRecord }
}

// --- Leave Operations ---

export function getLeaveRequests(filters?: {
  employeeId?: string
  state?: string
}): LeaveRequest[] {
  const db = getDatabase()
  let result = db.leaves
  if (filters?.employeeId) {
    result = result.filter((l) => l.employeeId === filters.employeeId)
  }
  if (filters?.state) {
    result = result.filter((l) => l.state === filters.state)
  }
  return result
}

export function createLeaveRequest(input: {
  employeeId: string
  type: LeaveType
  from: string
  to: string
  reason: string
}): LeaveRequest {
  const db = getDatabase()
  const days = datesBetween(input.from, input.to).filter(isWorkingDay).length
  const newLeave: LeaveRequest = {
    id: `lv-${Date.now()}`,
    employeeId: input.employeeId,
    type: input.type,
    from: input.from,
    to: input.to,
    days,
    reason: input.reason,
    state: "pending",
    submittedAt: new Date().toISOString(),
  }
  db.leaves.unshift(newLeave)
  db.lastUpdated = new Date().toISOString()
  return newLeave
}

export function reviewLeaveRequest(
  id: string,
  approve: boolean,
  reviewerId: string,
  comment: string,
): {
  leave: LeaveRequest | null
  updatedRecords?: AttendanceRecord[]
  updatedBalances?: LeaveBalance[]
} {
  const db = getDatabase()
  const lv = db.leaves.find((l) => l.id === id)
  if (!lv) return { leave: null }

  lv.state = approve ? "approved" : "rejected"
  lv.reviewedBy = reviewerId
  lv.reviewComment = comment

  const updatedRecords: AttendanceRecord[] = []
  if (approve) {
    const leaveDates = datesBetween(lv.from, lv.to).filter(isWorkingDay)
    leaveDates.forEach((date) => {
      const rec = upsertAttendance({
        employeeId: lv.employeeId,
        date,
        status: "leave",
        checkIn: null,
        checkOut: null,
        note: POLICY.leaveTypes[lv.type].label,
      })
      updatedRecords.push(rec)
    })

    if (lv.type !== "unpaid") {
      const paidType = lv.type as "casual" | "sick" | "earned"
      const bal = db.balances.find((b) => b.employeeId === lv.employeeId)
      if (bal) {
        bal[paidType] = Math.max(0, bal[paidType] - lv.days)
      }
    }
  }

  db.lastUpdated = new Date().toISOString()
  return { leave: lv, updatedRecords, updatedBalances: db.balances }
}

// --- Balances Operations ---

export function getLeaveBalances(employeeId?: string): LeaveBalance[] {
  const db = getDatabase()
  if (employeeId) {
    return db.balances.filter((b) => b.employeeId === employeeId)
  }
  return db.balances
}
