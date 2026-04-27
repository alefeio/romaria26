import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, Section } from "@/components/site";
import { getGalleryPhotosForYear, getGalleryYearsForSite, getSiteSettings } from "@/lib/site-data";
import { GalleryYearLightbox } from "./lightbox-client";

export async function generateMetadata({ params }: { params: Promise<{ ano: string }> }): Promise<Metadata> {
  const { ano } = await params;
  const yearNum = Number.parseInt(ano, 10);
  const s = await getSiteSettings();
  const name = s?.siteName?.trim() || "Site";
  const title = Number.isFinite(yearNum) ? `Galeria ${yearNum} | ${name}` : `Galeria | ${name}`;
  const description = s?.seoDescriptionDefault?.trim() || `Fotos da galeria de ${name}.`;
  return { title, description, openGraph: { title, description } };
}

export default async function GaleriaAnoPage({ params }: { params: Promise<{ ano: string }> }) {
  const { ano } = await params;
  const yearNum = Number.parseInt(ano, 10);
  if (!Number.isFinite(yearNum)) notFound();

  const [data, years] = await Promise.all([getGalleryPhotosForYear(yearNum), getGalleryYearsForSite()]);
  if (!data) notFound();

  const yearList = years.map((y) => y.year);
  const pos = yearList.indexOf(yearNum);
  const prevYear = pos >= 0 ? yearList[pos + 1] : null; // lista vem desc (2026, 2025...) então "esquerda" é +1
  const nextYear = pos > 0 ? yearList[pos - 1] : null;

  return (
    <>
      <PageHeader title={`Galeria ${data.year}`} subtitle={data.title ?? "Fotos do ano."} />
      <Section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/galeria" className="text-sm text-blue-600 underline">
            ← Voltar para os anos
          </Link>

          <div className="flex items-center gap-2">
            {prevYear ? (
              <Link
                href={`/galeria/${prevYear}`}
                className="inline-flex items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90"
                aria-label={`Ano anterior: ${prevYear}`}
              >
                ← {prevYear}
              </Link>
            ) : null}
            {nextYear ? (
              <Link
                href={`/galeria/${nextYear}`}
                className="inline-flex items-center justify-center rounded-md border border-[var(--card-border)] bg-[var(--igh-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-90"
                aria-label={`Próximo ano: ${nextYear}`}
              >
                {nextYear} →
              </Link>
            ) : null}
          </div>
        </div>

        <GalleryYearLightbox year={data.year} photos={data.photos} />
      </Section>
    </>
  );
}

