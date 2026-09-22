import { type NextRequest, NextResponse } from "next/server"
import { registerNewEmployee, type RegisterEmployeeInput } from "@/lib/server/attendance-db"
import type { Role } from "@/lib/attendance-data"

const VALID_ROLES: Role[] = ["employee", "manager", "hr", "payroll"]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, role, department, designation, managerId, monthlySalary } = body

    // 1. Validation
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Full name must be at least 2 characters." },
        { status: 400 },
      )
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 },
      )
    }

    if (password && (typeof password !== "string" || password.length < 6)) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 },
      )
    }

    const assignedRole: Role = VALID_ROLES.includes(role) ? role : "employee"

    const input: RegisterEmployeeInput = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password || "password123",
      role: assignedRole,
      department: department?.trim() || "Engineering",
      designation: designation?.trim() || "Staff Member",
      managerId: managerId && managerId !== "none" ? managerId : null,
      monthlySalary: Number(monthlySalary) || undefined,
    }

    // 2. Submit employee registration request (pending HR/Manager approval)
    const regRequest = await registerNewEmployee(input)

    return NextResponse.json(
      {
        success: true,
        pendingApproval: true,
        message: "Registration submitted successfully. Awaiting approval from HR or your Reporting Manager.",
        request: {
          id: regRequest.id,
          name: regRequest.name,
          email: regRequest.email,
          role: regRequest.role,
          department: regRequest.department,
          designation: regRequest.designation,
          status: regRequest.status,
          submittedAt: regRequest.submittedAt,
        },
      },
      { status: 201 },
    )
  } catch (error: any) {
    console.error("Registration error:", error)
    const isConflict = error?.message?.includes("already exists")
    return NextResponse.json(
      { error: error?.message || "Failed to register employee" },
      { status: isConflict ? 409 : 500 },
    )
  }
}
