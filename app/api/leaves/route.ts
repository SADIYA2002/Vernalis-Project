import { NextRequest, NextResponse } from "next/server"
import { createLeaveRequest, getLeaveRequests } from "@/lib/server/attendance-db"
import { requireAuth, canAccessEmployeeData } from "@/lib/server/auth"
import { directReports, type LeaveType } from "@/lib/attendance-data"

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
        { error: "Forbidden: You cannot view leaves for this employee." },
        { status: 403 },
      )
    }
    const leaves = getLeaveRequests({ employeeId: requestedEmployeeId, state })
    return NextResponse.json(leaves)
  }

  if (user.role === "employee") {
    const leaves = getLeaveRequests({ employeeId: user.id, state })
    return NextResponse.json(leaves)
  }

  if (user.role === "manager") {
    const team = directReports(user.id)
    const allowedIds = new Set([user.id, ...team.map((t) => t.id)])
    const allLeaves = getLeaveRequests({ state })
    return NextResponse.json(allLeaves.filter((l) => allowedIds.has(l.employeeId)))
  }

  // HR / Payroll
  const leaves = getLeaveRequests({ state })
  return NextResponse.json(leaves)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const user = auth.user

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

    // Security check: You can only submit leave requests for yourself
    if (user.role === "employee" && employeeId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only apply for leave for your own account." },
        { status: 403 },
      )
    }

    const leave = createLeaveRequest({
      employeeId: user.role === "employee" ? user.id : employeeId,
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
