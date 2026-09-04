import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/server/auth"
import { RoleWorkspace } from "@/components/attendance/role-workspace"

export default async function ManagerPage() {
  const user = await getAuthUser()
  if (!user) {
    redirect("/login")
  }

  // Server-side role gating: only Manager and HR are authorized
  if (user.role !== "manager" && user.role !== "hr") {
    redirect("/portal/unauthorized")
  }

  return <RoleWorkspace role="manager" />
}
