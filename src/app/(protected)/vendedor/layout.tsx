import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSessionUser();
  if (user.role !== "SELLER") {
    redirect(user.role === "CUSTOMER" ? "/cliente/dashboard" : "/dashboard");
  }
  return <>{children}</>;
}
