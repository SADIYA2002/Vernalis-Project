import { NextRequest, NextResponse } from "next/server"
import { getLeaveBalances } from "@/lib/server/attendance-db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId") || undefined

  const balances = getLeaveBalances(employeeId)
  return NextResponse.json(balances)
}
