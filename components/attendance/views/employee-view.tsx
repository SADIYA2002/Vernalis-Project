"use client"

import { useMemo, useState } from "react"
import { CalendarClock, Clock, Home, Inbox, TrendingUp } from "lucide-react"
import {
  POLICY,
  STATUS_META,
  TODAY,
  computeMonthStats,
  formatDate,
  getPerson,
  type AttendanceStatus,
  type LeaveType,
} from "@/lib/attendance-data"
import { useStore } from "../store"
import { CalendarLegend, MonthCalendar } from "../calendar"
import { Card, CardHeader, EmptyState, Field, PageHeading, StatTile, StateBadge, StatusBadge, inputCls } from "../ui"

export function EmployeeView({ section }: { section: string }) {
  const { currentUserId, records } = useStore()
  const myRecords = useMemo(() => records.filter((r) => r.employeeId === currentUserId), [records, currentUserId])
  const stats = useMemo(() => computeMonthStats(records, currentUserId), [records, currentUserId])
  const person = getPerson(currentUserId)

  if (section === "dashboard") return <Dashboard stats={stats} name={person?.name ?? ""} />
  if (section === "mark") return <MarkAttendance />
  if (section === "timesheet") return <Timesheet records={myRecords} />
  if (section === "corrections") return <Corrections />
  if (section === "leave") return <Leave />
  return null
}

