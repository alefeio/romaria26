import "server-only";

import { requireRole } from "@/lib/auth";
import { VoucherScannerClient } from "./scanner-client";

export default async function AdminVoucherScanPage() {
  await requireRole(["ADMIN", "MASTER"]);
  return <VoucherScannerClient />;
}
