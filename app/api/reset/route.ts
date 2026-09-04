import { NextRequest, NextResponse } from "next/server"
import { resetDatabase } from "@/lib/server/attendance-db"
import { requireAuth } from "@/lib/server/auth"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ["hr"])
  if (auth.errorResponse) return auth.errorResponse

  const db = resetDatabase()
  return NextResponse.json({
    success: true,
    message: "Server database reset to initial demo state.",
    lastUpdated: db.lastUpdated,
  })
}
