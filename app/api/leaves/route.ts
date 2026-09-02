import { NextRequest, NextResponse } from "next/server"
import { createLeaveRequest, getLeaveRequests } from "@/lib/server/attendance-db"
import type { LeaveType } from "@/lib/attendance-data"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId") || undefined
  const state = searchParams.get("state") || undefined

  const leaves = getLeaveRequests({ employeeId, state })
  return NextResponse.json(leaves)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employeeId, type, from, to, reason } = body

    if (!employeeId || !type || !from || !to || !reason) {
      return NextResponse.json(
        { error: "Missing required fields for leave request" },
        { status: 400 },
      )
    }

    if (to < from) {
      return NextResponse.json(
        { error: "End date ('to') cannot be before start date ('from')" },
        { status: 400 },
      )
    }

    const leave = createLeaveRequest({
      employeeId,
      type: type as LeaveType,
      from,
      to,
      reason: reason.trim(),
    })

    return NextResponse.json(leave, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create leave request" },
      { status: 500 },
    )
  }
}
