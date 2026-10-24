import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { brl, dateBr, dateTimeBr } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import type { DashboardOverview, Installment, Paged } from "@/types/api";
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, CircleAlert,
  CircleDollarSign, Clock3, Coins, MessageCircle, RefreshCw, TrendingUp, Wallet, type LucideIcon,
} from "lucide-react";

type CashSummary = { initialized: boolean; availableBalance?: number };
type CashMonth = { month: string; incoming: number; outgoing: number; balance: number };
type CashFlow = { initialized: boolean; months: CashMonth[] };
type LoanStatus = { current: number; soon: number; overdue: number; total: number; activePrincipal: number };
type Movement = { id: string; type: string; amount: number; description: string; date: string; reversed: boolean };
const cards: { label: string; hint: string; color: string; iconBg: string; iconColor: string; Icon: LucideIcon }[] = [
  { label: "Caixa disponível", hint: "Para novos empréstimos", color: "from-[#e6f9f1] to-[#f4fffa] border-[#d0f0e2]", iconBg: "bg-[#d4f6e4]", iconColor: "text-[#0db86d]", Icon: Wallet },
  { label: "Capital emprestado", hint: "Principal dos empréstimos ativos", color: "from-[#eaf4ff] to-[#f5faff] border-[#d8e9ff]", iconBg: "bg-[#dfedff]", iconColor: "text-[#1164e5]", Icon: Coins },
  { label: "Recebimentos do período", hint: "Pagamentos confirmados", color: "from-[#fff6e3] to-[#fffbf1] border-[#f6e9ce]", iconBg: "bg-[#fff0c7]", iconColor: "text-[#f0a400]", Icon: TrendingUp },
  { label: "Em atraso", hint: "Parcelas vencidas", color: "from-[#fff0f0] to-[#fff9f9] border-[#ffdddd]", iconBg: "bg-[#ffe6e6]", iconColor: "text-[#f03030]", Icon: CircleAlert },
];
const periods = [
  { value: "30d", label: "Últimos 30 dias" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "month", label: "Mês atual" },
  { value: "year", label: "Ano atual" },
  { value: "custom", label: "Personalizado" },
];
function rangeFor(period: string, from: string, to: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
  const start = (d: string) => new Date(d + "T00:00:00-03:00").toISOString();
  const end = (d: string) => new Date(d + "T23:59:59.999-03:00").toISOString();
  const shift = (days: number) => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  if (period === "custom") return { from: start(from || today), to: end(to || today) };
  if (period === "year") return { from: start(today.slice(0, 4) + "-01-01"), to: end(today) };
  if (period === "month") return { from: start(today.slice(0, 7) + "-01"), to: end(today) };
  return { from: start(shift(period === "7d" ? -6 : -29)), to: end(today) };
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(x => x[0] ?? "").join("").toUpperCase() || "—";
}
function waUrl(row: Installment): string | null {
  const phone = (row.clientPhone ?? "").replace(/\D/g, "");
  if (phone.length < 10) return null;
  const digits = phone.startsWith("55") && phone.length >= 12 ? phone : "55" + phone;
  const message = [
    "Olá, " + (row.clientName ?? "cliente") + "!",
    "Lembrete sobre a parcela " + row.number + " do contrato " + (row.loanCode ?? "") + ".",
    "Vencimento: " + dateBr(row.dueDate),
    "Saldo atualizado: " + brl(row.updatedRemainingBalance),
    "Caso já tenha efetuado o pagamento, desconsidere. Obrigado!",
  ].join("\n");
  return "https://wa.me/" + digits + "?text=" + encodeURIComponent(message);
}
function CardTitle({ children, href }: { children: React.ReactNode; href?: string }) {
  return <div className="mb-4 flex items-center justify-between gap-2">
    <h2 className="text-[15px] font-bold tracking-tight text-[#111e33]">{children}</h2>
    {href && <Link to={href} className="shrink-0 text-xs font-semibold text-[#0869e6] hover:underline">Ver todos</Link>}
  </div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[135px] items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">{children}</div>;
}
function Metric({ index, value, subtitle }: { index: number; value: string; subtitle?: string }) {
  const info = cards[index];
  const Icon = info.Icon;
  return <div className={"min-w-0 rounded-xl border bg-gradient-to-br px-4 py-4 sm:px-5 sm:py-5 " + info.color}>
    <div className="flex items-start gap-3">
      <span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " + info.iconBg}>
        <Icon className={"h-6 w-6 " + info.iconColor} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={"text-[11px] font-medium " + (index === 3 ? "text-red-600" : "text-slate-700")}>{info.label}</p>
        <p className={"mt-1 break-words text-[clamp(1rem,2vw,1.42rem)] font-extrabold tracking-tight tabular-nums " + (index === 0 ? "text-[#07a05a]" : index === 1 ? "text-[#0645a9]" : index === 3 ? "text-red-600" : "text-slate-950")}>{value}</p>
        <p className="mt-1.5 text-[11px] leading-snug text-slate-600">{subtitle ?? info.hint}</p>
      </div>
    </div>
  </div>;
}
function DetailRow({ name, amount, sub, href, accent = "rose", phoneUrl }: {
  name: string; amount: number; sub: string; href: string; accent?: "rose" | "blue"; phoneUrl?: string | null;
}) {
  const navigate = useNavigate();
  return <div className="flex min-w-0 items-center gap-2.5 border-b border-slate-100 py-2.5 last:border-b-0">
    <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold " + (accent === "rose" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-700")}>{initials(name)}</span>
    <button onClick={() => navigate(href)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <p className="truncate text-xs font-semibold text-slate-800" title={name}>{name}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>
    </button>
    <strong className="shrink-0 text-[11px] tabular-nums text-slate-800">{brl(amount)}</strong>
    {phoneUrl ? <a href={phoneUrl} target="_blank" rel="noreferrer" className="ml-1 shrink-0 text-emerald-600 hover:text-emerald-700" title={"Contatar " + name + " pelo WhatsApp"} aria-label={"Contatar " + name + " no WhatsApp"}>
      <MessageCircle className="h-5 w-5" />
    </a> : <Link to={href} className="ml-1 shrink-0 text-blue-500" aria-label={"Abrir contrato de " + name}><ArrowRight className="h-4 w-4"/></Link>}
  </div>;
}
const moneyTick = (value: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 0 }).format(value);
const colorOf = ["#16bd7b", "#ffc12c", "#ff504e"];
const monthLabel = (month: string) => {
  const i = Number(month.split("-")[1]) - 1;
  return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][i] ?? month;
};
export default function DashboardPage() {
  const { can } = useAuth();
  const hasFinance = can("finance:read");
  const [period, setPeriod] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(() => rangeFor(period, customFrom, customTo), [period, customFrom, customTo]);
  const query = useQuery({
    queryKey: ["dashboards", "overview", range.from, range.to],
    queryFn: async () => (await api.get("/api/v1/dashboards/overview", { params: range })).data.data as DashboardOverview,
    refetchInterval: 60_000,
  });
  const { data: finance, isError: financeError } = useQuery({
    queryKey: ["finance", "overview"], enabled: hasFinance,
    queryFn: async () => (await api.get("/api/v1/finance/overview")).data.data as CashSummary,
    refetchInterval: 60_000,
  });
  const { data: cashFlow } = useQuery({
    queryKey: ["finance", "cash-flow"], enabled: hasFinance && finance?.initialized === true,
    queryFn: async () => (await api.get("/api/v1/finance/cash-flow")).data.data as CashFlow,
    refetchInterval: 60_000,
  });
  const { data: loanStatus } = useQuery({
    queryKey: ["dashboards", "loan-status"],
    queryFn: async () => (await api.get("/api/v1/dashboards/loan-status")).data.data as LoanStatus,
    refetchInterval: 60_000,
  });
  const { data: movements } = useQuery({
    queryKey: ["finance", "entries", "dashboard"],
    enabled: hasFinance && finance?.initialized === true,
    queryFn: async () => (await api.get("/api/v1/finance/entries?page=1&pageSize=3")).data.data as Paged<Movement>,
    refetchInterval: 60_000,
  });
  const { data: overdue } = useQuery({
    queryKey: ["installments", "overdue", "dashboard"],
    queryFn: async () => (await api.get("/api/v1/installments?overdueOnly=true&page=1&pageSize=5")).data.data as Paged<Installment>,
    refetchInterval: 60_000,
  });
  const { data: due } = useQuery({
    queryKey: ["dashboards", "upcoming-due", "sketch"],
    queryFn: async () => (await api.get("/api/v1/dashboards/upcoming-due?page=1&pageSize=5")).data.data as Paged<DashboardOverview["upcomingDue"][number]>,
    refetchInterval: 60_000,
  });
  const info = query.data;
  const status = loanStatus ?? { current: 0, soon: 0, overdue: 0, total: 0, activePrincipal: 0 };
  const donut = [
    { name: "Em dia", value: status.current },
    { name: "Próximos do vencimento", value: status.soon },
    { name: "Em atraso", value: status.overdue },
  ];
  if (query.isError) return <Card className="p-6">
    <p className="mb-3 text-sm text-red-600">{getApiErrorMessage(query.error, "Não foi possível carregar o dashboard.")}</p>
    <Button onClick={() => query.refetch()}><RefreshCw className="h-4 w-4"/> Tentar novamente</Button>
  </Card>;
  return <div className="space-y-4 pb-8 sm:space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-[26px] font-extrabold tracking-tight text-[#101b2e] sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-[13px] text-[#627086]">Visão geral da operação</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={period} onValueChange={setPeriod} aria-label="Período do dashboard" className="h-10 w-full border-slate-200 bg-white text-xs sm:w-[175px]">
          {periods.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
        {period === "custom" && <>
          <Input type="date" aria-label="Início" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-[145px]" />
          <Input type="date" aria-label="Fim" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} className="w-[145px]" />
        </>}
      </div>
    </div>

    {query.isPending ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map(x => <div key={x} className="h-32 animate-pulse rounded-xl bg-slate-100" />)}
    </div> : <>
      <section aria-label="Resumo dos indicadores" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {hasFinance ? <Link to="/cash" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Metric index={0} value={financeError ? "Indisponível" : finance?.initialized ? brl(finance.availableBalance ?? 0) : "Configurar caixa"} />
        </Link> : <Metric index={0} value="Acesso restrito" subtitle="Disponível à gestão financeira" />}
        <Metric index={1} value={brl(status.activePrincipal)} subtitle={status.total + " empréstimo(s) ativo(s)"} />
        <Metric index={2} value={brl(info?.receivedTotal ?? 0)} subtitle="Pagamentos confirmados no período" />
        <Link to="/defaults"><Metric index={3} value={brl(info?.overdueAmount ?? 0)} subtitle={(info?.overdueInstallments ?? 0) + " parcela(s) atrasada(s)"} /></Link>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.07fr_0.93fr]">
        <Card className="min-w-0 rounded-xl border border-slate-200 p-4 shadow-[0_2px_16px_-10px_#123] sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-2">
            <div><h2 className="text-base font-bold tracking-tight text-slate-900">Resumo financeiro</h2>
              <p className="mt-1 text-[11px] text-slate-500">Entradas, saídas e evolução do saldo real</p></div>
            <span className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-600">Últimos 6 meses</span>
          </div>
          {hasFinance && cashFlow?.initialized ? <>
            <div className="h-[235px] w-full sm:h-[265px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashFlow.months} margin={{ top: 12, right: 10, left: -23, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e9edf2" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#69778a" }} dy={9} />
                  <YAxis tickFormatter={moneyTick} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#8b95a4" }} />
                  <Tooltip formatter={(v: number, name: string) => [brl(v), name]} labelFormatter={monthLabel} />
                  <Bar dataKey="incoming" name="Entradas" fill="#24c583" radius={[3, 3, 0, 0]} maxBarSize={25} />
                  <Bar dataKey="outgoing" name="Saídas" fill="#ff615d" radius={[3, 3, 0, 0]} maxBarSize={25} />
                  <Line type="monotone" dataKey="balance" name="Saldo do caixa" stroke="#2789ef" strokeWidth={2.5} dot={{ r: 3, fill: "#2789ef" }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-slate-600">
              <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#24c583]"/>Entradas</span>
              <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#ff615d]"/>Saídas</span>
              <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#2789ef]"/>Saldo do caixa</span>
            </div>
          </> : hasFinance ? <Empty>{finance?.initialized === false ? "Inicialize o caixa para visualizar a evolução financeira." : "Carregando dados financeiros..."}</Empty>
          : <Empty>Dados financeiros disponíveis apenas para perfis autorizados.</Empty>}
        </Card>

        <Card className="min-w-0 rounded-xl border border-slate-200 p-4 shadow-[0_2px_16px_-10px_#123] sm:p-5">
          <CardTitle>Situação dos empréstimos</CardTitle>
          <div className="grid items-center gap-3 sm:grid-cols-[minmax(170px,0.9fr)_minmax(0,1fr)]">
            <div className="relative mx-auto h-[220px] w-full max-w-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={status.total ? donut : [{ name: "Sem ativos", value: 1 }]} innerRadius={65} outerRadius={91}
                    dataKey="value" nameKey="name" strokeWidth={0} startAngle={90} endAngle={-270}>
                    {(status.total ? donut : [{ value: 1 }]).map((x, i) => <Cell key={i} fill={status.total ? colorOf[i] : "#e4e9f0"} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value + " empréstimo(s)", name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-3xl font-extrabold tabular-nums text-slate-900">{status.total}</strong>
                <span className="text-xs text-slate-500">empréstimos</span>
              </div>
            </div>
            <div className="space-y-0.5">
              {donut.map((x, i) => <div key={x.name} className="flex items-center justify-between gap-2 border-b border-slate-100 py-3 last:border-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: colorOf[i] }}>{i === 0 ? "✓" : i === 1 ? "⌄" : "!"}</span>
                  <span className="text-[12px] font-medium text-slate-700">{x.value} {x.name}</span>
                </div>
                <span className="text-xs font-semibold tabular-nums text-slate-500">{status.total ? Math.round(x.value / status.total * 100) : 0}%</span>
              </div>)}
            </div>
          </div>
        </Card>
      </div>

      <section aria-label="Acompanhamento operacional" className="grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
          <CardTitle href={hasFinance ? "/cash" : undefined}>Últimas movimentações de caixa</CardTitle>
          {hasFinance && finance?.initialized ? movements?.items?.length ? <div className="divide-y divide-slate-100">
            {movements.items.map(m => <div key={m.id} className="flex items-center gap-2 py-3">
              <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full " + (m.type === "PAYMENT" || m.type === "CONTRIBUTION" ? "bg-green-50 text-green-600" : "bg-rose-50 text-rose-600")}>
                {m.type === "PAYMENT" || m.type === "CONTRIBUTION" ? <ArrowDownLeft className="h-4 w-4"/> : <ArrowUpRight className="h-4 w-4"/>}
              </span>
              <div className="min-w-0 flex-1">
                <p className={"text-xs font-bold tabular-nums " + (m.reversed ? "text-slate-400 line-through" : m.type === "PAYMENT" || m.type === "CONTRIBUTION" ? "text-[#00a862]" : "text-red-500")}>
                  {(m.type === "PAYMENT" || m.type === "CONTRIBUTION" ? "+ " : "− ") + brl(m.amount)}
                </p>
                <p className="truncate text-[11px] text-slate-500" title={m.description}>{m.description}{m.reversed ? " · Estornado" : ""}</p>
              </div>
              <time className="shrink-0 text-[10px] text-slate-400">{dateTimeBr(m.date)}</time>
            </div>)}
          </div> : <Empty>Nenhuma movimentação desde a abertura.</Empty>
            : <Empty>{hasFinance ? "Inicialize o caixa para visualizar movimentações." : "Acesso restrito à gestão financeira."}</Empty>}
        </Card>

        <Card className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
          <CardTitle href="/defaults">Clientes em atraso</CardTitle>
          {overdue?.items?.length ? overdue.items.slice(0, 4).map(row => <DetailRow key={row.id}
            name={row.clientName ?? "Cliente"} amount={row.updatedRemainingBalance} sub={row.daysOverdue + " dias de atraso · Parcela " + row.number}
            href={"/loans/" + row.loanId} phoneUrl={waUrl(row)} />)
            : <Empty><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600"/> Nenhum cliente em atraso.</Empty>}
        </Card>

        <Card className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
          <CardTitle href="/installments">Próximos vencimentos</CardTitle>
          {due?.items?.length ? due.items.slice(0, 4).map(row => <DetailRow key={row.loanId + "-" + row.installmentNumber}
            name={row.clientName ?? "Cliente"} amount={row.remainingBalance} sub={"Vence em " + dateBr(row.dueDate)}
            accent="blue" href={"/loans/" + row.loanId} />)
            : <Empty><Clock3 className="mr-2 h-4 w-4"/> Nenhum vencimento próximo.</Empty>}
        </Card>
      </section>
    </>}
  </div>;
}
