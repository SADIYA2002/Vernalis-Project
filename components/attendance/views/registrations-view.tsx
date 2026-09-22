"use client"

import { useState } from "react"
import { Check, X, Clock, UserCheck, ShieldCheck, Mail, Building2, Briefcase, Calendar } from "lucide-react"
import { useStore, type RegistrationRequest } from "../store"
import { PageHeading, Card, CardHeader } from "../ui"

export function RegistrationsView() {
  const { registrationRequests, approveRegistration, rejectRegistration } = useStore()
  const [filter, setFilter] = useState<"pending" | "all" | "approved" | "rejected">("pending")
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const requests = registrationRequests || []
  const filtered = requests.filter((r) => {
    if (filter === "all") return true
    return r.status === filter
  })

  const pendingCount = requests.filter((r) => r.status === "pending").length

  async function handleApprove(id: string) {
    setActionLoadingId(id)
    try {
      await approveRegistration(id)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleReject(id: string) {
    setActionLoadingId(id)
    try {
      await rejectRegistration(id)
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Employee Registrations"
        description="Review, verify, and approve new candidates requesting access to the Chrono portal."
      />

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setFilter("pending")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            filter === "pending"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <Clock className="size-3.5" />
          Pending Approvals
          {pendingCount > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                filter === "pending"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setFilter("all")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            filter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          All Requests ({requests.length})
        </button>

        <button
          onClick={() => setFilter("approved")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            filter === "approved"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          Approved ({requests.filter((r) => r.status === "approved").length})
        </button>

        <button
          onClick={() => setFilter("rejected")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            filter === "rejected"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          Rejected ({requests.filter((r) => r.status === "rejected").length})
        </button>
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <UserCheck className="size-6" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            No {filter !== "all" ? filter : ""} registration requests
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {filter === "pending"
              ? "All candidate registration requests have been reviewed."
              : "New employee registration requests will appear here."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((req) => {
            const isLoading = actionLoadingId === req.id
            const isPending = req.status === "pending"

            const roleBadges: Record<string, string> = {
              employee: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900",
              manager: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900",
              hr: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900",
              payroll: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900",
            }

            return (
              <Card key={req.id} className="p-5 transition hover:border-border/80">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                      {req.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">{req.name}</h4>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            roleBadges[req.role] || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {req.role}
                        </span>

                        {isPending && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                            <Clock className="size-3" /> Pending Review
                          </span>
                        )}
                        {req.status === "approved" && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                            <Check className="size-3" /> Approved & Active
                          </span>
                        )}
                        {req.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:text-red-300">
                            <X className="size-3" /> Rejected
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="size-3.5" /> {req.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Briefcase className="size-3.5" /> {req.designation}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3.5" /> {req.department}
                        </span>
                        {req.managerId && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="size-3.5" /> Manager: {req.managerId}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        Submitted: {new Date(req.submittedAt).toLocaleString()}
                        {req.reviewedBy && ` · Reviewed by ${req.reviewedBy}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {isPending && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <X className="size-3.5" /> Reject
                      </button>

                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="size-3.5" />
                        {isLoading ? "Approving..." : "Approve & Activate"}
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
