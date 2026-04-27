import "server-only";
import type { PackageStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPackageRemainingCapacity } from "@/lib/reservations/create-reservation";
import type { MenuItemPublic, SiteSettingsPublic } from "@/lib/site-types";

export type { MenuItemPublic, SiteSettingsPublic };

export async function getMenuItems(): Promise<MenuItemPublic[]> {
  try {
  const items = await prisma.siteMenuItem.findMany({
    where: { isVisible: true, parentId: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      children: {
        where: { isVisible: true },
        orderBy: [{ order: "asc" }],
      },
    },
  });
  return items.map((i) => ({
    id: i.id,
    label: i.label,
    href: i.href,
    order: i.order,
    isExternal: i.isExternal,
    children: i.children.map((c) => ({
      id: c.id,
      label: c.label,
      href: c.href,
      order: c.order,
      isExternal: c.isExternal,
      children: [],
    })),
  }));
  } catch {
    return [];
  }
}

// --- Settings (para Footer e SEO) ---
function parseAddresses(value: unknown): { line: string; city: string; state: string; zip: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === "object" && "line" in x && "city" in x && "state" in x && "zip" in x
    )
    .map((x) => ({
      line: String(x.line ?? ""),
      city: String(x.city ?? ""),
      state: String(x.state ?? ""),
      zip: String(x.zip ?? ""),
    }));
}

export async function getSiteSettings(): Promise<SiteSettingsPublic | null> {
  try {
    const s = await prisma.siteSettings.findFirst();
    if (!s) return null;
    return {
    siteName: s.siteName,
    logoUrl: s.logoUrl,
    faviconUrl: s.faviconUrl,
    primaryColor: s.primaryColor,
    secondaryColor: s.secondaryColor,
    menuBackgroundColor: s.menuBackgroundColor,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    contactWhatsapp: s.contactWhatsapp,
    addresses: parseAddresses(s.addresses),
    businessHours: s.businessHours,
    socialInstagram: s.socialInstagram,
    socialFacebook: s.socialFacebook,
    socialYoutube: s.socialYoutube,
    socialLinkedin: s.socialLinkedin,
    seoTitleDefault: s.seoTitleDefault,
    seoDescriptionDefault: s.seoDescriptionDefault,
    socialShareTitle: s.socialShareTitle,
    socialShareDescription: s.socialShareDescription,
    socialShareImageUrl: s.socialShareImageUrl,
  };
  } catch {
    return null;
  }
}

// --- Sobre (página institucional) ---
export type AboutForSite = { title: string | null; subtitle: string | null; content: string | null; imageUrl: string | null };

export async function getAboutForSite(): Promise<AboutForSite | null> {
  try {
    const row = await prisma.siteAboutPage.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!row) return null;
    return { title: row.title, subtitle: row.subtitle, content: row.content, imageUrl: row.imageUrl };
  } catch {
    return null;
  }
}

// --- Página Contato (cabeçalho editável) ---
export type ContatoPageForSite = { title: string | null; subtitle: string | null; headerImageUrl: string | null };

export async function getContatoPageForSite(): Promise<ContatoPageForSite | null> {
  try {
    const row = await prisma.siteContatoPage.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!row) return null;
    return { title: row.title, subtitle: row.subtitle, headerImageUrl: row.headerImageUrl };
  } catch {
    return null;
  }
}

// --- Banners ---
export type BannerPublic = { id: string; title: string | null; subtitle: string | null; ctaLabel: string | null; ctaHref: string | null; imageUrl: string | null; order: number };

export async function getBanners(): Promise<BannerPublic[]> {
  try {
    const list = await prisma.siteBanner.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: "desc" }],
    });
    return list.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      ctaLabel: b.ctaLabel,
      ctaHref: b.ctaHref,
      imageUrl: b.imageUrl,
      order: b.order,
    }));
  } catch {
    return [];
  }
}

// --- Parceiros ---
export type PartnerPublic = { id: string; name: string; logoUrl: string | null; websiteUrl: string | null; order: number };

export async function getPartners(): Promise<PartnerPublic[]> {
  try {
    const list = await prisma.sitePartner.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
    });
    return list.map((p) => ({
      id: p.id,
      name: p.name,
      logoUrl: p.logoUrl,
      websiteUrl: p.websiteUrl,
      order: p.order,
    }));
  } catch {
    return [];
  }
}

