import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getAuthUser } from "@/lib/server/auth"
import { PortalShell } from "@/components/attendance/portal-shell"
import { StoreProvider } from "@/components/attendance/store"

export default async function PortalLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getAuthUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <StoreProvider initialRole={user.role}>
      <PortalShell user={user}>
        {children}
      </PortalShell>
    </StoreProvider>
  )
}
