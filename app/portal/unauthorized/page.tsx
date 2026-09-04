"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { ShieldAlert, ArrowLeft, LogOut, ArrowRight } from "lucide-react"

export default function UnauthorizedPage() {
  const { data: session } = useSession()

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm">
        <ShieldAlert className="size-8" />
      </div>

      <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        403 — Access Forbidden
      </h1>

      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your authenticated role (
        <span className="font-semibold uppercase text-foreground">
          {session?.user?.role || "user"}
        </span>
        ) does not possess server-side permissions to access this workspace.
      </p>

      <div className="mt-4 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground shadow-sm max-w-md">
        <p className="font-medium text-foreground">Server-Side Authorization Enforced</p>
        <p className="mt-1">
          Attendance records, team approvals, HR analytics, and payroll components are strictly
          restricted by legal privacy policies.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/portal/employee"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
        >
          <ArrowLeft className="size-4" /> Go to My Employee Portal
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
        >
          <LogOut className="size-4" /> Sign In as Different Role
        </button>
      </div>
    </div>
  )
}
