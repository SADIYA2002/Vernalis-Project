// ---------------------------------------------------------------------------
// Chrono Attendance Portal — Server Database Repository (Supabase + Memory Fallback)
// ---------------------------------------------------------------------------

import {
  type AttendanceRecord,
  type AttendanceStatus,
  type CorrectionRequest,
  type Employee,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type PayrollRow,
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

export interface ServerDatabase {
  employees: Employee[]
  records: AttendanceRecord[]
  corrections: CorrectionRequest[]
  leaves: LeaveRequest[]
  balances: LeaveBalance[]
  payrollLocked: boolean
  payrollLockedAt: string | null
  payrollLockedBy: string | null
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
      return (data as DbEmployee[]).map(mapDbEmployee)
    }
  }
  return getInMemoryDatabase().employees
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
      return (data as DbCorrectionRequest[]).map(mapDbCorrection)
    }
  }

  const db = getInMemoryDatabase()
  let result = db.corrections
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
}): Promise<CorrectionRequest> {
  const newCorrection: CorrectionRequest = {
    id: `cor-${Date.now()}`,
    ...input,
    state: "pending",
    submittedAt: new Date().toISOString(),
  }

  const client = getSupabaseClient()
  if (client) {
    const dbRow = mapCorrectionToDb(newCorrection)
    const { error } = await client.from("correction_requests").insert(dbRow)
    if (!error) {
      return newCorrection
    }
    console.warn("[Supabase] Failed to insert correction_request, falling back to memory:", error.message)
  }

  const db = getInMemoryDatabase()
  db.corrections.unshift(newCorrection)
  db.lastUpdated = new Date().toISOString()
  return newCorrection
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
      return (data as DbLeaveRequest[]).map(mapDbLeave)
    }
  }

  const db = getInMemoryDatabase()
  let result = db.leaves
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
}): Promise<LeaveRequest> {
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

  const client = getSupabaseClient()
  if (client) {
    const dbRow = mapLeaveToDb(newLeave)
    const { error } = await client.from("leave_requests").insert(dbRow)
    if (!error) {
      return newLeave
    }
    console.warn("[Supabase] Failed to insert leave_request, falling back to memory:", error.message)
  }

  const db = getInMemoryDatabase()
  db.leaves.unshift(newLeave)
  db.lastUpdated = new Date().toISOString()
  return newLeave
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

  if (user.role === "employee") {
    scopedRecords = allRecords.filter((r) => r.employeeId === user.id)
    scopedCorrections = allCorrections.filter((c) => c.employeeId === user.id)
    scopedLeaves = allLeaves.filter((l) => l.employeeId === user.id)
    scopedBalances = allBalances.filter((b) => b.employeeId === user.id)
  } else if (user.role === "manager") {
    const team = directReports(user.id)
    const allowedIds = new Set([user.id, ...team.map((t) => t.id)])
    scopedRecords = allRecords.filter((r) => allowedIds.has(r.employeeId))
    scopedCorrections = allCorrections.filter((c) => allowedIds.has(c.employeeId))
    scopedLeaves = allLeaves.filter((l) => allowedIds.has(l.employeeId))
    scopedBalances = allBalances.filter((b) => allowedIds.has(b.employeeId))
  }

  return {
    employees: sanitizedEmployees,
    records: scopedRecords,
    corrections: scopedCorrections,
    leaves: scopedLeaves,
    balances: scopedBalances,
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
