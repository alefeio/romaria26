import { randomUUID } from "crypto";

/** Sufixo interno: clientes sem e-mail informado recebem endereço único para cumprir `User.email` no Prisma. */
const DOMAIN = "sem-email.interno";

/**
 * Gera e-mail interno único (não recebe mensagens reais; uso apenas para login por e-mail, se o cliente atribuir e-mail depois).
 */
export function generateCustomerPlaceholderEmail(): string {
  return `u-${randomUUID().replace(/-/g, "")}@${DOMAIN}`;
}

export function isCustomerPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const e = email.trim().toLowerCase();
  return e.endsWith(`@${DOMAIN}`);
}

/**
 * Rótulo para UI quando o e-mail é só interno/placeholder.
 */
export function displayCustomerEmail(email: string | null | undefined): string {
  if (!email || isCustomerPlaceholderEmail(email)) return "—";
  return email;
}