// --- FAQ ---
export type FaqItemPublic = { id: string; question: string; answer: string; order: number };

export async function getFaqItems(): Promise<FaqItemPublic[]> {
  try {
    const list = await prisma.siteFaqItem.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
    });
    return list.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      order: f.order,
    }));
  } catch {
    return [];
  }
}

// --- Depoimentos ---
export type TestimonialPublic = { id: string; name: string; roleOrContext: string | null; quote: string; photoUrl: string | null; order: number };

export async function getTestimonials(): Promise<TestimonialPublic[]> {
  try {
    const list = await prisma.siteTestimonial.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
    });
    return list.map((t) => ({
      id: t.id,
      name: t.name,
      roleOrContext: t.roleOrContext,
      quote: t.quote,
      photoUrl: t.photoUrl,
      order: t.order,
    }));
  } catch {
    return [];
  }
}

// --- Galeria (site público) ---
export type SiteGalleryYearPublic = {
  id: string;
  year: number;
  title: string | null;
  coverImageUrl: string | null;
  photosCount: number;
};

export async function getGalleryYearsForSite(): Promise<SiteGalleryYearPublic[]> {
  try {
    const items = await prisma.siteGalleryYear.findMany({
      where: { isActive: true },
      orderBy: [{ year: "desc" }],
      include: {
        photos: { take: 1, orderBy: [{ order: "asc" }, { createdAt: "desc" }] },
        _count: { select: { photos: true } },
      },
    });
    return items.map((y) => ({
      id: y.id,
      year: y.year,
      title: y.title,
      coverImageUrl: y.photos[0]?.imageUrl ?? null,
      photosCount: y._count.photos,
    }));
  } catch {
    return [];
  }
}

export type SiteGalleryPhotoPublic = { id: string; imageUrl: string; caption: string | null };

export async function getGalleryPhotosForYear(
  year: number
): Promise<{ year: number; title: string | null; photos: SiteGalleryPhotoPublic[] } | null> {
  try {
    const y = await prisma.siteGalleryYear.findUnique({
      where: { year },
      include: { photos: { orderBy: [{ order: "asc" }, { createdAt: "desc" }] } },
    });
    if (!y || !y.isActive) return null;
    return {
      year: y.year,
      title: y.title,
      photos: y.photos.map((p) => ({ id: p.id, imageUrl: p.imageUrl, caption: p.caption })),
    };
  } catch {
    return null;
  }
}

export type SiteGalleryLatestPhotoPublic = {
  id: string;
  imageUrl: string;
  caption: string | null;
  year: number;
};

export async function getLatestGalleryPhotosForSite(limit = 8): Promise<SiteGalleryLatestPhotoPublic[]> {
  try {
    const list = await prisma.siteGalleryPhoto.findMany({
      where: { year: { isActive: true } },
      orderBy: [{ createdAt: "desc" }],
      take: Math.max(1, Math.min(24, limit)),
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        year: { select: { year: true } },
      },
    });
    return list.map((p) => ({ id: p.id, imageUrl: p.imageUrl, caption: p.caption, year: p.year.year }));
  } catch {
    return [];
  }
}

// --- Projetos (site público) ---
export type ProjectForSite = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  coverImageUrl: string | null;
  galleryImages: string[];
  order: number;
};

export async function getProjectsForSite(): Promise<ProjectForSite[]> {
  try {
    const list = await prisma.siteProject.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        coverImageUrl: true,
        galleryImages: true,
        order: true,
      },
    });
    return list.map((p) => ({ ...p, galleryImages: p.galleryImages ?? [] }));
  } catch {
    return [];
  }
}

export async function getProjectBySlug(slug: string): Promise<ProjectForSite | null> {
  try {
    const p = await prisma.siteProject.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        coverImageUrl: true,
        galleryImages: true,
        order: true,
      },
    });
    if (!p) return null;
    return { ...p, galleryImages: p.galleryImages ?? [] };
  } catch {
    return null;
  }
}

// --- Notícias (site público) ---
export type NewsCategoryForSite = { id: string; name: string; slug: string };

export type NewsPostForSite = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  imageUrls: string[];
  categoryId: string | null;
  categoryName: string | null;
  publishedAt: Date | null;
};

export async function getNewsCategoriesForSite(): Promise<NewsCategoryForSite[]> {
  try {
    const list = await prisma.siteNewsCategory.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
      select: { id: true, name: true, slug: true },
    });
    return list;
  } catch {
    return [];
  }
}

