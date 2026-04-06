import type { Metadata } from "next";
import { PageHeader, NoticiasList } from "@/components/site";
import type { PostForCard } from "@/components/site/NoticiasList";
import { getNewsCategoriesForSite, getNewsPostsForSite, getSiteSettings } from "@/lib/site-data";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const name = s?.siteName?.trim() || "Site";
  const description = s?.seoDescriptionDefault?.trim() || `Notícias e comunicados de ${name}.`;
  const title = `Notícias | ${name}`;
  return { title, description, openGraph: { title, description } };
}

function toPostForCard(p: {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  categoryName: string | null;
  publishedAt: Date | null;
}): PostForCard {
  let date = "";
  if (p.publishedAt) {
    const d = p.publishedAt;
    date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? "",
    category: p.categoryName ?? "Sem categoria",
    date,
    image: p.coverImageUrl ?? undefined,
  };
}

export default async function NoticiasPage() {
  const [settings, categories, posts] = await Promise.all([
    getSiteSettings(),
    getNewsCategoriesForSite(),
    getNewsPostsForSite(),
  ]);
  const siteName = settings?.siteName?.trim() || "Site";
  const postsForCard: PostForCard[] = posts.map(toPostForCard);

  return (
    <>
      <PageHeader title="Notícias" subtitle={`Acompanhe as novidades de ${siteName}.`} />
      <NoticiasList posts={postsForCard} categories={categories} />
    </>
  );
}
