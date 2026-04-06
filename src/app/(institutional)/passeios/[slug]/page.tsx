import { notFound } from "next/navigation";
import { Section, Button, ImageCarousel } from "@/components/site";
import { PackageReservationForm } from "@/components/site/PackageReservationForm";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getPackageBySlugForPublic, getSiteSettings } from "@/lib/site-data";

type Props = { params: Promise<{ slug: string }> };

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function formatBrl(value: string): string {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const pkg = await getPackageBySlugForPublic(slug);
  const settings = await getSiteSettings();
  const site = settings?.siteName ?? "Site";
  if (!pkg) return { title: "Passeio não encontrado" };
  return {
    title: pkg.name,
    description: pkg.shortDescription ?? `Passeio em ${formatDate(pkg.departureDate)} — ${site}`,
  };
}

export default async function PasseioDetalhePage({ params }: Props) {
  const { slug } = await params;
  const pkg = await getPackageBySlugForPublic(slug);
  if (!pkg) notFound();

  const session = await getSessionUserFromCookie();
  const gallery = [pkg.coverImageUrl, ...pkg.galleryImages].filter((u): u is string => Boolean(u && u.trim()));

  return (
    <Section className="py-12">
      <div className="mb-6">
        <Button as="link" href="/passeios" variant="outline" size="sm">
          ← Todos os passeios
        </Button>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <h1 className="text-3xl font-bold text-[var(--igh-secondary)]">{pkg.name}</h1>
          <p className="mt-2 text-[var(--igh-muted)]">
            {formatDate(pkg.departureDate)} · Saída às {pkg.departureTime} · Embarque: {pkg.boardingLocation}
          </p>
          <p className="mt-4 text-lg">
            <span className="text-[var(--igh-muted)]">A partir de </span>
            <span className="font-semibold text-[var(--igh-primary)]">{formatBrl(pkg.price)}</span>
            <span className="text-sm text-[var(--igh-muted)]"> / pessoa</span>
          </p>
          {pkg.breakfastKitAvailable ? (
            <p className="mt-1 text-sm text-[var(--igh-muted)]">
              Kit café opcional: {formatBrl(pkg.breakfastKitPrice)} por pessoa
            </p>
          ) : null}
          <p className="mt-2 text-sm text-[var(--igh-secondary)]">
            {pkg.remainingPlaces === null
              ? "Vagas: consulte a equipe"
              : pkg.remainingPlaces <= 0
                ? "Esgotado"
                : `${pkg.remainingPlaces} vagas disponíveis`}
          </p>

          {gallery.length > 0 ? (
            <div className="mt-8">
              <ImageCarousel images={gallery} />
            </div>
          ) : null}

          {pkg.description ? (
            <div className="prose prose-sm mt-8 max-w-none text-[var(--igh-secondary)] dark:prose-invert">
              <p className="whitespace-pre-wrap">{pkg.description}</p>
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <PackageReservationForm
            packageId={pkg.id}
            slug={pkg.slug}
            loggedIn={!!session}
            breakfastKitAvailable={pkg.breakfastKitAvailable}
            breakfastKitPrice={pkg.breakfastKitPrice}
            unitPrice={pkg.price}
            remainingPlaces={pkg.remainingPlaces}
            defaultName={session?.name ?? ""}
            defaultEmail={session?.email ?? ""}
            defaultPhone=""
          />
        </div>
      </div>
    </Section>
  );
}