export async function getNewsPostsForSite(categorySlug?: string): Promise<NewsPostForSite[]> {
  try {
    const where: { isPublished: true; category?: { slug: string } } = { isPublished: true };
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    const list = await prisma.siteNewsPost.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        coverImageUrl: true,
        imageUrls: true,
        categoryId: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
    });
    return list.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      coverImageUrl: p.coverImageUrl,
      imageUrls: p.imageUrls ?? [],
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      publishedAt: p.publishedAt,
    }));
  } catch {
    return [];
  }
}

export async function getNewsPostBySlug(slug: string): Promise<NewsPostForSite | null> {
  try {
    const p = await prisma.siteNewsPost.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        coverImageUrl: true,
        imageUrls: true,
        categoryId: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
    });
    if (!p) return null;
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      coverImageUrl: p.coverImageUrl,
      imageUrls: p.imageUrls ?? [],
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      publishedAt: p.publishedAt,
    };
  } catch {
    return null;
  }
}

// --- Transparência (site público) ---
export type TransparencyCategoryForSite = {
  id: string;
  name: string;
  slug: string;
  order: number;
  documents: {
    id: string;
    title: string;
    description: string | null;
    date: Date | null;
    fileUrl: string | null;
  }[];
};

export async function getTransparencyForSite(): Promise<TransparencyCategoryForSite[]> {
  try {
    const list = await prisma.siteTransparencyCategory.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }],
      include: {
        documents: {
          where: { isActive: true },
          orderBy: [{ date: "desc" }],
          select: {
            id: true,
            title: true,
            description: true,
            date: true,
            fileUrl: true,
          },
        },
      },
    });
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      order: c.order,
      documents: c.documents.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        date: d.date,
        fileUrl: d.fileUrl,
      })),
    }));
  } catch {
    return [];
  }
}

// --- Passeios / pacotes (site público) ---
export type PackagePublicListItem = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: string;
  childPrice: string;
  breakfastKitAvailable: boolean;
  breakfastKitPrice: string;
  kitsDeliveryInfo: string | null;
  departureDate: Date;
  departureTime: string;
  boardingLocation: string;
  capacity: number;
  status: PackageStatus;
  coverImageUrl: string | null;
  galleryImages: string[];
  remainingPlaces: number | null;
};

async function toPackagePublicListItem(p: {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  price: { toString(): string };
  childPrice: { toString(): string };
  breakfastKitAvailable: boolean;
  breakfastKitPrice: { toString(): string };
  kitsDeliveryInfo: string | null;
  departureDate: Date;
  departureTime: string;
  boardingLocation: string;
  capacity: number;
  status: PackageStatus;
  coverImageUrl: string | null;
  galleryImages: string[];
}): Promise<PackagePublicListItem> {
  const remainingPlaces = await getPackageRemainingCapacity(p.id);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription,
    description: p.description,
    price: p.price.toString(),
    childPrice: p.childPrice.toString(),
    breakfastKitAvailable: p.breakfastKitAvailable,
    breakfastKitPrice: p.breakfastKitPrice.toString(),
    kitsDeliveryInfo: p.kitsDeliveryInfo,
    departureDate: p.departureDate,
    departureTime: p.departureTime,
    boardingLocation: p.boardingLocation,
    capacity: p.capacity,
    status: p.status,
    coverImageUrl: p.coverImageUrl,
    galleryImages: p.galleryImages,
    remainingPlaces,
  };
}

export async function getPackagesForPublicSite(): Promise<PackagePublicListItem[]> {
  try {
    const rows = await prisma.package.findMany({
      // No site público: mostrar apenas (Em breve / Aberto / Esgotado). Encerrado não aparece.
      where: { isActive: true, status: { in: ["OPEN", "SOLD_OUT", "SOON"] } },
      orderBy: [{ departureDate: "asc" }, { name: "asc" }],
    });
    return Promise.all(rows.map((p) => toPackagePublicListItem(p)));
  } catch {
    return [];
  }
}

export async function getPackageBySlugForPublic(slug: string): Promise<PackagePublicListItem | null> {
  try {
    const p = await prisma.package.findFirst({
      where: { slug, isActive: true, status: { in: ["OPEN", "SOLD_OUT"] } },
    });
    if (!p) return null;
    return toPackagePublicListItem(p);
  } catch {
    return null;
  }
}
