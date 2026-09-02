// ---------------------------------------------------------------------------
// Chrono Attendance Portal — domain model, HR policy, and mock data generator.
// Attendance is a legal payroll record, so statuses, corrections and approvals
// are all modelled explicitly and every payroll figure is derived from records.
// ---------------------------------------------------------------------------

export type Role = "employee" | "manager" | "hr" | "payroll"

export type AttendanceStatus =
  | "present"
  | "half-day"
  | "late"
  | "wfh"
  | "leave"
  | "absent"
  | "holiday"
  | "weekend"

export type LeaveType = "casual" | "sick" | "earned" | "unpaid"

export type RequestState = "pending" | "approved" | "rejected"

export interface Employee {
  id: string
  name: string
  email: string
  department: string
  designation: string
  managerId: string | null
  baseRole: Role
  monthlySalary: number
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string // yyyy-mm-dd
  status: AttendanceStatus
  checkIn: string | null // "09:12"
  checkOut: string | null
  workedHours: number
  lateMinutes: number
  note?: string
  corrected?: boolean
}

export interface CorrectionRequest {
  id: string
  employeeId: string
  date: string
  fromStatus: AttendanceStatus
  toStatus: AttendanceStatus
  requestedCheckIn: string | null
  requestedCheckOut: string | null
  reason: string
  state: RequestState
  submittedAt: string
  reviewedBy?: string
  reviewComment?: string
}

export interface LeaveRequest {
  id: string
  employeeId: string
  type: LeaveType
  from: string
  to: string
  days: number
  reason: string
  state: RequestState
  submittedAt: string
  reviewedBy?: string
  reviewComment?: string
}

export interface LeaveBalance {
  employeeId: string
  casual: number
  sick: number
  earned: number
}

// --- HR POLICY -------------------------------------------------------------
// Policy first: this is the single source of truth the whole system enforces.

export const POLICY = {
  shiftStart: "09:00",
  shiftEnd: "18:00",
  graceMinutes: 15, // arrival up to 09:15 is on-time
  fullDayHours: 8, // worked hours (excludes 1h unpaid break)
  halfDayMinHours: 4, // 4–8 worked hours = half day
  lateToHalfDayRule: 3, // 3 late marks in a month = 0.5 day loss of pay
  workWeek: [1, 2, 3, 4, 5], // Mon–Fri (0 = Sunday)
  wfhPerMonthCap: 8,
  leaveTypes: {
    casual: { label: "Casual Leave (CL)", annualQuota: 12, paid: true },
    sick: { label: "Sick Leave (SL)", annualQuota: 10, paid: true },
    earned: { label: "Earned Leave (EL)", annualQuota: 15, paid: true },
    unpaid: { label: "Leave Without Pay (LWP)", annualQuota: 0, paid: false },
  } as Record<LeaveType, { label: string; annualQuota: number; paid: boolean }>,
  legal: [
    "Attendance is a statutory record and feeds directly into salary computation.",
    "Muster/attendance records must be retained for the period required by applicable labour law.",
    "Every correction is logged with requester, approver, timestamp and reason (audit trail).",
    "Deductions for absence follow the payment-of-wages principle: no arbitrary deductions.",
    "Overtime and weekly-off working are tracked separately from standard payable days.",
  ],
} as const

// The demo runs against a fixed "today" so generated data is stable.
export const TODAY = "2026-08-28"
export const PERIOD_START = "2026-08-01"
export const PERIOD_END = "2026-08-31"
export const HISTORY_START = "2026-07-01" // extra history for trend analytics

// --- ORG -------------------------------------------------------------------

