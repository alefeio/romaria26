"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

export function ShareVoucherWhatsAppButton({
  code,
  label = "Compartilhar no WhatsApp",
  intro = "Voucher",
}: {
  code: string;
  label?: string;
  intro?: string;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function share() {
    setLoading(true);
    try {
      const res = await fetch(`/api/vouchers/${encodeURIComponent(code)}/share`, { method: "POST" });
      const json = (await res.json()) as ApiResponse<{
        accessUrl: string;
        viewUrl: string;
        tempPassword: string;
        expiresAt: string;
      }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao preparar compartilhamento.");
        return;
      }

      const exp = new Date(json.data.expiresAt);
      const expLabel = exp.toLocaleString("pt-BR");

      const text = [
        `${intro} (acesso por senha temporária):`,
        "",
        `Link: ${json.data.accessUrl}`,
        `Senha temporária: ${json.data.tempPassword}`,
        `Válida até: ${expLabel}`,
        "",
        "Instruções: abra o link acima. Se solicitar senha, use a senha temporária.",
      ].join("\n");

      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    } catch {
      toast.push("error", "Não foi possível compartilhar agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={() => void share()}>
      {loading ? "…" : label}
    </Button>
  );
}

