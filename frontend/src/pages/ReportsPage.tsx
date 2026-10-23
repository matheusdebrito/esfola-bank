import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SimpleTable } from "@/components/SimpleTable";
import { BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { RefreshCw } from "lucide-react";
import { brl, percent } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import type { DashboardOverview } from "@/types/api";

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





const COLORS = ["#059669", "#2563eb", "#d97706", "#b91c1c", "#6b7280"];
const axisLabel = (v: string) => v.length === 7 ? v.slice(5) + "/" + v.slice(2, 4) : v.slice(8) + "/" + v.slice(5, 7);
const moneyTick = (n: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export default function ReportsPage() {
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => periodToRange(period, from, to), [period, from, to]);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["dashboards", "overview", range.from, range.to],
    queryFn: async () => {
      const q = new URLSearchParams({ from: range.from, to: range.to });
      const response = await api.get("/api/v1/dashboards/overview?" + q.toString());
      return response.data.data as DashboardOverview;
    },
    refetchInterval: 60_000,
  });

  if (isError) return <Card className="p-6 space-y-3">
    <h1 className="text-xl font-semibold">Relatórios</h1>
    <p className="text-sm text-destructive">{getApiErrorMessage(error, "Erro ao carregar relatórios")}</p>
    <Button onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente</Button>
  </Card>;
  const chart = data?.financialFlow ?? [];
  const aging = data?.aging ?? [];
  const composition = data?.portfolioComposition ?? [];
  const status = data?.installmentStatus;
  const statusItems = [
    { name: "Pagas", value: status?.paid ?? 0 },
    { name: "Pendentes", value: status?.pending ?? 0 },
    { name: "Parciais", value: status?.partiallyPaid ?? 0 },
    { name: "Atrasadas", value: status?.overdue ?? 0 },
    { name: "Canceladas", value: status?.canceled ?? 0 },
  ].filter(x => x.value > 0);

  return <div className="space-y-5 pb-6 sm:space-y-7">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Relatórios</h1>
        <p className="mt-1 text-sm text-muted-foreground">Movimentação financeira no período e análises da carteira atual.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={setPeriod}>
          {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        {period === "custom" && <>
          <Input aria-label="Data inicial" type="date" className="w-36" value={from} onChange={e => setFrom(e.target.value)} />
          <Input aria-label="Data final" type="date" className="w-36" min={from || undefined} value={to} onChange={e => setTo(e.target.value)} />
        </>}
      </div>
    </header>
    {isPending ? <Card className="p-5 text-sm text-muted-foreground">Carregando relatórios...</Card> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Capital concedido", data?.totalGranted ?? 0, "Empréstimos não cancelados no período"],
          ["Recebimentos", data?.receivedTotal ?? 0, "Entradas confirmadas no período"],
          ["Juros contratuais recebidos", data?.receivedInterest ?? 0, "Sem multas e mora"],
          ["Multas e mora recebidas", data?.receivedCharges ?? 0, "Encargos efetivamente recebidos"],
        ].map(([name, amount, detail]) =>
          <Card key={String(name)} className="rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{name}</p>
            <p className="mt-3 break-words text-xl font-semibold tabular-nums">{brl(Number(amount))}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </Card>)}
      </div>
      <Card className="rounded-2xl p-5">
        <CardHeader>
          <CardTitle className="text-base">Movimentação financeira</CardTitle>
          <p className="text-xs text-muted-foreground">Entradas, capital concedido e parcelas previstas por data de vencimento.</p>
        </CardHeader>
        <CardContent className="mt-3 h-64 sm:h-80">
          {chart.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Sem movimentos no período.</p> :
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={axisLabel} tick={{ fontSize: 11 }}/>
              <YAxis width={68} tickFormatter={moneyTick} tick={{ fontSize: 11 }}/>
              <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={axisLabel}/>
              <Legend />
              <Bar dataKey="received" name="Recebido" fill="#059669" radius={[3,3,0,0]}/>
              <Bar dataKey="predicted" name="Previsto" fill="#94a3b8" radius={[3,3,0,0]}/>
              <Bar dataKey="granted" name="Capital concedido" fill="#2563eb" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl p-5">
          <CardHeader><CardTitle className="text-base">Carteira atual</CardTitle></CardHeader>
          <CardContent className="mt-3 h-64">
            {composition.every(item => item.value === 0) ? <p className="py-10 text-center text-sm text-muted-foreground">Sem valores em aberto.</p> :
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={composition} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} cx="50%" cy="45%">
                    {composition.map((_, i) => <Cell key={i} fill={i ? "#b91c1c" : "#059669"} />)}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(v) => brl(Number(v))}/>
                </PieChart>
              </ResponsiveContainer>}
          </CardContent>
        </Card>
        <Card className="rounded-2xl p-5">
          <CardHeader><CardTitle className="text-base">Atrasos por faixa de dias</CardTitle></CardHeader>
          <CardContent className="mt-3 h-64">
            {aging.every(item => item.amount === 0) ? <p className="py-10 text-center text-sm text-muted-foreground">Sem atrasos.</p> :
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aging} margin={{ left: 0, right: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3"/>
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }}/>
                  <YAxis width={65} tickFormatter={moneyTick} tick={{ fontSize: 11 }}/>
                  <Tooltip formatter={(v) => brl(Number(v))}/>
                  <Bar dataKey="amount" name="Valor vencido" fill="#b91c1c" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>}
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl p-5">
          <CardHeader><CardTitle className="text-base">Situação das parcelas</CardTitle></CardHeader>
          <CardContent className="mt-3 space-y-3">
            {statusItems.map((item, i) => <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{item.name}</span>
              <strong className="tabular-nums">{item.value}</strong>
            </div>)}
            {statusItems.length === 0 && <p className="text-sm text-muted-foreground">Sem parcelas cadastradas.</p>}
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl p-5">
          <CardHeader><CardTitle className="text-base">Clientes por saldo em aberto</CardTitle></CardHeader>
          <CardContent>
            <SimpleTable columns={[
              { key: "clientName", label: "Cliente" },
              { key: "outstandingBalance", label: "Em aberto", render: (v) => brl(Number(v)) },
              { key: "overdueAmount", label: "Vencido", render: (v) => brl(Number(v)) },
            ]} data={data?.topClients ?? []}/>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">A posição atual da carteira não muda com o filtro de movimentação. Os recebimentos podem se referir a parcelas previstas em outros períodos. Esses valores não representam lucro líquido.</p>
    </>}
  </div>;
}
