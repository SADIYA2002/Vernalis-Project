// ---------------------------------------------------------------------------
// Chrono Attendance Portal — Supabase Database Client & Mappers
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type {
  AttendanceRecord,
  AttendanceStatus,
  CorrectionRequest,
  Employee,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  RequestState,
  Role,
} from "./attendance-data"

export interface DbEmployee {
  id: string
  name: string
  email: string
  department: string
  designation: string
  manager_id: string | null
  base_role: Role
  monthly_salary: number
}

export interface DbAttendanceRecord {
  id: string
  employee_id: string
  date: string
  status: AttendanceStatus
  check_in: string | null
  check_out: string | null
  worked_hours: number
  late_minutes: number
  note?: string | null
  corrected: boolean
}

export interface DbCorrectionRequest {
  id: string
  employee_id: string
  date: string
  from_status: AttendanceStatus
  to_status: AttendanceStatus
  requested_check_in: string | null
  requested_check_out: string | null
  reason: string
  state: RequestState
  reviewer_id: string | null
  review_comment: string | null
  submitted_at: string
}

export interface DbLeaveRequest {
  id: string
  employee_id: string
  type: LeaveType
  from_date: string
  to_date: string
  days: number
  reason: string
  state: RequestState
  reviewer_id: string | null
  review_comment: string | null
  submitted_at: string
}

export interface DbLeaveBalance {
  employee_id: string
  casual: number
  sick: number
  earned: number
  updated_at?: string
}

export interface DbPayrollLock {
  period_start: string
  period_end: string
  locked: boolean
  locked_at: string | null
  locked_by: string | null
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey && supabaseUrl.startsWith("http"))
}

let cachedClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        persistSession: false,
      },
    })
  }
  return cachedClient
}

// --- Data Mappers ---

export function mapDbEmployee(row: DbEmployee): Employee {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department,
    designation: row.designation,
    managerId: row.manager_id,
    baseRole: row.base_role,
    monthlySalary: Number(row.monthly_salary) || 0,
  }
}

export function mapDbAttendance(row: DbAttendanceRecord): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    status: row.status,
    checkIn: row.check_in,
    checkOut: row.check_out,
    workedHours: Number(row.worked_hours) || 0,
    lateMinutes: Number(row.late_minutes) || 0,
    note: row.note ?? undefined,
    corrected: row.corrected,
  }
}

export function mapAttendanceToDb(r: AttendanceRecord): DbAttendanceRecord {
  return {
    id: r.id,
    employee_id: r.employeeId,
    date: r.date,
    status: r.status,
    check_in: r.checkIn,
    check_out: r.checkOut,
    worked_hours: r.workedHours,
    late_minutes: r.lateMinutes,
    note: r.note ?? null,
    corrected: Boolean(r.corrected),
  }
}

export function mapDbCorrection(row: DbCorrectionRequest): CorrectionRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    requestedCheckIn: row.requested_check_in,
    requestedCheckOut: row.requested_check_out,
    reason: row.reason,
    state: row.state,
    reviewedBy: row.reviewer_id ?? undefined,
    reviewComment: row.review_comment ?? undefined,
    submittedAt: row.submitted_at,
  }
}

export function mapCorrectionToDb(c: CorrectionRequest): DbCorrectionRequest {
  return {
    id: c.id,
    employee_id: c.employeeId,
    date: c.date,
    from_status: c.fromStatus,
    to_status: c.toStatus,
    requested_check_in: c.requestedCheckIn,
    requested_check_out: c.requestedCheckOut,
    reason: c.reason,
    state: c.state,
    reviewer_id: c.reviewedBy ?? null,
    review_comment: c.reviewComment ?? null,
    submitted_at: c.submittedAt,
  }
}

export function mapDbLeave(row: DbLeaveRequest): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    from: row.from_date,
    to: row.to_date,
    days: Number(row.days) || 0,
    reason: row.reason,
    state: row.state,
    reviewedBy: row.reviewer_id ?? undefined,
    reviewComment: row.review_comment ?? undefined,
    submittedAt: row.submitted_at,
  }
}

export function mapLeaveToDb(l: LeaveRequest): DbLeaveRequest {
  return {
    id: l.id,
    employee_id: l.employeeId,
    type: l.type,
    from_date: l.from,
    to_date: l.to,
    days: l.days,
    reason: l.reason,
    state: l.state,
    reviewer_id: l.reviewedBy ?? null,
    review_comment: l.reviewComment ?? null,
    submitted_at: l.submittedAt,
  }
}

export function mapDbBalance(row: DbLeaveBalance): LeaveBalance {
  return {
    employeeId: row.employee_id,
    casual: Number(row.casual) || 0,
    sick: Number(row.sick) || 0,
    earned: Number(row.earned) || 0,
  }
}

export function mapBalanceToDb(b: LeaveBalance): DbLeaveBalance {
  return {
    employee_id: b.employeeId,
    casual: b.casual,
    sick: b.sick,
    earned: b.earned,
    updated_at: new Date().toISOString(),
  }
}
