import { NextRequest, NextResponse } from "next/server"
import { reviewCorrection } from "@/lib/server/attendance-db"

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params
    const body = await req.json()
    const { approve, reviewerId, comment } = body

    if (typeof approve !== "boolean" || !reviewerId) {
      return NextResponse.json(
        { error: "Missing required fields: approve, reviewerId" },
        { status: 400 },
      )
    }

    const result = reviewCorrection(id, approve, reviewerId, comment || "")
    if (!result.correction) {
      return NextResponse.json({ error: "Correction request not found" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to review correction" },
      { status: 500 },
    )
  }
}
