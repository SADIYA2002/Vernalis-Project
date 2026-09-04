import { NextRequest, NextResponse } from "next/server"
import { getPayrollSummary, setPayrollLock } from "@/lib/server/attendance-db"
import { requireAuth } from "@/lib/server/auth"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ["payroll", "hr"])
  if (auth.errorResponse) return auth.errorResponse

  const { searchParams } = new URL(req.url)
  const start = searchParams.get("start") || undefined
  const end = searchParams.get("end") || undefined

  const summary = getPayrollSummary(start, end)
  return NextResponse.json(summary)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ["payroll", "hr"])
  if (auth.errorResponse) return auth.errorResponse

  const user = auth.user
  try {
    const body = await req.json()
    const { locked } = body

    if (typeof locked !== "boolean") {
      return NextResponse.json(
        { error: "Invalid field: 'locked' must be a boolean" },
        { status: 400 },
      )
    }

    const summary = setPayrollLock(locked, user.id)
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update payroll lock state" },
      { status: 500 },
    )
  }
}
