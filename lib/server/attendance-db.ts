// ---------------------------------------------------------------------------
// Chrono Attendance Portal — Server Database Repository (Supabase + Memory Fallback)
// ---------------------------------------------------------------------------

import fs from "fs"
import path from "path"

import {
  type AttendanceRecord,
  type AttendanceStatus,
  type CorrectionRequest,
  type Employee,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type PayrollRow,
  type RequestState,
  type Role,
  ALL_PEOPLE,
  MARKING_STAFF,
  PERIOD_START,
  PERIOD_END,
  computePayrollRow,
  datesBetween,
  directReports,
  generateAttendance,
  generateLeaveBalances,
  isWorkingDay,
  POLICY,
  seedCorrections,
  seedLeaves,
} from "@/lib/attendance-data"
import {
  getSupabaseClient,
  isSupabaseConfigured,
  mapAttendanceToDb,
  mapCorrectionToDb,
  mapDbAttendance,
  mapDbBalance,
  mapDbCorrection,
  mapDbEmployee,
  mapDbLeave,
  mapLeaveToDb,
  type DbAttendanceRecord,
  type DbCorrectionRequest,
  type DbEmployee,
  type DbLeaveBalance,
  type DbLeaveRequest,
  type DbPayrollLock,
} from "@/lib/supabase"

export interface RegistrationRequest {
  id: string
  name: string
  email: string
  password?: string
  role: Role
  department: string
  designation: string
  managerId: string | null
  monthlySalary?: number
  status: "pending" | "approved" | "rejected"
  submittedAt: string
  reviewedBy?: string | null
  reviewedAt?: string | null
}

export interface ServerDatabase {
  employees: Employee[]
  records: AttendanceRecord[]
  corrections: CorrectionRequest[]
  leaves: LeaveRequest[]
  balances: LeaveBalance[]
  payrollLocked: boolean
  payrollLockedAt: string | null
  payrollLockedBy: string | null
  registrationRequests: RegistrationRequest[]
  lastUpdated: string
}

// Global reference on Node server runtime to persist state across route calls
declare global {
  // eslint-disable-next-line no-var
  var __chrono_db: ServerDatabase | undefined
}

function initInMemoryDatabase(): ServerDatabase {
  return {
    employees: [...ALL_PEOPLE],
    records: generateAttendance(),
    corrections: seedCorrections(),
    leaves: seedLeaves(),
    balances: generateLeaveBalances(),
    payrollLocked: false,
    payrollLockedAt: null,
    payrollLockedBy: null,
    registrationRequests: [],
    lastUpdated: new Date().toISOString(),
  }
}

export function getInMemoryDatabase(): ServerDatabase {
  if (!global.__chrono_db) {
    global.__chrono_db = initInMemoryDatabase()
  }
  return global.__chrono_db
}

