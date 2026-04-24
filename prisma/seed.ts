/**
 * Seeds iniciais — Romaria Fluvial Muiraquitã / Círio de Nazaré (Belém)
 * Baseado no plano de conteúdo SEO e keywords do documento de análise.
 *
 * Idempotente: usa upserts (slug único) ou cria só se a tabela estiver vazia.
 *
 * Variáveis opcionais:
 *   SEED_MASTER_EMAIL     (default: romariafluvialads@gmail.com)
 *   SEED_MASTER_PASSWORD  (default: Senha123!)
 *   SEED_FORCE_USERS=1    recria hash do master se já existir (opcional)
 *   SEED_RESET_MASTER=1   remove todos os MASTER e recria (ou use: npm run reset:master)
 *
 * Executar: npm run seed  (ou npx prisma db seed)
 */
import { hash } from "bcryptjs";

import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { deleteAllMasterUsers } from "./master-user-reset";

const SITE_NAME = "Romaria Fluvial Muiraquitã";
const SEO_TITLE = "Romaria Fluvial Muiraquitã no Círio de Nazaré | Pacotes e Reservas em Belém";
const SEO_DESCRIPTION =
  "Organização católica com mais de 20 anos de experiência. Reserve seu pacote por lote para a Romaria Fluvial no Círio de Nazaré. Kit café opcional. Vagas limitadas.";

const ABOUT_TITLE = "Quem somos";
const ABOUT_SUBTITLE =
  "Mais de 20 anos de experiência no segmento religioso católico — qualidade e eficácia no atendimento.";
const ABOUT_CONTENT_HTML = `<p>A <strong>Romaria Fluvial Muiraquitã</strong> é uma organização especializada no segmento religioso católico e com experiência há mais de 20 anos se destaca pela sua qualidade e eficácia no atendimento, a fim de garantir os melhores serviços para você, sua família e seu grupo. Dentre os públicos que atendemos estão: agências de viagens, paróquias, dioceses e organizações religiosas.</p>
<h3>Experiência</h3>
<p><strong>+20 anos</strong></p>`;

/** Sábado típico da Romaria Fluvial — ajuste após publicação oficial da programação 2026 */
const ROMARIA_DATE = new Date("2026-10-10T00:00:00.000Z");

async function seedSiteSettings() {
  const existing = await prisma.siteSettings.findFirst();
  const addresses = [
    {
      line: "Belém, PA",
      city: "Belém",
      state: "PA",
      zip: "66000-000",
    },
  ];
  const data = {
    siteName: SITE_NAME,
    primaryColor: "#0f766e",
    secondaryColor: "#134e4a",
    contactEmail: "contato@romariafluvial.com.br",
    contactPhone: "(91) 3000-0000",
    contactWhatsapp: "5591999999999",
    businessHours: "Segunda a sexta, 9h às 18h (horário de Brasília)",
    socialInstagram: "https://www.instagram.com/",
    seoTitleDefault: SEO_TITLE,
    seoDescriptionDefault: SEO_DESCRIPTION,
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    addresses: addresses as object,
  };

  if (existing) {
    await prisma.siteSettings.update({
      where: { id: existing.id },
      data: {
        ...data,
        logoUrl: existing.logoUrl,
        faviconUrl: existing.faviconUrl,
      },
    });
    console.log("SiteSettings atualizado.");
  } else {
    await prisma.siteSettings.create({ data });
    console.log("SiteSettings criado.");
  }
}

async function seedAboutAndContato() {
  const aboutPayload = {
    title: ABOUT_TITLE,
    subtitle: ABOUT_SUBTITLE,
    content: ABOUT_CONTENT_HTML,
  };
  const existingAbout = await prisma.siteAboutPage.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existingAbout) {
    await prisma.siteAboutPage.update({
      where: { id: existingAbout.id },
      data: aboutPayload,
    });
    console.log("SiteAboutPage atualizada (texto institucional).");
  } else {
    await prisma.siteAboutPage.create({ data: aboutPayload });
    console.log("SiteAboutPage criada.");
  }

  const contatoCount = await prisma.siteContatoPage.count();
  if (contatoCount === 0) {
    await prisma.siteContatoPage.create({
      data: {
        title: "Contato",
        subtitle: "Fale com a equipe antes ou depois da reserva. WhatsApp, e-mail e formulário.",
      },
    });
    console.log("SiteContatoPage criada.");
  }
}