export const EMPLOYEES: Employee[] = [
  { id: "mgr-01", name: "Vikram Rao", email: "vikram.rao@acme.co", department: "Engineering", designation: "Engineering Manager", managerId: "hr-01", baseRole: "manager", monthlySalary: 285000 },
  { id: "mgr-02", name: "Divya Kapoor", email: "divya.kapoor@acme.co", department: "Design & Sales", designation: "Team Lead", managerId: "hr-01", baseRole: "manager", monthlySalary: 240000 },
  { id: "emp-01", name: "Sadiya Mulla", email: "sadiya.mulla@acme.co", department: "Engineering", designation: "Software Engineer", managerId: "mgr-01", baseRole: "employee", monthlySalary: 120000 },
  { id: "emp-02", name: "Priya Nair", email: "priya.nair@acme.co", department: "Engineering", designation: "Senior Engineer", managerId: "mgr-01", baseRole: "employee", monthlySalary: 165000 },
  { id: "emp-03", name: "Rohan Gupta", email: "rohan.gupta@acme.co", department: "Engineering", designation: "QA Engineer", managerId: "mgr-01", baseRole: "employee", monthlySalary: 98000 },
  { id: "emp-04", name: "Sneha Iyer", email: "sneha.iyer@acme.co", department: "Design & Sales", designation: "Product Designer", managerId: "mgr-02", baseRole: "employee", monthlySalary: 110000 },
  { id: "emp-05", name: "Karan Mehta", email: "karan.mehta@acme.co", department: "Design & Sales", designation: "UX Researcher", managerId: "mgr-02", baseRole: "employee", monthlySalary: 105000 },
  { id: "emp-06", name: "Ananya Reddy", email: "ananya.reddy@acme.co", department: "Design & Sales", designation: "Account Executive", managerId: "mgr-02", baseRole: "employee", monthlySalary: 112000 },
]

export const HR_USER: Employee = {
  id: "hr-01", name: "Meera Joshi", email: "meera.joshi@acme.co", department: "Human Resources", designation: "HR Manager", managerId: null, baseRole: "hr", monthlySalary: 260000,
}
export const PAYROLL_USER: Employee = {
  id: "pay-01", name: "Sanjay Verma", email: "sanjay.verma@acme.co", department: "Finance", designation: "Payroll Officer", managerId: null, baseRole: "payroll", monthlySalary: 210000,
}

export const ALL_PEOPLE = [...EMPLOYEES, HR_USER, PAYROLL_USER]

export function getPerson(id: string): Employee | undefined {
  return ALL_PEOPLE.find((e) => e.id === id)
}

export function directReports(managerId: string): Employee[] {
  return EMPLOYEES.filter((e) => e.managerId === managerId)
}

// People who mark daily attendance (everyone except HR/payroll admins).
export const MARKING_STAFF = EMPLOYEES

// --- STATUS METADATA -------------------------------------------------------

export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; bg: string; fg: string; dot: string; countsAsPresent: boolean }
> = {
  present: { label: "Present", short: "P", bg: "bg-status-present", fg: "text-status-present-foreground", dot: "bg-emerald-500", countsAsPresent: true },
  "half-day": { label: "Half Day", short: "½", bg: "bg-status-half", fg: "text-status-half-foreground", dot: "bg-amber-500", countsAsPresent: true },
  late: { label: "Late", short: "L", bg: "bg-status-late", fg: "text-status-late-foreground", dot: "bg-orange-500", countsAsPresent: true },
  wfh: { label: "Work From Home", short: "WFH", bg: "bg-status-wfh", fg: "text-status-wfh-foreground", dot: "bg-sky-500", countsAsPresent: true },
  leave: { label: "On Leave", short: "LV", bg: "bg-status-leave", fg: "text-status-leave-foreground", dot: "bg-violet-500", countsAsPresent: false },
  absent: { label: "Absent", short: "A", bg: "bg-status-absent", fg: "text-status-absent-foreground", dot: "bg-red-500", countsAsPresent: false },
  holiday: { label: "Holiday", short: "H", bg: "bg-status-holiday", fg: "text-status-holiday-foreground", dot: "bg-slate-400", countsAsPresent: false },
  weekend: { label: "Weekend", short: "—", bg: "bg-status-holiday", fg: "text-status-holiday-foreground", dot: "bg-slate-300", countsAsPresent: false },
}

export const HOLIDAYS: Record<string, string> = {
  "2026-07-17": "Founder's Day",
  "2026-08-15": "Independence Day",
}

// --- DATE HELPERS ----------------------------------------------------------

