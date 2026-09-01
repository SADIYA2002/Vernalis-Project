"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import {
  type AttendanceRecord,
  type AttendanceStatus,
  type CorrectionRequest,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type Role,
  datesBetween,
  generateAttendance,
  generateLeaveBalances,
  isWorkingDay,
  POLICY,
  seedCorrections,
  seedLeaves,
} from "@/lib/attendance-data"

interface Toast {
  id: number
  title: string
  description?: string
  tone: "success" | "info" | "warn"
}

interface StoreValue {
  role: Role
  setRole: (r: Role) => void
  currentUserId: string
  setCurrentUserId: (id: string) => void

  records: AttendanceRecord[]
  corrections: CorrectionRequest[]
  leaves: LeaveRequest[]
  balances: LeaveBalance[]

  toasts: Toast[]
  dismissToast: (id: number) => void

  markAttendance: (input: {
    employeeId: string
    date: string
    status: AttendanceStatus
    checkIn?: string | null
    checkOut?: string | null
  }) => void

  submitCorrection: (input: {
    employeeId: string
    date: string
    fromStatus: AttendanceStatus
    toStatus: AttendanceStatus
    requestedCheckIn: string | null
    requestedCheckOut: string | null
    reason: string
  }) => void
  reviewCorrection: (id: string, approve: boolean, reviewerId: string, comment: string) => void

  submitLeave: (input: {
    employeeId: string
    type: LeaveType
    from: string
    to: string
    reason: string
  }) => void
  reviewLeave: (id: string, approve: boolean, reviewerId: string, comment: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

function workedHoursFrom(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0
  const [ih, im] = checkIn.split(":").map(Number)
  const [oh, om] = checkOut.split(":").map(Number)
  const span = oh * 60 + om - (ih * 60 + im) - 60 // minus 1h break
  return Math.max(0, Math.round((span / 60) * 10) / 10)
}

function lateMinutesFrom(checkIn?: string | null): number {
  if (!checkIn) return 0
  const [ih, im] = checkIn.split(":").map(Number)
  return Math.max(0, ih * 60 + im - 9 * 60)
}

let toastSeq = 1

export function StoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("employee")
  const [currentUserId, setCurrentUserId] = useState<string>("emp-01")
  const [records, setRecords] = useState<AttendanceRecord[]>(() => generateAttendance())
  const [corrections, setCorrections] = useState<CorrectionRequest[]>(() => seedCorrections())
  const [leaves, setLeaves] = useState<LeaveRequest[]>(() => seedLeaves())
  const [balances, setBalances] = useState<LeaveBalance[]>(() => generateLeaveBalances())
  const [toasts, setToasts] = useState<Toast[]>([])

  function pushToast(title: string, description?: string, tone: Toast["tone"] = "success") {
    const id = toastSeq++
    setToasts((t) => [...t, { id, title, description, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }
  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id))
  }

  function upsertRecord(next: AttendanceRecord) {
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.employeeId === next.employeeId && r.date === next.date)
      if (idx === -1) return [...prev, next]
      const copy = prev.slice()
      copy[idx] = next
      return copy
    })
  }

  const value: StoreValue = {
    role,
    setRole,
    currentUserId,
    setCurrentUserId,
    records,
    corrections,
    leaves,
    balances,
    toasts,
    dismissToast,

    markAttendance({ employeeId, date, status, checkIn, checkOut }) {
      upsertRecord({
        id: `${employeeId}-${date}`,
        employeeId,
        date,
        status,
        checkIn: checkIn ?? null,
        checkOut: checkOut ?? null,
        workedHours: workedHoursFrom(checkIn, checkOut),
        lateMinutes: lateMinutesFrom(checkIn),
      })
      pushToast("Attendance marked", `Saved as ${status.replace("-", " ")} for ${date}.`)
    },

    submitCorrection(input) {
      const id = `cor-${Date.now()}`
      setCorrections((prev) => [
        {
          id,
          ...input,
          state: "pending",
          submittedAt: new Date().toISOString(),
        },
        ...prev,
      ])
      pushToast("Correction submitted", "Your manager will review the request.", "info")
    },

    reviewCorrection(id, approve, reviewerId, comment) {
      setCorrections((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, state: approve ? "approved" : "rejected", reviewedBy: reviewerId, reviewComment: comment }
            : c,
        ),
      )
      const cor = corrections.find((c) => c.id === id)
      if (approve && cor) {
        upsertRecord({
          id: `${cor.employeeId}-${cor.date}`,
          employeeId: cor.employeeId,
          date: cor.date,
          status: cor.toStatus,
          checkIn: cor.requestedCheckIn,
          checkOut: cor.requestedCheckOut,
          workedHours: workedHoursFrom(cor.requestedCheckIn, cor.requestedCheckOut),
          lateMinutes: lateMinutesFrom(cor.requestedCheckIn),
          corrected: true,
        })
      }
      pushToast(
        approve ? "Correction approved" : "Correction rejected",
        approve ? "The attendance record has been updated." : "The employee has been notified.",
        approve ? "success" : "warn",
      )
    },

    submitLeave({ employeeId, type, from, to, reason }) {
      const days = datesBetween(from, to).filter(isWorkingDay).length
      const id = `lv-${Date.now()}`
      setLeaves((prev) => [
        { id, employeeId, type, from, to, days, reason, state: "pending", submittedAt: new Date().toISOString() },
        ...prev,
      ])
      pushToast("Leave applied", `${days} working day(s) sent for approval.`, "info")
    },

    reviewLeave(id, approve, reviewerId, comment) {
      const lv = leaves.find((l) => l.id === id)
      setLeaves((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, state: approve ? "approved" : "rejected", reviewedBy: reviewerId, reviewComment: comment }
            : l,
        ),
      )
      if (approve && lv) {
        // Apply leave to attendance records for working days in range.
        datesBetween(lv.from, lv.to)
          .filter(isWorkingDay)
          .forEach((date) => {
            upsertRecord({
              id: `${lv.employeeId}-${date}`,
              employeeId: lv.employeeId,
              date,
              status: "leave",
              checkIn: null,
              checkOut: null,
              workedHours: 0,
              lateMinutes: 0,
              note: POLICY.leaveTypes[lv.type].label,
            })
          })
        // Deduct paid leave balance.
        if (lv.type !== "unpaid") {
          setBalances((prev) =>
            prev.map((b) => (b.employeeId === lv.employeeId ? { ...b, [lv.type]: b[lv.type] - lv.days } : b)),
          )
        }
      }
      pushToast(
        approve ? "Leave approved" : "Leave rejected",
        approve ? "Balances and attendance have been updated." : "The employee has been notified.",
        approve ? "success" : "warn",
      )
    },
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}

export function usePendingCounts() {
  const { corrections, leaves } = useStore()
  return useMemo(
    () => ({
      corrections: corrections.filter((c) => c.state === "pending").length,
      leaves: leaves.filter((l) => l.state === "pending").length,
    }),
    [corrections, leaves],
  )
}
