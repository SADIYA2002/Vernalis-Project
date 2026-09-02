import { NextRequest, NextResponse } from "next/server"
import { getAttendanceRecords, upsertAttendance } from "@/lib/server/attendance-db"
import type { AttendanceStatus } from "@/lib/attendance-data"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId") || undefined
  const start = searchParams.get("start") || undefined
  const end = searchParams.get("end") || undefined

  const records = getAttendanceRecords({ employeeId, start, end })
  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId, date, status, checkIn, checkOut, note } = body

    if (!employeeId || !date || !status) {
      return NextResponse.json(
        { error: "Missing required fields: employeeId, date, status" },
        { status: 400 },
      )
    }

    const record = upsertAttendance({
      employeeId,
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
