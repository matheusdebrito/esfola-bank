import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { name: "Dashboard", href: "/dashboard", icon: "🏠" },
  { name: "Clientes", href: "/clients", icon: "💳" },
  { name: "Empréstimos", href: "/loans", icon: "💰" },
  { name: "Pagamentos", href: "/payments", icon: "💸" },
  { name: "Parcelas", href: "/installments", icon: "📋" },
  { name: "Inadimplência", href: "/defaults", icon: "⚠️" },
  { name: "Auditoria", href: "/audit", icon: "🛡️" },
  { name: "Usuários", href: "/users", icon: "👥" },
  { name: "Políticas", href: "/financial-policies", icon: "⚙️" },
];

const APP_NAME = "Esfola Bank";

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-full flex-col border-r border-border bg-background transition-transform duration-300 lg:static lg:z-auto lg:w-64 lg:shrink-0 lg:translate-x-0",
          menuOpen ? "visible translate-x-0" : "invisible -translate-x-full lg:visible",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-3">
          <NavLink to="/dashboard" aria-label={APP_NAME} className="min-w-0">
            <img
              src="/logo.webp"
              alt={APP_NAME}
              className="h-20 w-auto max-w-full object-contain lg:h-24"
            />
          </NavLink>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors lg:py-2",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <span className="h-5 w-5 text-center">{item.icon}</span>
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            onClick={() => (window.location.href = "/login")}
          >
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/50 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <h1 className="truncate text-base font-semibold sm:text-sm">{currentTitle(location.pathname)}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function currentTitle(path: string) {
  const m = NAV.find((n) => path === n.href || path.startsWith(n.href + "/"));
  return m ? m.name : APP_NAME;
}
