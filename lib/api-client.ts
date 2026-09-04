// ---------------------------------------------------------------------------
// Chrono Attendance Portal — Type-safe Backend API Client
// ---------------------------------------------------------------------------

import type {
  AttendanceRecord,
  AttendanceStatus,
  CorrectionRequest,
  Employee,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  PayrollRow,
} from "./attendance-data"

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

export interface BootstrapResponse {
  employees: Employee[]
  records: AttendanceRecord[]
  corrections: CorrectionRequest[]
  leaves: LeaveRequest[]
  balances: LeaveBalance[]
  backend?: "supabase" | "memory"
  lastUpdated: string
}

export interface ReviewCorrectionResponse {
  correction: CorrectionRequest
  updatedRecord?: AttendanceRecord
}

export interface ReviewLeaveResponse {
  leave: LeaveRequest
  updatedRecords: AttendanceRecord[]
  updatedBalances: LeaveBalance[]
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `HTTP ${res.status}: ${res.statusText}`)
  }

  return res.json()
}

export const apiClient = {
  async getBootstrap(): Promise<BootstrapResponse> {
    return request<BootstrapResponse>("/api/bootstrap")
  },

  async getEmployees(): Promise<Employee[]> {
    return request<Employee[]>("/api/employees")
  },

  async getAttendance(params?: {
    employeeId?: string
    start?: string
    end?: string
  }): Promise<AttendanceRecord[]> {
    const query = new URLSearchParams()
    if (params?.employeeId) query.set("employeeId", params.employeeId)
    if (params?.start) query.set("start", params.start)
    if (params?.end) query.set("end", params.end)
    const qs = query.toString() ? `?${query.toString()}` : ""
    return request<AttendanceRecord[]>(`/api/attendance${qs}`)
  },

  async markAttendance(input: {
    employeeId: string
    date: string
    status: AttendanceStatus
    checkIn?: string | null
    checkOut?: string | null
  }): Promise<AttendanceRecord> {
    return request<AttendanceRecord>("/api/attendance", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async getCorrections(params?: {
    employeeId?: string
    state?: string
  }): Promise<CorrectionRequest[]> {
    const query = new URLSearchParams()
    if (params?.employeeId) query.set("employeeId", params.employeeId)
    if (params?.state) query.set("state", params.state)
    const qs = query.toString() ? `?${query.toString()}` : ""
    return request<CorrectionRequest[]>(`/api/corrections${qs}`)
  },

  async submitCorrection(input: {
    employeeId: string
    date: string
    fromStatus: AttendanceStatus
    toStatus: AttendanceStatus
    requestedCheckIn: string | null
    requestedCheckOut: string | null
    reason: string
  }): Promise<CorrectionRequest> {
    return request<CorrectionRequest>("/api/corrections", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async reviewCorrection(
    id: string,
    input: { approve: boolean; reviewerId: string; comment: string },
  ): Promise<ReviewCorrectionResponse> {
    return request<ReviewCorrectionResponse>(`/api/corrections/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  },

  async getLeaves(params?: {
    employeeId?: string
    state?: string
  }): Promise<LeaveRequest[]> {
    const query = new URLSearchParams()
    if (params?.employeeId) query.set("employeeId", params.employeeId)
    if (params?.state) query.set("state", params.state)
    const qs = query.toString() ? `?${query.toString()}` : ""
    return request<LeaveRequest[]>(`/api/leaves${qs}`)
  },

  async submitLeave(input: {
    employeeId: string
    type: LeaveType
    from: string
    to: string
    reason: string
  }): Promise<LeaveRequest> {
    return request<LeaveRequest>("/api/leaves", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async reviewLeave(
    id: string,
    input: { approve: boolean; reviewerId: string; comment: string },
  ): Promise<ReviewLeaveResponse> {
    return request<ReviewLeaveResponse>(`/api/leaves/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  },

  async getBalances(employeeId?: string): Promise<LeaveBalance[]> {
    const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ""
    return request<LeaveBalance[]>(`/api/balances${qs}`)
  },

  async getPayroll(params?: { start?: string; end?: string }): Promise<ServerPayrollSummary> {
    const query = new URLSearchParams()
    if (params?.start) query.set("start", params.start)
    if (params?.end) query.set("end", params.end)
    const qs = query.toString() ? `?${query.toString()}` : ""
    return request<ServerPayrollSummary>(`/api/payroll${qs}`)
  },

  async setPayrollLock(locked: boolean): Promise<ServerPayrollSummary> {
    return request<ServerPayrollSummary>("/api/payroll", {
      method: "POST",
      body: JSON.stringify({ locked }),
    })
  },

  async resetServer(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>("/api/reset", {
      method: "POST",
    })
  },
}
