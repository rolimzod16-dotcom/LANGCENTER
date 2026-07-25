import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminCookie } from "@/lib/auth/admin-constants";

const PUBLIC_ADMIN_PATHS = ["/admin/login"];

const PUBLIC_API_PATHS = [
  "/api/teachers/login",
  "/api/students/login",
  "/api/students/register",
  "/api/logout",
  "/api/download/apk",
  "/api/teacher/me",
  "/api/student/me",
  "/api/attendance",
  "/api/grades",
  "/api/admin/login",
];

function isProtectedAdminPage(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") &&
      !PUBLIC_ADMIN_PATHS.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      ))
  );
}

function isProtectedAdminApi(pathname: string): boolean {
  if (PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  if (pathname === "/api/teachers" || pathname.startsWith("/api/teachers/")) {
    return pathname !== "/api/teachers/login";
  }
  if (pathname === "/api/students" || pathname.startsWith("/api/students/")) {
    return (
      pathname !== "/api/students/login" &&
      pathname !== "/api/students/register"
    );
  }
  if (pathname === "/api/assign") return true;
  if (pathname.startsWith("/api/owner")) return true;
  if (pathname.startsWith("/api/payments")) return true; // includes /api/payments/student
  if (pathname.startsWith("/api/admin") && pathname !== "/api/admin/login") {
    return true;
  }
  if (pathname.startsWith("/api/org")) return true;
  if (pathname.startsWith("/api/groups")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const admin = await verifyAdminCookie(
    request.cookies.get(ADMIN_COOKIE)?.value,
  );

  if (admin) return NextResponse.next();

  if (isProtectedAdminPage(pathname)) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (isProtectedAdminApi(pathname)) {
    return NextResponse.json(
      { error: "Нет доступа. Только для администратора." },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/teachers/:path*",
    "/api/students/:path*",
    "/api/assign",
    "/api/owner/:path*",
    "/api/payments/:path*",
    "/api/admin/:path*",
    "/api/org/:path*",
    "/api/groups/:path*",
  ],
};
