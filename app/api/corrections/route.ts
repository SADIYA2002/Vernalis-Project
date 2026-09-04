import { NextRequest, NextResponse } from "next/server"
import { createCorrection, getCorrections } from "@/lib/server/attendance-db"
import { requireAuth, canAccessEmployeeData } from "@/lib/server/auth"
import { directReports, type AttendanceStatus } from "@/lib/attendance-data"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const user = auth.user
  const { searchParams } = new URL(req.url)
  const requestedEmployeeId = searchParams.get("employeeId") || undefined
  const state = searchParams.get("state") || undefined

  if (requestedEmployeeId) {
    if (!canAccessEmployeeData(user, requestedEmployeeId)) {
      return NextResponse.json(
        { error: "Forbidden: You cannot view corrections for this employee." },
        { status: 403 },
      )
    }
    const corrections = getCorrections({ employeeId: requestedEmployeeId, state })
    return NextResponse.json(corrections)
  }

  if (user.role === "employee") {
    const corrections = getCorrections({ employeeId: user.id, state })
    return NextResponse.json(corrections)
  }

  if (user.role === "manager") {
    const team = directReports(user.id)
    const allowedIds = new Set([user.id, ...team.map((t) => t.id)])
    const allCorrections = getCorrections({ state })
    return NextResponse.json(allCorrections.filter((c) => allowedIds.has(c.employeeId)))
  }

  // HR / Payroll
  const corrections = getCorrections({ state })
  return NextResponse.json(corrections)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const user = auth.user

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

    // Security check: You can only submit corrections for yourself
    if (user.role === "employee" && employeeId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only submit corrections for your own attendance." },
        { status: 403 },
      )
    }

    const correction = createCorrection({
      employeeId: user.role === "employee" ? user.id : employeeId,
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
