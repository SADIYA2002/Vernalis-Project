import { NextResponse } from "next/server"
import { resetDatabase } from "@/lib/server/attendance-db"

export async function POST() {
  const db = resetDatabase()
  return NextResponse.json({
    success: true,
    message: "Server database reset to initial demo state.",
    lastUpdated: db.lastUpdated,
  })
}
