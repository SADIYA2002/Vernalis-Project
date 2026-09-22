import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { ALL_PEOPLE, type Role } from "@/lib/attendance-data"

declare module "next-auth" {
  interface User {
    id: string
    name: string
    email: string
    role: Role
    department: string
    designation: string
    managerId: string | null
  }

  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: Role
      department: string
      designation: string
      managerId: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    department: string
    designation: string
    managerId: string | null
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "chrono-attendance-portal-super-secret-key-32-chars-minimum-prod",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Chrono Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "sadiya.mulla@acme.co" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null
        }

        const email = credentials.email.trim().toLowerCase()
        const { getEmployees, verifyUserPassword } = await import("@/lib/server/attendance-db")

        let person = ALL_PEOPLE.find((p) => p.email.toLowerCase() === email || p.id.toLowerCase() === email)

        try {
          const employees = await getEmployees()
          const dbPerson = employees.find((p) => p.email.toLowerCase() === email || p.id.toLowerCase() === email)
          if (dbPerson) {
            person = dbPerson
          }
        } catch (err) {
          console.error("Error fetching employees in auth:", err)
        }

        if (!person) {
          const { getRegistrationRequests } = await import("@/lib/server/attendance-db")
          try {
            const regRequests = await getRegistrationRequests()
            const req = regRequests.find((r) => r.email.toLowerCase() === email)
            if (req && req.status === "pending") {
              throw new Error("PENDING_APPROVAL: Your registration is currently awaiting HR / Manager review.")
            }
            if (req && req.status === "rejected") {
              throw new Error("REJECTED: Your registration request was rejected by an administrator.")
            }
          } catch (err: any) {
            if (err?.message?.startsWith("PENDING_APPROVAL") || err?.message?.startsWith("REJECTED")) {
              throw err
            }
          }
          return null
        }

        // Check if candidate account is still pending approval or rejected
        if (person.id.startsWith("reg-") || person.designation?.includes("[PENDING]")) {
          throw new Error("PENDING_APPROVAL: Your registration is currently awaiting HR / Manager review.")
        }
        if (person.designation?.includes("[REJECTED]")) {
          throw new Error("REJECTED: Your registration request was rejected by an administrator.")
        }

        // Verify password
        const password = credentials.password || ""
        if (!verifyUserPassword(email, password)) {
          return null
        }

        // Update sign-in timestamp directly in Supabase employees table
        try {
          const { getSupabaseClient } = await import("@/lib/supabase")
          const supabase = getSupabaseClient()
          if (supabase) {
            await supabase
              .from("employees")
              .update({ created_at: new Date().toISOString() })
              .eq("id", person.id)
          }
        } catch {
          // Ignore timestamp update error if offline
        }

        return {
          id: person.id,
          name: person.name,
          email: person.email,
          role: person.baseRole,
          department: person.department,
          designation: person.designation,
          managerId: person.managerId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.department = user.department
        token.designation = user.designation
        token.managerId = user.managerId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.department = token.department
        session.user.designation = token.designation
        session.user.managerId = token.managerId
      }
      return session
    },
  },
}
