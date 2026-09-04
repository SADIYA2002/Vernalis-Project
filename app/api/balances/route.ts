import { NextRequest, NextResponse } from "next/server"
import { getLeaveBalances } from "@/lib/server/attendance-db"
import { requireAuth, canAccessEmployeeData } from "@/lib/server/auth"
import { directReports } from "@/lib/attendance-data"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const user = auth.user
  const { searchParams } = new URL(req.url)
  const requestedEmployeeId = searchParams.get("employeeId") || undefined

  if (requestedEmployeeId) {
    if (!canAccessEmployeeData(user, requestedEmployeeId)) {
      return NextResponse.json(
        { error: "Forbidden: You cannot view leave balances for this employee." },
        { status: 403 },
      )
    }
    const balances = getLeaveBalances(requestedEmployeeId)
    return NextResponse.json(balances)
  }

  if (user.role === "employee") {
    const balances = getLeaveBalances(user.id)
    return NextResponse.json(balances)
  }

  if (user.role === "manager") {
    const team = directReports(user.id)
    const allowedIds = new Set([user.id, ...team.map((t) => t.id)])
    const allBalances = getLeaveBalances()
    return NextResponse.json(allBalances.filter((b) => allowedIds.has(b.employeeId)))
  }

  // HR / Payroll
  const balances = getLeaveBalances()
  return NextResponse.json(balances)
}
