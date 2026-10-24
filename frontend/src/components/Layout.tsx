import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  Bell, BriefcaseBusiness, ChevronRight, CircleDollarSign, ClipboardList,
  FileBarChart2, HandCoins, House, Landmark, LogOut, Menu, MoreHorizontal, Plus, Search,
  Settings, ShieldCheck, UserRound, UsersRound, Wallet, X, type LucideIcon,
} from "lucide-react";

type NavItem = { name: string; href: string; icon: LucideIcon; roles?: string[] };
const mainItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: House },
  { name: "Empréstimos", href: "/loans", icon: BriefcaseBusiness },
  { name: "Clientes", href: "/clients", icon: UserRound },
  { name: "Cobranças", href: "/defaults", icon: HandCoins },
  { name: "Financeiro", href: "/finance", icon: CircleDollarSign, roles: ["ADMIN", "MANAGER", "AUDITOR"] },
  { name: "Caixa", href: "/cash", icon: Wallet, roles: ["ADMIN", "MANAGER", "AUDITOR"] },
  { name: "Relatórios", href: "/reports", icon: FileBarChart2 },
];
const secondaryItems: NavItem[] = [
  { name: "Recebimentos", href: "/payments", icon: CircleDollarSign },
  { name: "Parcelas", href: "/installments", icon: ClipboardList },
];
const adminItems: NavItem[] = [
  { name: "Usuários", href: "/users", icon: UsersRound, roles: ["ADMIN", "MANAGER", "AUDITOR"] },
  { name: "Configurações", href: "/financial-policies", icon: Settings, roles: ["ADMIN", "MANAGER", "AUDITOR"] },
  { name: "Auditoria", href: "/audit", icon: ShieldCheck, roles: ["ADMIN", "MANAGER", "AUDITOR"] },
];
const active = (path: string, href: string) => path === href || path.startsWith(href + "/") || (path === "/" && href === "/dashboard");
const allowed = (item: NavItem, role?: string) => !item.roles || !!role && item.roles.includes(role);
const roleName: Record<string, string> = { ADMIN: "Administrador", MANAGER: "Gerente", AUDITOR: "Auditor", OPERATOR: "Operador" };

function Brand({ small = false }: { small?: boolean }) {
  return <Link to="/dashboard" className="flex min-w-0 items-center gap-2 rounded-lg text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="Esfola Bank — dashboard">
    <span className="flex h-10 w-10 shrink-0 items-end justify-center text-white">
      <img src="/favicon-corvo.svg" alt="" className="h-10 w-10 rounded-xl object-cover" aria-hidden />
    </span>
    <span className={cn("min-w-0 leading-[.94] tracking-[-.045em]", small ? "text-[15px]" : "text-[20px]")}>
      <strong className="block text-white">ESFOLA</strong>
      <strong className="mt-0.5 block text-[#E6DBBE]">BANK</strong>
    </span>
  </Link>;
}

