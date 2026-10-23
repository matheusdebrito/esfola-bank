import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BarChart, Bar, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ArrowRight, CalendarClock, CheckCircle2, AlertTriangle, Wallet, TrendingUp, RefreshCw, ChevronRight } from "lucide-react";
import { brl, percent, dateBr } from "@/lib/format";
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



type DashboardIcon = React.ComponentType<{ className?: string }>;
function Metric({ title, value, description, Icon, variant = "default" }: {
  title: string; value: string; description: string; Icon: DashboardIcon;
  variant?: "default" | "positive" | "warning";
}) {
  const accent = variant === "warning" ? "text-destructive" : variant === "positive" ? "text-emerald-600" : "text-primary";
  return (
    <Card className="min-w-0 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-muted-foreground sm:text-sm">{title}</p>
        <Icon className={"h-4 w-4 shrink-0 " + accent} />
      </div>
      <p className="mt-3 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </Card>
  );
}
function shortDay(value: string) {
  if (value.length === 7) {
    const [year, month] = value.split("-");
    return month + "/" + year.slice(2);
  }
  const [year, month, day] = value.split("-");
  return day && month && year ? day + "/" + month : value;
}
const moneyTick = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(() => periodToRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["dashboards", "overview", range.from, range.to],
    queryFn: async () => {
      const q = new URLSearchParams({ from: range.from, to: range.to });
      const response = await api.get("/api/v1/dashboards/overview?" + q.toString());
      return response.data.data as DashboardOverview;
    },
    refetchInterval: 60_000,
  });
  const { data: upcoming, isPending: loadingUpcoming } = useQuery({
    queryKey: ["dashboards", "upcoming-due", "home"],
    queryFn: async () => {
      const response = await api.get("/api/v1/dashboards/upcoming-due?page=1&pageSize=6");
      return response.data.data.items as DashboardOverview["upcomingDue"];
    },
    refetchInterval: 60_000,
  });

  const info = data;
  const performance = info?.collectionPerformance;
  const performanceRate = performance?.rate;
  const ratio = typeof performanceRate === "number" ? Math.max(0, Math.min(100, performanceRate)) : 0;
  const debtRows = info?.overdueList.slice(0, 6) ?? [];
  const dueRows = upcoming ?? [];
  const flow = info?.financialFlow ?? [];

  if (isError) {
    return <Card className="space-y-3 p-6">
      <h1 className="text-xl font-semibold">Visão geral</h1>
      <p className="text-sm text-destructive">{getApiErrorMessage(error, "Não foi possível carregar os indicadores")}</p>
      <Button onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente</Button>
    </Card>;
  }

  return (
    <div className="space-y-5 pb-6 sm:space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Visão geral</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recebimentos do período e posição atual da carteira.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          {period === "custom" && <>
            <Input aria-label="Data inicial" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36" />
            <Input aria-label="Data final" type="date" min={customFrom || undefined} value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36" />
          </>}
        </div>
      </header>

      {isPending ? <Card className="p-6 text-sm text-muted-foreground">Carregando indicadores...</Card> : <>
        <section aria-label="Indicadores principais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric title="Recebido no período" value={brl(info?.receivedTotal ?? 0)} description="Entradas confirmadas" Icon={TrendingUp} variant="positive" />
          <Metric title="Total vencido" value={brl(info?.overdueAmount ?? 0)} description="Em aberto, incluindo encargos" Icon={AlertTriangle} variant="warning" />
          <Metric title="Carteira em aberto" value={brl(info?.openPortfolio ?? 0)} description="Posição atual, incluindo encargos" Icon={Wallet} />
          <Metric title="A vencer em 7 dias" value={brl(info?.dueNext7Amount ?? 0)} description="Saldo contratual, incluindo hoje" Icon={CalendarClock} />
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
          <Card className="rounded-2xl p-5">
            <CardHeader className="mb-3">
              <CardTitle className="text-base">Cumprimento dos vencimentos</CardTitle>
              <p className="text-xs text-muted-foreground">Parcelas com vencimento no período até hoje; inclui pagamentos antecipados e exclui multas.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Valor contratual previsto</p>
                  <p className="text-xl font-semibold tabular-nums">{brl(performance?.scheduled ?? 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Valor já quitado dessas parcelas</p>
                  <p className="text-xl font-semibold tabular-nums">{brl(performance?.settled ?? 0)}</p>
                </div>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio} aria-label="Percentual de vencimentos cumpridos">
                <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: ratio + "%" }} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{performanceRate === null || performanceRate === undefined ? "Sem parcelas vencidas nesse período" : "Realização das parcelas previstas"}</span>
                <strong className="text-lg tabular-nums">{performanceRate === null || performanceRate === undefined ? "—" : percent(performanceRate)}</strong>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl p-5">
            <CardHeader className="mb-3">
              <CardTitle className="text-base">Atenção necessária</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <span className="text-sm text-muted-foreground">Clientes com atraso</span><strong className="tabular-nums">{info?.overdueClients ?? 0}</strong>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <span className="text-sm text-muted-foreground">Parcelas vencidas</span><strong className="tabular-nums">{info?.overdueInstallments ?? 0}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Percentual da carteira vencida</span><strong className="tabular-nums">{percent(info?.delinquencyRate ?? 0)}</strong>
              </div>
              <Link to="/defaults" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">Ir para cobranças <ArrowRight className="h-4 w-4" /></Link>
            </CardContent>
          </Card>
        </div>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-label="Cobranças e próximos vencimentos">
          <Card className="min-w-0 rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Cobranças prioritárias</h2>
                <p className="text-xs text-muted-foreground">Mais dias de atraso primeiro; maior dívida no desempate.</p>
              </div>
              <Link className="inline-flex items-center gap-1 text-sm text-primary hover:underline" to="/defaults">Ver todas <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            {debtRows.length === 0 ? <div className="flex gap-2 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Nenhuma parcela vencida.</div> :
              <div className="divide-y divide-border">
                {debtRows.map((row) => <div key={row.loanId + ":" + row.installmentNumber} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.clientName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Parcela #{row.installmentNumber} · {row.daysOverdue} dias em atraso · {dateBr(row.dueDate)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{brl(row.updatedRemainingBalance)}</p>
                    <Button aria-label={"Abrir empréstimo de " + row.clientName} variant="ghost" size="sm" className="mt-1 h-8 px-2" onClick={() => navigate("/loans/" + row.loanId)}>Abrir <ChevronRight className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>)}
              </div>}
          </Card>
          <Card className="min-w-0 rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Próximos vencimentos</h2>
                <p className="text-xs text-muted-foreground">Parcelas abertas a partir de hoje.</p>
              </div>
              <Link className="inline-flex items-center gap-1 text-sm text-primary hover:underline" to="/installments">Ver parcelas <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            {loadingUpcoming ? <p className="py-3 text-sm text-muted-foreground">Carregando vencimentos...</p> : dueRows.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Nenhum vencimento futuro.</p> :
              <div className="divide-y divide-border">
                {dueRows.map((row) => <div key={row.loanId + ":" + row.installmentNumber} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.clientName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Parcela #{row.installmentNumber} · {dateBr(row.dueDate)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{brl(row.remainingBalance)}</p>
                    <Button aria-label={"Abrir empréstimo de " + row.clientName} variant="ghost" size="sm" className="mt-1 h-8 px-2" onClick={() => navigate("/loans/" + row.loanId)}>Abrir <ChevronRight className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>)}
              </div>}
          </Card>
        </section>

        <Card className="min-w-0 rounded-2xl p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Recebimentos e vencimentos previstos</h2>
              <p className="text-xs text-muted-foreground">Movimentação recebida × parcelas contratualmente previstas em cada data.</p>
            </div>
            <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Relatórios <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          {flow.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhum movimento no período.</p> :
            <div className="h-64 w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flow} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={shortDay} tick={{ fontSize: 11 }} />
                  <YAxis width={65} tickFormatter={moneyTick} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={shortDay} />
                  <Legend />
                  <Bar dataKey="received" name="Recebido" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="predicted" name="Previsto" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>}
          <p className="mt-2 text-xs text-muted-foreground">O recebido inclui pagamentos de qualquer vencimento; a taxa de realização acima considera apenas as parcelas da janela selecionada.</p>
        </Card>
      </>}
    </div>
  );
}