function Dashboard({ stats, name }: { stats: ReturnType<typeof computeMonthStats>; name: string }) {
  const { records, currentUserId, corrections, leaves } = useStore()
  const today = records.find((r) => r.employeeId === currentUserId && r.date === TODAY)
  const myPendingCor = corrections.filter((c) => c.employeeId === currentUserId && c.state === "pending")
  const myPendingLv = leaves.filter((l) => l.employeeId === currentUserId && l.state === "pending")

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title={`Good day, ${name.split(" ")[0]}`}
        description="Your attendance summary for August 2026. All figures feed directly into payroll."
      />

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CalendarClock className="size-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Today · {formatDate(TODAY)}</p>
            <p className="text-xs text-muted-foreground">
              {today && today.checkIn ? `Checked in ${today.checkIn}${today.checkOut ? ` · out ${today.checkOut}` : ""}` : "Not marked yet"}
            </p>
          </div>
        </div>
        {today ? <StatusBadge status={today.status} /> : <span className="text-sm text-muted-foreground">—</span>}
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Attendance %" value={`${stats.attendancePct}%`} sub="Present-equivalent / working days" accent="primary" icon={<TrendingUp className="size-4" />} />
        <StatTile label="Present days" value={stats.present + stats.late} sub={`${stats.late} late`} accent="green" />
        <StatTile label="WFH days" value={stats.wfh} sub={`Cap ${POLICY.wfhPerMonthCap}/mo`} accent="sky" icon={<Home className="size-4" />} />
        <StatTile label="Absent" value={stats.absent} sub={`${stats.leave} on leave`} accent={stats.absent > 0 ? "red" : "primary"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Late arrivals" description={`${POLICY.lateToHalfDayRule} late marks = ½ day loss of pay`} />
          <div className="flex items-center justify-between px-5 py-6">
            <div className="flex items-center gap-3">
              <Clock className="size-8 text-status-late-foreground" />
              <div>
                <p className="font-mono text-2xl font-semibold">{stats.late}</p>
                <p className="text-xs text-muted-foreground">{stats.totalLateMinutes} min total this month</p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              Avg worked
              <p className="font-mono text-lg font-semibold text-foreground">{stats.avgWorkedHours}h</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Open requests" description="Awaiting your manager" />
          {myPendingCor.length + myPendingLv.length === 0 ? (
            <EmptyState title="Nothing pending" description="You have no correction or leave requests awaiting approval." icon={<Inbox className="size-8" />} />
          ) : (
            <ul className="divide-y divide-border">
              {myPendingCor.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">Correction · {formatDate(c.date)}</p>
                    <p className="text-xs text-muted-foreground">{STATUS_META[c.fromStatus].label} → {STATUS_META[c.toStatus].label}</p>
                  </div>
                  <StateBadge state={c.state} />
                </li>
              ))}
              {myPendingLv.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">Leave · {POLICY.leaveTypes[l.type].label}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(l.from)} – {formatDate(l.to)} · {l.days}d</p>
                  </div>
                  <StateBadge state={l.state} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

const MARK_OPTIONS: AttendanceStatus[] = ["present", "wfh", "half-day", "leave"]

function MarkAttendance() {
  const { currentUserId, records, markAttendance } = useStore()
  const today = records.find((r) => r.employeeId === currentUserId && r.date === TODAY)
  const [status, setStatus] = useState<AttendanceStatus>(today?.status && MARK_OPTIONS.includes(today.status) ? today.status : "present")
  const [checkIn, setCheckIn] = useState(today?.checkIn ?? "09:00")
  const [checkOut, setCheckOut] = useState(today?.checkOut ?? "18:00")

  const needsTimes = status === "present" || status === "wfh" || status === "half-day"

  function submit() {
    markAttendance({
      employeeId: currentUserId,
      date: TODAY,
      status,
      checkIn: needsTimes ? checkIn : null,
      checkOut: needsTimes ? checkOut : null,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Mark attendance" description={`Record today's attendance — ${formatDate(TODAY)}. Shift ${POLICY.shiftStart}–${POLICY.shiftEnd}, grace ${POLICY.graceMinutes} min.`} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardHeader title="Today" description={formatDate(TODAY, { weekday: "long", day: "2-digit", month: "long" })} />
          <div className="flex flex-col gap-4 p-5">
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">Status</p>
              <div className="grid grid-cols-2 gap-2">
                {MARK_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      status === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent"
                    }`}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </div>
            {needsTimes ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Check in">
                  <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Check out">
                  <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputCls} />
                </Field>
              </div>
            ) : (
              <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                No check-in required for {STATUS_META[status].label.toLowerCase()}.
              </p>
            )}
            {needsTimes && checkIn > `09:${POLICY.graceMinutes}` ? (
              <p className="rounded-lg bg-status-late px-3 py-2 text-xs text-status-late-foreground">
                Arrival after grace period — this will be recorded as <strong>Late</strong>.
              </p>
            ) : null}
            <button onClick={submit} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              {today?.checkIn ? "Update today's attendance" : "Save attendance"}
            </button>
            {today ? (
              <p className="text-center text-xs text-muted-foreground">
                Currently recorded as <span className="font-medium text-foreground">{STATUS_META[today.status].label}</span>
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="August 2026" description="Your month at a glance. Past days can be fixed via Corrections." />
          <div className="p-5">
            <MonthCalendar records={records.filter((r) => r.employeeId === currentUserId)} />
            <div className="mt-4 border-t border-border pt-4">
              <CalendarLegend />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Timesheet({ records }: { records: ReturnType<typeof useStore>["records"] }) {
  const rows = [...records].filter((r) => r.date <= TODAY).sort((a, b) => (a.date < b.date ? 1 : -1))
  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="My timesheet" description="Every recorded day with check-in / check-out and worked hours." />
      <Card>
        <CardHeader title="Daily records" description="August 2026" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">In</th>
                <th className="px-5 py-3 font-medium">Out</th>
                <th className="px-5 py-3 text-right font-medium">Hours</th>
                <th className="px-5 py-3 text-right font-medium">Late</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="whitespace-nowrap px-5 py-2.5">
                    <span className="font-medium text-foreground">{formatDate(r.date, { day: "2-digit", month: "short" })}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatDate(r.date, { weekday: "short" })}</span>
                    {r.corrected ? <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">corrected</span> : null}
                  </td>
                  <td className="px-5 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-2.5 font-mono text-xs">{r.checkIn ?? "—"}</td>
                  <td className="px-5 py-2.5 font-mono text-xs">{r.checkOut ?? "—"}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{r.workedHours ? `${r.workedHours}h` : "—"}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{r.lateMinutes ? `${r.lateMinutes}m` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

const CORRECTION_TARGETS: AttendanceStatus[] = ["present", "wfh", "half-day", "late", "leave", "absent"]

function Corrections() {
  const { currentUserId, records, corrections, submitCorrection } = useStore()
  const myRecords = records.filter((r) => r.employeeId === currentUserId && r.date <= TODAY && r.status !== "weekend" && r.status !== "holiday")
  const myCorrections = corrections.filter((c) => c.employeeId === currentUserId)

  const [date, setDate] = useState(myRecords.length ? myRecords[myRecords.length - 1].date : TODAY)
  const current = myRecords.find((r) => r.date === date)
  const [toStatus, setToStatus] = useState<AttendanceStatus>("present")
  const [checkIn, setCheckIn] = useState("09:00")
  const [checkOut, setCheckOut] = useState("18:00")
  const [reason, setReason] = useState("")
  const needsTimes = toStatus === "present" || toStatus === "wfh" || toStatus === "half-day" || toStatus === "late"

  function submit() {
    if (!current || !reason.trim()) return
    submitCorrection({
      employeeId: currentUserId,
      date,
      fromStatus: current.status,
      toStatus,
      requestedCheckIn: needsTimes ? checkIn : null,
      requestedCheckOut: needsTimes ? checkOut : null,
      reason: reason.trim(),
    })
    setReason("")
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Corrections" description="Request a change to a past record. Every correction is logged with reason, requester and approver for the audit trail." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardHeader title="Raise a correction" />
          <div className="flex flex-col gap-4 p-5">
            <Field label="Date">
              <select value={date} onChange={(e) => setDate(e.target.value)} className={inputCls}>
                {[...myRecords].reverse().map((r) => (
                  <option key={r.date} value={r.date}>
                    {formatDate(r.date)} — {STATUS_META[r.status].label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Currently recorded as{" "}
              <span className="font-medium text-foreground">{current ? STATUS_META[current.status].label : "—"}</span>
            </div>
            <Field label="Change to">
              <select value={toStatus} onChange={(e) => setToStatus(e.target.value as AttendanceStatus)} className={inputCls}>
                {CORRECTION_TARGETS.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </Field>
            {needsTimes ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Check in"><input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputCls} /></Field>
                <Field label="Check out"><input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputCls} /></Field>
              </div>
            ) : null}
            <Field label="Reason" hint="Required — provides the audit justification.">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputCls} placeholder="Explain what happened…" />
            </Field>
            <button
              onClick={submit}
              disabled={!reason.trim() || !current}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              Submit for approval
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="My corrections" description={`${myCorrections.length} total`} />
          {myCorrections.length === 0 ? (
            <EmptyState title="No corrections yet" icon={<Inbox className="size-8" />} />
          ) : (
            <ul className="divide-y divide-border">
              {myCorrections.map((c) => (
                <li key={c.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{formatDate(c.date)}</p>
                    <StateBadge state={c.state} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {STATUS_META[c.fromStatus].label} → {STATUS_META[c.toStatus].label}
                  </p>
                  <p className="mt-1.5 text-sm text-foreground/80">{c.reason}</p>
                  {c.reviewComment ? (
                    <p className="mt-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                      Manager: {c.reviewComment}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Leave() {
  const { currentUserId, balances, leaves, submitLeave } = useStore()
  const myBalance = balances.find((b) => b.employeeId === currentUserId)
  const myLeaves = leaves.filter((l) => l.employeeId === currentUserId)
  const [type, setType] = useState<LeaveType>("casual")
  const [from, setFrom] = useState("2026-09-01")
  const [to, setTo] = useState("2026-09-01")
  const [reason, setReason] = useState("")

  function submit() {
    if (!reason.trim() || to < from) return
    submitLeave({ employeeId: currentUserId, type, from, to, reason: reason.trim() })
    setReason("")
  }

  const balanceTiles: { type: LeaveType; value: number }[] = [
    { type: "casual", value: myBalance?.casual ?? 0 },
    { type: "sick", value: myBalance?.sick ?? 0 },
    { type: "earned", value: myBalance?.earned ?? 0 },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Leave" description="Apply for leave and track balances. Approved leave updates your attendance and payroll automatically." />

      <div className="grid grid-cols-3 gap-4">
        {balanceTiles.map((b) => (
          <StatTile
            key={b.type}
            label={POLICY.leaveTypes[b.type].label}
            value={b.value}
            sub={`of ${POLICY.leaveTypes[b.type].annualQuota} annual`}
            accent="primary"
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardHeader title="Apply for leave" />
          <div className="flex flex-col gap-4 p-5">
            <Field label="Leave type">
              <select value={type} onChange={(e) => setType(e.target.value as LeaveType)} className={inputCls}>
                {(Object.keys(POLICY.leaveTypes) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>{POLICY.leaveTypes[t].label}{POLICY.leaveTypes[t].paid ? "" : " (unpaid)"}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
              <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label="Reason">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputCls} placeholder="Reason for leave…" />
            </Field>
            <button
              onClick={submit}
              disabled={!reason.trim() || to < from}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="My leave requests" description={`${myLeaves.length} total`} />
          {myLeaves.length === 0 ? (
            <EmptyState title="No leave requests" icon={<Inbox className="size-8" />} />
          ) : (
            <ul className="divide-y divide-border">
              {myLeaves.map((l) => (
                <li key={l.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{POLICY.leaveTypes[l.type].label}</p>
                    <StateBadge state={l.state} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(l.from)} – {formatDate(l.to)} · {l.days} day(s)</p>
                  <p className="mt-1.5 text-sm text-foreground/80">{l.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
