import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/server/attendance-db"

export async function GET() {
  const db = getDatabase()
  return NextResponse.json({
    employees: db.employees,
    records: db.records,
    corrections: db.corrections,
    leaves: db.leaves,
    balances: db.balances,
    lastUpdated: db.lastUpdated,
  })
}
