"use client"

import { cn } from "@/lib/utils"
import {
  PERIOD_START,
  STATUS_META,
  TODAY,
  type AttendanceRecord,
  datesBetween,
} from "@/lib/attendance-data"

// Renders the August 2026 period as a month grid keyed by attendance status.
export function MonthCalendar({
  records,
  onSelectDay,
  selectedDate,
}: {
  records: AttendanceRecord[]
  onSelectDay?: (date: string) => void
  selectedDate?: string
}) {
  const byDate = new Map(records.map((r) => [r.date, r]))
  const days = datesBetween(PERIOD_START, "2026-08-31")
  const firstDow = new Date(PERIOD_START + "T00:00:00").getDay() // 0 Sun
  const leading = firstDow // number of blanks before day 1
  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
        {weekLabels.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((date) => {
          const rec = byDate.get(date)
          const status = rec?.status ?? "absent"
          const meta = STATUS_META[status]
          const dayNum = Number(date.slice(-2))
          const isFuture = date > TODAY
          const isToday = date === TODAY
          const clickable = !!onSelectDay && !isFuture
          const muted = status === "weekend" || status === "holiday"

          return (
            <button
              key={date}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelectDay?.(date)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs transition",
                muted ? "border-transparent bg-muted/50" : cn("border-border", meta.bg),
                clickable && "cursor-pointer hover:ring-2 hover:ring-ring/40",
                !clickable && "cursor-default",
                selectedDate === date && "ring-2 ring-ring",
                isFuture && "opacity-40",
              )}
              aria-label={`${date}: ${meta.label}`}
            >
              <span className={cn("absolute left-1.5 top-1 text-[10px] font-medium", muted ? "text-muted-foreground" : meta.fg)}>
                {dayNum}
              </span>
              {isToday ? (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" aria-hidden />
              ) : null}
              {!muted && !isFuture ? (
                <span className={cn("mt-1 text-sm font-semibold", meta.fg)}>{meta.short}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CalendarLegend() {
  const shown: (keyof typeof STATUS_META)[] = ["present", "late", "wfh", "half-day", "leave", "absent", "holiday"]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {shown.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-2.5 rounded-full", STATUS_META[s].dot)} aria-hidden />
          {STATUS_META[s].label}
        </span>
      ))}
    </div>
  )
}
