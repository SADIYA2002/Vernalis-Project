"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signIn, signOut, useSession } from "next-auth/react"
import {
  CalendarCheck,
  HardDrive,
  Database,
  Download,
  Upload,
  RotateCcw,
  X,
  LogOut,
  UserCheck,
  Shield,
  Layers,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type Role } from "@/lib/attendance-data"
import { useStore } from "./store"
import { Avatar } from "./ui"
import type { AuthenticatedUser } from "@/lib/server/auth"

const WORKSPACES: { id: Role; label: string; href: string; blurb: string; allowedRoles: Role[] }[] = [
  {
    id: "employee",
    label: "Employee",
    href: "/portal/employee",
    blurb: "Mark & correct",
    allowedRoles: ["employee", "manager", "hr", "payroll"],
  },
  {
    id: "manager",
    label: "Manager",
    href: "/portal/manager",
    blurb: "Approve team",
    allowedRoles: ["manager", "hr"],
  },
  {
    id: "hr",
    label: "HR",
    href: "/portal/hr",
    blurb: "Analytics & register",
    allowedRoles: ["hr"],
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/portal/payroll",
    blurb: "Salary inputs",
    allowedRoles: ["payroll", "hr"],
  },
]

const DEMO_PERSONAS = [
  {
    name: "Sadiya Mulla",
    email: "sadiya.mulla@acme.co",
    role: "employee" as Role,
    roleLabel: "Employee",
    department: "Engineering",
    designation: "Software Engineer",
    badgeCls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  },
  {
    name: "Vikram Rao",
    email: "vikram.rao@acme.co",
    role: "manager" as Role,
    roleLabel: "Manager",
    department: "Engineering",
    designation: "Engineering Manager",
    badgeCls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  },
  {
    name: "Meera Joshi",
    email: "meera.joshi@acme.co",
    role: "hr" as Role,
    roleLabel: "HR",
    department: "Human Resources",
    designation: "HR Manager",
    badgeCls: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  },
  {
    name: "Sanjay Verma",
    email: "sanjay.verma@acme.co",
    role: "payroll" as Role,
    roleLabel: "Payroll",
    department: "Finance",
    designation: "Payroll Officer",
    badgeCls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
]

function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg",
            t.tone === "success" && "border-l-4 border-l-emerald-500",
            t.tone === "info" && "border-l-4 border-l-primary",
            t.tone === "warn" && "border-l-4 border-l-amber-500",
          )}
          role="status"
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            {t.description ? <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p> : null}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="text-muted-foreground transition hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