async function seedMenu() {
  if ((await prisma.siteMenuItem.count()) > 0) {
    console.log("SiteMenuItem: já existem itens, pulando.");
    return;
  }

  const items = [
    { label: "Início", href: "/", order: 0 },
    { label: "Passeios", href: "/passeios", order: 1 },
    { label: "Sobre", href: "/sobre", order: 2 },
    { label: "Notícias", href: "/noticias", order: 3 },
    { label: "Contato", href: "/contato", order: 4 },
  ];
  for (const item of items) {
    await prisma.siteMenuItem.create({
      data: {
        label: item.label,
        href: item.href,
        order: item.order,
        isExternal: false,
        isVisible: true,
      },
    });
  }
  console.log(`SiteMenuItem: ${items.length} itens criados.`);
}

async function seedBanners() {
  if ((await prisma.siteBanner.count()) > 0) {
    console.log("SiteBanner: já existem banners, pulando.");
    return;
  }
  const banners = [
    {
      title: `${SITE_NAME} no Círio de Nazaré`,
      subtitle: "Reserve por lote e escolha na hora se quer kit café da manhã.",
      ctaLabel: "Ver passeios",
      ctaHref: "/passeios",
      order: 0,
    },
    {
      title: "Vagas por lote: garanta seu lugar",
      subtitle: "Lote promocional e condições claras antes de confirmar.",
      ctaLabel: "Garantir minha vaga",
      ctaHref: "/passeios",
      order: 1,
    },
    {
      title: "Viva o Círio pelas águas de Belém",
      subtitle: "Pacotes com vagas limitadas e reserva online simples.",
      ctaLabel: "Reservar agora",
      ctaHref: "/passeios",
      order: 2,
    },
  ];
  for (const b of banners) {
    await prisma.siteBanner.create({ data: { ...b, isActive: true } });
  }
  console.log(`SiteBanner: ${banners.length} criados.`);
}

async function seedPackages() {
  const packages = [
    {
      slug: "lote-1-romaria-fluvial-2026",
      name: "Lote 1 — Romaria Fluvial 2026",
      shortDescription: "Primeiro lote com melhor condição. Vagas limitadas.",
      description: `Inclui participação no passeio da Romaria Fluvial conforme regulamento do pacote. O <strong>kit café da manhã</strong> é opcional na reserva (valor à parte).\n\nConfira na página do pacote o que está incluso e políticas antes de finalizar.`,
      price: new Prisma.Decimal("449.90"),
      breakfastKitAvailable: true,
      breakfastKitPrice: new Prisma.Decimal("35.00"),
      departureTime: "06:30",
      boardingLocation: "Embarque em Icoaraci — Belém/PA (detalhes na confirmação)",
      capacity: 120,
      status: "OPEN" as const,
    },
    {
      slug: "lote-2-romaria-fluvial-2026",
      name: "Lote 2 — Romaria Fluvial 2026",
      shortDescription: "Segundo lote. Valores e condições atualizados.",
      description: `Pacote por lote para a Romaria Fluvial / Círio Fluvial. Transparência de preço e opção de <strong>kit café da manhã</strong> na reserva.`,
      price: new Prisma.Decimal("519.90"),
      breakfastKitAvailable: true,
      breakfastKitPrice: new Prisma.Decimal("35.00"),
      departureTime: "06:30",
      boardingLocation: "Embarque em Icoaraci — Belém/PA (detalhes na confirmação)",
      capacity: 120,
      status: "OPEN" as const,
    },
    {
      slug: "lote-3-romaria-fluvial-2026",
      name: "Lote 3 — Romaria Fluvial 2026",
      shortDescription: "Terceiro lote. Sujeito à disponibilidade.",
      description: `Últimas vagas do período de vendas. Inclua ou não o kit café da manhã no checkout; o valor é recalculado antes de confirmar.`,
      price: new Prisma.Decimal("589.90"),
      breakfastKitAvailable: true,
      breakfastKitPrice: new Prisma.Decimal("35.00"),
      departureTime: "06:30",
      boardingLocation: "Embarque em Icoaraci — Belém/PA (detalhes na confirmação)",
      capacity: 80,
      status: "OPEN" as const,
    },
  ];

  for (const p of packages) {
    await prisma.package.upsert({
      where: { slug: p.slug },
      create: {
        ...p,
        departureDate: ROMARIA_DATE,
        isActive: true,
        galleryImages: [],
      },
      update: {
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        price: p.price,
        breakfastKitAvailable: p.breakfastKitAvailable,
        breakfastKitPrice: p.breakfastKitPrice,
        departureDate: ROMARIA_DATE,
        departureTime: p.departureTime,
        boardingLocation: p.boardingLocation,
        capacity: p.capacity,
        status: p.status,
        isActive: true,
      },
    });
  }
  console.log(`Package: ${packages.length} lotes upsert.`);
}

