import type { Metadata } from "next";
import { PageHeader, Section, Card, Button } from "@/components/site";
import { getGalleryYearsForSite, getSiteSettings } from "@/lib/site-data";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const name = s?.siteName?.trim() || "Site";
  const title = `Galeria | ${name}`;
  const description = s?.seoDescriptionDefault?.trim() || `Fotos e registros de ${name}, organizados por ano.`;
  return { title, description, openGraph: { title, description } };
}

export default async function GaleriaPage() {
  const years = await getGalleryYearsForSite();

  return (
    <>
      <PageHeader title="Galeria" subtitle="Fotos organizadas por ano." />
      <Section>
        {years.length === 0 ? (
          <p className="text-center text-[var(--igh-muted)]">Nenhuma foto publicada ainda.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {years.map((y) => (
              <Card key={y.id} as="article" className="flex flex-col overflow-hidden">
                {y.coverImageUrl ? (
                  <img src={y.coverImageUrl} alt="" className="mb-3 h-44 w-full rounded-lg object-cover" />
                ) : (
                  <div className="mb-3 h-44 w-full rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]" />
                )}
                <h2 className="text-xl font-semibold text-[var(--igh-secondary)]">{y.year}</h2>
                <p className="mt-1 text-sm text-[var(--igh-muted)]">{y.title ?? `${y.photosCount} foto(s)`}</p>
                <Button as="link" href={`/galeria/${y.year}`} variant="primary" size="sm" className="mt-4 w-full sm:w-auto">
                  Ver fotos
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

