import { NextRequest, NextResponse } from "next/server"
import { getAttendanceRecords, upsertAttendance } from "@/lib/server/attendance-db"
import { requireAuth, canAccessEmployeeData } from "@/lib/server/auth"
import { directReports, type AttendanceStatus } from "@/lib/attendance-data"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const user = auth.user
  const { searchParams } = new URL(req.url)
  const requestedEmployeeId = searchParams.get("employeeId") || undefined
  const start = searchParams.get("start") || undefined
  const end = searchParams.get("end") || undefined

  if (requestedEmployeeId) {
    if (!canAccessEmployeeData(user, requestedEmployeeId)) {
      return NextResponse.json(
        { error: "Forbidden: You cannot view attendance records for this employee." },
        { status: 403 },
      )
    }
    const records = await getAttendanceRecords({ employeeId: requestedEmployeeId, start, end })
    return NextResponse.json(records)
  }

  // If no specific employee requested, scope by role
  if (user.role === "employee") {
    const records = await getAttendanceRecords({ employeeId: user.id, start, end })
    return NextResponse.json(records)
  }

  if (user.role === "manager") {
    const team = directReports(user.id)
    const allowedIds = new Set([user.id, ...team.map((t) => t.id)])
    const allRecords = await getAttendanceRecords({ start, end })
    return NextResponse.json(allRecords.filter((r) => allowedIds.has(r.employeeId)))
  }

  // HR and Payroll can view all
  const records = await getAttendanceRecords({ start, end })
  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const user = auth.user

  try {
    const body = await req.json()
    const { employeeId, date, status, checkIn, checkOut, note } = body

    if (!employeeId || !date || !status) {
      return NextResponse.json(
        { error: "Missing required fields: employeeId, date, status" },
        { status: 400 },
      )
    }

    // Security check: Employee can only mark attendance for themselves
    if (user.role === "employee" && employeeId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only mark attendance for your own account." },
        { status: 403 },
      )
    }

    const record = await upsertAttendance({
      employeeId: user.role === "employee" ? user.id : employeeId,
      date,
      status: status as AttendanceStatus,
      checkIn,
      checkOut,
      note,
    })

    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save attendance" },
      { status: 500 },
    )
  }
}
