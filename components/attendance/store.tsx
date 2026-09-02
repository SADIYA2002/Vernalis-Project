"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  type AttendanceRecord,
  type AttendanceStatus,
  type CorrectionRequest,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type Role,
  datesBetween,
  isWorkingDay,
  POLICY,
} from "@/lib/attendance-data"
import {
  type ChronoStorageSchema,
  getDefaultSeedData,
  loadStorage,
  resetStorage,
  saveStorage,
  importStorageJson,
  STORAGE_KEY,
} from "@/lib/attendance-storage"

export interface Toast {
  id: number
  title: string
  description?: string
  tone: "success" | "info" | "warn"
}

export interface StoreValue {
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
  pushToast: (title: string, description?: string, tone?: Toast["tone"]) => void

  isLoaded: boolean
  resetData: () => void
  exportData: () => void
  importData: (jsonString: string) => boolean

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
  const seed = getDefaultSeedData()

  const [role, setRoleState] = useState<Role>(seed.session.role)
  const [currentUserId, setCurrentUserIdState] = useState<string>(seed.session.currentUserId)
  const [records, setRecords] = useState<AttendanceRecord[]>(seed.records)
  const [corrections, setCorrections] = useState<CorrectionRequest[]>(seed.corrections)
  const [leaves, setLeaves] = useState<LeaveRequest[]>(seed.leaves)
  const [balances, setBalances] = useState<LeaveBalance[]>(seed.balances)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on client mount (avoids Next.js SSR hydration mismatch)
  useEffect(() => {
    const data = loadStorage()
    setRoleState(data.session.role)
    setCurrentUserIdState(data.session.currentUserId)
    setRecords(data.records)
    setCorrections(data.corrections)
    setLeaves(data.leaves)
    setBalances(data.balances)
    setIsLoaded(true)
  }, [])

