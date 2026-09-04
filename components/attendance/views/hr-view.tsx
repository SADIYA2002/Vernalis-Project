"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, Clock, ScrollText, TrendingDown, Users } from "lucide-react"
import {
  EMPLOYEES,
  HISTORY_START,
  HOLIDAYS,
  MARKING_STAFF,
  POLICY,
  STATUS_META,
  TODAY,
  computeMonthStats,
  formatDate,
  getPerson,
  isWorkingDay,
  type AttendanceRecord,
} from "@/lib/attendance-data"
import { useStore } from "../store"
import { Avatar, Card, CardHeader, PageHeading, StatTile, StateBadge, StatusBadge } from "../ui"
import { CalendarLegend, MonthCalendar } from "../calendar"

export function HrView({ section }: { section: string }) {
  if (section === "analytics") return <Analytics />
  if (section === "register") return <Register />
  if (section === "leave") return <LeaveAdmin />
  if (section === "policy") return <PolicyView />
  return null
}

function isoWeekLabel(date: string): string {
  const d = new Date(date + "T00:00:00")
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return monday.toISOString().slice(5, 10)
}

function Analytics() {
  const { records } = useStore()

  const orgStats = useMemo(() => MARKING_STAFF.map((e) => computeMonthStats(records, e.id)), [records])
  const orgAttendance =
    orgStats.length ? Math.round((orgStats.reduce((s, r) => s + r.attendancePct, 0) / orgStats.length) * 10) / 10 : 0
  const totalAbsent = orgStats.reduce((s, r) => s + r.absent, 0)
  const totalLate = orgStats.reduce((s, r) => s + r.late, 0)
  const totalWorking = orgStats.reduce((s, r) => s + r.workingDays, 0)
  const absenceRate = totalWorking ? Math.round((totalAbsent / totalWorking) * 1000) / 10 : 0

  // Attendance % by department
  const deptData = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>()
    MARKING_STAFF.forEach((e) => {
      const st = computeMonthStats(records, e.id)
      const cur = map.get(e.department) ?? { sum: 0, n: 0 }
      cur.sum += st.attendancePct
      cur.n += 1
      map.set(e.department, cur)
    })
    return Array.from(map.entries()).map(([dept, v]) => ({ dept, pct: Math.round((v.sum / v.n) * 10) / 10 }))
  }, [records])

  // Absence trend by week (absent + leave as % of working slots)
  const trendData = useMemo(() => {
    const map = new Map<string, { absent: number; slots: number }>()
    records.forEach((r) => {
      if (r.date < HISTORY_START || r.date > TODAY) return
      if (r.status === "weekend" || r.status === "holiday") return
      const wk = isoWeekLabel(r.date)
      const cur = map.get(wk) ?? { absent: 0, slots: 0 }
      cur.slots += 1
      if (r.status === "absent" || r.status === "leave") cur.absent += 1
      map.set(wk, cur)
    })
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([wk, v]) => ({ week: wk, rate: Math.round((v.absent / v.slots) * 1000) / 10 }))
  }, [records])

  // Late patterns by weekday
  const lateData = useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    const counts = [0, 0, 0, 0, 0]
    records.forEach((r) => {
      if (r.status !== "late") return
      const dow = new Date(r.date + "T00:00:00").getDay() // 1..5
      if (dow >= 1 && dow <= 5) counts[dow - 1] += 1
    })
    return labels.map((day, i) => ({ day, late: counts[i] }))
  }, [records])

  const maxLate = Math.max(...lateData.map((d) => d.late), 1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Workforce analytics" description="What HR must see: attendance %, absence trends and late patterns across the organisation — August 2026." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Org attendance" value={`${orgAttendance}%`} accent="green" icon={<Users className="size-4" />} />
        <StatTile label="Absence rate" value={`${absenceRate}%`} sub={`${totalAbsent} absent days`} accent={absenceRate > 5 ? "red" : "primary"} icon={<TrendingDown className="size-4" />} />
        <StatTile label="Late marks" value={totalLate} accent="amber" icon={<Clock className="size-4" />} />
        <StatTile label="Headcount" value={MARKING_STAFF.length} sub={`${EMPLOYEES.filter((e) => e.baseRole === "manager").length} managers`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Attendance % by department" description="Present-equivalent across working days" />
          <div className="p-5 pt-6">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={deptData} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dept" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
                  formatter={(v: any) => [`${v}%`, "Attendance"]}
                />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]} fill="var(--color-chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Absence trend" description="Weekly absence rate (absent + leave)" />
          <div className="p-5 pt-6">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ left: -18, right: 8 }}>
                <defs>
                  <linearGradient id="absGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-4)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-4)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
                  formatter={(v: any) => [`${v}%`, "Absence rate"]}
                />
                <Area type="monotone" dataKey="rate" stroke="var(--color-chart-4)" strokeWidth={2} fill="url(#absGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Late-arrival patterns" description="Distribution of late marks by weekday — spot chronic problem days" />
        <div className="p-5 pt-6">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={lateData} margin={{ left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
                formatter={(v: any) => [v, "Late marks"]}
              />
              <Bar dataKey="late" radius={[6, 6, 0, 0]}>
                {lateData.map((d, i) => (
                  <Cell key={i} fill={d.late === maxLate ? "var(--color-chart-4)" : "var(--color-chart-3)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="Employees needing attention" description="Below 90% attendance or 3+ late marks" />
        <ul className="divide-y divide-border">
          {orgStats
            .filter((s) => s.attendancePct < 90 || s.late >= 3)
            .sort((a, b) => a.attendancePct - b.attendancePct)
            .map((s) => {
              const emp = getPerson(s.employeeId)
              return (
                <li key={s.employeeId} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="size-4 text-status-half-foreground" />
                    <div>
                      <p className="text-sm font-medium">{emp?.name}</p>
                      <p className="text-xs text-muted-foreground">{emp?.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="font-mono">{s.attendancePct}%</span>
                    <span className="font-mono text-status-late-foreground">{s.late} late</span>
                    <span className="font-mono text-status-absent-foreground">{s.absent} abs</span>
                  </div>
                </li>
              )
            })}
        </ul>
      </Card>
    </div>
  )
}

function Register() {
  const { records } = useStore()
  const [empId, setEmpId] = useState(MARKING_STAFF[0].id)
  const empRecords = records.filter((r) => r.employeeId === empId)
  const stats = computeMonthStats(records, empId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Attendance register" description="The statutory muster — full attendance record per employee, retained as a legal document." />

      <Card>
        <CardHeader
          title="Employee register"
          action={
            <select
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              {MARKING_STAFF.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          }
        />
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_260px]">
          <div>
            <MonthCalendar records={empRecords} />
            <div className="mt-4 border-t border-border pt-4">
              <CalendarLegend />
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:border-l lg:border-border lg:pl-6">
            {[
              ["Present", stats.present, "text-status-present-foreground"],
              ["Late", stats.late, "text-status-late-foreground"],
              ["WFH", stats.wfh, "text-status-wfh-foreground"],
              ["Half days", stats.halfDays, "text-status-half-foreground"],
              ["On leave", stats.leave, "text-status-leave-foreground"],
              ["Absent", stats.absent, "text-status-absent-foreground"],
            ].map(([label, val, cls]) => (
              <div key={label as string} className="flex items-center justify-between border-b border-border py-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-mono font-semibold ${cls}`}>{val}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span className="text-sm font-medium text-foreground">Attendance</span>
              <span className="font-mono text-lg font-bold text-primary">{stats.attendancePct}%</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Public holidays" description="Non-working days in the register period" />
        <ul className="divide-y divide-border">
          {Object.entries(HOLIDAYS).map(([date, name]) => (
            <li key={date} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="font-medium text-foreground">{name}</span>
              <span className="text-muted-foreground">{formatDate(date, { weekday: "long", day: "2-digit", month: "long" })}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function LeaveAdmin() {
  const { leaves, balances } = useStore()
  const sorted = [...leaves].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Leave administration" description="Organisation-wide leave requests and current balances." />

      <Card>
        <CardHeader title="Leave requests" description={`${leaves.length} total · ${leaves.filter((l) => l.state === "pending").length} pending`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Dates</th>
                <th className="px-5 py-3 text-right font-medium">Days</th>
                <th className="px-5 py-3 font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((l) => (
                <tr key={l.id} className="hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium text-foreground">{getPerson(l.employeeId)?.name}</td>
                  <td className="px-5 py-3">{POLICY.leaveTypes[l.type].label}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{formatDate(l.from, { day: "2-digit", month: "short" })} – {formatDate(l.to, { day: "2-digit", month: "short" })}</td>
                  <td className="px-5 py-3 text-right font-mono">{l.days}</td>
                  <td className="px-5 py-3"><StateBadge state={l.state} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Leave balances" description="Remaining paid-leave entitlement" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 text-right font-medium">Casual</th>
                <th className="px-5 py-3 text-right font-medium">Sick</th>
                <th className="px-5 py-3 text-right font-medium">Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {balances.map((b) => (
                <tr key={b.employeeId} className="hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={getPerson(b.employeeId)?.name ?? "?"} />
                      <span className="font-medium text-foreground">{getPerson(b.employeeId)?.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono">{b.casual}</td>
                  <td className="px-5 py-3 text-right font-mono">{b.sick}</td>
                  <td className="px-5 py-3 text-right font-mono">{b.earned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

const RACI = [
  { step: "Daily marking", employee: "Responsible", manager: "Informed", hr: "Consulted", payroll: "—" },
  { step: "Correction request", employee: "Responsible", manager: "Accountable", hr: "Informed", payroll: "—" },
  { step: "Leave approval", employee: "Responsible", manager: "Accountable", hr: "Consulted", payroll: "Informed" },
  { step: "Attendance audit", employee: "—", manager: "Consulted", hr: "Accountable", payroll: "Informed" },
  { step: "Payroll processing", employee: "—", manager: "Informed", hr: "Consulted", payroll: "Accountable" },
]

const FLOW = ["Daily marking", "Correction", "Approval", "Payroll input"]

function PolicyView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Policy & legal" description="Policy first: the rules the entire portal enforces, the process flow, role responsibilities, and the legal basis." />

      <Card>
        <CardHeader title="Process flow" description="daily marking → correction → approval → payroll" />
        <div className="flex flex-wrap items-center gap-2 p-5">
          {FLOW.map((f, i) => (
            <div key={f} className="flex items-center gap-2">
              <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground">{f}</span>
              {i < FLOW.length - 1 ? <span className="text-muted-foreground">→</span> : null}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Attendance rules" />
          <dl className="divide-y divide-border">
            {[
              ["Standard shift", `${POLICY.shiftStart} – ${POLICY.shiftEnd}`],
              ["Grace period", `${POLICY.graceMinutes} minutes`],
              ["Full day", `${POLICY.fullDayHours} worked hours`],
              ["Half day", `${POLICY.halfDayMinHours}–${POLICY.fullDayHours} worked hours`],
              ["Late → LOP rule", `${POLICY.lateToHalfDayRule} late marks = ½ day loss of pay`],
              ["Work week", "Monday – Friday"],
              ["WFH cap", `${POLICY.wfhPerMonthCap} days / month`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-5 py-3 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Leave types" />
          <dl className="divide-y divide-border">
            {(Object.entries(POLICY.leaveTypes)).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-5 py-3 text-sm">
                <dt className="text-foreground">{v.label}</dt>
                <dd className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{v.annualQuota}/yr</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.paid ? "bg-status-present text-status-present-foreground" : "bg-status-absent text-status-absent-foreground"}`}>
                    {v.paid ? "Paid" : "Unpaid"}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Who does what (RACI)" description="employee / manager / HR / payroll" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Process step</th>
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Manager</th>
                <th className="px-5 py-3 font-medium">HR</th>
                <th className="px-5 py-3 font-medium">Payroll</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {RACI.map((r) => (
                <tr key={r.step} className="hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium text-foreground">{r.step}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.employee}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.manager}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.hr}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.payroll}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Legal & compliance" description="Attendance drives salary — it is a legal record" />
        <ul className="flex flex-col gap-3 p-5">
          {POLICY.legal.map((line, i) => (
            <li key={i} className="flex gap-3 text-sm text-foreground/80">
              <ScrollText className="mt-0.5 size-4 shrink-0 text-primary" />
              {line}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
