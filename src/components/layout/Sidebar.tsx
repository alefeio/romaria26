"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  masterOnly?: boolean;
  adminOrMaster?: boolean;
  customerOnly?: boolean;
  alwaysShow?: boolean;
  category?: string;
};

/** Menu do painel: apenas cliente, operação de passeios/reservas, site institucional e tarefas de master. */
const ITEMS: Item[] = [
  { href: "/cliente/dashboard", label: "Área do cliente", customerOnly: true, category: "Cliente" },
  { href: "/cliente/reservas", label: "Minhas reservas", customerOnly: true, category: "Cliente" },
  { href: "/dashboard", label: "Painel", alwaysShow: true, category: "Início" },
  { href: "/admin/pacotes", label: "Pacotes", adminOrMaster: true, category: "Operação" },
  { href: "/admin/reservas", label: "Reservas", adminOrMaster: true, category: "Operação" },
  { href: "/admin/vouchers/scan", label: "Validar vouchers (câmera)", adminOrMaster: true, category: "Operação" },
  { href: "/admin/clientes", label: "Clientes", adminOrMaster: true, category: "Operação" },
  { href: "/admin/faturamento", label: "Faturamento", adminOrMaster: true, category: "Operação" },
  { href: "/admin/sms", label: "Campanhas SMS", adminOrMaster: true, category: "Operação" },
  { href: "/admin/email", label: "Campanhas de e-mail", adminOrMaster: true, category: "Operação" },
  { href: "/users", label: "Usuários", masterOnly: true, category: "Administração" },
  { href: "/admin/site/configuracoes", label: "Configurações", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/mensagens-contato", label: "Mensagens de contato", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/sobre", label: "Sobre", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/contato-pagina", label: "Contato (página)", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/menu", label: "Menu", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/banners", label: "Banners", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/depoimentos", label: "Depoimentos", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/parceiros", label: "Parceiros", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/galeria", label: "Galeria de fotos", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/noticias", label: "Notícias", adminOrMaster: true, category: "Site" },
  { href: "/admin/site/faq", label: "FAQ", adminOrMaster: true, category: "Site" },
  { href: "/backup", label: "Backup do banco", masterOnly: true, category: "Sistema" },
];

export function Sidebar({
  user,
  logoUrl = null,
  mobileOpen = false,
  onMobileClose,
}: {
  user: {
    name: string;
    email: string;
    role: "MASTER" | "ADMIN" | "CUSTOMER";
    baseRole?: "MASTER" | "ADMIN" | "CUSTOMER";
    isAdmin?: boolean;
    availableRoles?: { canMaster: boolean; canAdmin: boolean; canCustomer?: boolean };
  };
  logoUrl?: string | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();

  const filteredItems = ITEMS.filter((i) => {
    if (user.role === "CUSTOMER") {
      return i.customerOnly === true;
    }
    if (i.customerOnly) return false;
    if (i.alwaysShow) return true;
    if (i.masterOnly) return user.role === "MASTER";
    if (i.adminOrMaster) return user.role === "ADMIN" || user.role === "MASTER";
    return false;
  });

  const byCategory = filteredItems.reduce<Record<string, Item[]>>((acc, item) => {
    const cat = item.category ?? "Menu";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryOrder = ["Cliente", "Início", "Operação", "Administração", "Site", "Sistema", "Menu"];

  const navContent = (
    <ul className="flex list-none flex-col gap-4 pl-0">
      {categoryOrder.filter((cat) => byCategory[cat]?.length).map((cat) => (
        <li key={cat}>
          <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {cat}
          </div>
          <ul className="flex list-none flex-col gap-0.5 pl-0">
            {byCategory[cat].map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-sm ${
                      active ? "bg-[var(--igh-primary)] text-white" : "text-[var(--text-primary)] hover:bg-[var(--igh-surface)]"
                    }`}
                    onClick={onMobileClose}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );

  const sidebarContent = (
    <>
      <div className="shrink-0 border-b border-[var(--card-border)] px-4 py-4">
        <div className="flex justify-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
          ) : (
            <img src="/images/logo.png" alt="Logo" className="h-12 w-auto object-contain" />
          )}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">{navContent}</nav>
    </>
  );

  return (
    <>
      <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-[var(--card-border)] bg-[var(--card-bg)] md:flex">
        {sidebarContent}
      </aside>
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg transition-transform duration-200 ease-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--card-border)] px-3 py-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Menu</span>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded p-2 text-[var(--text-secondary)] hover:bg-[var(--igh-surface)]"
            aria-label="Fechar menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{sidebarContent}</div>
      </aside>
    </>
  );
}
