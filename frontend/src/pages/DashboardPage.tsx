"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SimpleTable } from "@/components/SimpleTable";
import { Pagination } from "@/components/Pagination";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  DollarSign,
  Wallet,
  TrendingUp,
  Percent,
  Users,
  Briefcase,
  CalendarClock,
  AlertTriangle,
  Clock,
  Target,
  RefreshCw,
} from "lucide-react";
import { QUERY_KEYS } from "@/lib/query-keys";
import { brl, percent, dateBr } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import type { DashboardOverview } from "@/types/api";

const COLORS = ["#2563eb", "#059669", "#d97706", "#be123c", "#7c3aed", "#0891b2"];

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "Últimos 7 dias" },
  { value: "month", label: "Mês atual" },
  { value: "year", label: "Ano atual" },
  { value: "custom", label: "Personalizado" },
];

function periodToRange(period: string, customFrom: string, customTo: string): { from: string; to: string } {
  const tz = "America/Sao_Paulo";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD in Brasília

  // Brasília is UTC-3 (no DST). Convert Brasília date to UTC ISO string.
  const startOfDay = (dateStr: string) => new Date(`${dateStr}T00:00:00-03:00`).toISOString();
  const endOfDay = (dateStr: string) => new Date(`${dateStr}T23:59:59.999-03:00`).toISOString();

  switch (period) {
    case "today":
      return { from: startOfDay(today), to: endOfDay(today) };
    case "7days": {
      const d = new Date(today + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 6);
      const fromStr = d.toISOString().slice(0, 10);
      return { from: startOfDay(fromStr), to: endOfDay(today) };
    }
    case "month": {
      const [y, m] = today.split("-").map(Number);
      const firstDay = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      return { from: startOfDay(firstDay), to: endOfDay(lastDay) };
    }
    case "year": {
      const y = Number(today.split("-")[0]);
      return { from: startOfDay(`${y}-01-01`), to: endOfDay(`${y}-12-31`) };
    }
    case "custom":
      return {
        from: customFrom ? startOfDay(customFrom) : startOfDay(today),
        to: customTo ? endOfDay(customTo) : endOfDay(today),
      };
    default:
      return { from: startOfDay(today), to: endOfDay(today) };
  }
}

