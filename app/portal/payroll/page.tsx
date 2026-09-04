import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/server/auth"
import { RoleWorkspace } from "@/components/attendance/role-workspace"

export default async function PayrollPage() {
  const user = await getAuthUser()
  if (!user) {
    redirect("/login")
  }

  // Server-side role gating: only Payroll and HR are authorized
  if (user.role !== "payroll" && user.role !== "hr") {
    redirect("/portal/unauthorized")
  }

  return <RoleWorkspace role="payroll" />
}
