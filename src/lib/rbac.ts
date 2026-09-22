import type { UserRole } from "@/generated/prisma/client";

export const MASTER_ONLY: UserRole[] = ["MASTER"];
export const MASTER_OR_ADMIN: UserRole[] = ["MASTER", "ADMIN"];
export const SELLER_ONLY: UserRole[] = ["SELLER"];

export const SELLER_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export function isAdminOrMasterRole(role: UserRole | string | null | undefined): boolean {
  return role === "MASTER" || role === "ADMIN";
}

export function isSellerRole(role: UserRole | string | null | undefined): boolean {
  return role === "SELLER";
}
