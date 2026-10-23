"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import type { DashboardMonthly } from "@/types/api";

const COLORS = ["#2563eb", "#059669", "#d97706", "#be123c", "#7c3aed"];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function MetricCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card className="rounded-xl border border-border p-4">
      <CardContent className="pt-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-bold">{value}</span>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: executive, isLoading: execLoading } = useQuery({
    queryKey: ["dashboard-executive"],
    queryFn: async () => {
      const res = await api.get("/api/v1/dashboards/executive");
      return res.data?.data ?? {};
    },
  });

  const { data: financial, isLoading: finLoading } = useQuery({
    queryKey: ["dashboard-financial"],
    queryFn: async () => {
      const res = await api.get("/api/v1/dashboards/financial");
      return res.data?.data ?? { series: [] };
    },
  });

  const { data: monthly } = useQuery({
    queryKey: ["dashboard-monthly"],
    queryFn: async () => {
      const res = await api.get("/api/v1/dashboards/monthly");
      return (res.data?.data ?? {}) as DashboardMonthly;
    },
  });

  const tg = executive?.totalGranted ?? 0;
  const al = executive?.activeLoans ?? 0;
  const ac = executive?.activeClients ?? 0;
  const oa = executive?.overdueAmount ?? 0;
  const rt = executive?.receivedTotal ?? 0;
  const ir = executive?.interestReceived ?? 0;
  const oi = executive?.overdueInstallments ?? 0;
  const dr = executive?.delinquencyRate ?? 0;

  const series = Array.isArray(financial?.series) ? financial.series : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Dashboard Executivo</h2>
        <p className="text-sm text-muted-foreground">Indicadores gerenciais em tempo real.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="Total emprestado" value={formatMoney(tg)} sub="R$" />
        <MetricCard title="A receber neste mês" value={formatMoney(monthly?.receivableThisMonth ?? 0)} sub="R$" />
        <MetricCard title="Parcelas a receber neste mês" value={String(monthly?.dueInstallmentsThisMonth ?? 0)} />
        <MetricCard title="Parcelas em atraso" value={String(monthly?.overdueInstallmentsThisMonth ?? 0)} />
        <MetricCard title="Parcelas em dia neste mês" value={String(monthly?.currentInstallmentsThisMonth ?? 0)} />
        <MetricCard title="Clientes ativos" value={String(executive?.activeClients ?? 0)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Principal concedido" value={formatMoney(tg)} sub="R$" />
        <MetricCard title="Empréstimos ativos" value={String(al)} />
        <MetricCard title="Clientes ativos" value={String(ac)} />
        <MetricCard title="Valor vencido" value={formatMoney(oa)} sub="R$" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle>Recebimentos por dia</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {finLoading || execLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <Line
                    type="monotone"
                    dataKey="received"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle>Composição da carteira</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Recebido", value: rt },
                    { name: "Juros recebidos", value: ir },
                    { name: "Vencido", value: oa },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  labelLine={false}
                >
                  {series.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border p-4">
          <CardHeader>
            <CardTitle>Inadimplência</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Parcelas vencidas</span>
                <Badge variant="destructive">{oi}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de inadimplência</span>
                <span className="font-medium">{dr.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Juros recebidos</span>
                <span className="font-medium">{formatMoney(ir)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-border p-4">
        <CardHeader>
          <CardTitle>Parcelas deste mês</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {finLoading || !monthly ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "A receber", value: monthly.dueInstallmentsThisMonth },
                  { name: "Em atraso", value: monthly.overdueInstallmentsThisMonth },
                  { name: "Em dia", value: monthly.currentInstallmentsThisMonth },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {execLoading || finLoading ? (
        <p className="text-muted-foreground">Carregando dados...</p>
      ) : null}
    </div>
  );
}
