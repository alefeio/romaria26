import { NextResponse, type NextRequest } from "next/server";

import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/setup", "/confirmar-inscricao", "/esqueci-senha", "/redefinir-senha"];
const AUTH_COOKIE_NAME = "auth_token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname + (request.nextUrl.search || ""));
    return NextResponse.redirect(loginUrl);
  }

  let role: string | undefined;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
    const { payload } = await jwtVerify(token, secret);
    role = typeof payload.role === "string" ? payload.role : undefined;
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname + (request.nextUrl.search || ""));
    return NextResponse.redirect(loginUrl);
  }

  const dashboardUrl = new URL("/dashboard", request.url);

  if (pathname.startsWith("/users")) {
    if (role !== "MASTER") {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/admin/site") || pathname.startsWith("/admin/sms") || pathname.startsWith("/admin/email")) {
    if (role !== "MASTER" && role !== "ADMIN") {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/admin/pacotes") || pathname.startsWith("/admin/reservas") || pathname.startsWith("/admin/tablet")) {
    if (role !== "MASTER" && role !== "ADMIN") {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (pathname.startsWith("/cliente")) {
    if (role !== "CUSTOMER") {
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/users/:path*",
    "/meus-dados/:path*",
    "/trocar-senha/:path*",
    "/escolher-perfil/:path*",
    "/suporte/:path*",
    "/admin/site/:path*",
    "/admin/sms/:path*",
    "/admin/email/:path*",
    "/admin/pacotes/:path*",
    "/admin/reservas/:path*",
    "/admin/tablet/:path*",
    "/cliente/:path*",
  ],
};
