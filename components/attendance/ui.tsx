"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { STATUS_META, type AttendanceStatus, type RequestState } from "@/lib/attendance-data"

export function StatusBadge({ status, className }: { status: AttendanceStatus; className?: string }) {
  const m = STATUS_META[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        m.bg,
        m.fg,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </span>
  )
}

export function StateBadge({ state }: { state: RequestState }) {
  const map: Record<RequestState, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-status-half text-status-half-foreground" },
    approved: { label: "Approved", cls: "bg-status-present text-status-present-foreground" },
    rejected: { label: "Rejected", cls: "bg-status-absent text-status-absent-foreground" },
  }
  const m = map[state]
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", m.cls)}>{m.label}</span>
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: "primary" | "green" | "red" | "amber" | "sky"
  icon?: ReactNode
}) {
  const accentCls =
    accent === "green"
      ? "text-status-present-foreground"
      : accent === "red"
        ? "text-status-absent-foreground"
        : accent === "amber"
          ? "text-status-half-foreground"
          : accent === "sky"
            ? "text-status-wfh-foreground"
            : "text-primary"
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className={cn("opacity-70", accentCls)}>{icon}</span> : null}
      </div>
      <p className={cn("mt-3 font-mono text-3xl font-semibold tabular-nums", accentCls)}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="text-muted-foreground/60">{icon}</div> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}

export function PageHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