function KpiCard({
  title,
  value,
  icon: Icon,
  sub,
  variant = "default",
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
  variant?: "default" | "danger" | "success";
}) {
  const colorClass =
    variant === "danger"
      ? "text-destructive"
      : variant === "success"
        ? "text-emerald-600"
        : "text-primary";
  return (
    <Card className="rounded-xl border border-border p-3 sm:p-4">
      <CardContent className="flex items-start gap-2 pt-2 sm:gap-3">
        <div className={`shrink-0 rounded-lg bg-muted p-1.5 sm:p-2 ${colorClass}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground leading-tight">{title}</p>
          <p className="mt-0.5 text-base font-bold leading-tight sm:text-lg break-words">{value}</p>
          {sub ? <p className="text-xs text-muted-foreground leading-tight">{sub}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function formatMonth(value: string) {
  const [y, m] = value.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  if (!y || !m || value.length !== 7) return value;
  return months[Number(m) - 1] ? `${months[Number(m) - 1]}/${y.slice(2)}` : value;
}

function formatDay(value: string) {
  const [, month, day] = value.split("-");
  return month && day ? `${day}/${month}` : value;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingPageSize, setUpcomingPageSize] = useState(10);
  const [upcomingSearch, setUpcomingSearch] = useState("");
  const [debouncedUpcomingSearch, setDebouncedUpcomingSearch] = useState("");

  // debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUpcomingSearch(upcomingSearch), 300);
    return () => clearTimeout(timer);
  }, [upcomingSearch]);

  const range = useMemo(() => periodToRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboards", "overview", range.from, range.to],
    refetchInterval: 60_000,
    queryFn: async () => {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await api.get(`/api/v1/dashboards/overview?${params.toString()}`);
      return (res.data?.data ?? {}) as DashboardOverview;
    },
  });

  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ["dashboards", "upcoming-due", upcomingPage, upcomingPageSize, debouncedUpcomingSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(upcomingPage), pageSize: String(upcomingPageSize) });
      if (debouncedUpcomingSearch) params.set("search", debouncedUpcomingSearch);
      const res = await api.get(`/api/v1/dashboards/upcoming-due?${params.toString()}`);
      return res.data?.data as { items: DashboardOverview["upcomingDue"]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
    },
  });

  const upcomingDue = upcomingData?.items ?? [];
  const upcomingMeta = upcomingData?.meta;

  const d = data ?? ({} as DashboardOverview);
  const financialFlow = Array.isArray(d.financialFlow) ? d.financialFlow : [];
  const flowLabel = (value: string) => value.length === 7 ? formatMonth(value) : formatDay(value);
  const receiptsSeries = Array.isArray(d.receiptsSeries) ? d.receiptsSeries : [];
  const portfolioComposition = Array.isArray(d.portfolioComposition) ? d.portfolioComposition : [];
  const aging = Array.isArray(d.aging) ? d.aging : [];
  const topClients = Array.isArray(d.topClients) ? d.topClients : [];
  const overdueList = Array.isArray(d.overdueList) ? d.overdueList : [];
  const installmentStatus = d.installmentStatus ?? { paid: 0, pending: 0, partiallyPaid: 0, overdue: 0, canceled: 0 };

  const statusPieData = [
    { name: "Pagas", value: installmentStatus.paid },
    { name: "Pendentes", value: installmentStatus.pending },
    { name: "Parciais", value: installmentStatus.partiallyPaid },
    { name: "Atrasadas", value: installmentStatus.overdue },
    { name: "Canceladas", value: installmentStatus.canceled },
  ].filter((x) => x.value > 0);

  const statusColors = ["#059669", "#2563eb", "#d97706", "#be123c", "#6b7280"];

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <Card className="rounded-xl border border-border p-6">
          <CardContent className="text-center">
            <p className="text-destructive">{getApiErrorMessage(error, "Erro ao carregar dashboard")}</p>
            <Button className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Entradas no período e posição atual da carteira · atualização periódica.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          {period === "custom" ? (
            <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36" />
            </>
          ) : null}
        </div>
      </div>

      {/* Destaques operacionais: informações que direcionam cobrança e caixa. */}
      <h3 className="text-sm font-semibold text-muted-foreground">Operação e recebimentos</h3>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard title="Recebido no período" value={brl(d.receivedTotal ?? 0)} icon={TrendingUp} variant="success" />
        <KpiCard title="Vencido acumulado" value={brl(d.overdueAmount ?? 0)} icon={AlertTriangle} sub="posição atual · com encargos" variant="danger" />
        <KpiCard title="Carteira em aberto" value={brl(d.openPortfolio ?? 0)} icon={Wallet} sub="posição atual · com encargos" />
        <KpiCard title="A receber no período" value={brl(d.receivableInPeriod ?? 0)} icon={CalendarClock} sub="saldo contratual com vencimento no período" />
        <KpiCard title="Capital concedido" value={brl(d.totalGranted ?? 0)} icon={DollarSign} sub="no período" />
        <KpiCard title="Carteira vencida (%)" value={percent(d.delinquencyRate ?? 0)} icon={Target} sub="valor vencido / carteira em aberto" variant={d.delinquencyRate && d.delinquencyRate > 10 ? "danger" : "default"} />
            </div>

      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">Parcelas atrasadas: {d.overdueInstallments ?? 0}</Badge>
        <Badge variant="secondary">Clientes em atraso: {d.overdueClients ?? 0}</Badge>
        <Badge variant="secondary">Vencem hoje: {d.dueToday ?? 0}</Badge>
        <Badge variant="secondary">Vencem em 7 dias: {d.dueNext7Days ?? 0}</Badge>
        <Badge variant="secondary">Juros recebidos: {brl(d.receivedInterest ?? 0)}</Badge>
        <Badge variant="secondary">Multas e mora recebidas: {brl(d.receivedCharges ?? 0)}</Badge>
      </div>

      <h3 className="text-sm font-semibold text-muted-foreground">Cobranças e vencimentos</h3>
      {/* Operational Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Due */}
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle className="text-base">Próximos vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Input
                placeholder="Pesquisar por empréstimo, cliente..."
                value={upcomingSearch}
                onChange={(e) => { setUpcomingSearch(e.target.value); setUpcomingPage(1); }}
                className="max-w-sm"
              />
            </div>
            {upcomingLoading ? (
              <div className="flex h-20 items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : upcomingDue.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum vencimento próximo.</p>
            ) : (
              <>
                <SimpleTable
                  columns={[
                    { key: "clientName", label: "Cliente" },
                    { key: "loanCode", label: "Empréstimo", render: (v) => <span className="font-mono text-xs">{v}</span> },
                    { key: "installmentNumber", label: "Parcela", render: (v) => `#${v}` },
                    { key: "dueDate", label: "Vencimento", render: (v) => dateBr(v) },
                    { key: "remainingBalance", label: "Saldo", render: (v) => brl(Number(v)) },
                    { key: "actions", label: "", render: (_v, row) => <Button size="sm" variant="outline" onClick={() => navigate(`/loans/${row.loanId}`)}>Abrir</Button> },
                  ]}
                  data={upcomingDue}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <select
                    value={upcomingPageSize}
                    onChange={(e) => { setUpcomingPageSize(Number(e.target.value)); setUpcomingPage(1); }}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value={10}>10 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={50}>50 por página</option>
                    <option value={100}>100 por página</option>
                  </select>
                  <Pagination page={upcomingPage} totalPages={upcomingMeta?.totalPages ?? 1} onPageChange={setUpcomingPage} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Overdue List */}
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle className="text-base">Cobranças prioritárias · parcelas em atraso</CardTitle>
          </CardHeader>
          <CardContent>
            {overdueList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma parcela em atraso.</p>
            ) : (
              <SimpleTable
                columns={[
                  { key: "clientName", label: "Cliente" },
                  { key: "loanCode", label: "Empréstimo", render: (v) => <span className="font-mono text-xs">{v}</span> },
                  { key: "installmentNumber", label: "Parcela", render: (v) => `#${v}` },
                  { key: "dueDate", label: "Vencimento", render: (v) => dateBr(v) },
                  { key: "updatedRemainingBalance", label: "Em aberto atualizado", render: (v) => brl(Number(v)) },
                  { key: "lateCharges", label: "Multa e juros", render: (v) => brl(Number(v)) },
                  { key: "daysOverdue", label: "Dias", render: (v) => <span className="text-destructive font-medium">{v}</span> },
                  { key: "actions", label: "", render: (_v, row) => <Button size="sm" variant="outline" onClick={() => navigate(`/loans/${row.loanId}`)}>Cobrar</Button> },
                ]}
                data={overdueList}
              />
            )}
          </CardContent>
        </Card>
      </div>


      <h3 className="text-sm font-semibold text-muted-foreground">Análise financeira</h3>
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Financial Flow */}
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle className="text-base">Fluxo financeiro</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : financialFlow.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialFlow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={flowLabel} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => brl(Number(v))} tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={flowLabel} />
                  <Legend />
                  <Bar dataKey="granted" name="Capital emprestado" fill="#2563eb" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="received" name="Recebido" fill="#059669" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="predicted" name="Previsto" fill="#d97706" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Receipts Evolution */}
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle className="text-base">Evolução dos recebimentos</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : receiptsSeries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem recebimentos no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={receiptsSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="receivedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={flowLabel} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => brl(Number(v))} tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={flowLabel} />
                  <Area type="monotone" dataKey="received" name="Recebido" stroke="#059669" strokeWidth={2} fill="url(#receivedGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Portfolio Composition */}
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle className="text-base">Composição da carteira</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : portfolioComposition.every((x) => x.value === 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={portfolioComposition} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} labelLine={false}>
                    {portfolioComposition.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Legend verticalAlign="bottom" height={24} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Installment Status */}
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle className="text-base">Status das parcelas</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : statusPieData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} labelLine={false}>
                    {statusPieData.map((_, i) => (
                      <Cell key={i} fill={statusColors[i % statusColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={24} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Aging */}
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle className="text-base">Aging da inadimplência</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : aging.every((a) => a.amount === 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem inadimplência.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aging} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => brl(Number(v))} tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Bar dataKey="amount" name="Valor" fill="#be123c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Clients */}
      {topClients.length > 0 ? (
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle className="text-base">Top 5 clientes por saldo em aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleTable
              columns={[
                { key: "clientName", label: "Cliente" },
                { key: "outstandingBalance", label: "Saldo em aberto", render: (v) => brl(Number(v)) },
                { key: "overdueAmount", label: "Valor vencido", render: (v) => brl(Number(v)) },
              ]}
              data={topClients}
            />
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}