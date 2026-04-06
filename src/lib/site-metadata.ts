import type { Metadata } from "next";
import type { SiteSettingsPublic } from "@/lib/site-types";

/** URL absoluta para assets públicos (favicon, etc.): aceita http(s) ou caminho relativo ao site. */
export function resolvePublicAssetUrl(url: string | null | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

export function getMetadataBase(): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw.endsWith("/") ? raw.slice(0, -1) : raw);
  } catch {
    return undefined;
  }
}

/** Ícones do documento a partir de SiteSettings (faviconUrl no banco). */
export function siteIconsFromSettings(settings: SiteSettingsPublic | null): NonNullable<Metadata["icons"]> {
  const faviconUrl = resolvePublicAssetUrl(settings?.faviconUrl ?? null);
  if (faviconUrl) {
    return {
      icon: [{ url: faviconUrl }],
      shortcut: [{ url: faviconUrl }],
      apple: [{ url: faviconUrl }],
    };
  }
  return {
    icon: [
      { url: "/images/favicon.ico", type: "image/x-icon" },
      { url: "/images/favicon.png", type: "image/png" },
    ],
    shortcut: ["/images/favicon.ico"],
    apple: [{ url: "/images/favicon.png", type: "image/png" }],
  };
}
