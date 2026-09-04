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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getPerson, type Role } from "@/lib/attendance-data"
import { usePendingCounts, useStore } from "./store"
import { Avatar } from "./ui"
import { EmployeeView } from "./views/employee-view"
import { ManagerView } from "./views/manager-view"
import { HrView } from "./views/hr-view"
import { PayrollView } from "./views/payroll-view"

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

export function RoleWorkspace({ role }: { role: Role }) {
  const { currentUserId, setRole } = useStore()
  const pending = usePendingCounts()
  const nav = NAV[role]
  const [section, setSection] = useState<string>(nav[0].id)
  const person = getPerson(currentUserId)

  // Ensure active role in store matches the workspace
  useEffect(() => {
    setRole(role)
    if (!nav.some((n) => n.id === section)) {
      setSection(nav[0].id)
    }
  }, [role, section, nav, setRole])

  function badgeCount(item: NavItem): number {
    if (item.badge === "corrections") return pending.corrections
    if (item.badge === "leaves") return pending.leaves
    if (item.badge === "both") return pending.corrections + pending.leaves
    return 0
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      {/* Role Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex border-r border-sidebar-border">
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            {role.toUpperCase()} Workspace
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
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {count > 0 ? (
                  <span
                    className={cn(
                      "flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                      active
                        ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        {/* User Card in Sidebar */}
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

      {/* Main Workspace Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Navigation bar */}
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
          {nav.map((item) => {
            const count = badgeCount(item)
            const active = section === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <item.icon className="size-3.5" />
                <span>{item.label}</span>
                {count > 0 ? (
                  <span className="flex min-w-4 items-center justify-center rounded-full bg-background/20 px-1 text-[10px]">
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {role === "employee" && <EmployeeView section={section} />}
          {role === "manager" && <ManagerView section={section} />}
          {role === "hr" && <HrView section={section} />}
          {role === "payroll" && <PayrollView section={section} />}
        </main>
      </div>
    </div>
  )
}
