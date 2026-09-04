import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Ignore public assets, api routes (which have their own granular auth), and next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "chrono-attendance-portal-super-secret-key-32-chars-minimum-prod",
  })

  // If visiting /login while already authenticated, redirect to root portal
  if (pathname === "/login") {
    if (token) {
      return NextResponse.redirect(new URL("/", req.url))
    }
    return NextResponse.next()
  }

  // Protect all /portal routes
  if (pathname.startsWith("/portal")) {
    if (!token) {
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }

    const role = token.role as string

    // Allow /portal/unauthorized without role check
    if (pathname === "/portal/unauthorized") {
      return NextResponse.next()
    }

    // Role-based route gating
    if (pathname.startsWith("/portal/manager")) {
      if (role !== "manager" && role !== "hr") {
        return NextResponse.redirect(new URL("/portal/unauthorized", req.url))
      }
    }

    if (pathname.startsWith("/portal/hr")) {
      if (role !== "hr") {
        return NextResponse.redirect(new URL("/portal/unauthorized", req.url))
      }
    }

    if (pathname.startsWith("/portal/payroll")) {
      if (role !== "payroll" && role !== "hr") {
        return NextResponse.redirect(new URL("/portal/unauthorized", req.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/portal/:path*", "/login"],
}