async function seedFaq() {
  if ((await prisma.siteFaqItem.count()) > 0) {
    console.log("SiteFaqItem: já existem perguntas, pulando.");
    return;
  }
  const faqs: { question: string; answer: string; order: number }[] = [
    {
      question: "Como faço para reservar?",
      answer:
        "Escolha um lote disponível em Passeios, informe a quantidade de pessoas, selecione com ou sem kit café da manhã e finalize a reserva.",
      order: 0,
    },
    {
      question: "O kit café da manhã é obrigatório?",
      answer: "Não. Você decide na hora da reserva; o valor é recalculado antes de confirmar.",
      order: 1,
    },
    {
      question: "O que está incluso no pacote?",
      answer:
        "Depende do lote; na página de cada passeio listamos o que está incluso e o que não está. Leia antes de pagar.",
      order: 2,
    },
    {
      question: "Posso reservar para várias pessoas?",
      answer: "Sim. Informe a quantidade no processo de reserva.",
      order: 3,
    },
    {
      question: "Como recebo a confirmação?",
      answer: "Por e-mail e também na área do cliente, após o login.",
      order: 4,
    },
    {
      question: "Qual é a política de cancelamento?",
      answer:
        "Consulte a página de política de cancelamento e o detalhe do pacote antes de finalizar. As condições podem variar por lote.",
      order: 5,
    },
    {
      question: "Onde é o embarque?",
      answer:
        "O local e horário do seu pacote aparecem na confirmação e na área do cliente. Icoaraci e Estação das Docas são pontos frequentemente citados no Círio — confirme sempre o do seu lote.",
      order: 6,
    },
    {
      question: "Crianças podem participar?",
      answer:
        "Existem regras de segurança e restrições por tipo de embarcação. Siga as orientações oficiais e as do seu pacote.",
      order: 7,
    },
    {
      question: "Que documentos preciso levar?",
      answer: "Documento de identificação e a confirmação/voucher conforme instrução da reserva.",
      order: 8,
    },
    {
      question: "Como falar com o suporte?",
      answer: "Pelos canais de contato do site: WhatsApp, e-mail e formulário na página Contato.",
      order: 9,
    },
  ];
  await prisma.siteFaqItem.createMany({ data: faqs.map((f) => ({ ...f, isActive: true })) });
  console.log(`SiteFaqItem: ${faqs.length} criadas.`);
}

async function seedNews() {
  const catSlug = "guias-e-dicas";
  let category = await prisma.siteNewsCategory.findUnique({ where: { slug: catSlug } });
  if (!category) {
    category = await prisma.siteNewsCategory.create({
      data: { name: "Guias e dicas", slug: catSlug, order: 0, isActive: true },
    });
    console.log("SiteNewsCategory: guias-e-dicas criada.");
  }

  const posts = [
    {
      slug: "romaria-fluvial-cirio-nazaré-o-que-e",
      title: "Romaria Fluvial no Círio de Nazaré: o que é e como reservar",
      excerpt:
        "Entenda a diferença entre buscas por Romaria Fluvial e Círio Fluvial e como funciona a reserva por lote com kit café opcional.",
      content: `<p>Tanto <strong>Romaria Fluvial</strong> quanto <strong>Círio Fluvial</strong> aparecem em buscas e materiais oficiais. No nosso site tratamos como a mesma experiência de passeio pelo Círio, com foco em <strong>reserva</strong>, <strong>lotes</strong> e <strong>transparência</strong>.</p><p>Reserve com antecedência: o período do Círio concentra muita demanda em Belém.</p>`,
    },
    {
      slug: "programacao-cirio-horarios-trajeto",
      title: "Programação, horários e trajeto: o que acompanhar antes do passeio",
      excerpt:
        "Use sempre a programação oficial do Círio e as orientações do seu pacote para embarque e segurança.",
      content: `<p>Para informações de calendário e procissões, o site oficial do Círio e a programação publicada são referência. Combine isso com os horários e local de embarque <strong>do seu lote</strong>, enviados na confirmação.</p>`,
    },
    {
      slug: "kit-cafe-manha-romaria-fluvial",
      title: "Kit café da manhã na Romaria Fluvial: como funciona na reserva",
      excerpt:
        "O kit não é um pacote separado: você escolhe com ou sem na reserva e o valor é recalculado antes de confirmar.",
      content: `<p>Conforme nosso modelo, o <strong>kit café da manhã</strong> é opcional no checkout. Isso evita confusão e deixa claro o valor total antes do pagamento.</p>`,
    },
    {
      slug: "regras-seguranca-embarque-cirio-fluvial",
      title: "Segurança e embarque: coletes, lotação e boas práticas",
      excerpt:
        "Regras oficiais de navegação e segurança complementam as orientações do seu pacote.",
      content: `<p>A Marinha e a autoridade marítima publicam normas para o período do Círio. Use colete quando orientado, respeite lotação e siga a equipe. Para crianças e restrições, verifique o tipo de embarcação.</p>`,
    },
    {
      slug: "o-que-levar-romaria-fluvial-belem",
      title: "O que levar na Romaria Fluvial: checklist prático",
      excerpt: "Documento, conforto, hidratação e proteção solar para horas no trajeto.",
      content: `<ul><li>Documento de identificação</li><li>Confirmação da reserva (digital ou impressa, conforme instrução)</li><li>Roupas leves, água, protetor solar</li><li>Paciência e atenção às orientações da equipe</li></ul>`,
    },
  ];

  let created = 0;
  for (const post of posts) {
    const existing = await prisma.siteNewsPost.findUnique({ where: { slug: post.slug } });
    if (existing) continue;
    await prisma.siteNewsPost.create({
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        categoryId: category.id,
        isPublished: true,
        publishedAt: new Date(),
        imageUrls: [],
      },
    });
    created++;
  }
  console.log(`SiteNewsPost: ${created} novos posts (cluster SEO).`);
}

