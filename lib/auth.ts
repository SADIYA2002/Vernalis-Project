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
        const person = ALL_PEOPLE.find((p) => p.email.toLowerCase() === email || p.id.toLowerCase() === email)

        if (!person) {
          return null
        }

        // Demo password: accept 'password123' or empty/demo password
        const password = credentials.password || ""
        if (password && password !== "password123" && password !== "demo") {
          return null
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
