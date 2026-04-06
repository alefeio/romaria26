import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAuthSessionToken,
  getSessionUserFromCookie,
  AUTH_TOKEN_COOKIE_NAME,
  getAuthCookieOptions,
} from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import type { UserRole } from "@/generated/prisma/client";

const ALLOWED_ROLES: UserRole[] = ["MASTER", "ADMIN", "CUSTOMER"];

function jsonOkWithSession<T>(data: T, user: Parameters<typeof buildAuthSessionToken>[0], effectiveRole: UserRole) {
  return (async () => {
    const token = await buildAuthSessionToken(user, effectiveRole);
    const res = NextResponse.json({ ok: true as const, data });
    res.cookies.set(AUTH_TOKEN_COOKIE_NAME, token, getAuthCookieOptions());
    return res;
  })();
}

export async function POST(request: Request) {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Faça login para continuar.", 401);
  }

  const body = await request.json().catch(() => null);
  const role = body?.role as UserRole | undefined;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return jsonErr("VALIDATION_ERROR", "Escolha inválida.", 400);
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, isAdmin: true, isActive: true, mustChangePassword: true },
  });
  if (!full || !full.isActive) {
    return jsonErr("UNAUTHORIZED", "Sessão inválida.", 401);
  }

  const sessionPayload = {
    id: full.id,
    name: full.name,
    email: full.email,
    role: full.role,
    isActive: full.isActive,
    mustChangePassword: full.mustChangePassword ?? false,
    isAdmin: full.isAdmin ?? false,
  };

  if (role === "MASTER") {
    if (full.role !== "MASTER") {
      return jsonErr("FORBIDDEN", "Você não tem acesso como Administrador Master.", 403);
    }
    return jsonOkWithSession({ role: "MASTER" as const }, sessionPayload, "MASTER");
  }

  if (role === "ADMIN") {
    if (!full.isAdmin && full.role !== "ADMIN" && full.role !== "MASTER") {
      return jsonErr("FORBIDDEN", "Você não tem acesso como Admin.", 403);
    }
    return jsonOkWithSession({ role: "ADMIN" as const }, sessionPayload, "ADMIN");
  }

  if (role === "CUSTOMER") {
    if (full.role !== "CUSTOMER") {
      return jsonErr("FORBIDDEN", "Você não tem perfil de cliente.", 403);
    }
    return jsonOkWithSession({ role: "CUSTOMER" as const }, sessionPayload, "CUSTOMER");
  }

  return jsonErr("VALIDATION_ERROR", "Escolha inválida.", 400);
}
