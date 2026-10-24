import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { brl, dateTimeBr } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/Pagination";
import { ArrowDownLeft, ArrowUpRight, Banknote, Download, Landmark, Plus, RefreshCw, Wallet } from "lucide-react";

type Finance = {
  initialized: boolean; openingBalance?: number; availableBalance?: number; startedAt?: string;
  contributions?: number; withdrawals?: number; expenses?: number; disbursements?: number;
  received?: number;
};
type Row = {
  id: string; type: "CONTRIBUTION" | "WITHDRAWAL" | "EXPENSE" | "DISBURSEMENT" | "PAYMENT";
  description: string; amount: number; date: string; reversed: boolean;
  userName?: string; balanceAfter?: number;
};
type PageResult = { items: Row[]; meta: { total: number; page: number; pageSize: number; totalPages: number } };
type Category = "CONTRIBUTION" | "WITHDRAWAL" | "EXPENSE";
const typeText: Record<Row["type"], string> = {
  CONTRIBUTION: "Adição", WITHDRAWAL: "Retirada", EXPENSE: "Despesa",
  DISBURSEMENT: "Empréstimo", PAYMENT: "Pagamento",
};
const isIncoming = (row: Row) => row.type === "CONTRIBUTION" || row.type === "PAYMENT";
function parseMoney(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 && value <= 999999999999.99 ? value : null;
}
function toIso(value: string, end: boolean) {
  return new Date(value + (end ? "T23:59:59.999-03:00" : "T00:00:00-03:00")).toISOString();
}
function exportRows(rows: Row[]) {
  const headers = ["Data", "Tipo", "Descrição", "Valor", "Saldo após", "Usuário", "Status"];
  const safe = (value: string) => '"' + (/^[=+\-@]/.test(value) ? "'" : "") + value.replace(/"/g, '""') + '"';
  const fields = rows.map(r => [
    dateTimeBr(r.date), typeText[r.type], r.description, (isIncoming(r) ? 1 : -1) * r.amount,
    r.balanceAfter ?? "", r.userName ?? "", r.reversed ? "Estornado" : "Confirmado",
  ]);
  const csv = "\ufeff" + [headers, ...fields].map(line => line.map(v => safe(String(v))).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "movimentacoes-caixa.csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
function Summary({ title, value, detail, icon: Icon, tone }: { title: string; value: string; detail: string; icon: typeof Wallet; tone: "blue" | "green" | "red" }) {
  return <Card className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-full " + (tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "red" ? "bg-rose-50 text-rose-500" : "bg-blue-50 text-blue-600")}>
      <Icon className="h-6 w-6" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-slate-500">{title}</p>
      <p className={"mt-0.5 break-words text-[clamp(1rem,1.7vw,1.3rem)] font-extrabold tabular-nums " + (tone === "green" ? "text-emerald-700" : tone === "red" ? "text-slate-900" : "text-[#0645a9]")}>{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </div>
  </Card>;
}
export default function CashPage() {
  const client = useQueryClient();
  const { toast } = useToast();
  const { can } = useAuth();
  const mayWrite = can("finance:write");
  const [open, setOpen] = useState<Category | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [tab, setTab] = useState<"movements" | "summary">("movements");
  const [type, setType] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const overview = useQuery({
    queryKey: ["finance", "overview"],
    queryFn: async () => (await api.get("/api/v1/finance/overview")).data.data as Finance,
    refetchInterval: 60_000,
  });
  const status = useQuery({
    queryKey: ["dashboards", "loan-status"],
    queryFn: async () => (await api.get("/api/v1/dashboards/loan-status")).data.data as { activePrincipal: number },
  });
  const entries = useQuery({
    queryKey: ["finance", "entries", "cash", type, from, to, page],
    enabled: overview.data?.initialized === true,
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), pageSize: "15" });
      if (type !== "ALL") p.set("type", type);
      if (from) p.set("from", toIso(from, false));
      if (to) p.set("to", toIso(to, true));
      return (await api.get("/api/v1/finance/entries?" + p)).data.data as PageResult;
    },
    refetchInterval: 60_000,
  });
  const register = useMutation({
    mutationFn: async () => {
      const money = parseMoney(amount);
      if (!money || !open || description.trim().length < 3) throw new Error("Informe valor e descrição com pelo menos três caracteres.");
      return api.post("/api/v1/finance/entries", {
        type: open, amount: money, description: description.trim(),
      });
    },
    onSuccess: () => {
      toast({ title: "Movimentação registrada no caixa" });
      client.invalidateQueries({ queryKey: ["finance"] });
      client.invalidateQueries({ queryKey: ["dashboards"] });
      setOpen(null); setDescription(""); setAmount(""); setPage(1);
    },
    onError: (err: unknown) => toast({ title: "Não foi possível registrar", description: getApiErrorMessage(err, "Verifique o saldo e os dados."), variant: "destructive" }),
  });
  const reverse = useMutation({
    mutationFn: (values: { id: string; justification: string }) => api.post("/api/v1/finance/entries/" + values.id + "/reverse", { justification: values.justification }),
    onSuccess: () => { toast({ title: "Movimentação estornada" }); client.invalidateQueries({ queryKey: ["finance"] }); client.invalidateQueries({ queryKey: ["dashboards"] }); },
    onError: (err: unknown) => toast({ title: "Estorno não concluído", description: getApiErrorMessage(err, "Não foi possível estornar."), variant: "destructive" }),
  });
  function begin(type: Category) { setDescription(""); setAmount(""); setOpen(type); }
  function onReverse(row: Row) {
    const justification = window.prompt("Motivo do estorno (mínimo 10 caracteres):");
    if (!justification || justification.trim().length < 10) return;
    if (window.confirm("Confirmar estorno de " + brl(row.amount) + "? O histórico será preservado.")) {
      reverse.mutate({ id: row.id, justification: justification.trim() });
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (open !== "CONTRIBUTION" && !window.confirm("Confirma a saída de " + brl(parseMoney(amount) ?? 0) + " do caixa?")) return;
    register.mutate();
  }
  if (overview.isError) return <Card className="space-y-3 p-5">
    <h1 className="text-xl font-bold">Caixa</h1><p className="text-sm text-red-600">{getApiErrorMessage(overview.error, "Não foi possível consultar seu caixa.")}</p>
    <Button onClick={() => overview.refetch()}><RefreshCw className="h-4 w-4"/> Tentar novamente</Button>
  </Card>;
  if (!overview.data?.initialized) return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold text-slate-950">Caixa</h1><p className="text-sm text-slate-500">Gerencie o capital disponível para empréstimos.</p></div>
    <Card className="p-6"><p className="mb-4 text-sm text-slate-600">O caixa ainda não foi inicializado. Informe o saldo real de abertura no Financeiro para começar.</p>
      <Link to="/finance" className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Configurar caixa</Link>
    </Card>
  </div>;
  const info = overview.data;
  const list = entries.data?.items ?? [];
  return <div className="space-y-5 pb-7">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h1 className="text-[27px] font-extrabold tracking-tight text-[#111e33]">Caixa</h1>
        <p className="mt-1 text-xs text-slate-500">Gerencie o capital disponível para empréstimos</p>
      </div>
      {mayWrite && <div className="flex flex-wrap gap-2">
        <button onClick={() => begin("CONTRIBUTION")} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0db66b] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#069b5b] sm:flex-none">
          <Plus className="h-4 w-4"/>Adicionar dinheiro
        </button>
        <button onClick={() => begin("WITHDRAWAL")} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff4c4c] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#ed3838] sm:flex-none">
          <ArrowUpRight className="h-4 w-4"/>Retirar dinheiro
        </button>
      </div>}
    </div>
    <section aria-label="Resumo do caixa" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary title="Saldo atual do caixa" value={brl(info.availableBalance ?? 0)} detail="Disponível para novos empréstimos" icon={Wallet} tone="blue"/>
      <Summary title="Total aportado" value={brl(info.contributions ?? 0)} detail="Soma das adições após abertura" icon={ArrowDownLeft as typeof Wallet} tone="green"/>
      <Summary title="Total retirado" value={brl(info.withdrawals ?? 0)} detail="Saídas classificadas como retiradas" icon={ArrowUpRight as typeof Wallet} tone="red"/>
      <Summary title="Capital emprestado" value={brl(status.data?.activePrincipal ?? 0)} detail="Principal em empréstimos ativos" icon={Landmark} tone="blue"/>
    </section>

    <Card className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => setTab("movements")} className={"border-b-2 px-1 pb-2 text-xs font-semibold " + (tab === "movements" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500")}>Movimentações</button>
          <button onClick={() => setTab("summary")} className={"border-b-2 px-1 pb-2 text-xs font-semibold " + (tab === "summary" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500")}>Resumo</button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={type} onValueChange={v => { setType(v); setPage(1); }} aria-label="Tipo de movimentação" className="col-span-2 h-9 w-full text-xs sm:w-[160px]">
            <option value="ALL">Todos os tipos</option>
            <option value="CONTRIBUTION">Adição</option>
            <option value="WITHDRAWAL">Retirada</option>
            <option value="EXPENSE">Despesa</option>
            <option value="DISBURSEMENT">Desembolso</option>
            <option value="PAYMENT">Pagamento</option>
          </Select>
          <Input type="date" aria-label="Data inicial" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="h-9 w-full text-xs sm:w-[145px]" />
          <Input type="date" aria-label="Data final" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPage(1); }} className="h-9 w-full text-xs sm:w-[145px]" />
          <button onClick={() => exportRows(list)} disabled={!list.length} className="col-span-2 flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:col-span-1">
            <Download className="h-4 w-4"/> Exportar página
          </button>
        </div>
      </div>
      {tab === "summary" ? <div className="grid gap-3 py-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Saldo de abertura", info.openingBalance ?? 0],
          ["Pagamentos recebidos", info.received ?? 0],
          ["Despesas operacionais", info.expenses ?? 0],
          ["Desembolsos", info.disbursements ?? 0],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><strong className="mt-2 block text-lg text-slate-900">{brl(Number(value))}</strong></div>)}
        <p className="text-xs text-slate-500 sm:col-span-2 xl:col-span-4">Saldos e totais contabilizados desde a abertura em {dateTimeBr(info.startedAt)}. Não representam lucro contábil.</p>
      </div> : entries.isError ? <div className="p-5 text-sm text-red-600">{getApiErrorMessage(entries.error, "Erro ao carregar movimentos.")} <button className="underline" onClick={() => entries.refetch()}>Tentar novamente</button></div>
        : entries.isPending ? <div className="p-5 text-sm text-slate-500">Carregando movimentações...</div>
        : list.length === 0 ? <div className="p-6 text-center text-sm text-slate-500">Nenhuma movimentação encontrada.</div> :
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead><tr className="bg-[#f3f6fa] text-[11px] font-semibold text-[#3c4656]">
                {["Data", "Tipo", "Descrição", "Valor", "Saldo após", "Usuário", "Ações"].map(v => <th key={v} className="px-3 py-3">{v}</th>)}
              </tr></thead>
              <tbody>{list.map(row => <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">{dateTimeBr(row.date)}</td>
                <td className={"px-3 py-3 font-semibold " + (row.reversed ? "text-slate-400" : isIncoming(row) ? "text-emerald-600" : "text-red-500")}>{typeText[row.type]}{row.reversed ? " (estorno)" : ""}</td>
                <td className="max-w-[240px] break-words px-3 py-3 text-slate-700">{row.description}</td>
                <td className={"whitespace-nowrap px-3 py-3 font-semibold tabular-nums " + (row.reversed ? "text-slate-400 line-through" : isIncoming(row) ? "text-emerald-600" : "text-red-500")}>{isIncoming(row) ? "+ " : "− "}{brl(row.amount)}</td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-700">{row.balanceAfter === undefined ? "—" : brl(row.balanceAfter)}</td>
                <td className="px-3 py-3 text-slate-600">{row.userName ?? "—"}</td>
                <td className="px-3 py-3">{mayWrite && !row.reversed && row.type !== "PAYMENT" ? <button onClick={() => onReverse(row)} disabled={reverse.isPending} className="text-xs font-semibold text-blue-600 hover:underline">Estornar</button> : "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {list.map(row => <div key={row.id} className="space-y-1 p-3">
              <div className="flex items-center justify-between gap-2"><span className={"text-xs font-semibold " + (isIncoming(row) ? "text-emerald-600" : "text-red-500")}>{typeText[row.type]}{row.reversed ? " · Estornado" : ""}</span>
                <strong className={"shrink-0 text-sm tabular-nums " + (isIncoming(row) ? "text-emerald-600" : "text-red-500")}>{isIncoming(row) ? "+ " : "− "}{brl(row.amount)}</strong></div>
              <p className="break-words text-xs text-slate-700">{row.description}</p>
              <p className="text-[11px] text-slate-500">{dateTimeBr(row.date)} · {row.userName ?? "Sistema"}</p>
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500"><span>Saldo após: {row.balanceAfter === undefined ? "—" : brl(row.balanceAfter)}</span>
                {mayWrite && !row.reversed && row.type !== "PAYMENT" && <button className="font-semibold text-blue-600" disabled={reverse.isPending} onClick={() => onReverse(row)}>Estornar</button>}</div>
            </div>)}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">{entries.data?.meta.total ?? 0} movimentações · página {page}</span>
            <Pagination page={page} totalPages={entries.data?.meta.totalPages ?? 1} onPageChange={setPage}/>
          </div>
        </>}
    </Card>

    <Dialog size="sm" open={open !== null} onOpenChange={flag => { if (!flag && !register.isPending) setOpen(null); }}>
      <DialogHeader><DialogTitle>{open === "CONTRIBUTION" ? "Adicionar dinheiro ao caixa" : open === "WITHDRAWAL" ? "Retirar dinheiro do caixa" : "Registrar despesa"}</DialogTitle>
        <DialogDescription>O lançamento será registrado no histórico do caixa.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="space-y-2"><Label htmlFor="cashAmount">Valor *</Label>
          <Input id="cashAmount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="R$ 0,00" required autoFocus /></div>
        <div className="space-y-2"><Label htmlFor="cashDescription">{open === "WITHDRAWAL" ? "Motivo da retirada *" : "Descrição *"}</Label>
          <Input id="cashDescription" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: aporte do sócio, transferência..." minLength={3} maxLength={500} required /></div>
        <div className="space-y-2"><Label htmlFor="cashDate">Data do registro</Label>
          <Input id="cashDate" value={dateTimeBr(new Date())} readOnly className="bg-slate-50 text-slate-500" />
          <p className="text-[11px] text-slate-500">Registrada automaticamente no horário do servidor.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(null)} disabled={register.isPending}>Cancelar</Button>
          <Button type="submit" disabled={register.isPending || !parseMoney(amount) || description.trim().length < 3}
            className={open === "CONTRIBUTION" ? "bg-[#0bad63] hover:bg-[#079652]" : "bg-[#ef4545] hover:bg-[#d93636]"}>
            {register.isPending ? "Registrando..." : open === "CONTRIBUTION" ? "Adicionar" : "Confirmar retirada"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  </div>;
}
