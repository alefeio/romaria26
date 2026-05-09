import type { Metadata } from "next";
import { PageHeader, Section, Card, Button, GalleryMediaThumb } from "@/components/site";
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
      <PageHeader title="Galeria" subtitle="Fotos e vídeos organizados por ano." />
      <Section>
        {years.length === 0 ? (
          <p className="text-center text-[var(--igh-muted)]">Nenhuma mídia publicada ainda.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {years.map((y) => (
              <Card key={y.id} as="article" className="flex flex-col overflow-hidden">
                {y.coverImageUrl ? (
                  <GalleryMediaThumb
                    src={y.coverImageUrl}
                    alt=""
                    className="mb-3 h-44 rounded-lg"
                    mediaClassName="h-44 rounded-lg"
                  />
                ) : (
                  <div className="mb-3 h-44 w-full rounded-lg border border-[var(--card-border)] bg-[var(--igh-surface)]" />
                )}
                <h2 className="text-xl font-semibold text-[var(--igh-secondary)]">{y.year}</h2>
                <p className="mt-1 text-sm text-[var(--igh-muted)]">{y.title ?? `${y.photosCount} item(ns)`}</p>
                <Button as="link" href={`/galeria/${y.year}`} variant="primary" size="sm" className="mt-4 w-full sm:w-auto">
                  Ver galeria
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

