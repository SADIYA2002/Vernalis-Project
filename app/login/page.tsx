"use client"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarCheck, ShieldCheck, UserCheck, Lock, AlertCircle, ArrowRight, Loader2 } from "lucide-react"

const DEMO_ACCOUNTS = [
  {
    name: "Sadiya Mulla",
    email: "sadiya.mulla@acme.co",
    role: "Employee",
    roleBadge: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900",
    designation: "Software Engineer",
    department: "Engineering",
    blurb: "Mark attendance, view timesheets, request corrections & leaves",
  },
  {
    name: "Vikram Rao",
    email: "vikram.rao@acme.co",
    role: "Manager",
    roleBadge: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900",
    designation: "Engineering Manager",
    department: "Engineering",
    blurb: "Team overview, approve timesheets, approve team leave & corrections",
  },
  {
    name: "Meera Joshi",
    email: "meera.joshi@acme.co",
    role: "HR",
    roleBadge: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900",
    designation: "HR Manager",
    department: "Human Resources",
    blurb: "Workforce analytics, company muster register, leave administration",
  },
  {
    name: "Sanjay Verma",
    email: "sanjay.verma@acme.co",
    role: "Payroll",
    roleBadge: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900",
    designation: "Payroll Officer",
    department: "Finance",
    blurb: "Statutory payroll inputs, LOP calculations, net attendance pay",
  },
]

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("password123")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeAccount, setActiveAccount] = useState<string | null>(null)

  async function handleLogin(e?: React.FormEvent, customEmail?: string) {
    if (e) e.preventDefault()
    setError(null)
    setLoading(true)

    const targetEmail = customEmail || email

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: targetEmail,
        password: password || "password123",
        callbackUrl,
      })

      if (res?.error) {
        setError("Invalid credentials. Please verify your email.")
        setLoading(false)
        setActiveAccount(null)
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setError("An unexpected error occurred during sign in.")
      setLoading(false)
      setActiveAccount(null)
    }
  }

  function handleDemoClick(accountEmail: string) {
    setActiveAccount(accountEmail)
    setEmail(accountEmail)
    handleLogin(undefined, accountEmail)
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
          Sign in to Chrono
        </h2>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          Enterprise Attendance & Role-Based Workforce Portal
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

          {/* Direct credentials form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@acme.co"
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
                  <Lock className="size-4" />
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Demo password is <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">password123</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-50"
            >
              {loading && !activeAccount ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign in with Credentials <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Personas */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="bg-card px-3 text-muted-foreground font-medium">
                  Or 1-Click Sign in as Demo Role
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = activeAccount === acc.email && loading
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleDemoClick(acc.email)}
                    disabled={loading}
                    className="flex flex-col items-start rounded-xl border border-border bg-card/60 p-3.5 text-left transition hover:border-primary/50 hover:bg-accent/40 disabled:opacity-50"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="size-3.5 text-primary" />
                        <span className="text-xs font-semibold text-foreground">{acc.name}</span>
                      </div>
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${acc.roleBadge}`}
                      >
                        {acc.role}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {acc.designation} · {acc.department}
                    </p>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground/80">
                      {acc.blurb}
                    </p>

                    <div className="mt-2.5 flex w-full items-center justify-between text-[11px] font-medium text-primary">
                      <span>{isSelected ? "Signing in..." : "Instant Login"}</span>
                      {isSelected ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <ArrowRight className="size-3 transition group-hover:translate-x-0.5" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
            <span>Server-side cryptographic JWT cookie sessions enforced</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
