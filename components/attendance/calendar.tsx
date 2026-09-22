"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  HOLIDAYS,
  STATUS_META,
  TODAY,
  formatDate,
  type AttendanceRecord,
  type AttendanceStatus,
} from "@/lib/attendance-data"
import { StatusBadge } from "./ui"

export interface MonthCalendarProps {
  records: AttendanceRecord[]
  month?: string // "YYYY-MM" (e.g. "2026-08")
  onMonthChange?: (month: string) => void
  onSelectDay?: (date: string) => void
  selectedDate?: string | null
  showNavigation?: boolean
  showSelectedDayCard?: boolean
  className?: string
}

export function MonthCalendar({
  records,
  month: controlledMonth,
  onMonthChange,
  onSelectDay,
  selectedDate: controlledSelectedDate,
  showNavigation = true,
  showSelectedDayCard = true,
  className,
}: MonthCalendarProps) {
  // Internal month state if not controlled from parent
  const [internalMonth, setInternalMonth] = useState<string>(() => {
    if (controlledMonth) return controlledMonth
    if (records.length > 0) {
      const sorted = [...records].sort((a, b) => (a.date < b.date ? 1 : -1))
      return sorted[0].date.slice(0, 7)
    }
    return TODAY.slice(0, 7)
  })

  // Internal selected date state if not controlled
  const [internalSelectedDate, setInternalSelectedDate] = useState<string | null>(null)

  const activeMonth = controlledMonth ?? internalMonth
  const activeSelectedDate = controlledSelectedDate !== undefined ? controlledSelectedDate : internalSelectedDate

  const handleMonthChange = (newMonth: string) => {
    if (onMonthChange) {
      onMonthChange(newMonth)
    } else {
      setInternalMonth(newMonth)
    }
  }

  const handleSelectDay = (date: string) => {
    if (onSelectDay) {
      onSelectDay(date)
    } else {
      setInternalSelectedDate(date)
    }
  }

  const handlePrevMonth = () => {
    const [y, m] = activeMonth.split("-").map(Number)
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`
    handleMonthChange(prev)
  }

  const handleNextMonth = () => {
    const [y, m] = activeMonth.split("-").map(Number)
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
    handleMonthChange(next)
  }

  const handleToday = () => {
    const todayMonth = TODAY.slice(0, 7)
    handleMonthChange(todayMonth)
    handleSelectDay(TODAY)
  }

  const byDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records])

  const { days, leading, monthTitle } = useMemo(() => {
    const [year, monthNum] = activeMonth.split("-").map(Number)
    const totalDays = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
    const firstDow = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay() // 0 = Sun
    const list: string[] = []
    for (let i = 1; i <= totalDays; i++) {
      list.push(`${year}-${String(monthNum).padStart(2, "0")}-${String(i).padStart(2, "0")}`)
    }
    const title = formatDate(`${activeMonth}-01`, { month: "long", year: "numeric" })
    return { days: list, leading: firstDow, monthTitle: title }
  }, [activeMonth])

  const weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const selectedRecord = activeSelectedDate ? byDate.get(activeSelectedDate) : null

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Dynamic Month Navigation Bar */}
      {showNavigation && (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground sm:text-base">
              {monthTitle}
            </span>
            {activeMonth === TODAY.slice(0, 7) && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Current
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="inline-flex size-7.5 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-accent hover:text-accent-foreground"
              title="Previous month"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
              title="Jump to today"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="inline-flex size-7.5 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-accent hover:text-accent-foreground"
              title="Next month"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Weekday Columns */}
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
        {weekLabels.map((w) => (
          <div key={w} className="py-0.5">{w}</div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((date) => {
          const rec = byDate.get(date)
          const dayOfWeek = new Date(date + "T00:00:00Z").getUTCDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
          const holidayName = HOLIDAYS[date]
          const isFuture = date > TODAY
          const isToday = date === TODAY

          let status: AttendanceStatus
          if (rec) {
            status = rec.status
          } else if (holidayName) {
            status = "holiday"
          } else if (isWeekend) {
            status = "weekend"
          } else if (isFuture) {
            status = "present"
          } else {
            status = "absent"
          }

          const meta = STATUS_META[status]
          const dayNum = Number(date.slice(-2))
          const isMuted = (status === "weekend" || status === "holiday" || (isFuture && !rec))
          const isSelected = activeSelectedDate === date

          return (
            <button
              key={date}
              type="button"
              onClick={() => handleSelectDay(date)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs transition cursor-pointer hover:ring-2 hover:ring-ring/40",
                isMuted && !rec ? "border-transparent bg-muted/40 hover:bg-muted/70" : cn("border-border", meta.bg),
                isSelected && "ring-2 ring-primary ring-offset-2 dark:ring-offset-card font-semibold shadow-sm z-10",
                isFuture && !rec && "opacity-45",
              )}
              aria-label={`${date}: ${meta.label}${holidayName ? ` (${holidayName})` : ""}`}
            >
              <span
                className={cn(
                  "absolute left-1.5 top-1 text-[10px] font-medium",
                  isMuted && !rec ? "text-muted-foreground" : meta.fg,
                )}
              >
                {dayNum}
              </span>
              {isToday ? (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary ring-2 ring-primary/30" aria-hidden />
              ) : null}
              {holidayName && !rec ? (
                <span className="mt-1 text-[10px] font-semibold text-status-leave-foreground" title={holidayName}>
                  H
                </span>
              ) : isWeekend && !rec ? (
                <span className="mt-1 text-xs text-muted-foreground/60">—</span>
              ) : !isFuture || rec ? (
                <span className={cn("mt-1 text-sm font-semibold", meta.fg)}>{meta.short}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Selected Day Details Panel */}
      {showSelectedDayCard && activeSelectedDate && (
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3.5 transition">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground sm:text-sm">
                {formatDate(activeSelectedDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </span>
              {activeSelectedDate === TODAY && (
                <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                  Today
                </span>
              )}
              {HOLIDAYS[activeSelectedDate] && (
                <span className="rounded bg-status-leave px-1.5 py-0.2 text-[10px] font-medium text-status-leave-foreground">
                  {HOLIDAYS[activeSelectedDate]}
                </span>
              )}
            </div>
            <StatusBadge
              status={
                selectedRecord?.status ??
                (HOLIDAYS[activeSelectedDate]
                  ? "holiday"
                  : [0, 6].includes(new Date(activeSelectedDate + "T00:00:00Z").getUTCDay())
                    ? "weekend"
                    : activeSelectedDate > TODAY
                      ? "present"
                      : "absent")
              }
            />
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-card/60 p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check In</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-foreground sm:text-sm">
                {selectedRecord?.checkIn ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check Out</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-foreground sm:text-sm">
                {selectedRecord?.checkOut ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Worked</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-foreground sm:text-sm">
                {selectedRecord?.workedHours ? `${selectedRecord.workedHours}h` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Late arrival</p>
              <p
                className={cn(
                  "mt-0.5 font-mono text-xs font-semibold sm:text-sm",
                  selectedRecord?.lateMinutes ? "text-status-late-foreground font-bold" : "text-foreground",
                )}
              >
                {selectedRecord?.lateMinutes ? `${selectedRecord.lateMinutes}m` : "0m"}
              </p>
            </div>
          </div>
        </div>
      )}
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
