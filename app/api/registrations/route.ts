import { type NextRequest, NextResponse } from "next/server"
import { getRegistrationRequests } from "@/lib/server/attendance-db"
import { requireAuth } from "@/lib/server/auth"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ["hr", "manager", "payroll"])
  if (auth.errorResponse) {
    return auth.errorResponse
  }

  const user = auth.user
  const requests = await getRegistrationRequests({
    managerId: user.role === "manager" ? user.id : undefined,
  })

  return NextResponse.json(requests)
}
