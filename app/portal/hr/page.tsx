import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/server/auth"
import { RoleWorkspace } from "@/components/attendance/role-workspace"

export default async function HrPage() {
  const user = await getAuthUser()
  if (!user) {
    redirect("/login")
  }

  // Server-side role gating: only HR is authorized
  if (user.role !== "hr") {
    redirect("/portal/unauthorized")
  }

  return <RoleWorkspace role="hr" />
}
