import { unstable_noStore as noStore } from "next/cache";
import { Navbar, Footer, FloatingChatWidget } from "@/components/site";
import { getSessionUserFromCookie } from "@/lib/auth";
import { getMetadataBase, resolvePublicAssetUrl, siteIconsFromSettings } from "@/lib/site-metadata";
import { getMenuItems, getSiteSettings } from "@/lib/site-data";

function absoluteUrl(pathOrUrl: string, baseUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const base = baseUrl.replace(/\/$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

export async function generateMetadata() {
  noStore();
  const settings = await getSiteSettings();
  const siteName = settings?.siteName?.trim() || "Site";
  const defaultTitle = `${siteName} | Início`;
  const defaultDescription =
    "Passeios, projetos e notícias. Personalize título e texto em Configurações gerais do site.";
  const title = settings?.seoTitleDefault?.trim() || defaultTitle;
  const description = settings?.seoDescriptionDefault?.trim() || defaultDescription;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const metadataBase = getMetadataBase();

  const ogTitle =
    settings?.socialShareTitle?.trim() || settings?.seoTitleDefault?.trim() || siteName;
  const ogDescription =
    settings?.socialShareDescription?.trim() ||
    settings?.seoDescriptionDefault?.trim() ||
    defaultDescription;

  const shareImageResolved = resolvePublicAssetUrl(settings?.socialShareImageUrl ?? null);
  const logoUrl = settings?.logoUrl?.trim();
  const logoAbsolute = logoUrl
    ? logoUrl.startsWith("http")
      ? logoUrl
      : baseUrl
        ? absoluteUrl(logoUrl, baseUrl)
        : null
    : null;
  const ogImageUrl = shareImageResolved || logoAbsolute;

  const openGraph: {
    title: string;
    description: string;
    images?: { url: string; width?: number; height?: number; alt?: string }[];
  } = {
    title: ogTitle,
    description: ogDescription,
    ...(ogImageUrl
      ? { images: [{ url: ogImageUrl, width: 1200, height: 630, alt: siteName }] }
      : {}),
  };

  return {
    ...(metadataBase ? { metadataBase } : {}),
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description,
    icons: siteIconsFromSettings(settings),
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}

export default async function InstitutionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuItems, settings, sessionUser] = await Promise.all([
    getMenuItems(),
    getSiteSettings(),
    getSessionUserFromCookie(),
  ]);

  const cssVars: string[] = [];
  if (settings?.primaryColor) {
    cssVars.push(`--igh-primary: ${settings.primaryColor}`);
    cssVars.push(`--igh-primary-hover: ${settings.primaryColor}`);
  }
  if (settings?.secondaryColor) {
    cssVars.push(`--igh-secondary: ${settings.secondaryColor}`);
    cssVars.push(`--igh-secondary-solid: ${settings.secondaryColor}`);
  }
  if (settings?.menuBackgroundColor?.trim()) {
    cssVars.push(`--navbar-bg: ${settings.menuBackgroundColor.trim()}`);
  }
  const styleContent = cssVars.length > 0 ? `:root { ${cssVars.join("; ")} }` : "";

  return (
    <>
      {styleContent ? <style dangerouslySetInnerHTML={{ __html: styleContent }} /> : null}
      <Navbar menuItems={menuItems} settings={settings} sessionUser={sessionUser} />
      <main id="main-content" className="min-h-[50vh]" style={{ background: "var(--background)" }}>{children}</main>
      <Footer menuItems={menuItems} settings={settings} />
      <FloatingChatWidget contactWhatsapp={settings?.contactWhatsapp} siteName={settings?.siteName} />
    </>
  );
}
