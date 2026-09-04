import { NextRequest, NextResponse } from "next/server"
import { getEmployees } from "@/lib/server/attendance-db"
import { requireAuth } from "@/lib/server/auth"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.errorResponse) return auth.errorResponse

  const user = auth.user
  const employees = await getEmployees()

  const canSeeSalaries = user.role === "hr" || user.role === "payroll"

  const sanitized = employees.map((emp) => {
    if (canSeeSalaries || emp.id === user.id) {
      return emp
    }
    return {
      ...emp,
      monthlySalary: 0,
    }
  })

  return NextResponse.json(sanitized)
}
