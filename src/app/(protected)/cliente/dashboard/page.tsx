import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function ClienteDashboardPage() {
  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Área do cliente</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Reserve passeios, acompanhe suas solicitações e acesse seus vouchers (QR Code) após a quitação do pagamento.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/passeios">
          <Button>Ver passeios</Button>
        </Link>
        <Link href="/cliente/reservas">
          <Button variant="secondary">Minhas reservas</Button>
        </Link>
      </div>
    </div>
  );
}
