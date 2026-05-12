"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";

type Props = {
  email: string;
  tempPassword: string;
  loginUrl: string;
};

export function CopiarSenhaAdminClient({ email, tempPassword, loginUrl }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tempPassword);
        setCopied(true);
        toast.push("success", "Senha copiada para a área de transferência.");
        return;
      }
    } catch {
      /* fallback abaixo */
    }
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
      el.setSelectionRange(0, tempPassword.length);
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.push("success", "Senha copiada. Cole no campo de senha do login.");
      } catch {
        toast.push("error", "Não foi possível copiar automaticamente. Selecione o campo acima e copie manualmente.");
      }
    }
  }, [tempPassword, toast]);

  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="mb-4 flex justify-center sm:mb-6">
        <img src="/images/logo.png" alt="Logo" className="h-16 w-auto object-contain sm:h-20" />
      </div>
      <div className="card w-full">
        <div className="card-header">
          <div className="text-lg font-semibold text-[var(--text-primary)]">Senha de primeiro acesso</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">
            Toque no botão para copiar a senha temporária. Depois, use o login com o e-mail abaixo.
          </div>
        </div>
        <div className="card-body flex flex-col gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">E-mail (login)</div>
            <p className="mt-1 break-all text-sm text-[var(--text-primary)]">{email}</p>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]" htmlFor="admin-temp-pw">
              Senha temporária
            </label>
            <input
              ref={inputRef}
              id="admin-temp-pw"
              readOnly
              value={tempPassword}
              onFocus={(e) => e.target.select()}
              className="theme-input mt-1 w-full rounded-md border px-3 py-3 font-mono text-lg tracking-wide outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Dica: se o botão não funcionar, toque no campo, escolha “Selecionar tudo” e copie.
            </p>
          </div>
          <Button type="button" variant="primary" className="w-full py-3 text-base" onClick={() => void copy()}>
            {copied ? "Copiado — abra o login" : "Copiar senha"}
          </Button>
          <Link
            href={loginUrl}
            className="inline-flex w-full min-h-[44px] cursor-pointer items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-all hover:opacity-90"
          >
            Ir para o login
          </Link>
          <p className="text-center text-xs text-[var(--text-muted)]">
            Por segurança, troque esta senha no primeiro acesso ao painel.
          </p>
        </div>
      </div>
    </div>
  );
}
