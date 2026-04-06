import "server-only";

import { requireRole } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { jsonErr } from "@/lib/http";

export async function requireAdminApi(): Promise<SessionUser | Response> {
  try {
    return await requireRole(["ADMIN", "MASTER"]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") return jsonErr("UNAUTHORIZED", "Não autenticado.", 401);
    return jsonErr("FORBIDDEN", "Acesso negado.", 403);
  }
}
