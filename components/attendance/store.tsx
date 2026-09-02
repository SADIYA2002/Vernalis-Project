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
import { apiClient } from "@/lib/api-client"

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
  resetData: () => Promise<void>
  exportData: () => void
  importData: (jsonString: string) => boolean

  markAttendance: (input: {
    employeeId: string
    date: string
    status: AttendanceStatus
    checkIn?: string | null
    checkOut?: string | null
  }) => Promise<void>

  submitCorrection: (input: {
    employeeId: string
    date: string
    fromStatus: AttendanceStatus
    toStatus: AttendanceStatus
    requestedCheckIn: string | null
    requestedCheckOut: string | null
    reason: string
  }) => Promise<void>

  reviewCorrection: (id: string, approve: boolean, reviewerId: string, comment: string) => Promise<void>

  submitLeave: (input: {
    employeeId: string
    type: LeaveType
    from: string
    to: string
    reason: string
  }) => Promise<void>

  reviewLeave: (id: string, approve: boolean, reviewerId: string, comment: string) => Promise<void>
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

  // Load from Backend API /api/bootstrap on client mount (with local storage fallback)
  useEffect(() => {
    let active = true
    async function loadInitialData() {
      // First load local storage cache so UI renders immediately
      const cached = loadStorage()
      if (active) {
        setRoleState(cached.session.role)
        setCurrentUserIdState(cached.session.currentUserId)
        setRecords(cached.records)
        setCorrections(cached.corrections)
        setLeaves(cached.leaves)
        setBalances(cached.balances)
        setIsLoaded(true)
      }

      // Then fetch latest from API route
      try {
        const bootstrap = await apiClient.getBootstrap()
        if (active && bootstrap) {
          setRecords(bootstrap.records)
          setCorrections(bootstrap.corrections)
          setLeaves(bootstrap.leaves)
          setBalances(bootstrap.balances)
          saveStorage({
            version: 1,
            updatedAt: bootstrap.lastUpdated,
            records: bootstrap.records,
            corrections: bootstrap.corrections,
            leaves: bootstrap.leaves,
            balances: bootstrap.balances,
            session: { role: cached.session.role, currentUserId: cached.session.currentUserId },
          })
        }
      } catch (err) {
        console.warn("[StoreProvider] Failed to fetch /api/bootstrap, using local cache:", err)
      }
    }

    loadInitialData()
    return () => {
      active = false
    }
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

  async function resetData() {
    try {
      await apiClient.resetServer()
    } catch {
      // server reset error
    }
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

    async markAttendance({ employeeId, date, status, checkIn, checkOut }) {
      const optimisticRecord: AttendanceRecord = {
        id: `${employeeId}-${date}`,
        employeeId,
        date,
        status,
        checkIn: checkIn ?? null,
        checkOut: checkOut ?? null,
        workedHours: workedHoursFrom(checkIn, checkOut),
        lateMinutes: lateMinutesFrom(checkIn),
      }

      setRecords((prev) => {
        const idx = prev.findIndex((r) => r.employeeId === employeeId && r.date === date)
        const nextRecords = idx === -1 ? [...prev, optimisticRecord] : prev.map((r, i) => (i === idx ? optimisticRecord : r))
        persistCurrent({ records: nextRecords })
        return nextRecords
      })
      pushToast("Attendance marked", `Saved as ${status.replace("-", " ")} for ${date}.`)

      try {
        const saved = await apiClient.markAttendance({ employeeId, date, status, checkIn, checkOut })
        setRecords((prev) => {
          const idx = prev.findIndex((r) => r.employeeId === employeeId && r.date === date)
          const nextRecords = idx === -1 ? [...prev, saved] : prev.map((r, i) => (i === idx ? saved : r))
          persistCurrent({ records: nextRecords })
          return nextRecords
        })
      } catch (err) {
        console.warn("[StoreProvider] API markAttendance error:", err)
      }
    },

    async submitCorrection(input) {
      const tempId = `cor-${Date.now()}`
      const optimisticCorrection: CorrectionRequest = {
        id: tempId,
        ...input,
        state: "pending",
        submittedAt: new Date().toISOString(),
      }

      setCorrections((prev) => {
        const nextCorrections = [optimisticCorrection, ...prev]
        persistCurrent({ corrections: nextCorrections })
        return nextCorrections
      })
      pushToast("Correction submitted", "Your manager will review the request.", "info")

      try {
        const created = await apiClient.submitCorrection(input)
        setCorrections((prev) => {
          const nextCorrections = prev.map((c) => (c.id === tempId ? created : c))
          persistCurrent({ corrections: nextCorrections })
          return nextCorrections
        })
      } catch (err) {
        console.warn("[StoreProvider] API submitCorrection error:", err)
      }
    },

    async reviewCorrection(id, approve, reviewerId, comment) {
      try {
        const res = await apiClient.reviewCorrection(id, { approve, reviewerId, comment })
        setCorrections((prev) => {
          const nextCorrections = prev.map((c) => (c.id === id ? res.correction : c))
          persistCurrent({ corrections: nextCorrections })
          return nextCorrections
        })

        if (res.updatedRecord) {
          setRecords((prev) => {
            const idx = prev.findIndex((r) => r.employeeId === res.updatedRecord!.employeeId && r.date === res.updatedRecord!.date)
            const nextRecords = idx === -1 ? [...prev, res.updatedRecord!] : prev.map((r, i) => (i === idx ? res.updatedRecord! : r))
            persistCurrent({ records: nextRecords })
            return nextRecords
          })
        }

        pushToast(
          approve ? "Correction approved" : "Correction rejected",
          approve ? "The attendance record has been updated on the server." : "The employee has been notified.",
          approve ? "success" : "warn",
        )
      } catch (err) {
        console.warn("[StoreProvider] API reviewCorrection error, falling back locally:", err)
        // Fallback local update
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
      }
    },

    async submitLeave({ employeeId, type, from, to, reason }) {
      const days = datesBetween(from, to).filter(isWorkingDay).length
      const tempId = `lv-${Date.now()}`
      const optimisticLeave: LeaveRequest = {
        id: tempId,
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
        const nextLeaves = [optimisticLeave, ...prev]
        persistCurrent({ leaves: nextLeaves })
        return nextLeaves
      })
      pushToast("Leave applied", `${days} working day(s) sent for approval.`, "info")

      try {
        const created = await apiClient.submitLeave({ employeeId, type, from, to, reason })
        setLeaves((prev) => {
          const nextLeaves = prev.map((l) => (l.id === tempId ? created : l))
          persistCurrent({ leaves: nextLeaves })
          return nextLeaves
        })
      } catch (err) {
        console.warn("[StoreProvider] API submitLeave error:", err)
      }
    },

    async reviewLeave(id, approve, reviewerId, comment) {
      try {
        const res = await apiClient.reviewLeave(id, { approve, reviewerId, comment })
        setLeaves((prev) => {
          const nextLeaves = prev.map((l) => (l.id === id ? res.leave : l))
          persistCurrent({ leaves: nextLeaves })
          return nextLeaves
        })

        if (res.updatedRecords && res.updatedRecords.length > 0) {
          setRecords((prev) => {
            const updated = [...prev]
            res.updatedRecords.forEach((rec) => {
              const idx = updated.findIndex((r) => r.employeeId === rec.employeeId && r.date === rec.date)
              if (idx === -1) updated.push(rec)
              else updated[idx] = rec
            })
            persistCurrent({ records: updated })
            return updated
          })
        }

        if (res.updatedBalances) {
          setBalances(res.updatedBalances)
          persistCurrent({ balances: res.updatedBalances })
        }

        pushToast(
          approve ? "Leave approved" : "Leave rejected",
          approve ? "Balances and attendance records updated on the server." : "The employee has been notified.",
          approve ? "success" : "warn",
        )
      } catch (err) {
        console.warn("[StoreProvider] API reviewLeave error, falling back locally:", err)
        // Fallback local update
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
      }
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