export function datesBetween(start: string, end: string): string[] {
  const out: string[] = []
  const d = new Date(start + "T00:00:00")
  const last = new Date(end + "T00:00:00")
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function isWorkingDay(date: string): boolean {
  const day = new Date(date + "T00:00:00").getDay()
  return (POLICY.workWeek as readonly number[]).includes(day) && !HOLIDAYS[date]
}

export function baseStatusFor(date: string): AttendanceStatus | null {
  const day = new Date(date + "T00:00:00").getDay()
  if (HOLIDAYS[date]) return "holiday"
  if (!(POLICY.workWeek as readonly number[]).includes(day)) return "weekend"
  return null
}

export function formatDate(date: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", opts ?? { day: "2-digit", month: "short", year: "numeric" })
}

export function weekdayShort(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })
}

// --- SEEDED GENERATOR ------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pad(n: number) {
  return n.toString().padStart(2, "0")
}

function minutesToTime(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

// Each employee has a slightly different behavioural profile for realistic data.
const PROFILES: Record<string, { punctual: number; wfh: number; absent: number }> = {
  "emp-01": { punctual: 0.78, wfh: 0.12, absent: 0.03 },
  "emp-02": { punctual: 0.9, wfh: 0.18, absent: 0.02 },
  "emp-03": { punctual: 0.62, wfh: 0.08, absent: 0.06 },
  "emp-04": { punctual: 0.83, wfh: 0.15, absent: 0.03 },
  "emp-05": { punctual: 0.7, wfh: 0.1, absent: 0.05 },
  "emp-06": { punctual: 0.75, wfh: 0.2, absent: 0.04 },
  "mgr-01": { punctual: 0.94, wfh: 0.1, absent: 0.01 },
  "mgr-02": { punctual: 0.88, wfh: 0.12, absent: 0.02 },
}

export function generateAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = []
  const dates = datesBetween(HISTORY_START, TODAY)

  MARKING_STAFF.forEach((emp, idx) => {
    const profile = PROFILES[emp.id] ?? { punctual: 0.8, wfh: 0.1, absent: 0.03 }
    const rand = mulberry32(1000 + idx * 97)

    dates.forEach((date) => {
      const base = baseStatusFor(date)
      if (base) {
        records.push({
          id: `${emp.id}-${date}`,
          employeeId: emp.id,
          date,
          status: base,
          checkIn: null,
          checkOut: null,
          workedHours: 0,
          lateMinutes: 0,
        })
        return
      }

      const roll = rand()
      let status: AttendanceStatus
      if (roll < profile.absent) status = "absent"
      else if (roll < profile.absent + 0.05) status = "leave"
      else if (roll < profile.absent + 0.05 + 0.03) status = "half-day"
      else if (roll < profile.absent + 0.05 + 0.03 + profile.wfh) status = "wfh"
      else if (rand() > profile.punctual) status = "late"
      else status = "present"

      let checkIn: string | null = null
      let checkOut: string | null = null
      let workedHours = 0
      let lateMinutes = 0

      const shiftStartMin = 9 * 60
      if (status === "present" || status === "wfh") {
        const inMin = shiftStartMin - 5 + Math.floor(rand() * 18) // 08:55–09:13
        checkIn = minutesToTime(Math.max(inMin, 8 * 60 + 40))
        workedHours = 8 + Math.round(rand() * 10) / 10
        checkOut = minutesToTime(inMin + 60 + Math.round(workedHours * 60))
        lateMinutes = Math.max(0, inMin - shiftStartMin)
      } else if (status === "late") {
        const inMin = shiftStartMin + 20 + Math.floor(rand() * 70) // 09:20–10:30
        checkIn = minutesToTime(inMin)
        workedHours = 7 + Math.round(rand() * 12) / 10
        checkOut = minutesToTime(inMin + 60 + Math.round(workedHours * 60))
        lateMinutes = inMin - shiftStartMin
      } else if (status === "half-day") {
        const half = rand() > 0.5
        if (half) {
          checkIn = "09:05"
          workedHours = 4 + Math.round(rand() * 8) / 10
          checkOut = minutesToTime(9 * 60 + 5 + 60 + Math.round(workedHours * 60))
        } else {
          checkIn = "13:30"
          workedHours = 4 + Math.round(rand() * 6) / 10
          checkOut = minutesToTime(13 * 60 + 30 + Math.round(workedHours * 60))
        }
      }

      records.push({
        id: `${emp.id}-${date}`,
        employeeId: emp.id,
        date,
        status,
        checkIn,
        checkOut,
        workedHours: Math.round(workedHours * 10) / 10,
        lateMinutes,
      })
    })
  })

  return records
}

