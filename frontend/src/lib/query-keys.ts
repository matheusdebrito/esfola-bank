/**
 * Chaves de cache do TanStack Query.
 *
 * Centralizar as chaves evita divergência entre queries e invalidações
 * (ex.: uma tela consultar `dashboard-executive` e a mutação invalidar
 * apenas `dashboard`).
 */
export const QUERY_KEYS = {
  auth: {
    me: ["auth", "me"] as const,
  },
  clients: {
    root: ["clients"] as const,
    list: ["clients"] as const,
    options: ["clients", "options"] as const,
    detail: (id: string) => ["client", id] as const,
  },
  documents: {
    root: ["documents"] as const,
  },
  loans: {
    root: ["loans"] as const,
    list: ["loans"] as const,
    active: ["loans", "active"] as const,
    detail: (id: string) => ["loan", id] as const,
  },
  installments: {
    root: ["installments"] as const,
    list: ["installments"] as const,
    byLoan: (loanId: string) => ["installments", "loan", loanId] as const,
  },
  payments: {
    root: ["payments"] as const,
    list: ["payments"] as const,
  },
  policies: {
    root: ["policies"] as const,
    list: ["policies"] as const,
    options: ["policies", "options"] as const,
  },
  users: {
    root: ["users"] as const,
  },
  audit: {
    root: ["audit"] as const,
  },
  dashboards: {
    root: ["dashboards"] as const,
    executive: ["dashboards", "executive"] as const,
    financial: ["dashboards", "financial"] as const,
    monthly: ["dashboards", "monthly"] as const,
    overview: ["dashboards", "overview"] as const,
  },
} as const;
