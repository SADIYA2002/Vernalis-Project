import { type NextRequest, NextResponse } from "next/server"
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  getRegistrationRequests,
} from "@/lib/server/attendance-db"
import { requireAuth } from "@/lib/server/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Only HR administrators are authorized to approve or reject registrations
  const auth = await requireAuth(req, ["hr"])
  if (auth.errorResponse) {
    return auth.errorResponse
  }

  const user = auth.user
  const { id } = await params

  try {
    const body = await req.json()
    const { action } = body

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'." },
        { status: 400 },
      )
    }

    const allRequests = await getRegistrationRequests()
    const target = allRequests.find((r) => r.id === id)

    if (!target) {
      return NextResponse.json({ error: "Registration request not found." }, { status: 404 })
    }

    if (action === "approve") {
      const result = await approveRegistrationRequest(id, user.id)
      return NextResponse.json({
        success: true,
        message: `Candidate ${target.name} approved and activated as ${target.role}.`,
        employee: result.employee,
        request: result.request,
      })
    } else {
      const rejectedReq = await rejectRegistrationRequest(id, user.id)
      return NextResponse.json({
        success: true,
        message: `Candidate ${target.name} registration has been rejected.`,
        request: rejectedReq,
      })
    }
  } catch (error: any) {
    console.error("Error processing registration action:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    )
  }
}
