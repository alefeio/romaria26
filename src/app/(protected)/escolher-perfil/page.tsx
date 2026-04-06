"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHero, SectionCard } from "@/components/dashboard/DashboardUI";
import { useUser } from "@/components/layout/UserProvider";
import { Button } from "@/components/ui/Button";
import type { ApiResponse } from "@/lib/api-types";

type RolesResponse = {
  canAdmin: boolean;
  canMaster?: boolean;
  canCustomer?: boolean;
};

export default function EscolherPerfilPage() {
  useUser();
  const router = useRouter();
  const [roles, setRoles] = useState<RolesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/roles")
      .then((res) => res.json())
      .then((json: ApiResponse<RolesResponse>) => {
        if (!cancelled && json?.ok && json.data) setRoles(json.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const canAdmin = roles?.canAdmin === true;
  const canMaster = roles?.canMaster === true;
  const canCustomer = roles?.canCustomer === true;
  const hasOperational = canAdmin || canMaster || canCustomer;

  useEffect(() => {
    if (roles !== null && !hasOperational) {
      router.replace("/dashboard");
    }
  }, [roles, hasOperational, router]);

  if (roles === null) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-0">
        <DashboardHero
          eyebrow="Sessão"
          title="Escolher perfil"
          description="Carregando os perfis disponíveis para sua conta."
        />
        <SectionCard title="Aguarde" variant="elevated">
          <p className="text-sm text-[var(--text-muted)]">Carregando perfis…</p>
        </SectionCard>
      </div>
    );
  }

  if (!hasOperational) {
    return null;
  }

  async function enterAs(role: "ADMIN" | "MASTER" | "CUSTOMER") {
    const res = await fetch("/api/auth/choose-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) return;
    router.replace("/dashboard");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-0 sm:py-4">
      <DashboardHero
        eyebrow="Sessão"
        title="Como deseja acessar?"
        description="Escolha o perfil para esta sessão (operação de passeios e site)."
      />
      <SectionCard title="Perfis disponíveis" variant="elevated">
        <div className="flex flex-col gap-3">
          {canMaster && (
            <Button variant="primary" className="w-full" onClick={() => void enterAs("MASTER")}>
              Entrar como Administrador Master
            </Button>
          )}
          {canAdmin && !canMaster && (
            <Button variant="primary" className="w-full" onClick={() => void enterAs("ADMIN")}>
              Entrar como Admin
            </Button>
          )}
          {canAdmin && canMaster && (
            <Button variant="secondary" className="w-full" onClick={() => void enterAs("ADMIN")}>
              Entrar como Admin
            </Button>
          )}
          {canCustomer && (
            <Button variant="secondary" className="w-full" onClick={() => void enterAs("CUSTOMER")}>
              Entrar como Cliente
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
