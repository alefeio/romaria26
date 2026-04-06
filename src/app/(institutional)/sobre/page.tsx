import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/site";
import { getAboutForSite, getSiteSettings } from "@/lib/site-data";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const name = s?.siteName?.trim() || "Site";
  const description = s?.seoDescriptionDefault?.trim() || `Conheça a missão e os projetos de ${name}.`;
  const title = `Sobre | ${name}`;
  return { title, description, openGraph: { title, description } };
}

export default async function SobrePage() {
  const [settings, about] = await Promise.all([getSiteSettings(), getAboutForSite()]);
  const siteName = settings?.siteName?.trim() || "Site";
  const title = about?.title?.trim() || `Sobre ${siteName}`;
  const subtitle =
    about?.subtitle?.trim() || "Conheça nossa missão e nosso compromisso com a comunidade.";
  const content = about?.content;

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        backgroundImageUrl={about?.imageUrl?.trim() || null}
      />
      <Section>
        {content ? (
          <div
            className="prose prose-lg max-w-none text-[var(--igh-muted)] [&_p]:mb-4"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div className="max-w-none space-y-4 text-[var(--igh-muted)]">
            <p>
              {siteName} reúne projetos de inclusão, sustentabilidade e passeios com reserva online. Personalize este
              texto em <strong>Sobre</strong> no painel do site.
            </p>
          </div>
        )}
      </Section>
    </>
  );
}
