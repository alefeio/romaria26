import "server-only";

import { createHash } from "node:crypto";

import { EncryptJWT, jwtDecrypt } from "jose";

const AUD = "admin-welcome-copy";

/** Chave 256 bits derivada de AUTH_SECRET para JWE (dir + A256GCM). */
function encryptionKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "dev-secret-change-me";
  return new Uint8Array(createHash("sha256").update(secret).digest());
}

/** Token de uso único no link “copiar senha” do e-mail de boas-vindas admin (curta duração). */
export async function createAdminWelcomeCopyToken(params: { email: string; tempPassword: string }): Promise<string> {
  return new EncryptJWT({ e: params.email, p: params.tempPassword })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("72h")
    .setAudience(AUD)
    .encrypt(encryptionKey());
}

export async function decryptAdminWelcomeCopyToken(
  token: string
): Promise<{ email: string; tempPassword: string }> {
  const { payload } = await jwtDecrypt(token, encryptionKey(), {
    audience: AUD,
    keyManagementAlgorithms: ["dir"],
  });
  const email = typeof payload.e === "string" ? payload.e : "";
  const tempPassword = typeof payload.p === "string" ? payload.p : "";
  if (!email || !tempPassword) {
    throw new Error("INVALID_TOKEN_PAYLOAD");
  }
  return { email, tempPassword };
}
