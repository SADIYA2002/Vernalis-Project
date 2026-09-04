import { getServerSession } from "next-auth/next"
import { getToken } from "next-auth/jwt"
import { type NextRequest, NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { directReports, type Role } from "@/lib/attendance-data"

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  role: Role
  department: string
  designation: string
  managerId: string | null
}

/**
 * Retrieves the current session user on the server.
 * Supports both Route Handlers (using getToken if req is supplied) and Server Components.
 */
export async function getAuthUser(req?: NextRequest): Promise<AuthenticatedUser | null> {
  if (req) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET || "chrono-attendance-portal-super-secret-key-32-chars-minimum-prod",
    })
    if (token && token.id && token.role) {
      return {
        id: token.id as string,
        name: (token.name as string) || "",
        email: (token.email as string) || "",
        role: token.role as Role,
        department: (token.department as string) || "",
        designation: (token.designation as string) || "",
        managerId: (token.managerId as string | null) ?? null,
      }
    }
  }

  const session = await getServerSession(authOptions)
  if (session?.user?.id && session?.user?.role) {
    return session.user as AuthenticatedUser
  }

  return null
}

/**
 * Enforces authentication and optional role restrictions.
 * If unauthorized, returns an error NextResponse (401 or 403).
 */
export async function requireAuth(
  req?: NextRequest,
  allowedRoles?: Role[],
): Promise<{ user: AuthenticatedUser; errorResponse?: never } | { user?: never; errorResponse: NextResponse }> {
  const user = await getAuthUser(req)

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 },
      ),
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      errorResponse: NextResponse.json(
        { error: `Forbidden. Role '${user.role}' is not authorized to access this resource.` },
        { status: 403 },
      ),
    }
  }

  return { user }
}

/**
 * Checks whether an employee is a direct report of a manager.
 */
export function isDirectReport(managerId: string, employeeId: string): boolean {
  const reports = directReports(managerId)
  return reports.some((r) => r.id === employeeId)
}

/**
 * Checks whether the current user is authorized to read or review data for targetEmployeeId.
 * - Any user can access their own data.
 * - Managers can access their direct reports.
 * - HR and Payroll can access all employees.
 */
export function canAccessEmployeeData(user: AuthenticatedUser, targetEmployeeId: string): boolean {
  if (user.id === targetEmployeeId) return true
  if (user.role === "hr" || user.role === "payroll") return true
  if (user.role === "manager") return isDirectReport(user.id, targetEmployeeId)
  return false
}
