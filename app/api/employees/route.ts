import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/server/attendance-db"

export async function GET() {
  const db = getDatabase()
  return NextResponse.json(db.employees)
}
