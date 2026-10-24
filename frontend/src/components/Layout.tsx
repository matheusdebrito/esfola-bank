import { Outlet, NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, UsersRound, HandCoins, Wallet, ListChecks, CreditCard,
  ChartNoAxesCombined, Landmark, ScrollText, ShieldCheck, Settings2,
  Menu, X, Plus, LogOut, CalendarDays, type LucideIcon,
} from "lucide-react";

type IconType = LucideIcon;
type NavItem = { name: string; href: string; icon: IconType; roles?: string[]; end?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const groups: NavGroup[] = [
  { title: "OPERAÇÃO", items: [
    { name: "Visão geral", href: "/dashboard", icon: LayoutDashboard },
    { name: "Cobranças", href: "/defaults", icon: HandCoins },
    { name: "Empréstimos", href: "/loans", icon: Wallet },
    { name: "Recebimentos", href: "/payments", icon: CreditCard },
    { name: "Parcelas", href: "/installments", icon: ListChecks },
    { name: "Clientes", href: "/clients", icon: UsersRound },
  ] },
  { title: "GESTÃO", items: [
    { name: "Financeiro", href: "/finance", icon: Landmark, roles: ["ADMIN", "MANAGER", "AUDITOR"] },
    { name: "Relatórios", href: "/reports", icon: ChartNoAxesCombined },
  ] },
  { title: "ADMINISTRAÇÃO", items: [
    { name: "Políticas", href: "/financial-policies", icon: Settings2, roles: ["ADMIN", "MANAGER", "AUDITOR"] },
    { name: "Usuários", href: "/users", icon: ShieldCheck, roles: ["ADMIN", "MANAGER", "AUDITOR"] },
    { name: "Auditoria", href: "/audit", icon: ScrollText, roles: ["ADMIN", "MANAGER", "AUDITOR"] },
  ] },
];
const allItems = groups.flatMap(group => group.items);
const bottomItems: NavItem[] = [
  { name: "Início", href: "/dashboard", icon: LayoutDashboard },
  { name: "Cobranças", href: "/defaults", icon: HandCoins },
  { name: "Contratos", href: "/loans", icon: Wallet },
  { name: "Clientes", href: "/clients", icon: UsersRound },
];

function isActivePath(path: string, href: string) {
  return path === href || path.startsWith(href + "/") || (path === "/" && href === "/dashboard");
}
function currentPageName(path: string) {
  return [...allItems].sort((a, b) => b.href.length - a.href.length)
    .find(item => isActivePath(path, item.href))?.name ?? "Visão geral";
}
function allowed(item: NavItem, role?: string) {
  return !item.roles || (role !== undefined && item.roles.includes(role));
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { data: currentUser } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await api.get("/api/v1/auth/me")).data.data.user as { role: string; name: string },
    staleTime: 60_000,
    retry: false,
  });
  const role = currentUser?.role;
  const hasFinance = role !== undefined && ["ADMIN", "MANAGER", "AUDITOR"].includes(role);
  const canCreate = role !== undefined && ["ADMIN", "MANAGER", "OPERATOR"].includes(role);
  const menuItems = [...bottomItems, hasFinance ? { name: "Financeiro", href: "/finance", icon: Landmark } : { name: "Pagamentos", href: "/payments", icon: CreditCard }];
  const pageTitle = currentPageName(location.pathname);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [menuOpen]);

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await api.post("/api/v1/auth/logout");
      queryClient.clear();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Não foi possível encerrar a sessão. Tente novamente.");
    } finally {
      setLoggingOut(false);
    }
  }

  function renderLink(item: NavItem) {
    const Icon = item.icon;
    return <NavLink key={item.href} to={item.href} onClick={() => setMenuOpen(false)}
      aria-current={isActivePath(location.pathname, item.href) ? "page" : undefined}
      className={({ isActive }) => cn(
        "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/80",
        isActive || isActivePath(location.pathname, item.href)
          ? "bg-white/[.13] text-white ring-1 ring-white/10"
          : "text-slate-300 hover:bg-white/[.07] hover:text-white",
      )}>
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span className="flex-1">{item.name}</span>
      {isActivePath(location.pathname, item.href) && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
    </NavLink>;
  }

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-background">
      {menuOpen && <button type="button" aria-label="Fechar menu de navegação"
        onClick={() => setMenuOpen(false)}
        className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[3px] lg:hidden" />}

      <aside id="app-sidebar" aria-label="Navegação principal"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(310px,87vw)] flex-col bg-[#13243C] text-white shadow-2xl transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-[252px] lg:shrink-0 lg:translate-x-0 lg:shadow-none",
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}>
        <div className="flex h-[100px] shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm" aria-hidden="true">
              <img src="/logo-nova.jpg" alt="" className="absolute left-1/2 top-1/2 h-[125%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain" />
            </div>
            <span className="min-w-0 leading-tight">
              <span className="block text-[15px] font-bold tracking-tight">Esfola Bank</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400">Gestão de empréstimos</span>
            </span>
          </Link>
          <button onClick={() => setMenuOpen(false)} type="button" aria-label="Fechar menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Seções">
          {groups.map(group => {
            const visible = group.items.filter(item => allowed(item, role));
            if (!visible.length) return null;
            return <div key={group.title} className="space-y-1">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">{group.title}</p>
              {visible.map(renderLink)}
            </div>;
          })}
        </nav>
        <div className="shrink-0 space-y-3 border-t border-white/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {currentUser && <div className="flex items-center gap-3 rounded-xl bg-white/[.06] p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
              {currentUser.name?.trim().charAt(0).toUpperCase() || "U"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">{currentUser.name}</span>
              <span className="block text-[11px] text-slate-400">{role === "ADMIN" ? "Administrador" : role === "MANAGER" ? "Gerente" : role === "AUDITOR" ? "Auditor" : "Operador"}</span>
            </span>
          </div>}
          <button type="button" onClick={logout} disabled={loggingOut}
            className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50">
            <LogOut className="h-4 w-4" aria-hidden /> {loggingOut ? "Saindo…" : "Sair da conta"}
          </button>
          {logoutError && <p role="alert" className="text-xs text-rose-300">{logoutError}</p>}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-white/90 px-4 backdrop-blur-lg sm:px-6 lg:h-[76px] lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button ref={menuButtonRef} type="button" onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu de navegação" aria-expanded={menuOpen} aria-controls="app-sidebar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-foreground hover:bg-accent lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="hidden text-[11px] font-medium text-muted-foreground sm:block">Operação / {pageTitle}</p>
              <p className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">{pageTitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" })}
            </span>
            {canCreate && <>
              <Link to="/payments?new=1" className="hidden h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent sm:inline-flex">
                <CreditCard className="h-4 w-4" aria-hidden /> Receber
              </Link>
              <Link to="/loans?new=1" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:px-4">
                <Plus className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Novo empréstimo</span><span className="sr-only sm:hidden">Novo empréstimo</span>
              </Link>
            </>}
          </div>
        </header>

        <main id="main-content" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:pb-9 lg:px-8">
          <div className="mx-auto w-full max-w-[1460px]"><Outlet /></div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-white/95 px-1 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-20px_rgba(15,23,42,.35)] backdrop-blur-lg lg:hidden" aria-label="Acesso rápido">
          {menuItems.map(item => {
            const Icon = item.icon;
            const active = isActivePath(location.pathname, item.href);
            return <NavLink key={item.href} to={item.href} className={cn(
              "flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )} aria-label={item.name} aria-current={active ? "page" : undefined}>
              <Icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate">{item.name}</span>
            </NavLink>;
          })}
        </nav>
      </div>
    </div>
  );
}
