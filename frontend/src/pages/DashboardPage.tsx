"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { QUERY_KEYS } from "@/lib/query-keys";
import { brl, percent } from "@/lib/format";
import type { DashboardMonthly } from "@/types/api";

const COLORS = ["#2563eb", "#059669", "#d97706", "#be123c", "#7c3aed"];

type Executive = {
  totalGranted?: number;
  activeLoans?: number;
  activeClients?: number;
  overdueAmount?: number;
  receivedTotal?: number;
  interestReceived?: number;
  overdueInstallments?: number;
  openPortfolio?: number;
  delinquencyRate?: number;
};

type FinancialSeriesItem = { day: string; received: number };

function MetricCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card className="rounded-xl border border-border p-4">
      <CardContent className="pt-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value}</span>
          {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDay(value: string) {
  const [, month, day] = value.split("-");
  return month && day ? `${day}/${month}` : value;
}

export default function DashboardPage() {
  const { data: executive, isLoading: execLoading } = useQuery({
    queryKey: QUERY_KEYS.dashboards.executive,
    queryFn: async () => {
      const res = await api.get("/api/v1/dashboards/executive");
      return (res.data?.data ?? {}) as Executive;
    },
  });

  const { data: financial, isLoading: finLoading } = useQuery({
    queryKey: QUERY_KEYS.dashboards.financial,
    queryFn: async () => {
      const res = await api.get("/api/v1/dashboards/financial");
      return (res.data?.data ?? { series: [] }) as { series: FinancialSeriesItem[] };
    },
  });

  const { data: monthly } = useQuery({
    queryKey: QUERY_KEYS.dashboards.monthly,
    queryFn: async () => {
      const res = await api.get("/api/v1/dashboards/monthly");
      return (res.data?.data ?? {}) as DashboardMonthly;
    },
  });

  const series = Array.isArray(financial?.series) ? financial.series : [];
  const openPortfolio = Number(executive?.openPortfolio ?? 0);
  const overdueAmount = Number(executive?.overdueAmount ?? 0);

  const portfolioComposition = [
    { name: "Em aberto", value: Math.max(0, openPortfolio - overdueAmount) },
    { name: "Vencido", value: overdueAmount },
    { name: "Juros recebidos", value: Number(executive?.interestReceived ?? 0) },
  ];

  const monthInstallments = [
    { name: "A receber", value: monthly?.dueInstallmentsThisMonth ?? 0 },
    { name: "Em atraso", value: monthly?.overdueInstallmentsThisMonth ?? 0 },
    { name: "Em dia", value: monthly?.currentInstallmentsThisMonth ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Dashboard Executivo</h2>
        <p className="text-sm text-muted-foreground">Indicadores gerenciais em tempo real.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard title="Total emprestado" value={brl(monthly?.totalGranted ?? executive?.totalGranted ?? 0)} />
        <MetricCard title="Carteira em aberto" value={brl(openPortfolio)} />
        <MetricCard title="Recebido" value={brl(executive?.receivedTotal ?? 0)} />
        <MetricCard title="Juros recebidos" value={brl(executive?.interestReceived ?? 0)} />
        <MetricCard title="A receber neste mês" value={brl(monthly?.receivableThisMonth ?? 0)} />
        <MetricCard title="Parcelas a receber" value={String(monthly?.dueInstallmentsThisMonth ?? 0)} />
        <MetricCard title="Parcelas em atraso" value={String(executive?.overdueInstallments ?? 0)} />
        <MetricCard title="Valor vencido" value={brl(overdueAmount)} />
        <MetricCard title="Inadimplência" value={percent(executive?.delinquencyRate ?? 0)} />
        <MetricCard title="Clientes ativos" value={String(executive?.activeClients ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-xl border border-border p-4 lg:col-span-2">
          <CardHeader>
            <CardTitle>Recebimentos por dia</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {finLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : series.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum recebimento registrado no período.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="receivedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => brl(Number(value))} tick={{ fontSize: 12 }} width={90} />
                  <Tooltip
                    labelFormatter={(value) => `Dia ${formatDay(String(value))}`}
                    formatter={(value) => [brl(Number(value)), "Recebido"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="received"
                    name="Recebido"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#receivedGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle>Composição da carteira</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {execLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolioComposition}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    labelLine={false}
                  >
                    {portfolioComposition.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => brl(Number(value))} />
                  <Legend verticalAlign="bottom" height={24} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle>Inadimplência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Parcelas vencidas</span>
              <Badge variant="destructive">{executive?.overdueInstallments ?? 0}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor vencido</span>
              <span className="font-medium">{brl(overdueAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa de inadimplência</span>
              <span className="font-medium">{percent(executive?.delinquencyRate ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Juros recebidos</span>
              <span className="font-medium">{brl(executive?.interestReceived ?? 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border p-4 lg:col-span-2">
          <CardHeader>
            <CardTitle>Parcelas deste mês</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {!monthly ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthInstallments} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={40} />
                  <Tooltip formatter={(value) => [`${value} parcela(s)`, "Quantidade"]} />
                  <Bar dataKey="value" name="Parcelas" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {execLoading || finLoading ? <p className="text-muted-foreground">Carregando dados...</p> : null}
    </div>
  );
}
