"use client"

import { useEffect, useState } from "react"
import {
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  Gauge,
  LayoutGrid,
  ListChecks,
  PlaneTakeoff,
  ScrollText,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { EMPLOYEES, HR_USER, PAYROLL_USER, getPerson, type Role } from "@/lib/attendance-data"
import { StoreProvider, usePendingCounts, useStore } from "./store"
import { Avatar } from "./ui"
import { EmployeeView } from "./views/employee-view"
import { ManagerView } from "./views/manager-view"
import { HrView } from "./views/hr-view"
import { PayrollView } from "./views/payroll-view"

const ROLES: { id: Role; label: string; blurb: string }[] = [
  { id: "employee", label: "Employee", blurb: "Mark & correct" },
  { id: "manager", label: "Manager", blurb: "Approve" },
  { id: "hr", label: "HR", blurb: "Analytics & admin" },
  { id: "payroll", label: "Payroll", blurb: "Salary inputs" },
]

type NavItem = { id: string; label: string; icon: typeof Gauge; badge?: "corrections" | "leaves" | "both" }

const NAV: Record<Role, NavItem[]> = {
  employee: [
    { id: "dashboard", label: "My Dashboard", icon: Gauge },
    { id: "mark", label: "Mark Attendance", icon: CalendarCheck },
    { id: "timesheet", label: "My Timesheet", icon: CalendarDays },
    { id: "corrections", label: "Corrections", icon: ClipboardCheck },
    { id: "leave", label: "Leave", icon: PlaneTakeoff },
  ],
  manager: [
    { id: "overview", label: "Team Overview", icon: LayoutGrid },
    { id: "approvals", label: "Approvals", icon: ListChecks, badge: "both" },
    { id: "team", label: "Team Timesheet", icon: Users },
  ],
  hr: [
    { id: "analytics", label: "Analytics", icon: Gauge },
    { id: "register", label: "Attendance Register", icon: CalendarDays },
    { id: "leave", label: "Leave Admin", icon: PlaneTakeoff },
    { id: "policy", label: "Policy & Legal", icon: ScrollText },
  ],
  payroll: [
    { id: "inputs", label: "Payroll Inputs", icon: FileSpreadsheet },
    { id: "register", label: "Attendance Register", icon: CalendarDays },
  ],
}

const DEFAULT_USER: Record<Role, string> = {
  employee: "emp-01",
  manager: "mgr-01",
  hr: HR_USER.id,
  payroll: PAYROLL_USER.id,
}

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

function Shell() {
  const { role, setRole, currentUserId, setCurrentUserId } = useStore()
  const pending = usePendingCounts()
  const [section, setSection] = useState<string>(NAV[role][0].id)

  const nav = NAV[role]
  const person = getPerson(currentUserId)

  function switchRole(next: Role) {
    setRole(next)
    setCurrentUserId(DEFAULT_USER[next])
    setSection(NAV[next][0].id)
  }

  // Keep the section valid if role changes elsewhere.
  useEffect(() => {
    if (!NAV[role].some((n) => n.id === section)) setSection(NAV[role][0].id)
  }, [role, section])

  function badgeCount(item: NavItem): number {
    if (item.badge === "corrections") return pending.corrections
    if (item.badge === "leaves") return pending.leaves
    if (item.badge === "both") return pending.corrections + pending.leaves
    return 0
  }

  const identityOptions =
    role === "employee"
      ? EMPLOYEES.filter((e) => e.baseRole === "employee")
      : role === "manager"
        ? EMPLOYEES.filter((e) => e.baseRole === "manager")
        : role === "hr"
          ? [HR_USER]
          : [PAYROLL_USER]

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <CalendarCheck className="size-4.5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Chrono</p>
            <p className="text-xs text-sidebar-foreground/60">Attendance Portal</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
            {ROLES.find((r) => r.id === role)?.label} workspace
          </p>
          {nav.map((item) => {
            const count = badgeCount(item)
            const active = section === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {count > 0 ? (
                  <span
                    className={cn(
                      "flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                      active ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <Avatar name={person?.name ?? "?"} className="bg-sidebar-accent text-sidebar-accent-foreground" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{person?.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{person?.designation}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Role switcher */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => switchRole(r.id)}
                  className={cn(
                    "flex flex-col items-start rounded-md px-3 py-1.5 text-left transition sm:flex-row sm:items-center sm:gap-2",
                    role === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className={cn("hidden text-xs sm:inline", role === r.id ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
                    {r.blurb}
                  </span>
                </button>
              ))}
            </div>

            {/* Identity selector for role */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Acting as</span>
              <select
                value={currentUserId}
                onChange={(e) => setCurrentUserId(e.target.value)}
                disabled={identityOptions.length <= 1}
                className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-70"
              >
                {identityOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · {o.department}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile nav */}
          <div className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:hidden">
            {nav.map((item) => {
              const count = badgeCount(item)
              return (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    section === item.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {count > 0 ? (
                    <span className="flex min-w-4 items-center justify-center rounded-full bg-background/25 px-1 text-xs">
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {role === "employee" && <EmployeeView section={section} />}
          {role === "manager" && <ManagerView section={section} />}
          {role === "hr" && <HrView section={section} />}
          {role === "payroll" && <PayrollView section={section} />}
        </main>
      </div>

      <Toasts />
    </div>
  )
}

export function AttendancePortal() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
