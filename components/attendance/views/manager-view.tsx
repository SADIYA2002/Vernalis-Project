"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Inbox, Users, XCircle } from "lucide-react"
import {
  POLICY,
  STATUS_META,
  TODAY,
  computeMonthStats,
  directReports,
  formatDate,
  getPerson,
} from "@/lib/attendance-data"
import { useStore } from "../store"
import { Avatar, Card, CardHeader, EmptyState, PageHeading, StatTile, StatusBadge, inputCls } from "../ui"

export function ManagerView({ section }: { section: string }) {
  const { currentUserId } = useStore()
  const reports = useMemo(() => directReports(currentUserId), [currentUserId])
  if (section === "overview") return <Overview reports={reports} />
  if (section === "approvals") return <Approvals reports={reports} />
  if (section === "team") return <TeamTimesheet reports={reports} />
  return null
}

function Overview({ reports }: { reports: ReturnType<typeof directReports> }) {
  const { records } = useStore()
  const rows = reports.map((r) => ({ emp: r, stats: computeMonthStats(records, r.id) }))
  const avgPct = rows.length ? Math.round((rows.reduce((s, r) => s + r.stats.attendancePct, 0) / rows.length) * 10) / 10 : 0
  const totalAbsent = rows.reduce((s, r) => s + r.stats.absent, 0)
  const totalLate = rows.reduce((s, r) => s + r.stats.late, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Team overview" description="Attendance health for your direct reports — August 2026." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Team size" value={reports.length} icon={<Users className="size-4" />} />
        <StatTile label="Avg attendance" value={`${avgPct}%`} accent="green" />
        <StatTile label="Late marks" value={totalLate} accent="amber" />
        <StatTile label="Absences" value={totalAbsent} accent={totalAbsent > 0 ? "red" : "primary"} />
      </div>

      <Card>
        <CardHeader title="Direct reports" description="Sorted by attendance %" />
        <ul className="divide-y divide-border">
          {[...rows]
            .sort((a, b) => a.stats.attendancePct - b.stats.attendancePct)
            .map(({ emp, stats }) => (
              <li key={emp.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={emp.name} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.designation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Present</p>
                    <p className="font-mono text-sm font-semibold">{stats.present + stats.late}/{stats.workingDays}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Late</p>
                    <p className="font-mono text-sm font-semibold text-status-late-foreground">{stats.late}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Absent</p>
                    <p className="font-mono text-sm font-semibold text-status-absent-foreground">{stats.absent}</p>
                  </div>
                  <div className="w-28">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Attd.</span>
                      <span className="font-mono font-semibold">{stats.attendancePct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${stats.attendancePct >= 90 ? "bg-emerald-500" : stats.attendancePct >= 75 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${stats.attendancePct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  )
}

function ReviewActions({ onApprove, onReject }: { onApprove: (comment: string) => void; onReject: (comment: string) => void }) {
  const [comment, setComment] = useState("")
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment (optional)…"
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(comment || "Approved")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <CheckCircle2 className="size-4" /> Approve
        </button>
        <button
          onClick={() => onReject(comment || "Rejected")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          <XCircle className="size-4" /> Reject
        </button>
      </div>
    </div>
  )
}

function Approvals({ reports }: { reports: ReturnType<typeof directReports> }) {
  const { corrections, leaves, reviewCorrection, reviewLeave, currentUserId } = useStore()
  const reportIds = new Set(reports.map((r) => r.id))
  const pendingCor = corrections.filter((c) => reportIds.has(c.employeeId) && c.state === "pending")
  const pendingLv = leaves.filter((l) => reportIds.has(l.employeeId) && l.state === "pending")

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Approvals" description="Review correction and leave requests from your team. Approving a correction rewrites the attendance record; approving leave updates balances and payroll." />

      <Card>
        <CardHeader title="Correction requests" description={`${pendingCor.length} pending`} />
        {pendingCor.length === 0 ? (
          <EmptyState title="No pending corrections" icon={<Inbox className="size-8" />} />
        ) : (
          <ul className="divide-y divide-border">
            {pendingCor.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={getPerson(c.employeeId)?.name ?? "?"} />
                    <div>
                      <p className="text-sm font-medium">{getPerson(c.employeeId)?.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <StatusBadge status={c.fromStatus} />
                    <span className="text-muted-foreground">→</span>
                    <StatusBadge status={c.toStatus} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-foreground/80">{c.reason}</p>
                {c.requestedCheckIn ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">Requested: {c.requestedCheckIn} – {c.requestedCheckOut}</p>
                ) : null}
                <ReviewActions
                  onApprove={(comment) => reviewCorrection(c.id, true, currentUserId, comment)}
                  onReject={(comment) => reviewCorrection(c.id, false, currentUserId, comment)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Leave requests" description={`${pendingLv.length} pending`} />
        {pendingLv.length === 0 ? (
          <EmptyState title="No pending leave" icon={<Inbox className="size-8" />} />
        ) : (
          <ul className="divide-y divide-border">
            {pendingLv.map((l) => (
              <li key={l.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={getPerson(l.employeeId)?.name ?? "?"} />
                    <div>
                      <p className="text-sm font-medium">{getPerson(l.employeeId)?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {POLICY.leaveTypes[l.type].label} · {formatDate(l.from)} – {formatDate(l.to)} · {l.days}d
                      </p>
                    </div>
                  </div>
                  {!POLICY.leaveTypes[l.type].paid ? (
                    <span className="rounded-full bg-status-absent px-2.5 py-0.5 text-xs font-medium text-status-absent-foreground">Unpaid</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-foreground/80">{l.reason}</p>
                <ReviewActions
                  onApprove={(comment) => reviewLeave(l.id, true, currentUserId, comment)}
                  onReject={(comment) => reviewLeave(l.id, false, currentUserId, comment)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function TeamTimesheet({ reports }: { reports: ReturnType<typeof directReports> }) {
  const { records } = useStore()
  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Team timesheet" description={`Today's status and month summary — ${formatDate(TODAY)}.`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Today</th>
                <th className="px-5 py-3 text-right font-medium">Present</th>
                <th className="px-5 py-3 text-right font-medium">Late</th>
                <th className="px-5 py-3 text-right font-medium">WFH</th>
                <th className="px-5 py-3 text-right font-medium">Absent</th>
                <th className="px-5 py-3 text-right font-medium">Attd. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((emp) => {
                const stats = computeMonthStats(records, emp.id)
                const today = records.find((r) => r.employeeId === emp.id && r.date === TODAY)
                return (
                  <tr key={emp.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} />
                        <div>
                          <p className="font-medium text-foreground">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.designation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">{today ? <StatusBadge status={today.status} /> : "—"}</td>
                    <td className="px-5 py-3 text-right font-mono">{stats.present + stats.late}</td>
                    <td className="px-5 py-3 text-right font-mono text-status-late-foreground">{stats.late}</td>
                    <td className="px-5 py-3 text-right font-mono text-status-wfh-foreground">{stats.wfh}</td>
                    <td className="px-5 py-3 text-right font-mono text-status-absent-foreground">{stats.absent}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold">{stats.attendancePct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
