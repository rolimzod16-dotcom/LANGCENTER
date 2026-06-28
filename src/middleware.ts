import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminAuthenticated } from "@/lib/auth/admin-constants";

const PUBLIC_ADMIN_PATHS = ["/admin/login"];

const PUBLIC_API_PATHS = [
  "/api/teachers/login",
  "/api/students/login",
  "/api/logout",
  "/api/download/apk",
  "/api/teacher/me",
  "/api/student/me",
  "/api/attendance",
  "/api/grades",
];

function isProtectedAdminPage(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") &&
      !PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
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
    return pathname !== "/api/students/login";
  }
  if (pathname === "/api/assign") return true;
  if (pathname.startsWith("/api/owner")) return true;
  if (pathname.startsWith("/api/payments")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = isAdminAuthenticated(
    request.cookies.get(ADMIN_COOKIE)?.value,
  );

  if (isAdmin) return NextResponse.next();

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
  ],
};