  // Cross-tab synchronization via browser storage events
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as ChronoStorageSchema
          if (parsed && Array.isArray(parsed.records)) {
            setRecords(parsed.records)
            setCorrections(parsed.corrections)
            setLeaves(parsed.leaves)
            setBalances(parsed.balances)
            if (parsed.session) {
              setRoleState(parsed.session.role)
              setCurrentUserIdState(parsed.session.currentUserId)
            }
          }
        } catch {
          // ignore corrupted cross-tab payload
        }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  function pushToast(title: string, description?: string, tone: Toast["tone"] = "success") {
    const id = toastSeq++
    setToasts((t) => [...t, { id, title, description, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }

  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id))
  }

  // Persist snapshot to storage helper
  function persistCurrent(overrides: Partial<ChronoStorageSchema> = {}) {
    saveStorage({
      version: 1,
      updatedAt: new Date().toISOString(),
      records: overrides.records ?? records,
      corrections: overrides.corrections ?? corrections,
      leaves: overrides.leaves ?? leaves,
      balances: overrides.balances ?? balances,
      session: overrides.session ?? { role, currentUserId },
    })
  }

  function setRole(nextRole: Role) {
    setRoleState(nextRole)
    persistCurrent({ session: { role: nextRole, currentUserId } })
  }

  function setCurrentUserId(nextUserId: string) {
    setCurrentUserIdState(nextUserId)
    persistCurrent({ session: { role, currentUserId: nextUserId } })
  }

  function upsertRecordAndPersist(next: AttendanceRecord) {
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.employeeId === next.employeeId && r.date === next.date)
      const nextRecords = idx === -1 ? [...prev, next] : prev.map((r, i) => (i === idx ? next : r))
      persistCurrent({ records: nextRecords })
      return nextRecords
    })
  }

  function resetData() {
    const seedData = resetStorage()
    setRoleState(seedData.session.role)
    setCurrentUserIdState(seedData.session.currentUserId)
    setRecords(seedData.records)
    setCorrections(seedData.corrections)
    setLeaves(seedData.leaves)
    setBalances(seedData.balances)
    pushToast("Data reset", "Restored all attendance and leave data to initial demo state.", "info")
  }

  function exportData() {
    try {
      const data = loadStorage()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `chrono-attendance-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      pushToast("Backup downloaded", "Attendance data snapshot exported successfully.", "success")
    } catch {
      pushToast("Export failed", "Could not export attendance data.", "warn")
    }
  }

  function importData(jsonString: string): boolean {
    const res = importStorageJson(jsonString)
    if (res.success && res.data) {
      setRoleState(res.data.session.role)
      setCurrentUserIdState(res.data.session.currentUserId)
      setRecords(res.data.records)
      setCorrections(res.data.corrections)
      setLeaves(res.data.leaves)
      setBalances(res.data.balances)
      pushToast("Backup restored", "Attendance records and leave requests successfully loaded.", "success")
      return true
    } else {
      pushToast("Import failed", res.error ?? "Invalid backup file format.", "warn")
      return false
    }
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
    pushToast,
    isLoaded,
    resetData,
    exportData,
    importData,

    markAttendance({ employeeId, date, status, checkIn, checkOut }) {
      upsertRecordAndPersist({
        id: `${employeeId}-${date}`,
        employeeId,
        date,
        status,
        checkIn: checkIn ?? null,
        checkOut: checkOut ?? null,
        workedHours: workedHoursFrom(checkIn, checkOut),
        lateMinutes: lateMinutesFrom(checkIn),
      })
      pushToast("Attendance marked", `Saved as ${status.replace("-", " ")} for ${date} (persisted).`)
    },

    submitCorrection(input) {
      const id = `cor-${Date.now()}`
      const newCorrection: CorrectionRequest = {
        id,
        ...input,
        state: "pending",
        submittedAt: new Date().toISOString(),
      }
      setCorrections((prev) => {
        const nextCorrections = [newCorrection, ...prev]
        persistCurrent({ corrections: nextCorrections })
        return nextCorrections
      })
      pushToast("Correction submitted", "Your manager will review the request.", "info")
    },

    reviewCorrection(id, approve, reviewerId, comment) {
      const nextCorrections = corrections.map((c) =>
        c.id === id
          ? { ...c, state: approve ? ("approved" as const) : ("rejected" as const), reviewedBy: reviewerId, reviewComment: comment }
          : c,
      )
      setCorrections(nextCorrections)

      let nextRecords = records
      const cor = corrections.find((c) => c.id === id)
      if (approve && cor) {
        const updatedRecord: AttendanceRecord = {
          id: `${cor.employeeId}-${cor.date}`,
          employeeId: cor.employeeId,
          date: cor.date,
          status: cor.toStatus,
          checkIn: cor.requestedCheckIn,
          checkOut: cor.requestedCheckOut,
          workedHours: workedHoursFrom(cor.requestedCheckIn, cor.requestedCheckOut),
          lateMinutes: lateMinutesFrom(cor.requestedCheckIn),
          corrected: true,
        }
        const idx = records.findIndex((r) => r.employeeId === updatedRecord.employeeId && r.date === updatedRecord.date)
        nextRecords = idx === -1 ? [...records, updatedRecord] : records.map((r, i) => (i === idx ? updatedRecord : r))
        setRecords(nextRecords)
      }

      persistCurrent({
        corrections: nextCorrections,
        records: nextRecords,
      })

      pushToast(
        approve ? "Correction approved" : "Correction rejected",
        approve ? "The attendance record has been updated and persisted." : "The employee has been notified.",
        approve ? "success" : "warn",
      )
    },

    submitLeave({ employeeId, type, from, to, reason }) {
      const days = datesBetween(from, to).filter(isWorkingDay).length
      const id = `lv-${Date.now()}`
      const newLeave: LeaveRequest = {
        id,
        employeeId,
        type,
        from,
        to,
        days,
        reason,
        state: "pending",
        submittedAt: new Date().toISOString(),
      }
      setLeaves((prev) => {
        const nextLeaves = [newLeave, ...prev]
        persistCurrent({ leaves: nextLeaves })
        return nextLeaves
      })
      pushToast("Leave applied", `${days} working day(s) sent for approval.`, "info")
    },

    reviewLeave(id, approve, reviewerId, comment) {
      const lv = leaves.find((l) => l.id === id)
      const nextLeaves = leaves.map((l) =>
        l.id === id
          ? { ...l, state: approve ? ("approved" as const) : ("rejected" as const), reviewedBy: reviewerId, reviewComment: comment }
          : l,
      )
      setLeaves(nextLeaves)

      let nextRecords = records
      let nextBalances = balances

      if (approve && lv) {
        // Apply leave to attendance records for working days in range
        const leaveDates = datesBetween(lv.from, lv.to).filter(isWorkingDay)
        const updatedRecords = [...records]

        leaveDates.forEach((date) => {
          const rec: AttendanceRecord = {
            id: `${lv.employeeId}-${date}`,
            employeeId: lv.employeeId,
            date,
            status: "leave",
            checkIn: null,
            checkOut: null,
            workedHours: 0,
            lateMinutes: 0,
            note: POLICY.leaveTypes[lv.type].label,
          }
          const idx = updatedRecords.findIndex((r) => r.employeeId === rec.employeeId && r.date === rec.date)
          if (idx === -1) updatedRecords.push(rec)
          else updatedRecords[idx] = rec
        })

        nextRecords = updatedRecords
        setRecords(nextRecords)

        // Deduct paid leave balance
        if (lv.type !== "unpaid") {
          const paidType = lv.type as "casual" | "sick" | "earned"
          nextBalances = balances.map((b) =>
            b.employeeId === lv.employeeId ? { ...b, [paidType]: Math.max(0, b[paidType] - lv.days) } : b,
          )
          setBalances(nextBalances)
        }
      }

      persistCurrent({
        leaves: nextLeaves,
        records: nextRecords,
        balances: nextBalances,
      })

      pushToast(
        approve ? "Leave approved" : "Leave rejected",
        approve ? "Balances and attendance have been updated and persisted." : "The employee has been notified.",
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
