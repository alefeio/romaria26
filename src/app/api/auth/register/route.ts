import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildAuthSessionToken, getAuthCookieOptions, AUTH_TOKEN_COOKIE_NAME, hashPassword } from "@/lib/auth";
import { jsonErr } from "@/lib/http";
import { registerSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
    }

    const name = parsed.data.name.trim();
    const email = parsed.data.email.trim().toLowerCase();
    const passwordHash = await hashPassword(parsed.data.password);

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return jsonErr("EMAIL_IN_USE", "Este e-mail já está cadastrado. Faça login.", 409);
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "CUSTOMER",
        isActive: true,
        mustChangePassword: false,
        isAdmin: false,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, isAdmin: true },
    });

    const token = await buildAuthSessionToken(user);
    const res = NextResponse.json({ ok: true as const, data: { user } }, { status: 201 });
    res.cookies.set(AUTH_TOKEN_COOKIE_NAME, token, getAuthCookieOptions());
    return res;
  } catch (e) {
    console.error("[auth/register]", e);
    return jsonErr("SERVER_ERROR", "Não foi possível concluir o cadastro. Tente novamente.", 500);
  }
}

