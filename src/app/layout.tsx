import type { Metadata, Viewport } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { getMetadataBase, siteIconsFromSettings } from "@/lib/site-metadata";
import { getSiteSettings } from "@/lib/site-data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultTitle = "Painel";
const defaultDescription = "Sistema de cadastro de cursos, turmas e professores.";

export async function generateMetadata(): Promise<Metadata> {
  noStore();
  const settings = await getSiteSettings();
  const title = settings?.seoTitleDefault ?? defaultTitle;
  const description = settings?.seoDescriptionDefault ?? defaultDescription;
  const metadataBase = getMetadataBase();

  return {
    ...(metadataBase ? { metadataBase } : {}),
    title,
    description,
    icons: siteIconsFromSettings(settings),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeScript />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
