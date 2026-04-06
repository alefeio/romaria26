import { getPackagesForPublicSite, getFaqItems } from "@/lib/site-data";
import { jsonOk } from "@/lib/http";

/** Dados para o widget de atendimento: passeios e FAQ. Público, sem auth. */
export async function GET() {
  const [packagesList, faqItems] = await Promise.all([getPackagesForPublicSite(), getFaqItems()]);

  const packagesForChat = packagesList.map((p) => ({
    name: p.name,
    slug: p.slug,
    url: `/passeios/${encodeURIComponent(p.slug)}`,
  }));

  const faqForChat = faqItems.map((f) => ({
    pergunta: f.question,
    resposta: f.answer,
  }));

  return jsonOk({
    packages: packagesForChat,
    faq: faqForChat,
  });
}
