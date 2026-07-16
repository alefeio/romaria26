"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";
import type { ApiResponse } from "@/lib/api-types";

export function AdminSendVoucherButton({ code }: { code: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (!code || loading) return;
    if (
      !window.confirm(
        "Enviar por e-mail todos os vouchers desta reserva para o cliente? Se já tiver sido enviado antes, será reenviado."
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vouchers/${encodeURIComponent(code)}/send-customer`, {
        method: "POST",
      });
      const raw = await res.text();
      let json: ApiResponse<{ ok: true; skipped?: boolean }>;
      try {
        json = raw
          ? (JSON.parse(raw) as ApiResponse<{ ok: true; skipped?: boolean }>)
          : { ok: false, error: { code: "EMPTY", message: "Resposta vazia do servidor." } };
      } catch {
        toast.push("error", `Erro do servidor ao enviar (${res.status}).`);
        return;
      }
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao enviar e-mail.");
        return;
      }
      toast.push("success", "E-mail com todos os vouchers enviado para o cliente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" onClick={() => void onClick()} disabled={loading}>
      {loading ? "Enviando…" : "Enviar por e-mail para o cliente"}
    </Button>
  );
}
