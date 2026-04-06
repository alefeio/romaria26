import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAuthSessionToken,
  verifyPassword,
  AUTH_TOKEN_COOKIE_NAME,
  getAuthCookieOptions,
  type SessionUser,
} from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/client";
import { jsonErr } from "@/lib/http";
import { loginSchema } from "@/lib/validators/auth";

const userLoginSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isAdmin: true,
  isActive: true,
  mustChangePassword: true,
  passwordHash: true,
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    const { login, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: login },
      select: userLoginSelect,
    });

    if (!user || !user.isActive) {
      return jsonErr("INVALID_CREDENTIALS", "E-mail ou senha inválidos.", 401);
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return jsonErr("INVALID_CREDENTIALS", "E-mail ou senha inválidos.", 401);
    }

    const sessionUser: SessionUser & { isAdmin?: boolean } = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword ?? false,
      isAdmin: user.isAdmin ?? false,
    };

    const token = await buildAuthSessionToken(sessionUser);
    const res = NextResponse.json({
      ok: true as const,
      data: {
        user: {
          id: sessionUser.id,
          name: sessionUser.name,
          email: sessionUser.email,
          role: sessionUser.role,
          mustChangePassword: sessionUser.mustChangePassword,
        },
        needsRoleChoice: false,
      },
    });
    res.cookies.set(AUTH_TOKEN_COOKIE_NAME, token, getAuthCookieOptions());
    return res;
  } catch (e) {
    console.error("[auth/login]", e);
    return jsonErr("SERVER_ERROR", "Não foi possível concluir o login. Tente novamente.", 500);
  }
}
