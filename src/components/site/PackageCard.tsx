import Link from "next/link";
import { Card } from "./Card";
import { Button } from "./Button";

export type PackageCardProps = {
  name: string;
  slug: string;
  shortDescription: string | null;
  price: string;
  departureDate: Date;
  departureTime: string;
  boardingLocation: string;
  coverImageUrl: string | null;
  remainingPlaces: number | null;
};

function formatBrl(value: string): string {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function PackageCard(p: PackageCardProps) {
  const vagas =
    p.remainingPlaces === null ? "—" : p.remainingPlaces <= 0 ? "Esgotado" : `${p.remainingPlaces} vagas`;

  return (
    <Card as="article" className="flex h-full flex-col overflow-hidden p-0">
      <div className="aspect-[16/10] w-full bg-[var(--igh-surface)]">
        {p.coverImageUrl ? (
          <img src={p.coverImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--igh-muted)]">Sem imagem</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-semibold text-[var(--igh-secondary)]">{p.name}</h2>
        {p.shortDescription ? (
          <p className="mt-2 line-clamp-3 text-sm text-[var(--igh-muted)]">{p.shortDescription}</p>
        ) : null}
        <ul className="mt-3 space-y-1 text-sm text-[var(--igh-secondary)]">
          <li>
            <span className="text-[var(--igh-muted)]">Saída: </span>
            {formatDate(p.departureDate)} às {p.departureTime}
          </li>
          <li>
            <span className="text-[var(--igh-muted)]">Embarque: </span>
            {p.boardingLocation}
          </li>
          <li>
            <span className="text-[var(--igh-muted)]">A partir de: </span>
            <span className="font-semibold text-[var(--igh-primary)]">{formatBrl(p.price)}</span>
          </li>
          <li>
            <span className="text-[var(--igh-muted)]">Vagas: </span>
            {vagas}
          </li>
        </ul>
        <div className="mt-auto pt-4">
          <Button as="link" href={`/passeios/${p.slug}`} variant="primary" size="md" className="w-full justify-center">
            Ver detalhes e reservar
          </Button>
        </div>
      </div>
    </Card>
  );
}
