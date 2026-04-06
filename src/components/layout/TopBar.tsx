"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type RoleOption = {
  value: "ADMIN" | "MASTER" | "CUSTOMER";
  label: string;
};

export function TopBar({
  user,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: "MASTER" | "ADMIN" | "CUSTOMER";
    baseRole?: "MASTER" | "ADMIN" | "CUSTOMER";
    isAdmin?: boolean;
    availableRoles?: {
      canMaster: boolean;
      canAdmin: boolean;
      canCustomer?: boolean;
    };
  };
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const r = user.availableRoles;
  const canMaster = r?.canMaster ?? user.baseRole === "MASTER";
  const canAdmin =
    r?.canAdmin ?? (user.isAdmin === true || user.baseRole === "ADMIN" || user.baseRole === "MASTER");
  const canCustomer = r?.canCustomer ?? user.baseRole === "CUSTOMER";

  const roleLabels: Record<RoleOption["value"], string> = {
    MASTER: "Administrador Master",
    ADMIN: "Admin (site)",
    CUSTOMER: "Cliente",
  };

  let roleOptions: RoleOption[] = [
    ...(canMaster ? [{ value: "MASTER" as const, label: roleLabels.MASTER }] : []),
    ...(canAdmin ? [{ value: "ADMIN" as const, label: roleLabels.ADMIN }] : []),
    ...(canCustomer ? [{ value: "CUSTOMER" as const, label: roleLabels.CUSTOMER }] : []),
  ];
  if (!roleOptions.some((o) => o.value === user.role)) {
    roleOptions = [...roleOptions, { value: user.role, label: roleLabels[user.role as RoleOption["value"]] ?? user.role }];
  }
  const hasMoreThanOneProfile = roleOptions.length >= 2;

  async function onRoleChange(newRole: RoleOption["value"]) {
    if (newRole === user.role) return;
    setSwitchingRole(true);
    try {
      const res = await fetch("/api/auth/choose-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (res.ok && json?.ok) router.refresh();
    } finally {
      setSwitchingRole(false);
    }
  }

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex shrink-0 items-center justify-end gap-2 px-3 py-2">
      <div className="relative flex items-center gap-2">
        <ThemeToggle aria-label="Alternar tema" />
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--card-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--igh-primary)] focus:ring-offset-2"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="Abrir menu do usuário"
          >
            <span className="hidden max-w-[120px] truncate sm:inline" title={user.name}>
              {user.name}
            </span>
            <svg className="h-4 w-4 shrink-0 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-lg"
                role="menu"
              >
                <div className="border-b border-[var(--card-border)] pb-3">
                  <p className="truncate font-medium text-[var(--text-primary)]" title={user.name}>
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]" title={user.email}>
                    {user.email}
                  </p>
                </div>
                {hasMoreThanOneProfile && (
                  <div className="border-b border-[var(--card-border)] py-3">
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Perfil</label>
                    <select
                      value={user.role}
                      disabled={switchingRole}
                      onChange={(e) => void onRoleChange(e.target.value as RoleOption["value"])}
                      className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1.5 text-sm text-[var(--input-text)] focus:border-[var(--igh-primary)] focus:outline-none"
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="border-b border-[var(--card-border)] py-3">
                  <p className="mb-1 text-xs font-medium text-[var(--text-muted)]">Tema</p>
                  <ThemeToggle showLabel className="w-full justify-start" />
                </div>
                <ul className="list-none space-y-0.5 py-3 pl-0">
                  <li>
                    <Link
                      href="/"
                      className="block rounded-md px-2 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Acessar site
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/meus-dados"
                      className="block rounded-md px-2 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Meus dados
                    </Link>
                  </li>
                </ul>
                <div className="pt-2">
                  <Button variant="secondary" className="w-full" onClick={logout} disabled={loading}>
                    Sair
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
