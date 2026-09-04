import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/server/auth"
import { RoleWorkspace } from "@/components/attendance/role-workspace"

export default async function EmployeePage() {
  const user = await getAuthUser()
  if (!user) {
    redirect("/login")
  }

  return <RoleWorkspace role="employee" />
}