export function generateLeaveBalances(): LeaveBalance[] {
  return MARKING_STAFF.map((e, i) => ({
    employeeId: e.id,
    casual: POLICY.leaveTypes.casual.annualQuota - (2 + (i % 3)),
    sick: POLICY.leaveTypes.sick.annualQuota - (1 + (i % 2)),
    earned: POLICY.leaveTypes.earned.annualQuota - (3 + (i % 4)),
  }))
}

export function seedCorrections(): CorrectionRequest[] {
  return [
    {
      id: "cor-seed-1",
      employeeId: "emp-01",
      date: "2026-08-24",
      fromStatus: "late",
      toStatus: "present",
      requestedCheckIn: "09:05",
      requestedCheckOut: "18:20",
      reason: "Biometric device failed at gate; entered via reception log at 09:05.",
      state: "pending",
      submittedAt: "2026-08-25T09:12:00",
    },
    {
      id: "cor-seed-2",
      employeeId: "emp-03",
      date: "2026-08-20",
      fromStatus: "absent",
      toStatus: "wfh",
      requestedCheckIn: "09:10",
      requestedCheckOut: "18:30",
      reason: "Approved WFH over chat but forgot to mark attendance.",
      state: "pending",
      submittedAt: "2026-08-21T10:02:00",
    },
    {
      id: "cor-seed-3",
      employeeId: "emp-05",
      date: "2026-08-18",
      fromStatus: "half-day",
      toStatus: "present",
      requestedCheckIn: "09:00",
      requestedCheckOut: "18:15",
      reason: "Off-site client meeting in the morning, not a half day.",
      state: "pending",
      submittedAt: "2026-08-19T08:40:00",
    },
  ]
}

export function seedLeaves(): LeaveRequest[] {
  return [
    {
      id: "lv-seed-1",
      employeeId: "emp-02",
      type: "earned",
      from: "2026-09-07",
      to: "2026-09-09",
      days: 3,
      reason: "Family function out of town.",
      state: "pending",
      submittedAt: "2026-08-26T14:20:00",
    },
    {
      id: "lv-seed-2",
      employeeId: "emp-04",
      type: "sick",
      from: "2026-08-31",
      to: "2026-08-31",
      days: 1,
      reason: "Doctor appointment, viral fever.",
      state: "pending",
      submittedAt: "2026-08-27T18:05:00",
    },
    {
      id: "lv-seed-3",
      employeeId: "emp-06",
      type: "casual",
      from: "2026-09-14",
      to: "2026-09-14",
      days: 1,
      reason: "Personal errand.",
      state: "approved",
      submittedAt: "2026-08-22T11:00:00",
      reviewedBy: "mgr-02",
      reviewComment: "Approved.",
    },
  ]
}

// --- ANALYTICS / PAYROLL COMPUTATION --------------------------------------

export interface EmployeeMonthStats {
  employeeId: string
  workingDays: number
  present: number
  wfh: number
  late: number
  halfDays: number
  leave: number
  absent: number
  attendancePct: number // present-equivalent / working days
  avgWorkedHours: number
  totalLateMinutes: number
}

function inPeriod(date: string, start: string, end: string) {
  return date >= start && date <= end
}