function PersistenceMenu() {
  const { exportData, importData, resetData, backend } = useStore()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isSupabase = backend === "supabase"

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
        setConfirmReset(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        importData(content)
        setOpen(false)
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          setOpen((v) => !v)
          setConfirmReset(false)
        }}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-accent focus:outline-none"
        title={isSupabase ? "Connected to Supabase PostgreSQL cloud database" : "Data persistence (Supabase enabled)"}
      >
        <span
          className={cn(
            "flex size-2 rounded-full ring-2",
            isSupabase
              ? "bg-emerald-500 ring-emerald-500/20"
              : "bg-blue-500 ring-blue-500/20",
          )}
        />
        <HardDrive className="size-3.5 text-muted-foreground" />
        <span className="hidden sm:inline">{isSupabase ? "Supabase" : "Data"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          <div className="border-b border-border/80 px-2 pb-2 pt-1">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Database className="size-3.5 text-primary" /> Data Persistence
              </p>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                  isSupabase
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30",
                )}
              >
                {isSupabase ? "Supabase Cloud" : "In-Memory DB"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              {isSupabase
                ? "Connected to Supabase cloud PostgreSQL. Attendance and leaves persist to cloud tables."
                : "Running in-memory database. Add NEXT_PUBLIC_SUPABASE_URL to connect Supabase."}
            </p>
          </div>

          <div className="flex flex-col gap-0.5 py-1.5">
            <button
              onClick={() => {
                exportData()
                setOpen(false)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition hover:bg-accent"
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span>Export backup JSON</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition hover:bg-accent"
            >
              <Upload className="size-3.5 text-muted-foreground" />
              <span>Import backup JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="border-t border-border/80 pt-1.5">
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-destructive transition hover:bg-destructive/10"
              >
                <RotateCcw className="size-3.5 text-destructive" />
                <span>Reset to demo data</span>
              </button>
            ) : (
              <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-2">
                <p className="text-[11px] font-medium text-foreground">Restore initial demo state?</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      resetData()
                      setOpen(false)
                      setConfirmReset(false)
                    }}
                    className="flex-1 rounded-md bg-destructive px-2 py-1 text-center text-xs font-semibold text-destructive-foreground shadow-sm hover:opacity-90"
                  >
                    Yes, reset
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SwitchAccountModal({
  open,
  onClose,
  currentEmail,
}: {
  open: boolean
  onClose: () => void
  currentEmail: string
}) {
  const [switching, setSwitching] = useState<string | null>(null)

  if (!open) return null

  async function handleSwitch(email: string) {
    setSwitching(email)
    try {
      await signIn("credentials", {
        redirect: true,
        email,
        password: "password123",
        callbackUrl: "/",
      })
    } catch {
      setSwitching(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="size-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Switch Demo Account</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          Select a demo persona to test server-side role gating. Each switch creates a new cryptographically signed NextAuth session cookie.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {DEMO_PERSONAS.map((p) => {
            const isCurrent = p.email === currentEmail
            const isTarget = switching === p.email

            return (
              <button
                key={p.email}
                disabled={isCurrent || !!switching}
                onClick={() => handleSwitch(p.email)}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition",
                  isCurrent
                    ? "border-primary/50 bg-primary/5 cursor-default"
                    : "border-border bg-card/60 hover:border-primary/40 hover:bg-accent/50",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={p.name} className="size-8 text-xs shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground flex items-center gap-1.5">
                      {p.name}
                      {isCurrent && (
                        <span className="rounded bg-primary/20 px-1 py-0.2 text-[9px] font-medium text-primary">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.designation} · {p.department}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", p.badgeCls)}>
                    {p.roleLabel}
                  </span>
                  {isTarget && <Loader2 className="size-3.5 animate-spin text-primary" />}
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function PortalShell({
  user,
  children,
}: {
  user: AuthenticatedUser
  children: ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [switchOpen, setSwitchOpen] = useState(false)

  // Use session user or server-passed user
  const activeUser: AuthenticatedUser = (session?.user as AuthenticatedUser) || user

  // Filter workspaces permitted by the active user's role
  const permittedWorkspaces = WORKSPACES.filter((w) => w.allowedRoles.includes(activeUser.role))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Universal Top Header with Server-gated Workspace tabs and Identity */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-2.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Logo & Permitted Role Workspace Tabs */}
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-85">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <CalendarCheck className="size-4.5" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-tight text-foreground">Chrono</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Attendance</p>
              </div>
            </Link>

            {/* Role Workspaces Tabs — ONLY permitted workspaces are shown */}
            <nav className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
              {permittedWorkspaces.map((w) => {
                const active = pathname.startsWith(w.href)
                return (
                  <Link
                    key={w.id}
                    href={w.href}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "bg-background text-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                    )}
                  >
                    <span>{w.label}</span>
                    <span className="hidden text-[10px] text-muted-foreground md:inline">({w.blurb})</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right Header: Authenticated User pill, switch account modal, sign-out */}
          <div className="flex items-center justify-between gap-2.5 sm:justify-end">
            {/* Authenticated User pill */}
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-1.5 shadow-sm">
              <Avatar name={activeUser.name} className="size-7 text-xs bg-primary/10 text-primary" />
              <div className="hidden flex-col leading-tight sm:flex">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">{activeUser.name}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider",
                      activeUser.role === "employee" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                      activeUser.role === "manager" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      activeUser.role === "hr" && "bg-purple-500/10 text-purple-600 dark:text-purple-400",
                      activeUser.role === "payroll" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {activeUser.role}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{activeUser.designation}</span>
              </div>
            </div>

            {/* Switch Demo Persona Button */}
            <button
              onClick={() => setSwitchOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-accent"
              title="Switch demo persona (NextAuth)"
            >
              <UserCheck className="size-3.5 text-primary" />
              <span className="hidden md:inline">Switch Role</span>
            </button>

            {/* Persistence menu */}
            <PersistenceMenu />

            {/* Sign Out Button */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1.5 text-xs font-medium text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              title="Sign out of Chrono"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace View */}
      <div className="flex-1">{children}</div>

      <Toasts />
      <SwitchAccountModal
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        currentEmail={activeUser.email}
      />
    </div>
  )
}
