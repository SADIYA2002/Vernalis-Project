import { NextRequest, NextResponse } from "next/server"
import { getLeaveRequests, reviewLeaveRequest } from "@/lib/server/attendance-db"
import { requireAuth, isDirectReport } from "@/lib/server/auth"

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req, ["manager", "hr"])
  if (auth.errorResponse) return auth.errorResponse

  const user = auth.user

  try {
    const { id } = await props.params
    const body = await req.json()
    const { approve, comment } = body

    if (typeof approve !== "boolean") {
      return NextResponse.json(
        { error: "Missing or invalid required field: approve (boolean)" },
        { status: 400 },
      )
    }

    // Verify target leave request exists
    const allLeaves = getLeaveRequests()
    const target = allLeaves.find((l) => l.id === id)
    if (!target) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // If manager, enforce that the requester is a direct report
    if (user.role === "manager" && !isDirectReport(user.id, target.employeeId)) {
      return NextResponse.json(
        { error: "Forbidden: You can only approve leave requests for your direct reports." },
        { status: 403 },
      )
    }

    // Set reviewerId strictly to authenticated user's ID
    const result = reviewLeaveRequest(id, approve, user.id, comment || "")
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to review leave request" },
      { status: 500 },
    )
  }
}