export function computeMonthStats(
  records: AttendanceRecord[],
  employeeId: string,
  start = PERIOD_START,
  end = TODAY,
): EmployeeMonthStats {
  const recs = records.filter((r) => r.employeeId === employeeId && inPeriod(r.date, start, end))
  let workingDays = 0
  let present = 0
  let wfh = 0
  let late = 0
  let halfDays = 0
  let leave = 0
  let absent = 0
  let presentEquiv = 0
  let workedSum = 0
  let workedCount = 0
  let lateMin = 0

  for (const r of recs) {
    if (r.status === "weekend" || r.status === "holiday") continue
    workingDays++
    switch (r.status) {
      case "present":
        present++
        presentEquiv += 1
        break
      case "wfh":
        wfh++
        presentEquiv += 1
        break
      case "late":
        late++
        presentEquiv += 1
        break
      case "half-day":
        halfDays++
        presentEquiv += 0.5
        break
      case "leave":
        leave++
        break
      case "absent":
        absent++
        break
    }
    if (r.workedHours > 0) {
      workedSum += r.workedHours
      workedCount++
    }
    lateMin += r.lateMinutes
  }

  return {
    employeeId,
    workingDays,
    present,
    wfh,
    late,
    halfDays,
    leave,
    absent,
    attendancePct: workingDays ? Math.round((presentEquiv / workingDays) * 1000) / 10 : 0,
    avgWorkedHours: workedCount ? Math.round((workedSum / workedCount) * 10) / 10 : 0,
    totalLateMinutes: lateMin,
  }
}

export interface PayrollRow {
  employeeId: string
  workingDays: number
  payableDays: number
  lopDays: number // loss of pay
  paidLeaveDays: number
  unpaidLeaveDays: number
  lateMarks: number
  lateDeductionDays: number
  wfhDays: number
  perDay: number
  grossForDays: number
  lateDeductionAmt: number
  netAttendancePay: number
}

export function computePayrollRow(
  records: AttendanceRecord[],
  leaves: LeaveRequest[],
  emp: Employee,
  start = PERIOD_START,
  end = PERIOD_END,
): PayrollRow {
  const recs = records.filter((r) => r.employeeId === emp.id && inPeriod(r.date, start, end))
  let workingDays = 0
  let payable = 0
  let lop = 0
  let lateMarks = 0
  let wfhDays = 0
  let paidLeaveDays = 0
  let unpaidLeaveDays = 0

  // approved unpaid leave days in period
  const approvedUnpaid = leaves
    .filter((l) => l.employeeId === emp.id && l.type === "unpaid" && l.state === "approved")
    .reduce((s, l) => s + l.days, 0)

  for (const r of recs) {
    if (r.status === "weekend" || r.status === "holiday") continue
    workingDays++
    switch (r.status) {
      case "present":
      case "wfh":
      case "late":
        payable += 1
        if (r.status === "wfh") wfhDays++
        if (r.status === "late") lateMarks++
        break
      case "half-day":
        payable += 0.5
        lop += 0.5
        break
      case "leave":
        payable += 1 // treated as paid leave unless matched to LWP below
        paidLeaveDays += 1
        break
      case "absent":
        lop += 1
        break
    }
  }

  // Convert some paid-leave days to unpaid where LWP was approved.
  const unpaid = Math.min(approvedUnpaid, paidLeaveDays)
  paidLeaveDays -= unpaid
  unpaidLeaveDays = unpaid
  payable -= unpaid
  lop += unpaid

  const lateDeductionDays = Math.floor(lateMarks / POLICY.lateToHalfDayRule) * 0.5
  payable = Math.max(0, payable - lateDeductionDays)

  const daysInMonth = datesBetween(start, end).filter(isWorkingDay).length || 1
  const perDay = Math.round(emp.monthlySalary / daysInMonth)
  const grossForDays = Math.round(perDay * payable)
  const lateDeductionAmt = Math.round(perDay * lateDeductionDays)

  return {
    employeeId: emp.id,
    workingDays,
    payableDays: Math.round(payable * 10) / 10,
    lopDays: Math.round(lop * 10) / 10,
    paidLeaveDays,
    unpaidLeaveDays,
    lateMarks,
    lateDeductionDays,
    wfhDays,
    perDay,
    grossForDays,
    lateDeductionAmt,
    netAttendancePay: grossForDays,
  }
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
}