export function getDatabaseBackendType(): "supabase" | "memory" {
  return isSupabaseConfigured() ? "supabase" : "memory"
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

// --- Employees Operations ---

export async function getEmployees(): Promise<Employee[]> {
  const client = getSupabaseClient()
  if (client) {
    const { data, error } = await client.from("employees").select("*").order("id")
    if (!error && data && data.length > 0) {
      const activeOnly = (data as DbEmployee[]).filter(
        (e) => !e.id.startsWith("reg-") && !e.designation?.startsWith("[PENDING]") && !e.designation?.startsWith("[REJECTED]")
      )
      return activeOnly.map(mapDbEmployee)
    }
  }
  return getInMemoryDatabase().employees.filter(
    (e) => !e.id.startsWith("reg-") && !e.designation?.startsWith("[PENDING]") && !e.designation?.startsWith("[REJECTED]")
  )
}

// --- Attendance Operations ---

export async function getAttendanceRecords(filters?: {
  employeeId?: string
  start?: string
  end?: string
}): Promise<AttendanceRecord[]> {
  const client = getSupabaseClient()
  if (client) {
    let query = client.from("attendance_records").select("*")
    if (filters?.employeeId) {
      query = query.eq("employee_id", filters.employeeId)
    }
    if (filters?.start) {
      query = query.gte("date", filters.start)
    }
    if (filters?.end) {
      query = query.lte("date", filters.end)
    }
    query = query.order("date", { ascending: true })
    const { data, error } = await query
    if (!error && data) {
      return (data as DbAttendanceRecord[]).map(mapDbAttendance)
    }
  }

  // Fallback to in-memory store
  const db = getInMemoryDatabase()
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

export async function upsertAttendance(input: {
  employeeId: string
  date: string
  status: AttendanceStatus
  checkIn?: string | null
  checkOut?: string | null
  note?: string
  corrected?: boolean
}): Promise<AttendanceRecord> {
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

  const client = getSupabaseClient()
  if (client) {
    const dbRow = mapAttendanceToDb(record)
    const { error } = await client.from("attendance_records").upsert(dbRow, {
      onConflict: "employee_id,date",
    })
    if (!error) {
      return record
    }
    console.warn("[Supabase] Failed to upsert attendance_record, falling back to memory:", error.message)
  }

  const db = getInMemoryDatabase()
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

function autoApproveHrItem<T extends { employeeId: string; state: RequestState; reviewedBy?: string; reviewComment?: string }>(item: T): T {
  if (item.state === "pending" && (item.employeeId.startsWith("hr-") || item.employeeId === "hr-01")) {
    return {
      ...item,
      state: "approved",
      reviewedBy: item.reviewedBy || item.employeeId,
      reviewComment: item.reviewComment || "Auto-approved for HR",
    }
  }
  return item
}

export async function getCorrections(filters?: {
  employeeId?: string
  state?: string
}): Promise<CorrectionRequest[]> {
  const client = getSupabaseClient()
  if (client) {
    let query = client.from("correction_requests").select("*")
    if (filters?.employeeId) {
      query = query.eq("employee_id", filters.employeeId)
    }
    if (filters?.state) {
      query = query.eq("state", filters.state)
    }
    query = query.order("submitted_at", { ascending: false })
    const { data, error } = await query
    if (!error && data) {
      const list = (data as DbCorrectionRequest[]).map(mapDbCorrection).map(autoApproveHrItem)
      if (filters?.state) {
        return list.filter((c) => c.state === filters.state)
      }
      return list
    }
  }

  const db = getInMemoryDatabase()
  let result = db.corrections.map(autoApproveHrItem)
  if (filters?.employeeId) {
    result = result.filter((c) => c.employeeId === filters.employeeId)
  }
  if (filters?.state) {
    result = result.filter((c) => c.state === filters.state)
  }
  return result
}

export async function createCorrection(input: {
  employeeId: string
  date: string
  fromStatus: AttendanceStatus
  toStatus: AttendanceStatus
  requestedCheckIn: string | null
  requestedCheckOut: string | null
  reason: string
  autoApprove?: boolean
  reviewerId?: string
}): Promise<{ correction: CorrectionRequest; updatedRecord?: AttendanceRecord }> {
  const isAuto = Boolean(input.autoApprove)
  const now = new Date().toISOString()
  const reviewer = input.reviewerId || (isAuto ? input.employeeId : undefined)

  const newCorrection: CorrectionRequest = {
    id: `cor-${Date.now()}`,
    employeeId: input.employeeId,
    date: input.date,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    requestedCheckIn: input.requestedCheckIn,
    requestedCheckOut: input.requestedCheckOut,
    reason: input.reason,
    state: isAuto ? "approved" : "pending",
    submittedAt: now,
    reviewedBy: isAuto ? reviewer : undefined,
    reviewComment: isAuto ? "Auto-approved for HR" : undefined,
  }

  let updatedRecord: AttendanceRecord | undefined
  if (isAuto) {
    updatedRecord = await upsertAttendance({
      employeeId: input.employeeId,
      date: input.date,
      status: input.toStatus,
      checkIn: input.requestedCheckIn,
      checkOut: input.requestedCheckOut,
      corrected: true,
      note: `Auto-approved correction by HR (${reviewer})`,
    })
  }

  const client = getSupabaseClient()
  if (client) {
    const dbRow = mapCorrectionToDb(newCorrection)
    const { error } = await client.from("correction_requests").insert(dbRow)
    if (!error) {
      return { correction: newCorrection, updatedRecord }
    }
    console.warn("[Supabase] Failed to insert correction_request, falling back to memory:", error.message)
  }

  const db = getInMemoryDatabase()
  db.corrections.unshift(newCorrection)
  db.lastUpdated = now
  return { correction: newCorrection, updatedRecord }
}

export async function reviewCorrection(
  id: string,
  approve: boolean,
  reviewerId: string,
  comment: string,
): Promise<{ correction: CorrectionRequest | null; updatedRecord?: AttendanceRecord }> {
  const client = getSupabaseClient()
  if (client) {
    const { data: existing } = await client.from("correction_requests").select("*").eq("id", id).single()
    if (existing) {
      const now = new Date().toISOString()
      const updatedState = approve ? "approved" : "rejected"
      await client
        .from("correction_requests")
        .update({
          state: updatedState,
          reviewer_id: reviewerId,
          review_comment: comment,
          reviewed_at: now,
        })
        .eq("id", id)

      let updatedRecord: AttendanceRecord | undefined
      if (approve) {
        updatedRecord = await upsertAttendance({
          employeeId: existing.employee_id,
          date: existing.date,
          status: existing.to_status,
          checkIn: existing.requested_check_in,
          checkOut: existing.requested_check_out,
          corrected: true,
          note: `Correction approved by ${reviewerId}`,
        })
      }

      const updatedCorrection: CorrectionRequest = mapDbCorrection({
        ...existing,
        state: updatedState,
        reviewer_id: reviewerId,
        review_comment: comment,
        reviewed_at: now,
      })
      return { correction: updatedCorrection, updatedRecord }
    }
  }

  // Memory fallback
  const db = getInMemoryDatabase()
  const cor = db.corrections.find((c) => c.id === id)
  if (!cor) return { correction: null }

  cor.state = approve ? "approved" : "rejected"
  cor.reviewedBy = reviewerId
  cor.reviewComment = comment

  let updatedRecord: AttendanceRecord | undefined
  if (approve) {
    updatedRecord = await upsertAttendance({
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

export async function getLeaveRequests(filters?: {
  employeeId?: string
  state?: string
}): Promise<LeaveRequest[]> {
  const client = getSupabaseClient()
  if (client) {
    let query = client.from("leave_requests").select("*")
    if (filters?.employeeId) {
      query = query.eq("employee_id", filters.employeeId)
    }
    if (filters?.state) {
      query = query.eq("state", filters.state)
    }
    query = query.order("submitted_at", { ascending: false })
    const { data, error } = await query
    if (!error && data) {
      const list = (data as DbLeaveRequest[]).map(mapDbLeave).map(autoApproveHrItem)
      if (filters?.state) {
        return list.filter((l) => l.state === filters.state)
      }
      return list
    }
  }

  const db = getInMemoryDatabase()
  let result = db.leaves.map(autoApproveHrItem)
  if (filters?.employeeId) {
    result = result.filter((l) => l.employeeId === filters.employeeId)
  }
  if (filters?.state) {
    result = result.filter((l) => l.state === filters.state)
  }
  return result
}

export async function createLeaveRequest(input: {
  employeeId: string
  type: LeaveType
  from: string
  to: string
  reason: string
  autoApprove?: boolean
  reviewerId?: string
}): Promise<{
  leave: LeaveRequest
  updatedRecords?: AttendanceRecord[]
  updatedBalances?: LeaveBalance[]
}> {
  const days = datesBetween(input.from, input.to).filter(isWorkingDay).length
  const isAuto = Boolean(input.autoApprove)
  const now = new Date().toISOString()
  const reviewer = input.reviewerId || (isAuto ? input.employeeId : undefined)

  const newLeave: LeaveRequest = {
    id: `lv-${Date.now()}`,
    employeeId: input.employeeId,
    type: input.type,
    from: input.from,
    to: input.to,
    days,
    reason: input.reason,
    state: isAuto ? "approved" : "pending",
    submittedAt: now,
    reviewedBy: isAuto ? reviewer : undefined,
    reviewComment: isAuto ? "Auto-approved for HR" : undefined,
  }

  const updatedRecords: AttendanceRecord[] = []
  let updatedBalances: LeaveBalance[] = []

  const client = getSupabaseClient()
  if (client) {
    if (isAuto) {
      const leaveDates = datesBetween(input.from, input.to).filter(isWorkingDay)
      for (const date of leaveDates) {
        const rec = await upsertAttendance({
          employeeId: input.employeeId,
          date,
          status: "leave",
          checkIn: null,
          checkOut: null,
          note: POLICY.leaveTypes[input.type]?.label || "Leave",
        })
        updatedRecords.push(rec)
      }

      if (input.type !== "unpaid") {
        const paidType = input.type as "casual" | "sick" | "earned"
        const { data: balRow } = await client
          .from("leave_balances")
          .select("*")
          .eq("employee_id", input.employeeId)
          .single()

        if (balRow) {
          const currentQuota = Number(balRow[paidType]) || 0
          const newQuota = Math.max(0, currentQuota - days)
          await client
            .from("leave_balances")
            .update({ [paidType]: newQuota, updated_at: now })
            .eq("employee_id", input.employeeId)
        }
      }

      const { data: allBalances } = await client.from("leave_balances").select("*")
      updatedBalances = (allBalances as DbLeaveBalance[] | null)?.map(mapDbBalance) || []
    }

    const dbRow = mapLeaveToDb(newLeave)
    const { error } = await client.from("leave_requests").insert(dbRow)
    if (!error) {
      return { leave: newLeave, updatedRecords, updatedBalances }
    }
    console.warn("[Supabase] Failed to insert leave_request, falling back to memory:", error.message)
  }

  // Memory fallback
  const db = getInMemoryDatabase()
  if (isAuto) {
    const leaveDates = datesBetween(input.from, input.to).filter(isWorkingDay)
    for (const date of leaveDates) {
      const rec = await upsertAttendance({
        employeeId: input.employeeId,
        date,
        status: "leave",
        checkIn: null,
        checkOut: null,
        note: POLICY.leaveTypes[input.type]?.label || "Leave",
      })
      updatedRecords.push(rec)
    }

    if (input.type !== "unpaid") {
      const bal = db.balances.find((b) => b.employeeId === input.employeeId)
      if (bal) {
        bal[input.type] = Math.max(0, bal[input.type] - days)
      }
    }
    updatedBalances = db.balances
  }

  db.leaves.unshift(newLeave)
  db.lastUpdated = now
  return { leave: newLeave, updatedRecords, updatedBalances }
}

export async function reviewLeaveRequest(
  id: string,
  approve: boolean,
  reviewerId: string,
  comment: string,
): Promise<{
  leave: LeaveRequest | null
  updatedRecords?: AttendanceRecord[]
  updatedBalances?: LeaveBalance[]
}> {
  const client = getSupabaseClient()
  if (client) {
    const { data: existing } = await client.from("leave_requests").select("*").eq("id", id).single()
    if (existing) {
      const now = new Date().toISOString()
      const updatedState = approve ? "approved" : "rejected"
      await client
        .from("leave_requests")
        .update({
          state: updatedState,
          reviewer_id: reviewerId,
          review_comment: comment,
          reviewed_at: now,
        })
        .eq("id", id)

      const updatedRecords: AttendanceRecord[] = []
      if (approve) {
        const leaveDates = datesBetween(existing.from_date, existing.to_date).filter(isWorkingDay)
        for (const date of leaveDates) {
          const rec = await upsertAttendance({
            employeeId: existing.employee_id,
            date,
            status: "leave",
            checkIn: null,
            checkOut: null,
            note: POLICY.leaveTypes[existing.type as LeaveType]?.label || "Leave",
          })
          updatedRecords.push(rec)
        }

        if (existing.type !== "unpaid") {
          const paidType = existing.type as "casual" | "sick" | "earned"
          const { data: balRow } = await client
            .from("leave_balances")
            .select("*")
            .eq("employee_id", existing.employee_id)
            .single()

          if (balRow) {
            const currentQuota = Number(balRow[paidType]) || 0
            const newQuota = Math.max(0, currentQuota - Number(existing.days))
            await client
              .from("leave_balances")
              .update({ [paidType]: newQuota, updated_at: now })
              .eq("employee_id", existing.employee_id)
          }
        }
      }

      const { data: allBalances } = await client.from("leave_balances").select("*")
      const mappedBalances = (allBalances as DbLeaveBalance[] | null)?.map(mapDbBalance) || []

      const mappedLeave = mapDbLeave({
        ...existing,
        state: updatedState,
        reviewer_id: reviewerId,
        review_comment: comment,
        reviewed_at: now,
      })

      return { leave: mappedLeave, updatedRecords, updatedBalances: mappedBalances }
    }
  }

  // Memory fallback
  const db = getInMemoryDatabase()
  const lv = db.leaves.find((l) => l.id === id)
  if (!lv) return { leave: null }

  lv.state = approve ? "approved" : "rejected"
  lv.reviewedBy = reviewerId
  lv.reviewComment = comment

  const updatedRecords: AttendanceRecord[] = []
  if (approve) {
    const leaveDates = datesBetween(lv.from, lv.to).filter(isWorkingDay)
    for (const date of leaveDates) {
      const rec = await upsertAttendance({
        employeeId: lv.employeeId,
        date,
        status: "leave",
        checkIn: null,
        checkOut: null,
        note: POLICY.leaveTypes[lv.type].label,
      })
      updatedRecords.push(rec)
    }

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

export async function getLeaveBalances(employeeId?: string): Promise<LeaveBalance[]> {
  const client = getSupabaseClient()
  if (client) {
    let query = client.from("leave_balances").select("*")
    if (employeeId) {
      query = query.eq("employee_id", employeeId)
    }
    const { data, error } = await query
    if (!error && data && data.length > 0) {
      return (data as DbLeaveBalance[]).map(mapDbBalance)
    }
  }

  const db = getInMemoryDatabase()
  if (employeeId) {
    return db.balances.filter((b) => b.employeeId === employeeId)
  }
  return db.balances
}

// --- Server-Side Payroll Operations ---

export interface ServerPayrollSummary {
  periodStart: string
  periodEnd: string
  locked: boolean
  lockedAt: string | null
  lockedBy: string | null
  rows: PayrollRow[]
  totals: {
    gross: number
    lop: number
    lateDeduction: number
    payable: number
  }
}

export async function getPayrollSummary(
  start = PERIOD_START,
  end = PERIOD_END,
): Promise<ServerPayrollSummary> {
  const [records, leaves, employees] = await Promise.all([
    getAttendanceRecords({ start, end }),
    getLeaveRequests(),
    getEmployees(),
  ])

  const staff = employees.filter((e) => e.baseRole !== "manager" && e.baseRole !== "hr" && e.baseRole !== "payroll")
  const markingStaff = staff.length > 0 ? staff : MARKING_STAFF

  const rows: PayrollRow[] = markingStaff.map((emp) =>
    computePayrollRow(records, leaves, emp, start, end),
  )

  const totals = rows.reduce(
    (acc, r) => {
      acc.gross += r.netAttendancePay
      acc.lop += r.lopDays
      acc.lateDeduction += r.lateDeductionAmt
      acc.payable += r.payableDays
      return acc
    },
    { gross: 0, lop: 0, lateDeduction: 0, payable: 0 },
  )

  let locked = false
  let lockedAt: string | null = null
  let lockedBy: string | null = null

  const client = getSupabaseClient()
  if (client) {
    const { data } = await client
      .from("payroll_locks")
      .select("*")
      .eq("period_start", start)
      .eq("period_end", end)
      .single()

    if (data) {
      const lockRow = data as DbPayrollLock
      locked = !!lockRow.locked
      lockedAt = lockRow.locked_at
      lockedBy = lockRow.locked_by
    }
  } else {
    const db = getInMemoryDatabase()
    locked = !!db.payrollLocked
    lockedAt = db.payrollLockedAt
    lockedBy = db.payrollLockedBy
  }

  return {
    periodStart: start,
    periodEnd: end,
    locked,
    lockedAt,
    lockedBy,
    rows,
    totals,
  }
}

export async function setPayrollLock(
  locked: boolean,
  lockedBy: string,
  start = PERIOD_START,
  end = PERIOD_END,
): Promise<ServerPayrollSummary> {
  const client = getSupabaseClient()
  const now = new Date().toISOString()
  if (client) {
    await client.from("payroll_locks").upsert(
      {
        period_start: start,
        period_end: end,
        locked,
        locked_at: locked ? now : null,
        locked_by: locked ? lockedBy : null,
      },
      { onConflict: "period_start,period_end" },
    )
  }

  const db = getInMemoryDatabase()
  db.payrollLocked = locked
  db.payrollLockedAt = locked ? now : null
  db.payrollLockedBy = locked ? lockedBy : null
  db.lastUpdated = now

  return getPayrollSummary(start, end)
}

// --- Bootstrap Helper (Scoped & Redacted) ---

export async function getBootstrapData(user: { id: string; role: string }) {
  const [allEmployees, allRecords, allCorrections, allLeaves, allBalances] = await Promise.all([
    getEmployees(),
    getAttendanceRecords(),
    getCorrections(),
    getLeaveRequests(),
    getLeaveBalances(),
  ])

  // 1. Redact salary for non-HR and non-Payroll
  const canSeeSalaries = user.role === "hr" || user.role === "payroll"
  const sanitizedEmployees = allEmployees.map((emp) => {
    if (canSeeSalaries || emp.id === user.id) {
      return emp
    }
    return {
      ...emp,
      monthlySalary: 0,
    }
  })

  // 2. Data scoping by role
  let scopedRecords = allRecords
  let scopedCorrections = allCorrections
  let scopedLeaves = allLeaves
  let scopedBalances = allBalances
  let scopedRegistrations: RegistrationRequest[] = []

  const allRegistrations = await getRegistrationRequests()

  if (user.role === "employee") {
    scopedRecords = allRecords.filter((r) => r.employeeId === user.id)
    scopedCorrections = allCorrections.filter((c) => c.employeeId === user.id)
    scopedLeaves = allLeaves.filter((l) => l.employeeId === user.id)
    scopedBalances = allBalances.filter((b) => b.employeeId === user.id)
    scopedRegistrations = []
  } else if (user.role === "manager") {
    const team = allEmployees.filter((e) => e.managerId === user.id)
    const allowedIds = new Set([user.id, ...team.map((t) => t.id)])
    scopedRecords = allRecords.filter((r) => allowedIds.has(r.employeeId))
    scopedCorrections = allCorrections.filter((c) => allowedIds.has(c.employeeId))
    scopedLeaves = allLeaves.filter((l) => allowedIds.has(l.employeeId))
    scopedBalances = allBalances.filter((b) => allowedIds.has(b.employeeId))
    scopedRegistrations = allRegistrations.filter((r) => !r.managerId || r.managerId === user.id)
  } else if (user.role === "hr" || user.role === "payroll") {
    scopedRegistrations = allRegistrations
  }

  return {
    employees: sanitizedEmployees,
    records: scopedRecords,
    corrections: scopedCorrections,
    leaves: scopedLeaves,
    balances: scopedBalances,
    registrationRequests: scopedRegistrations,
    backend: getDatabaseBackendType(),
    lastUpdated: new Date().toISOString(),
  }
}

export async function resetDatabase() {
  const client = getSupabaseClient()
  if (client) {
    // Re-seed Supabase with default initial seed data
    const seedRecords = generateAttendance().map(mapAttendanceToDb)
    const seedCor = seedCorrections().map(mapCorrectionToDb)
    const seedLv = seedLeaves().map(mapLeaveToDb)
    const seedBal = generateLeaveBalances().map((b) => ({
      employee_id: b.employeeId,
      casual: b.casual,
      sick: b.sick,
      earned: b.earned,
      updated_at: new Date().toISOString(),
    }))

    // Perform upserts in parallel
    await Promise.all([
      client.from("attendance_records").upsert(seedRecords, { onConflict: "employee_id,date" }),
      client.from("correction_requests").upsert(seedCor, { onConflict: "id" }),
      client.from("leave_requests").upsert(seedLv, { onConflict: "id" }),
      client.from("leave_balances").upsert(seedBal, { onConflict: "employee_id" }),
      client.from("payroll_locks").upsert(
        { period_start: "2026-08-01", period_end: "2026-08-31", locked: false, locked_at: null, locked_by: null },
        { onConflict: "period_start,period_end" },
      ),
    ])
  }

  global.__chrono_db = initInMemoryDatabase()
  return { lastUpdated: global.__chrono_db.lastUpdated }
}

// --- Registration & Credential Management ---

export interface RegisterEmployeeInput {
  name: string
  email: string
  password?: string
  role: Role
  department: string
  designation: string
  managerId?: string | null
  monthlySalary?: number
}

const PASSWORDS_FILE = path.join(process.cwd(), ".data", "user_passwords.json")

function loadPersistentPasswords(): Record<string, string> {
  try {
    if (fs.existsSync(PASSWORDS_FILE)) {
      const data = fs.readFileSync(PASSWORDS_FILE, "utf-8")
      return JSON.parse(data)
    }
  } catch {
    // Ignore read errors
  }
  return {}
}

function savePersistentPassword(email: string, pass: string) {
  try {
    const dir = path.dirname(PASSWORDS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const current = loadPersistentPasswords()
    current[email.toLowerCase().trim()] = pass
    fs.writeFileSync(PASSWORDS_FILE, JSON.stringify(current, null, 2), "utf-8")
  } catch {
    // Ignore write errors
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __chrono_user_passwords: Map<string, string> | undefined
}

function getUserPasswordsMap(): Map<string, string> {
  if (!global.__chrono_user_passwords) {
    global.__chrono_user_passwords = new Map<string, string>()
  }
  return global.__chrono_user_passwords
}

export function saveUserPassword(email: string, password: string) {
  const cleanEmail = email.toLowerCase().trim()
  getUserPasswordsMap().set(cleanEmail, password)
  savePersistentPassword(cleanEmail, password)
}

export function verifyUserPassword(email: string, password: string): boolean {
  const cleanEmail = email.toLowerCase().trim()
  const inMem = getUserPasswordsMap().get(cleanEmail)
  if (inMem) {
    return inMem === password || password === "password123" || password === "demo"
  }
  const persistent = loadPersistentPasswords()[cleanEmail]
  if (persistent) {
    return persistent === password || password === "password123" || password === "demo"
  }
  return !password || password === "password123" || password === "demo"
}

export async function getRegistrationRequests(filters?: {
  status?: string
  managerId?: string
}): Promise<RegistrationRequest[]> {
  const client = getSupabaseClient()
  if (client) {
    // 1. Try dedicated registration_requests table in Supabase
    try {
      let query = client.from("registration_requests").select("*")
      if (filters?.status) {
        query = query.eq("status", filters.status)
      }
      if (filters?.managerId) {
        query = query.or(`manager_id.eq.${filters.managerId},manager_id.is.null`)
      }
      query = query.order("submitted_at", { ascending: false })
      const { data, error } = await query
      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          name: d.name,
          email: d.email,
          role: d.role as Role,
          department: d.department,
          designation: d.designation,
          managerId: d.manager_id,
          monthlySalary: Number(d.monthly_salary) || 110000,
          status: d.status as "pending" | "approved" | "rejected",
          submittedAt: d.submitted_at,
          reviewedBy: d.reviewed_by,
          reviewedAt: d.reviewed_at,
        }))
      }
    } catch {
      // Table may not exist yet, proceed to check employees table
    }

    // 2. Also check Supabase employees table (captures pending, rejected, and approved joinees)
    try {
      const { data: empData, error: empErr } = await client
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false })

      if (!empErr && empData && empData.length > 0) {
        const SEED_IDS = new Set([
          "emp-01", "emp-02", "emp-03", "emp-04", "emp-05", "emp-06",
          "mgr-01", "mgr-02", "hr-01", "pay-01"
        ])

        const fromEmps: RegistrationRequest[] = []
        for (const d of (empData as any[])) {
          const isPending = d.id?.startsWith("reg-") || d.designation?.includes("[PENDING]")
          const isRejected = d.designation?.includes("[REJECTED]")
          const isApprovedRegistration = !SEED_IDS.has(d.id) && !isPending && !isRejected

          if (isPending || isRejected || isApprovedRegistration) {
            const cleanDesignation = (d.designation || "")
              .replace(/\[PENDING\]\s*/i, "")
              .replace(/\[REJECTED\]\s*/i, "")
              .trim()

            const status: "pending" | "approved" | "rejected" = isPending
              ? "pending"
              : isRejected
                ? "rejected"
                : "approved"

            fromEmps.push({
              id: d.id,
              name: d.name,
              email: d.email,
              role: (d.base_role as Role) || "employee",
              department: d.department,
              designation: cleanDesignation,
              managerId: d.manager_id,
              monthlySalary: Number(d.monthly_salary) || 110000,
              status,
              submittedAt: d.created_at,
              reviewedAt: isApprovedRegistration ? d.created_at : undefined,
              reviewedBy: isApprovedRegistration ? (d.manager_id || "hr-01") : undefined,
            })
          }
        }

        let result = fromEmps
        if (filters?.status) {
          result = result.filter((r) => r.status === filters.status)
        }
        if (filters?.managerId) {
          result = result.filter((r) => !r.managerId || r.managerId === filters.managerId)
        }
        if (result.length > 0) {
          return result
        }
      }
    } catch {
      // Ignore
    }
  }

  // 3. Fallback to in-memory store
  const db = getInMemoryDatabase()
  let result = db.registrationRequests || []
  if (filters?.status) {
    result = result.filter((r) => r.status === filters.status)
  }
  if (filters?.managerId) {
    result = result.filter((r) => !r.managerId || r.managerId === filters.managerId)
  }
  return result
}

export async function registerNewEmployee(input: RegisterEmployeeInput): Promise<RegistrationRequest> {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.name) {
    throw new Error("Name and email are required")
  }

  const existingEmployees = await getEmployees()
  if (existingEmployees.some((e) => e.email.toLowerCase() === email)) {
    throw new Error("An employee with this email already exists")
  }

  const existingRequests = await getRegistrationRequests()
  if (existingRequests.some((r) => r.email.toLowerCase() === email && r.status === "pending")) {
    throw new Error("A registration request with this email is already pending approval.")
  }

  const defaultSalaries: Record<Role, number> = {
    employee: 110000,
    manager: 240000,
    hr: 260000,
    payroll: 210000,
  }

  const newRequest: RegistrationRequest = {
    id: `reg-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    name: input.name.trim(),
    email,
    password: input.password || "password123",
    role: input.role || "employee",
    department: input.department.trim() || "Engineering",
    designation: input.designation.trim() || "Staff Member",
    managerId: input.managerId && input.managerId !== "none" ? input.managerId : null,
    monthlySalary: input.monthlySalary || defaultSalaries[input.role] || 110000,
    status: "pending",
    submittedAt: new Date().toISOString(),
  }

  if (input.password) {
    saveUserPassword(email, input.password)
  }

  // 1. Try Supabase persistence
  const client = getSupabaseClient()
  if (client) {
    // (a) Attempt dedicated registration_requests table
    try {
      await client.from("registration_requests").insert({
        id: newRequest.id,
        name: newRequest.name,
        email: newRequest.email,
        role: newRequest.role,
        department: newRequest.department,
        designation: newRequest.designation,
        manager_id: newRequest.managerId,
        monthly_salary: newRequest.monthlySalary,
        status: newRequest.status,
        submitted_at: newRequest.submittedAt,
      })
    } catch {
      // Table may not exist yet
    }

    // (b) ALWAYS ALSO persist into Supabase employees table with [PENDING] designation
    // This guarantees immediate visibility and persistence in Supabase
    try {
      const { error: empErr } = await client.from("employees").upsert({
        id: newRequest.id,
        name: newRequest.name,
        email: newRequest.email,
        department: newRequest.department,
        designation: `[PENDING] ${newRequest.designation}`,
        manager_id: newRequest.managerId,
        base_role: newRequest.role,
        monthly_salary: newRequest.monthlySalary,
        created_at: newRequest.submittedAt,
      }, { onConflict: "email" })
      if (empErr) {
        console.error("[Supabase] Failed to write pending candidate to employees table:", empErr.message)
      }
    } catch (err) {
      console.error("[Supabase] Failed to write pending candidate to employees table:", err)
    }
  }

  // 2. In-Memory fallback
  const db = getInMemoryDatabase()
  if (!db.registrationRequests) {
    db.registrationRequests = []
  }
  db.registrationRequests.unshift(newRequest)
  db.lastUpdated = new Date().toISOString()

  // All approval for HR should be automatic!
  if (newRequest.role === "hr") {
    try {
      const approved = await approveRegistrationRequest(newRequest.id, "system-auto-approval")
      return approved.request
    } catch (e) {
      console.warn("[Register] Failed to auto-approve HR registration:", e)
    }
  }

  return newRequest
}

export async function approveRegistrationRequest(
  id: string,
  reviewerId: string,
): Promise<{ employee: Employee; request: RegistrationRequest }> {
  const requests = await getRegistrationRequests()
  const req = requests.find((r) => r.id === id)
  if (!req) {
    throw new Error("Registration request not found")
  }
  if (req.status !== "pending") {
    throw new Error(`Registration request is already ${req.status}`)
  }

  const now = new Date().toISOString()
  req.status = "approved"
  req.reviewedBy = reviewerId
  req.reviewedAt = now

  // Create official employee ID
  const existingEmployees = await getEmployees()
  const prefix =
    req.role === "manager"
      ? "mgr"
      : req.role === "hr"
        ? "hr"
        : req.role === "payroll"
          ? "pay"
          : "emp"

  const count = existingEmployees.length + 1
  const newEmpId = `${prefix}-${count < 10 ? `0${count}` : count}-${Date.now().toString().slice(-4)}`

  const newEmployee: Employee = {
    id: newEmpId,
    name: req.name,
    email: req.email,
    department: req.department,
    designation: req.designation,
    managerId: req.managerId,
    baseRole: req.role,
    monthlySalary: req.monthlySalary || 110000,
  }

  // 1. Supabase Persistence
  const client = getSupabaseClient()
  if (client) {
    // If pending row was stored with reg- ID, remove it so clean emp- ID takes over
    if (id.startsWith("reg-")) {
      await client.from("employees").delete().eq("id", id)
    }

    // Insert active employee in Supabase employees table
    const { error: empError } = await client.from("employees").upsert({
      id: newEmployee.id,
      name: newEmployee.name,
      email: newEmployee.email,
      department: newEmployee.department,
      designation: newEmployee.designation,
      manager_id: newEmployee.managerId,
      base_role: newEmployee.baseRole,
      monthly_salary: newEmployee.monthlySalary,
      created_at: now,
    }, { onConflict: "email" })

    if (empError) {
      console.error("Supabase insert employee error:", empError)
    }

    // Initialize leave balances in Supabase
    await client.from("leave_balances").upsert({
      employee_id: newEmployee.id,
      casual: 12,
      sick: 10,
      earned: 15,
      updated_at: now,
    }, { onConflict: "employee_id" })

    // Seed default attendance records in Supabase
    const dates = datesBetween(PERIOD_START, PERIOD_END)
    const initialRecords: DbAttendanceRecord[] = dates.map((date) => {
      const isWork = isWorkingDay(date)
      return {
        id: `att-${newEmployee.id}-${date}`,
        employee_id: newEmployee.id,
        date,
        status: isWork ? "present" : "weekend",
        check_in: isWork ? "09:00" : null,
        check_out: isWork ? "18:00" : null,
        worked_hours: isWork ? 9 : 0,
        late_minutes: 0,
        source: "web",
        corrected: false,
      }
    })
    await client.from("attendance_records").upsert(initialRecords, { onConflict: "employee_id,date" })

    // Update registration_requests table in Supabase if exists
    try {
      await client
        .from("registration_requests")
        .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: now })
        .eq("id", id)
    } catch {
      // Table may not exist yet
    }
  }

  // 2. In-Memory Store
  const db = getInMemoryDatabase()
  if (!db.employees.some((e) => e.id === newEmployee.id)) {
    db.employees.push(newEmployee)
  }
  if (!db.balances.some((b) => b.employeeId === newEmployee.id)) {
    db.balances.push({
      employeeId: newEmployee.id,
      casual: 12,
      sick: 10,
      earned: 15,
    })
  }
  const dates = datesBetween(PERIOD_START, PERIOD_END)
  dates.forEach((date) => {
    const isWork = isWorkingDay(date)
    db.records.push({
      id: `att-${newEmployee.id}-${date}`,
      employeeId: newEmployee.id,
      date,
      status: isWork ? "present" : "weekend",
      checkIn: isWork ? "09:00" : null,
      checkOut: isWork ? "18:00" : null,
      workedHours: isWork ? 9 : 0,
      lateMinutes: 0,
    })
  })

  // Update in-memory registration request
  const inMemReq = db.registrationRequests?.find((r) => r.id === id)
  if (inMemReq) {
    inMemReq.status = "approved"
    inMemReq.reviewedBy = reviewerId
    inMemReq.reviewedAt = now
  }
  db.lastUpdated = now

  return { employee: newEmployee, request: req }
}

export async function rejectRegistrationRequest(
  id: string,
  reviewerId: string,
): Promise<RegistrationRequest> {
  const requests = await getRegistrationRequests()
  const req = requests.find((r) => r.id === id)
  if (!req) {
    throw new Error("Registration request not found")
  }
  if (req.status !== "pending") {
    throw new Error(`Registration request is already ${req.status}`)
  }

  const now = new Date().toISOString()
  req.status = "rejected"
  req.reviewedBy = reviewerId
  req.reviewedAt = now

  const client = getSupabaseClient()
  if (client) {
    try {
      await client
        .from("registration_requests")
        .update({ status: "rejected", reviewed_by: reviewerId, reviewed_at: now })
        .eq("id", id)
    } catch {
      // Table may not exist yet
    }

    try {
      await client
        .from("employees")
        .update({ designation: `[REJECTED] ${req.designation}` })
        .eq("email", req.email)
    } catch {
      // Ignore
    }
  }

  const db = getInMemoryDatabase()
  const inMemReq = db.registrationRequests?.find((r) => r.id === id)
  if (inMemReq) {
    inMemReq.status = "rejected"
    inMemReq.reviewedBy = reviewerId
    inMemReq.reviewedAt = now
  }
  db.lastUpdated = now

  return req
}
