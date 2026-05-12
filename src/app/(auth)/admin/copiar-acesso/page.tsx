import Link from "next/link";

import { decryptAdminWelcomeCopyToken } from "@/lib/admin-welcome-copy-token";
import { resolvePublicAppUrl } from "@/lib/email";

import { CopiarSenhaAdminClient } from "./copiar-senha-admin-client";

export const metadata = {
  title: "Copiar senha de acesso",
  robots: { index: false, follow: false } as const,
};

type Props = { searchParams: Promise<{ t?: string | string[] }> };

function invalidCard(message: string) {
  return (
    <div className="w-full max-w-md px-2 sm:px-0">
      <div className="card w-full">
        <div className="card-header">
          <div className="text-lg font-semibold text-[var(--text-primary)]">Link inválido</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">{message}</div>
        </div>
        <div className="card-body">
          <Link href="/login" className="text-sm font-medium text-[var(--igh-primary)] hover:underline">
            Ir para o login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function AdminCopiarAcessoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp.t;
  const t = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (!t?.trim()) {
    return invalidCard("Este link não contém um token válido. Use o botão no e-mail de boas-vindas ou peça um novo convite ao administrador.");
  }

  try {
    const { email, tempPassword } = await decryptAdminWelcomeCopyToken(t.trim());
    const base = await resolvePublicAppUrl();
    return <CopiarSenhaAdminClient email={email} tempPassword={tempPassword} loginUrl={`${base}/login`} />;
  } catch {
    return invalidCard("Este link expirou ou já foi invalidado. Peça ao administrador que reenvie o convite ou redefina seu acesso.");
  }
}
