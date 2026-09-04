import { type NextRequest, NextResponse } from "next/server"
import { getBootstrapData } from "@/lib/server/attendance-db"
import { requireAuth } from "@/lib/server/auth"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.errorResponse) {
    return auth.errorResponse
  }

  const data = await getBootstrapData(auth.user)
  return NextResponse.json(data)
}
