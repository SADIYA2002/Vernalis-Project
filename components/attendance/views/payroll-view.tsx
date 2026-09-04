"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Lock, LockOpen, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import {
  MARKING_STAFF,
  PERIOD_END,
  PERIOD_START,
  POLICY,
  computePayrollRow,
  formatCurrency,
  formatDate,
  getPerson,
  type PayrollRow,
} from "@/lib/attendance-data"
import { useStore } from "@/components/attendance/store"
import { apiClient, type ServerPayrollSummary } from "@/lib/api-client"
import { Avatar, Card, CardHeader, PageHeading, StatTile } from "@/components/attendance/ui"

export function PayrollView({ section }: { section: string }) {
  const { records, leaves, corrections, pushToast } = useStore()
  const [serverPayroll, setServerPayroll] = useState<ServerPayrollSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [lockLoading, setLockLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  // Fetch server-side computed payroll numbers from backend API
  const loadServerPayroll = useCallback(async () => {
    try {
      const data = await apiClient.getPayroll({ start: PERIOD_START, end: PERIOD_END })
      setServerPayroll(data)
    } catch (err) {
      console.warn("[PayrollView] Failed to fetch server-computed payroll:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServerPayroll()
  }, [loadServerPayroll, records, leaves])

  // Fallback if initial load is pending
  const fallbackRows = useMemo<PayrollRow[]>(
    () => MARKING_STAFF.map((e) => computePayrollRow(records, leaves, e)),
    [records, leaves],
  )

  const fallbackTotals = useMemo(() => {
    return fallbackRows.reduce(
      (acc, r) => {
        acc.gross += r.netAttendancePay
        acc.lop += r.lopDays
        acc.lateDeduction += r.lateDeductionAmt
        acc.payable += r.payableDays
        return acc
      },
      { gross: 0, lop: 0, lateDeduction: 0, payable: 0 },
    )
  }, [fallbackRows])

  const rows = serverPayroll?.rows ?? fallbackRows
  const totals = serverPayroll?.totals ?? fallbackTotals
  const locked = serverPayroll?.locked ?? false

  async function handleToggleLock() {
    setLockLoading(true)
    try {
      const nextLocked = !locked
      const res = await apiClient.setPayrollLock(nextLocked)
      setServerPayroll(res)
      pushToast(
        nextLocked ? "Payroll Period Locked" : "Payroll Period Unlocked",
        nextLocked
          ? "Attendance for this cycle is frozen on the server for payroll handoff."
          : "Payroll cycle unlocked for adjustments.",
        nextLocked ? "success" : "info",
      )
    } catch (err) {
      pushToast("Lock action failed", err instanceof Error ? err.message : "Could not update lock state", "warn")
    } finally {
      setLockLoading(false)
    }
  }

  const pendingCount =
    corrections.filter((c) => c.state === "pending").length + leaves.filter((l) => l.state === "pending").length

  function exportCsv() {
    const header = [
      "Employee",
      "Department",
      "Working Days",
      "Payable Days",
      "LOP Days",
      "Paid Leave",
      "Unpaid Leave",
      "Late Marks",
      "Late Deduction (days)",
      "Per Day",
      "Late Deduction (amt)",
      "Net Attendance Pay",
    ]
    const lines = rows.map((r) => {
      const p = getPerson(r.employeeId)!
      return [
        p.name,
        p.department,
        r.workingDays,
        r.payableDays,
        r.lopDays,
        r.paidLeaveDays,
        r.unpaidLeaveDays,
        r.lateMarks,
        r.lateDeductionDays,
        r.perDay,
        r.lateDeductionAmt,
        r.netAttendancePay,
      ].join(",")
    })
    const csv = [header.join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payroll-inputs-${PERIOD_START}_${PERIOD_END}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (section === "register") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading
          title="Attendance Register"
          description="The statutory muster (audit view): payable days, leave and deductions that justify each salary figure."
        />
        <RegisterSummary rows={rows} />
      </div>
    )
  }

  // section === "inputs"
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Payroll Inputs"
        description={`Attendance-derived pay components for ${formatDate(PERIOD_START, { day: "2-digit", month: "long" })} – ${formatDate(PERIOD_END, { day: "2-digit", month: "long", year: "numeric" })}. This is the hand-off from attendance to salary processing.`}
        action={
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 sm:inline-flex dark:text-emerald-400">
              <CheckCircle2 className="size-3" /> Server Computed
            </span>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
            >
              <Download className="size-4" /> Export CSV
            </button>
            <button
              onClick={handleToggleLock}
              disabled={lockLoading}
              className={
                locked
                  ? "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent disabled:opacity-50"
                  : "inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
              }
            >
              {lockLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : locked ? (
                <LockOpen className="size-4" />
              ) : (
                <Lock className="size-4" />
              )}
              {locked ? "Unlock Period" : "Lock for Payroll"}
            </button>
          </div>
        }
      />

      {pendingCount > 0 && !locked ? (
        <div className="flex items-start gap-3 rounded-lg border border-status-half-foreground/25 bg-status-half px-4 py-3 text-status-half-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{pendingCount} request(s) still pending</span> across corrections and leave.
            Pay figures may change until every request is resolved and the period is locked.
          </p>
        </div>
      ) : null}

      {locked ? (
        <div className="flex items-start gap-3 rounded-lg border border-status-present-foreground/25 bg-status-present px-4 py-3 text-status-present-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">Period locked.</span> Attendance is frozen and these inputs are final for
            salary processing. Corrections after lock require a payroll adjustment in the next cycle.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total Net Pay (attendance)" value={formatCurrency(totals.gross)} accent="primary" />
        <StatTile label="Payable Days" value={totals.payable.toFixed(1)} accent="green" />
        <StatTile label="Loss of Pay Days" value={totals.lop.toFixed(1)} accent="red" />
        <StatTile label="Late Deductions" value={formatCurrency(totals.lateDeduction)} accent="amber" />
      </div>

      {selected ? (
        <PayrollDetail row={rows.find((r) => r.employeeId === selected)!} onBack={() => setSelected(null)} />
      ) : (
        <PayrollInputsTable rows={rows} onSelect={(id) => setSelected(id)} />
      )}
    </div>
  )
}

function PayrollInputsTable({ rows, onSelect }: { rows: PayrollRow[]; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader
        title="Per-employee payroll inputs"
        description="Every figure is derived from attendance records. Click a row to see the computation."
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-3 py-3 text-right font-medium">Payable</th>
              <th className="px-3 py-3 text-right font-medium">LOP</th>
              <th className="px-3 py-3 text-right font-medium">Paid Lv</th>
              <th className="px-3 py-3 text-right font-medium">Late</th>
              <th className="px-3 py-3 text-right font-medium">Late Ded.</th>
              <th className="px-5 py-3 text-right font-medium">Net Pay</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = getPerson(r.employeeId)!
              return (
                <tr
                  key={r.employeeId}
                  onClick={() => onSelect(r.employeeId)}
                  className="cursor-pointer border-b border-border/60 transition last:border-0 hover:bg-accent/50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} />
                      <div>
                        <p className="font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.payableDays.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-status-absent-foreground">
                    {r.lopDays.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.paidLeaveDays}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.lateMarks}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-status-half-foreground">
                    {r.lateDeductionAmt ? formatCurrency(r.lateDeductionAmt) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
                    {formatCurrency(r.netAttendancePay)}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground">
                    <ChevronRight className="ml-auto size-4" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PayrollDetail({ row, onBack }: { row: PayrollRow; onBack: () => void }) {
  const p = getPerson(row.employeeId)!
  const steps = [
    { label: "Gross monthly salary", value: formatCurrency(p.monthlySalary) },
    { label: "Standard working days in period", value: `${Math.round(p.monthlySalary / row.perDay)} days` },
    { label: "Per-day rate", value: formatCurrency(row.perDay) },
    { label: "Payable days (present + WFH + paid leave − ½ days − late)", value: `${row.payableDays.toFixed(1)} days` },
    { label: "Loss-of-pay days (absent + unpaid leave)", value: `${row.lopDays.toFixed(1)} days` },
    {
      label: `Late deduction (${row.lateMarks} late ÷ ${POLICY.lateToHalfDayRule} = ${row.lateDeductionDays} day)`,
      value: `− ${formatCurrency(row.lateDeductionAmt)}`,
    },
  ]
  return (
    <Card>
      <CardHeader
        title={`${p.name} — pay computation`}
        description={`${p.designation}, ${p.department}`}
        action={
          <button
            onClick={onBack}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-accent"
          >
            Back to inputs
          </button>
        }
      />
      <div className="grid gap-0 sm:grid-cols-2">
        <div className="divide-y divide-border border-b border-border sm:border-b-0 sm:border-r">
          {steps.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <span className="font-mono text-sm font-medium tabular-nums text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-center gap-4 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Net attendance-based pay
            </p>
            <p className="mt-2 font-mono text-4xl font-semibold tabular-nums text-primary">
              {formatCurrency(row.netAttendancePay)}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This is the attendance component only. Statutory deductions (PF, ESI, TDS), reimbursements and variable pay
            are applied downstream by the payroll system. Attendance is the legal basis for the payable-days figure
            above.
          </p>
        </div>
      </div>
    </Card>
  )
}

function RegisterSummary({ rows }: { rows: PayrollRow[] }) {
  return (
    <Card>
      <CardHeader
        title="Attendance register (audit view)"
        description="The statutory muster: payable days, leave and deductions that justify each salary figure."
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-3 py-3 text-right font-medium">Working</th>
              <th className="px-3 py-3 text-right font-medium">Payable</th>
              <th className="px-3 py-3 text-right font-medium">Paid Lv</th>
              <th className="px-3 py-3 text-right font-medium">Unpaid Lv</th>
              <th className="px-3 py-3 text-right font-medium">WFH</th>
              <th className="px-3 py-3 text-right font-medium">Late</th>
              <th className="px-5 py-3 text-right font-medium">LOP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = getPerson(r.employeeId)!
              return (
                <tr key={r.employeeId} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.department}</p>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.workingDays}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.payableDays.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.paidLeaveDays}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.unpaidLeaveDays}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.wfhDays}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.lateMarks}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-status-absent-foreground">
                    {r.lopDays.toFixed(1)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
