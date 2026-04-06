"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

type MeUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function MeusDadosForm() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me");
      const json = (await res.json()) as ApiResponse<{ user: MeUser }>;
      if (json?.ok && json.data?.user) {
        setName(json.data.user.name);
        setEmail(json.data.user.email);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = (await res.json()) as ApiResponse<{ user: MeUser }>;
      if (res.ok && json?.ok) {
        toast.push("success", "Dados atualizados.");
        if (json.data?.user) {
          setName(json.data.user.name);
        }
      } else {
        const msg = json && !json.ok ? json.error.message : "Não foi possível salvar.";
        toast.push("error", msg);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)]">Nome</label>
        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)]">E-mail</label>
        <Input className="mt-1" value={email} readOnly disabled />
        <p className="mt-1 text-xs text-[var(--text-muted)]">O e-mail de login não pode ser alterado aqui.</p>
      </div>
      <Button type="submit" variant="primary" disabled={saving}>
        {saving ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
