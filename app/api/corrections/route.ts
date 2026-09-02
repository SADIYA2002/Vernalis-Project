import { NextRequest, NextResponse } from "next/server"
import { createCorrection, getCorrections } from "@/lib/server/attendance-db"
import type { AttendanceStatus } from "@/lib/attendance-data"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId") || undefined
  const state = searchParams.get("state") || undefined

  const corrections = getCorrections({ employeeId, state })
  return NextResponse.json(corrections)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      employeeId,
      date,
      fromStatus,
      toStatus,
      requestedCheckIn,
      requestedCheckOut,
      reason,
    } = body

    if (!employeeId || !date || !fromStatus || !toStatus || !reason) {
      return NextResponse.json(
        { error: "Missing required fields for correction request" },
        { status: 400 },
      )
    }

    const correction = createCorrection({
      employeeId,
      date,
      fromStatus: fromStatus as AttendanceStatus,
      toStatus: toStatus as AttendanceStatus,
      requestedCheckIn: requestedCheckIn ?? null,
      requestedCheckOut: requestedCheckOut ?? null,
      reason: reason.trim(),
    })

    return NextResponse.json(correction, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create correction" },
      { status: 500 },
    )
  }
}
