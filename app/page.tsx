import { redirect } from "next/navigation"
import { getAuthUser } from "@/lib/server/auth"

export default async function RootPage() {
  const user = await getAuthUser()

  if (!user) {
    redirect("/login")
  }

  // Redirect to primary workspace based on verified server role
  if (user.role === "payroll") {
    redirect("/portal/payroll")
  }
  if (user.role === "hr") {
    redirect("/portal/hr")
  }
  if (user.role === "manager") {
    redirect("/portal/manager")
  }

  redirect("/portal/employee")
}