function QuickSearch({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);
  const { data, isError } = useQuery({
    queryKey: ["global-search", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const [clients, loans] = await Promise.allSettled([
        api.get("/api/v1/clients", { params: { search: debounced, page: 1, pageSize: 4 } }),
        api.get("/api/v1/loans", { params: { search: debounced, page: 1, pageSize: 4 } }),
      ]);
      return {
        clients: clients.status === "fulfilled" ? clients.value.data.data.items as { id: string; name: string }[] : [],
        loans: loans.status === "fulfilled" ? loans.value.data.data.items as { id: string; code: string; clientName?: string }[] : [],
      };
    },
    retry: false,
  });
  const results = [
    ...(data?.clients ?? []).map(item => ({ title: item.name, type: "Cliente", to: "/clients/" + item.id })),
    ...(data?.loans ?? []).map(item => ({ title: item.code + (item.clientName ? " · " + item.clientName : ""), type: "Empréstimo", to: "/loans/" + item.id })),
  ];
  return <div className={"relative min-w-0 " + className}>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#65746E]" aria-hidden />
    <input type="search" aria-label="Buscar clientes ou empréstimos"
      placeholder="Buscar cliente, empréstimo ou contrato..." value={term}
      onChange={e => setTerm(e.target.value)} onFocus={() => setFocused(true)}
      onBlur={() => setTimeout(() => setFocused(false), 180)}
      onKeyDown={e => { if (e.key === "Escape") setFocused(false); if (e.key === "Enter" && results[0]) { navigate(results[0].to); setTerm(""); setFocused(false); } }}
      className="h-10 w-full rounded-lg border border-transparent bg-[#EEF2F0] pl-10 pr-3 text-xs text-[#303A36] outline-none placeholder:text-[#7E8984] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
    {focused && debounced.length >= 2 && <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
      {results.length ? results.map(x => <button key={x.to} onMouseDown={e => e.preventDefault()}
        onClick={() => { navigate(x.to); setFocused(false); setTerm(""); }}
        className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-emerald-50">
        <span className="truncate text-xs font-semibold text-slate-900">{x.title}</span>
        <span className="text-[10px] text-stone-500">{x.type}</span>
      </button>) : <p className="p-3 text-xs text-stone-500">{isError ? "Não foi possível buscar agora." : "Nenhum registro encontrado."}</p>}
    </div>}
  </div>;
}
function Notices() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["dashboards", "notifications"],
    queryFn: async () => (await api.get("/api/v1/dashboards/overview")).data.data as { overdueInstallments: number; dueToday: number },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const count = (data?.overdueInstallments ?? 0) + (data?.dueToday ?? 0);
  return <div className="relative">
    <button type="button" onClick={() => setOpen(!open)} aria-label="Notificações da operação" aria-expanded={open}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-400 lg:text-stone-600 lg:hover:bg-stone-100">
      <Bell className="h-5 w-5" />
      {count > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
    </button>
    {open && <div className="absolute right-0 top-12 z-50 w-[min(300px,84vw)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
      <p className="mb-3 text-sm font-bold text-slate-900">Atenção na operação</p>
      <Link onClick={() => setOpen(false)} to="/defaults" className="flex items-center justify-between border-b border-slate-100 py-2 text-xs text-slate-700">
        <span>Parcelas vencidas</span><strong className="text-red-600">{data?.overdueInstallments ?? 0}</strong>
      </Link>
      <Link onClick={() => setOpen(false)} to="/installments" className="flex items-center justify-between py-2 text-xs text-slate-700">
        <span>Vencimentos de hoje</span><strong className="text-[#85602E]">{data?.dueToday ?? 0}</strong>
      </Link>
    </div>}
  </div>;
}
export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await api.get("/api/v1/auth/me")).data.data.user as { name: string; role: string },
    staleTime: 60_000,
    retry: false,
  });
  const role = user?.role;
  const canCreate = !!role && ["ADMIN", "MANAGER", "OPERATOR"].includes(role);
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  async function logout() {
    setLoggingOut(true); setLogoutError("");
    try { await api.post("/api/v1/auth/logout"); queryClient.clear(); navigate("/login", { replace: true }); }
    catch { setLogoutError("Não foi possível sair. Tente novamente."); }
    finally { setLoggingOut(false); }
  }
  function navItem(item: NavItem) {
    const Icon = item.icon;
    return <NavLink key={item.href} to={item.href} onClick={() => setOpen(false)}
      className={cn("flex min-h-[43px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400",
        active(location.pathname, item.href) ? "bg-[#738D81]/25 text-[#F3F4F0]" : "text-stone-200/90 hover:bg-white/10 hover:text-white")}
      aria-current={active(location.pathname, item.href) ? "page" : undefined}>
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 flex-1">{item.name}</span>
      {item.href === "/cash" && active(location.pathname, item.href) && <span className="rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-semibold text-white">CAIXA</span>}
    </NavLink>;
  }
  const sections = [
    { title: "", items: mainItems },
    { title: "ACESSO RÁPIDO", items: secondaryItems },
    { title: "Administração", items: adminItems },
  ];
  return <div className="flex h-[100dvh] overflow-hidden bg-[#F4F6F5]">
    {open && <button className="fixed inset-0 z-40 bg-stone-950/60 lg:hidden" aria-label="Fechar menu" onClick={() => setOpen(false)}/>}
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[#434C49] text-white transition-transform lg:static lg:w-[210px] lg:shrink-0 xl:w-[230px]",
      open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")} aria-label="Navegação principal">
      <div className="flex h-[94px] shrink-0 items-center justify-between gap-2 px-4">
        <Brand />
        <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-stone-300 lg:hidden" aria-label="Fechar menu"><X className="h-5 w-5"/></button>
      </div>
      <nav className="sidebar-scrollbar min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-2">
        {sections.map(section => {
          const items = section.items.filter(item => allowed(item, role));
          if (!items.length) return null;
          return <div key={section.title || "nav"} className="space-y-1">
            {section.title && <div className="px-3 pb-2 pt-2 text-[11px] font-medium text-[#D8E1D9]">{section.title}</div>}
            {items.map(navItem)}
          </div>;
        })}
      </nav>
      <div className="space-y-1 border-t border-white/10 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Link to="/profile" onClick={() => setOpen(false)} aria-label="Editar meu perfil" title="Meu perfil" className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DCE5DE] text-sm font-bold text-[#434C49]">{user?.name?.[0]?.toUpperCase() ?? "U"}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{user?.name ?? "Usuário"}</span>
            <span className="block text-[11px] text-[#D5CABE]">{roleName[role ?? ""] ?? "Conta"}</span></span>
          <ChevronRight className="h-4 w-4 text-stone-400"/>
        </Link>
        <button onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-stone-300 hover:bg-white/10">
          <LogOut className="h-4 w-4" /> {loggingOut ? "Saindo..." : "Sair"}
        </button>
        {logoutError && <p role="alert" className="px-3 text-xs text-red-300">{logoutError}</p>}
      </div>
    </aside>

    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#59635F] bg-[#434C49] px-3 sm:px-6 lg:border-[#DFE6E2] lg:bg-white">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10 lg:hidden"><Menu className="h-5 w-5"/></button>
          <div className="lg:hidden"><Brand small/></div>
          <QuickSearch className="ml-1 hidden w-[min(100%,470px)] sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <Notices />
          {canCreate && <Link to="/loans?new=1" className="hidden h-9 items-center gap-2 rounded-lg bg-[#DCE8DE] text-[#30443B] px-3 text-xs font-bold hover:bg-[#E2D2B5] lg:inline-flex">
            <Plus className="h-4 w-4"/> Novo empréstimo
          </Link>}
        </div>
      </header>
      <main id="main-content" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-5 lg:px-6 lg:pb-7 xl:px-7">
        <div className="mx-auto w-full max-w-[1550px]"><Outlet /></div>
      </main>
      <nav aria-label="Acesso rápido" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-[#DFE6E2] bg-[#434C49] px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-xl lg:hidden">
        {[
          { name: "Início", href: "/dashboard", icon: House },
          { name: "Empréstimos", href: "/loans", icon: BriefcaseBusiness },
        ].map(item => <NavLink key={item.href} to={item.href} className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[10px]",active(location.pathname,item.href)?"text-[#F3F4F0]":"text-stone-300")}>
          <item.icon className="h-[19px] w-[19px]"/>{item.name}
        </NavLink>)}
        <Link to={canCreate ? "/loans?new=1" : "/dashboard"} aria-label={canCreate ? "Novo empréstimo" : "Início"} className="-mt-3 flex h-14 w-14 items-center justify-center justify-self-center rounded-full bg-[#D5C19C] text-[#434C49] shadow-[0_3px_16px_rgba(214,164,68,.4)]">
          <Plus className="h-7 w-7"/>
        </Link>
        <NavLink to="/clients" className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[10px]",active(location.pathname,"/clients")?"text-[#F3F4F0]":"text-stone-300")}>
          <UsersRound className="h-[19px] w-[19px]"/>Clientes
        </NavLink>
        <button onClick={() => setOpen(true)} className="flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[10px] text-stone-300">
          <MoreHorizontal className="h-[21px] w-[21px]"/>Mais
        </button>
      </nav>
    </div>
  </div>;
}
