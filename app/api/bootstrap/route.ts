import { type NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/server/attendance-db"
import { requireAuth } from "@/lib/server/auth"
import { directReports } from "@/lib/attendance-data"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.errorResponse) {
    return auth.errorResponse
  }

  const user = auth.user
  const db = getDatabase()

  // 1. Redact salary for non-HR and non-Payroll
  const canSeeSalaries = user.role === "hr" || user.role === "payroll"
  const sanitizedEmployees = db.employees.map((emp) => {
    if (canSeeSalaries || emp.id === user.id) {
      return emp
    }
    return {
      ...emp,
      monthlySalary: 0,
    }
  })

  // 2. Data scoping by role
  let scopedRecords = db.records
  let scopedCorrections = db.corrections
  let scopedLeaves = db.leaves
  let scopedBalances = db.balances

  if (user.role === "employee") {
    scopedRecords = db.records.filter((r) => r.employeeId === user.id)
    scopedCorrections = db.corrections.filter((c) => c.employeeId === user.id)
    scopedLeaves = db.leaves.filter((l) => l.employeeId === user.id)
    scopedBalances = db.balances.filter((b) => b.employeeId === user.id)
  } else if (user.role === "manager") {
    const team = directReports(user.id)
    const allowedIds = new Set([user.id, ...team.map((t) => t.id)])
    scopedRecords = db.records.filter((r) => allowedIds.has(r.employeeId))
    scopedCorrections = db.corrections.filter((c) => allowedIds.has(c.employeeId))
    scopedLeaves = db.leaves.filter((l) => allowedIds.has(l.employeeId))
    scopedBalances = db.balances.filter((b) => allowedIds.has(b.employeeId))
  }
  // HR and Payroll receive all records

  return NextResponse.json({
    employees: sanitizedEmployees,
    records: scopedRecords,
    corrections: scopedCorrections,
    leaves: scopedLeaves,
    balances: scopedBalances,
    lastUpdated: db.lastUpdated,
  })
}
