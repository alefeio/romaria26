import { getSessionUserFromCookie } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/http";

/** Retorna os perfis disponíveis para o usuário logado (para a tela de escolha de perfil). */
export async function GET() {
  const user = await getSessionUserFromCookie();
  if (!user) {
    return jsonErr("UNAUTHORIZED", "Faça login para continuar.", 401);
  }

  return jsonOk({
    canAdmin: user.isAdmin === true || user.baseRole === "ADMIN" || user.baseRole === "MASTER",
    canMaster: user.baseRole === "MASTER",
    canCustomer: user.baseRole === "CUSTOMER",
  });
}
