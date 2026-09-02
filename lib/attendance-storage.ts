// ---------------------------------------------------------------------------
// Chrono Attendance Portal — Storage & Persistence Engine
// Provides structured schema, versioning, serialization, error recovery,
// cross-tab sync, and backup export/import for localStorage persistence.
// ---------------------------------------------------------------------------

import {
  type AttendanceRecord,
  type CorrectionRequest,
  type LeaveBalance,
  type LeaveRequest,
  type Role,
  generateAttendance,
  generateLeaveBalances,
  seedCorrections,
  seedLeaves,
} from "./attendance-data"

export const STORAGE_KEY = "chrono_attendance_v1"
export const STORAGE_VERSION = 1
export const STORAGE_EVENT_NAME = "chrono:storage-sync"

export interface UserSession {
  role: Role
  currentUserId: string
}

export interface ChronoStorageSchema {
  version: number
  updatedAt: string
  records: AttendanceRecord[]
  corrections: CorrectionRequest[]
  leaves: LeaveRequest[]
  balances: LeaveBalance[]
  session: UserSession
}

export function getDefaultSeedData(): ChronoStorageSchema {
  return {
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    records: generateAttendance(),
    corrections: seedCorrections(),
    leaves: seedLeaves(),
    balances: generateLeaveBalances(),
    session: {
      role: "employee",
      currentUserId: "emp-01",
    },
  }
}

function isValidSchema(data: unknown): data is ChronoStorageSchema {
  if (!data || typeof data !== "object") return false
  const d = data as Partial<ChronoStorageSchema>
  return (
    typeof d.version === "number" &&
    Array.isArray(d.records) &&
    Array.isArray(d.corrections) &&
    Array.isArray(d.leaves) &&
    Array.isArray(d.balances) &&
    typeof d.session === "object" &&
    d.session !== null &&
    typeof d.session.role === "string" &&
    typeof d.session.currentUserId === "string"
  )
}

export function loadStorage(): ChronoStorageSchema {
  if (typeof window === "undefined") {
    return getDefaultSeedData()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seed = getDefaultSeedData()
      saveStorage(seed)
      return seed
    }

    const parsed = JSON.parse(raw)
    if (isValidSchema(parsed) && parsed.version === STORAGE_VERSION) {
      return parsed
    }

    // Schema mismatch or corrupted data: fallback to initial seed
    console.warn("[ChronoStorage] Invalid or outdated storage schema. Resetting to initial seed.")
    const seed = getDefaultSeedData()
    saveStorage(seed)
    return seed
  } catch (err) {
    console.error("[ChronoStorage] Failed to load data from localStorage:", err)
    return getDefaultSeedData()
  }
}

export function saveStorage(data: ChronoStorageSchema): boolean {
  if (typeof window === "undefined") return false

  try {
    const payload: ChronoStorageSchema = {
      ...data,
      version: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    // Broadcast custom event for in-tab listeners if needed
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT_NAME, { detail: payload }))
    return true
  } catch (err) {
    console.error("[ChronoStorage] Failed to save data to localStorage:", err)
    return false
  }
}

export function resetStorage(): ChronoStorageSchema {
  const seed = getDefaultSeedData()
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT_NAME, { detail: seed }))
    } catch (err) {
      console.error("[ChronoStorage] Failed to reset storage in localStorage:", err)
    }
  }
  return seed
}

export function exportStorageJson(): string {
  const current = loadStorage()
  return JSON.stringify(current, null, 2)
}

export function importStorageJson(jsonString: string): { success: boolean; data?: ChronoStorageSchema; error?: string } {
  try {
    const parsed = JSON.parse(jsonString)
    if (!isValidSchema(parsed)) {
      return { success: false, error: "The selected file is not a valid Chrono attendance backup." }
    }
    const validatedData: ChronoStorageSchema = {
      ...parsed,
      version: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
    }
    saveStorage(validatedData)
    return { success: true, data: validatedData }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to parse JSON backup file." }
  }
}
