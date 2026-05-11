"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { ApiResponse } from "@/lib/api-types";
import { formatBrazilMobileDisplay } from "@/lib/format-brazil-mobile";

type CadastroFormProps = { redirectTo?: string };

export function CadastroForm({ redirectTo }: CadastroFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [password, setPassword] = useState("");

  function digitsOnly(s: string): string {
    return (s ?? "").replace(/\D/g, "");
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    setPhoneDisplay(formatBrazilMobileDisplay(digits));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nameTrim = name.trim();
    const emailTrim = email.trim();
    if (nameTrim.length < 2) {
      toast.push("error", "Informe seu nome completo (mínimo 2 caracteres).");
      return;
    }
    if (!emailTrim) {
      toast.push("error", "Informe seu e-mail.");
      return;
    }
    const phoneDigits = digitsOnly(phoneDisplay);
    if (phoneDigits.length !== 11) {
      toast.push("error", "Informe o celular completo com DDD (11 dígitos).");
      return;
    }
    if (password.length < 8) {
      toast.push("error", "A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nameTrim, email: emailTrim, phone: phoneDigits, password }),
      });
      const json = (await res.json()) as ApiResponse<{ user: { id: string } }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha no cadastro.");
        return;
      }
      toast.push("success", "Conta criada com sucesso.");
      const path = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/dashboard";
      router.replace(path);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div>
        <label className="text-sm font-medium" htmlFor="cadastro-nome">
          Nome <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <div className="mt-1">
          <Input
            id="cadastro-nome"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            required
            minLength={2}
            aria-required
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="cadastro-email">
          E-mail <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <div className="mt-1">
          <Input
            id="cadastro-email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            aria-required
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="cadastro-celular">
          Celular (WhatsApp) <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <div className="mt-1">
          <Input
            id="cadastro-celular"
            name="phone"
            value={phoneDisplay}
            onChange={handlePhoneChange}
            placeholder="(91) 99999-9999"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={15}
            required
            aria-required
            title="Informe o celular com DDD no formato (XX) XXXXX-XXXX."
            pattern="^\([0-9]{2}\) [0-9]{5}-[0-9]{4}$"
          />
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Obrigatório: DDD + celular (11 dígitos), com máscara.</p>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="cadastro-senha">
          Senha <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <div className="mt-1">
          <PasswordInput
            id="cadastro-senha"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 8 caracteres"
            autoComplete="new-password"
            required
            minLength={8}
            aria-required
          />
        </div>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Criando..." : "Criar conta"}
      </Button>
      <div className="text-center">
        <Link className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]" href={redirectTo ? `/login?from=${encodeURIComponent(redirectTo)}` : "/login"}>
          Já tenho conta
        </Link>
      </div>
    </form>
  );
}

