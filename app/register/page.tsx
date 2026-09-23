"use client"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  CalendarCheck,
  ShieldCheck,
  UserPlus,
  Lock,
  Mail,
  User,
  Building2,
  Briefcase,
  AlertCircle,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react"
import type { Role } from "@/lib/attendance-data"

const ROLES: { id: Role; label: string; badge: string; desc: string }[] = [
  {
    id: "employee",
    label: "Employee",
    badge: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900",
    desc: "Mark daily attendance, apply for leaves, submit timesheet corrections",
  },
  {
    id: "manager",
    label: "Manager",
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900",
    desc: "Oversee team attendance, approve leave applications & timesheet corrections",
  },
  {
    id: "hr",
    label: "HR Admin",
    badge: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900",
    desc: "Workforce directory, company muster register, attendance admin",
  },
  {
    id: "payroll",
    label: "Payroll Officer",
    badge: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900",
    desc: "Statutory payroll math, LOP deductions, cycle locking & reconciliation",
  },
]

const MANAGERS = [
  { id: "mgr-01", name: "Vikram Rao (Engineering Manager)" },
  { id: "mgr-02", name: "Divya Kapoor (Team Lead - Design & Sales)" },
  { id: "none", name: "None / Top-level Admin" },
]

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("employee")
  const [department, setDepartment] = useState("Engineering")
  const [designation, setDesignation] = useState("Software Engineer")
  const [managerId, setManagerId] = useState("mgr-01")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [regResult, setRegResult] = useState<any>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. Call Register API
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password: password || "password123",
          role,
          department,
          designation,
          managerId: managerId === "none" ? null : managerId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to register employee")
      }

      setRegResult(data)
      setSuccess(true)
      setLoading(false)
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.")
      setLoading(false)
    }
  }

  if (success) {
    const isAutoApproved = regResult?.pendingApproval === false || role === "hr"

    return (
      <div className="flex min-h-screen flex-col justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-xl sm:p-8">
            <div
              className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
                isAutoApproved
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              {isAutoApproved ? <CheckCircle2 className="size-8" /> : <Clock className="size-8" />}
            </div>
            <h3 className="mt-4 text-xl font-bold text-foreground">
              {isAutoApproved ? "Account Activated Automatically" : "Registration Submitted"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {isAutoApproved ? (
                <>
                  Welcome, <strong className="text-foreground">{name}</strong>! As <strong className="text-foreground capitalize">{role}</strong>, your account has been approved automatically and is ready for use.
                </>
              ) : (
                <>
                  Thank you, <strong className="text-foreground">{name}</strong>! Your registration request for the role of{" "}
                  <strong className="text-foreground capitalize">{role}</strong> in{" "}
                  <strong className="text-foreground">{department}</strong> has been submitted.
                </>
              )}
            </p>

            <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Work Email:</span>
                <span className="font-semibold text-foreground">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Designation:</span>
                <span className="font-semibold text-foreground">{designation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                {isAutoApproved ? (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-bold uppercase text-[10px] text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-3" /> Active / Approved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-bold uppercase text-[10px] text-amber-700 dark:text-amber-300">
                    <Clock className="size-3" /> Pending Approval
                  </span>
                )}
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              {isAutoApproved
                ? "Your HR privileges have been enabled. You can now sign in with your email and password."
                : "An HR Administrator (Meera Joshi) will review and approve your registration. Once approved, you can sign in with your credentials."}
            </p>

            <div className="mt-6">
              <Link
                href="/login"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
              >
                {isAutoApproved ? "Sign In Now" : "Return to Sign In"} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <CalendarCheck className="size-7" />
          </span>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Register New Employee
        </h2>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          Join the organization and access your role-based portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive">
              <AlertCircle className="size-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>Registration successful! Signing you in...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full Name
              </label>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="block w-full rounded-lg border border-input bg-background pl-9 pr-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <User className="size-4" />
                </span>
              </div>
            </div>

            {/* Email & Password grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Work Email
                </label>
                <div className="relative mt-1.5">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@acme.co"
                    className="block w-full rounded-lg border border-input bg-background pl-9 pr-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Mail className="size-4" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="block w-full rounded-lg border border-input bg-background pl-9 pr-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Lock className="size-4" />
                  </span>
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Assign Role & Access Level
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLES.map((r) => {
                  const isSelected = role === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:border-primary/40 hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{r.label}</span>
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${r.badge}`}>
                          {r.id}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                        {r.desc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Department & Designation */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Department
                </label>
                <div className="relative mt-1.5">
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="block w-full rounded-lg border border-input bg-background pl-9 pr-3.5 py-2.5 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Design & Sales">Design & Sales</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Building2 className="size-4" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Designation
                </label>
                <div className="relative mt-1.5">
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    className="block w-full rounded-lg border border-input bg-background pl-9 pr-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Briefcase className="size-4" />
                  </span>
                </div>
              </div>
            </div>

            {/* Reporting Manager */}
            {role === "employee" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reporting Manager
                </label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  {MANAGERS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Leave requests and corrections will be routed to this manager for approval.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !name || !email}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Registering & Syncing...
                </>
              ) : (
                <>
                  <UserPlus className="size-4" /> Register & Access Portal <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Link to Login */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            Already have an employee account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary transition hover:underline"
            >
              Sign in here
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
            <span>Persists to Supabase cloud database & initializes leave quotas</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
