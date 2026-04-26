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
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vouchers/${encodeURIComponent(code)}/send-customer`, { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ ok: true; skipped?: boolean }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao enviar e-mail.");
        return;
      }
      toast.push("success", json.data.skipped ? "E-mail já tinha sido enviado (sem reenvio)." : "E-mail enviado para o cliente.");
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

