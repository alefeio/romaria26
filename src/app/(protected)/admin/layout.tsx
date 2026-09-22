import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";

export default async function AdminAreaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSessionUser();
  if (user.role === "SELLER") redirect("/vendedor");
  if (user.role !== "ADMIN" && user.role !== "MASTER") redirect("/dashboard");
  return <>{children}</>;
}