async function seedTestimonials() {
  if ((await prisma.siteTestimonial.count()) > 0) {
    console.log("SiteTestimonial: já existem depoimentos, pulando.");
    return;
  }
  await prisma.siteTestimonial.createMany({
    data: [
      {
        name: "Maria S.",
        roleOrContext: "Belém, PA",
        quote:
          "Reserva clara e confirmação por e-mail. Saber que o kit café era opcional ajudou a decidir em família.",
        order: 0,
        isActive: true,
      },
      {
        name: "João P.",
        roleOrContext: "Fortaleza, CE",
        quote:
          "Queria entender lote e horário de embarque; o site respondeu antes de eu comprar. Recomendo reservar cedo.",
        order: 1,
        isActive: true,
      },
      {
        name: "Ana L.",
        roleOrContext: "Icoaraci",
        quote: "Atendimento tirou dúvida sobre documentos e embarque. Experiência organizada.",
        order: 2,
        isActive: true,
      },
    ],
  });
  console.log("SiteTestimonial: 3 criados.");
}

async function seedTransparency() {
  if ((await prisma.siteTransparencyCategory.count()) > 0) {
    console.log("SiteTransparencyCategory: já existe, pulando.");
    return;
  }
  const cat = await prisma.siteTransparencyCategory.create({
    data: {
      name: "Institucional",
      slug: "institucional",
      order: 0,
      isActive: true,
    },
  });
  await prisma.siteTransparencyDocument.create({
    data: {
      categoryId: cat.id,
      title: "Política de cancelamento (modelo)",
      description: "Substitua por PDF oficial. Texto de exemplo para transparência ao cliente.",
      date: new Date("2026-01-15T00:00:00.000Z"),
      isActive: true,
    },
  });
  console.log("Transparência: categoria + documento modelo.");
}

async function seedMasterUser() {
  const email = (process.env.SEED_MASTER_EMAIL ?? "romariafluvialads@gmail.com").toLowerCase().trim();
  const plain = process.env.SEED_MASTER_PASSWORD ?? "Senha123!";
  const passwordHash = await hash(plain, 10);

  if (process.env.SEED_RESET_MASTER === "1") {
    const removed = await deleteAllMasterUsers(prisma);
    if (removed > 0) {
      console.log(`SEED_RESET_MASTER: removido(s) ${removed} utilizador(es) MASTER.`);
    }
  }

  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash && clash.role !== "MASTER") {
    throw new Error(`E-mail ${email} já está em uso por outro perfil (${clash.role}). Ajuste SEED_MASTER_EMAIL.`);
  }

  const existingMaster = await prisma.user.findFirst({ where: { role: "MASTER" } });
  if (existingMaster) {
    await prisma.user.update({
      where: { id: existingMaster.id },
      data: {
        email,
        passwordHash,
        mustChangePassword: false,
      },
    });
    console.log(`User MASTER atualizado: ${email}`);
    return;
  }

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Administrador Master",
      passwordHash,
      role: "MASTER",
      isActive: true,
      mustChangePassword: false,
      isAdmin: false,
    },
    update:
      process.env.SEED_FORCE_USERS === "1"
        ? { passwordHash, mustChangePassword: false }
        : {},
  });
  console.log(`User MASTER: ${email}`);
}

async function main() {
  await prisma.$connect();

  await seedSiteSettings();
  await seedAboutAndContato();
  await seedMenu();
  await seedBanners();
  await seedPackages();
  await seedFaq();
  await seedNews();
  await seedTestimonials();
  await seedTransparency();
  await seedMasterUser();

  console.log("\nSeed concluído. Revise datas dos pacotes quando a programação oficial 2026 for publicada.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
