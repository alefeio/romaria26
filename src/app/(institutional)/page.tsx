import type { Metadata } from "next";
import {
  Container,
  Section,
  Button,
  AwardsShowcase,
  Testimonials,
  CTASection,
  FAQ,
  BlogCard,
  HeroBannerCarousel,
} from "@/components/site";
import { awardsShowcase } from "@/content";
import {
  getBanners,
  getPartners,
  getFaqItems,
  getTestimonials,
  getNewsPostsForSite,
  getPackagesForPublicSite,
  getSiteSettings,
} from "@/lib/site-data";
import { PackageCard } from "@/components/site/PackageCard";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const name = settings?.siteName?.trim() || "Site";
  const title = settings?.seoTitleDefault?.trim() || `${name} | Início`;
  const description =
    settings?.seoDescriptionDefault?.trim() ||
    "Passeios, projetos e notícias. Reserve online e acompanhe nossas ações.";
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function HomePage() {
  const [settings, banners, partners, faqItemsFromDb, testimonialsFromDb, newsPosts, packagesPublic] =
    await Promise.all([
      getSiteSettings(),
      getBanners(),
      getPartners(),
      getFaqItems(),
      getTestimonials(),
      getNewsPostsForSite(),
      getPackagesForPublicSite(),
    ]);

  const siteName = settings?.siteName?.trim() || "Site";

  const recentPosts = newsPosts.slice(0, 4).map((p) => {
    let date = "";
    if (p.publishedAt) {
      const d = p.publishedAt;
      date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
    return {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? "",
      category: p.categoryName ?? "Notícia",
      date,
      image: p.coverImageUrl ?? undefined,
    };
  });

  const faqItems = faqItemsFromDb.map((i) => ({ pergunta: i.question, resposta: i.answer }));
  const depoimentos = testimonialsFromDb.map((t) => ({
    nome: t.name,
    role: t.roleOrContext ?? "",
    texto: t.quote,
    avatar: t.photoUrl ?? undefined,
  }));

  return (
    <>
      {banners.length > 0 ? (
        <HeroBannerCarousel banners={banners} />
      ) : (
        <section className="flex min-h-screen flex-col justify-center bg-[var(--igh-surface)] py-16 sm:py-24">
          <Container>
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight text-[var(--igh-secondary)] sm:text-4xl lg:text-5xl">
                {siteName}
              </h1>
              <p className="mt-4 text-lg text-[var(--igh-muted)]">
                {settings?.seoDescriptionDefault?.trim() ||
                  "Conheça nossos passeios, projetos e formas de participar."}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button as="link" href="/passeios" variant="primary" size="lg">
                  Ver passeios
                </Button>
                <Button as="link" href="/contato" variant="secondary" size="lg">
                  Fale conosco
                </Button>
              </div>
            </div>
          </Container>
        </section>
      )}

      <AwardsShowcase heading={awardsShowcase.heading} awards={awardsShowcase.awards} />

      {packagesPublic.length > 0 ? (
        <Section
          title="Há mais de 20 anos navegando com Maria"
          subtitle="Permita que a Romaria Fluvial Muiraquitã proporcione uma experiência inesquecível para você e sua família."
        >
          <ul className="grid list-none gap-8 pl-0 sm:grid-cols-2 lg:grid-cols-3">
            {packagesPublic.slice(0, 6).map((p) => (
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
        </Section>
      ) : null}

      <Testimonials title="O que dizem sobre nós" items={depoimentos} courses={[]} />

      {partners.length > 0 ? (
        <Section title="Parceiros e apoio" background="muted">
          <div className="flex flex-wrap items-center justify-center gap-8">
            {partners.map((p) => (
              <a
                key={p.id}
                href={p.websiteUrl || undefined}
                target={p.websiteUrl ? "_blank" : undefined}
                rel={p.websiteUrl ? "noreferrer noopener" : undefined}
                className="group flex h-16 w-36 items-center justify-center rounded-lg border border-[var(--igh-border)] bg-white px-3 text-[var(--igh-muted)] text-sm transition hover:border-[var(--igh-border)] hover:shadow-sm"
                title={p.name}
                aria-label={p.websiteUrl ? `Abrir site do parceiro: ${p.name}` : p.name}
              >
                {p.logoUrl ? (
                  <img
                    src={p.logoUrl}
                    alt={p.name}
                    className="max-h-10 w-full object-contain opacity-90 transition group-hover:opacity-100"
                    loading="lazy"
                  />
                ) : (
                  <span className="line-clamp-2 text-center">{p.name}</span>
                )}
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Notícias" subtitle={`Acompanhe as novidades de ${siteName}.`}>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {recentPosts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button as="link" href="/noticias" variant="outline" size="lg">
            Ver todas as notícias
          </Button>
        </div>
      </Section>

      {faqItems.length > 0 && <FAQ items={faqItems} />}

      <CTASection
        title="Pronto para participar?"
        subtitle="Reserve um passeio ou fale conosco."
        primaryCTA={{ label: "Ver passeios", href: "/passeios" }}
        secondaryCTAs={[{ label: `Fale com ${siteName}`, href: "/contato" }]}
      />
    </>
  );
}
