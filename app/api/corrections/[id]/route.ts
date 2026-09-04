import { NextRequest, NextResponse } from "next/server"
import { getCorrections, reviewCorrection } from "@/lib/server/attendance-db"
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

    // Verify the target correction exists
    const allCorrections = getCorrections()
    const target = allCorrections.find((c) => c.id === id)
    if (!target) {
      return NextResponse.json({ error: "Correction request not found" }, { status: 404 })
    }

    // If manager, enforce that the requester is a direct report
    if (user.role === "manager" && !isDirectReport(user.id, target.employeeId)) {
      return NextResponse.json(
        { error: "Forbidden: You can only approve corrections for your direct reports." },
        { status: 403 },
      )
    }

    // Set reviewerId strictly to the authenticated user's ID
    const result = reviewCorrection(id, approve, user.id, comment || "")
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to review correction" },
      { status: 500 },
    )
  }
}
