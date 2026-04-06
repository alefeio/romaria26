import { Section } from "@/components/site";
import { PackageCard } from "@/components/site/PackageCard";
import { getPackagesForPublicSite, getSiteSettings } from "@/lib/site-data";

export async function generateMetadata() {
  const settings = await getSiteSettings();
  const site = settings?.siteName ?? "Site";
  return {
    title: "Passeios",
    description: `Pacotes e passeios disponíveis para reserva — ${site}.`,
  };
}

export default async function PasseiosPage() {
  const packages = await getPackagesForPublicSite();

  return (
    <Section
      title="Passeios"
      subtitle="Datas de saída, embarque e valores. Escolha um pacote e solicite sua reserva online."
      className="py-12"
    >
      {packages.length === 0 ? (
        <p className="text-center text-[var(--igh-muted)]">
          Nenhum passeio aberto para reserva no momento. Volte em breve ou entre em contato.
        </p>
      ) : (
        <ul className="grid list-none gap-8 pl-0 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <li key={p.id}>
              <PackageCard
                name={p.name}
                slug={p.slug}
                shortDescription={p.shortDescription}
                price={p.price}
                departureDate={p.departureDate}
                departureTime={p.departureTime}
                boardingLocation={p.boardingLocation}
                coverImageUrl={p.coverImageUrl}
                remainingPlaces={p.remainingPlaces}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
