import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { useToast } from "@/hooks/use-toast";
import { brl, dateTimeBr } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, Landmark, Plus, RefreshCw, Undo2, Minus, ReceiptText, Wallet, ArrowRight } from "lucide-react";

type FinanceOverview = {
  initialized: boolean;
  startedAt?: string;
  openingBalance?: number;
  availableBalance?: number;
  received?: number;
  principalRecovered?: number;
  interestReceived?: number;
  chargesReceived?: number;
  contributions?: number;
  withdrawals?: number;
  expenses?: number;
  disbursements?: number;
  operationalCashResult?: number;
  note?: string;
};
type FinanceEntryType = "CONTRIBUTION" | "WITHDRAWAL" | "EXPENSE" | "DISBURSEMENT";
type FinanceMovement = {
  id: string; type: FinanceEntryType | "PAYMENT"; amount: number; date: string;
  description: string; loanId: string | null; reversed: boolean; source: "MANUAL" | "PAYMENT";
};
type FinancePageResult = {
  items: FinanceMovement[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};
type EligibleLoan = { id: string; code: string; clientName: string; principalAmount: number };
const labels: Record<FinanceMovement["type"], string> = {
  CONTRIBUTION: "Aporte", WITHDRAWAL: "Retirada", EXPENSE: "Despesa",
  DISBURSEMENT: "Desembolso", PAYMENT: "Recebimento",
};
const cashPositive = (type: FinanceMovement["type"]) => type === "CONTRIBUTION" || type === "PAYMENT";
function moneyValue(s: string): number | null {
  const normalized = s.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 && value <= 999999999999.99 ? value : null;
}
function toIsoDayStart(date: string) { return new Date(date + "T00:00:00-03:00").toISOString(); }
function toIsoDayEnd(date: string) { return new Date(date + "T23:59:59.999-03:00").toISOString(); }

export default function FinancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: currentUser } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await api.get("/api/v1/auth/me")).data.data.user as { role: string },
    staleTime: 60_000,
    retry: false,
  });
  const mayWrite = ["ADMIN", "MANAGER"].includes(currentUser?.role ?? "");
  const [opening, setOpening] = useState("");
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [openingConfirmed, setOpeningConfirmed] = useState(false);
  const [kind, setKind] = useState<FinanceEntryType>("CONTRIBUTION");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loanId, setLoanId] = useState("");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function openMovement(type: FinanceEntryType) {
    setKind(type);
    setAmount("");
    setDescription("");
    setLoanId("");
    setShowEntryForm(true);
  }

  useEffect(() => {
    if (!mayWrite) return;
    const action = searchParams.get("action")?.toUpperCase();
    if (!action || !["CONTRIBUTION", "WITHDRAWAL", "EXPENSE", "DISBURSEMENT"].includes(action)) return;
    openMovement(action as FinanceEntryType);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete("action");
      return next;
    }, { replace: true });
  }, [mayWrite, searchParams, setSearchParams]);

  useEffect(() => {
    if (showEntryForm) document.getElementById("cash-movement-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showEntryForm, kind]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["finance"] });
  const onError = (error: unknown) => toast({ title: "Operação não concluída", description: getApiErrorMessage(error, "Verifique os dados informados."), variant: "destructive" });

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["finance", "overview"],
    queryFn: async () => (await api.get("/api/v1/finance/overview")).data.data as FinanceOverview,
    refetchInterval: 60_000,
  });
  const { data: eligibleLoans } = useQuery({
    queryKey: ["finance", "eligible-loans"],
    enabled: data?.initialized === true && mayWrite,
    queryFn: async () => (await api.get("/api/v1/finance/eligible-loans")).data.data as EligibleLoan[],
  });
  const { data: movements, isPending: loadingMovements } = useQuery({
    queryKey: ["finance", "entries", page, from, to],
    enabled: data?.initialized === true,
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), pageSize: "15" });
      if (from) p.set("from", toIsoDayStart(from));
      if (to) p.set("to", toIsoDayEnd(to));
      return (await api.get("/api/v1/finance/entries?" + p.toString())).data.data as FinancePageResult;
    },
  });

  const selectedLoan = useMemo(() => (eligibleLoans ?? []).find(l => l.id === loanId), [eligibleLoans, loanId]);
  const mutationSetup = useMutation({
    mutationFn: async () => {
      const balance = moneyValue(opening);
      if (balance === null) throw new Error("Informe o saldo inicial com até duas casas decimais.");
      return api.post("/api/v1/finance/setup", { openingBalance: balance });
    },
    onSuccess: () => { toast({ title: "Caixa inicializado" }); refresh(); },
    onError,
  });
  const mutationEntry = useMutation({
    mutationFn: async () => {
      const value = kind === "DISBURSEMENT" && selectedLoan ? selectedLoan.principalAmount : moneyValue(amount);
      if (value === null || value <= 0 || !description.trim()) throw new Error("Informe uma descrição e um valor positivo.");
      if (kind === "DISBURSEMENT" && !loanId) throw new Error("Escolha o empréstimo que recebeu o dinheiro.");
      return api.post("/api/v1/finance/entries", {
        type: kind, amount: value, description: description.trim(), ...(kind === "DISBURSEMENT" ? { loanId } : {}),
      });
    },
    onSuccess: () => {
      toast({ title: "Movimentação registrada" });
      setAmount(""); setDescription(""); setLoanId(""); setPage(1); setShowEntryForm(false); refresh();
    },
    onError,
  });
  const mutationReverse = useMutation({
    mutationFn: async (input: { id: string; reason: string }) =>
      api.post("/api/v1/finance/entries/" + input.id + "/reverse", { justification: input.reason }),
    onSuccess: () => { toast({ title: "Lançamento estornado" }); refresh(); },
    onError,
  });
  function reverseEntry(row: FinanceMovement) {
    if (row.source !== "MANUAL" || row.reversed) return;
    const reason = window.prompt("Motivo obrigatório do estorno (mínimo 10 caracteres):");
    if (!reason || reason.trim().length < 10) return;
    if (!window.confirm("Confirmar o estorno de " + brl(row.amount) + "? O histórico será preservado.")) return;
    mutationReverse.mutate({ id: row.id, reason: reason.trim() });
  }

  if (isPending) return <div className="p-6 text-sm text-muted-foreground">Carregando financeiro...</div>;
  if (isError) return <Card className="space-y-3 p-5">
    <h1 className="text-xl font-semibold">Financeiro</h1>
    <p className="text-sm text-destructive">{getApiErrorMessage(error, "Sem permissão ou serviço indisponível")}</p>
    <Button onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4"/> Tentar novamente</Button>
  </Card>;

  if (!data?.initialized && !mayWrite) {
    return <Card className="p-6 text-sm text-muted-foreground">O livro-caixa ainda não foi aberto. Somente administradores e gerentes podem registrar o saldo inicial.</Card>;
  }
  if (!data?.initialized) {
    return <div className="mx-auto max-w-2xl space-y-5">
      <div><h1 className="text-2xl font-semibold">Iniciar controle financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">Conciliação necessária para calcular o capital efetivamente disponível.</p>
      </div>
      <Card className="space-y-4 p-5">
        <div className="flex gap-3 rounded-lg bg-muted p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/>
          <div><strong>Abertura definitiva</strong>
            <p className="mt-1 text-muted-foreground">Confira o dinheiro disponível agora, considerando os empréstimos antigos já desembolsados. O sistema contabilizará automaticamente apenas os recebimentos registrados a partir da abertura. Não lançará desembolsos antigos novamente. O saldo inicial não poderá ser reconfigurado.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="opening">Saldo inicial conciliado (R$)</Label>
          <Input id="opening" inputMode="decimal" placeholder="Ex.: 15000,00" value={opening} onChange={e => setOpening(e.target.value)}/>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={openingConfirmed} onChange={e => setOpeningConfirmed(e.target.checked)}/>
          Confirmo que conferi o saldo inicial e compreendo que registros anteriores à abertura não serão somados.
        </label>
        <Button disabled={!openingConfirmed || mutationSetup.isPending || moneyValue(opening) === null} onClick={() => mutationSetup.mutate()}>
          {mutationSetup.isPending ? "Registrando..." : "Iniciar livro-caixa"}
        </Button>
      </Card>
    </div>;
  }

  const rows = movements?.items ?? [];
  const cashCards = [
    { name: "Recebimentos", value: data.received, detail: "Pagamentos confirmados desde a abertura", Icon: ArrowDownLeft },
    { name: "Desembolsos", value: data.disbursements, detail: "Principal efetivamente entregue aos clientes", Icon: ArrowUpRight },
    { name: "Resultado operacional de caixa", value: data.operationalCashResult, detail: "Juros e encargos recebidos menos despesas", Icon: Banknote },
  ];
  return <div className="space-y-6 pb-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[.15em] text-primary">Gestão de caixa</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">Saldo, entradas e saídas desde {dateTimeBr(data.startedAt ?? "")}.</p>
      </div>
      {mayWrite && <Button onClick={() => setShowEntryForm(current => !current)} variant={showEntryForm ? "outline" : "default"}>
        <Plus className="mr-1 h-4 w-4" /> {showEntryForm ? "Fechar lançamento" : "Nova movimentação"}
      </Button>}
    </header>
    <section aria-label="Saldo do caixa e ações" className="rounded-2xl bg-[#14243B] p-5 text-white shadow-sm sm:p-7">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Wallet className="h-5 w-5 text-amber-300" aria-hidden /> Dinheiro disponível no caixa
      </div>
      <p className="mt-3 break-words text-[clamp(2rem,7vw,3.5rem)] font-bold leading-tight tracking-tight tabular-nums">
        {brl(data.availableBalance ?? 0)}
      </p>
      <p className="mt-2 max-w-xl text-sm text-slate-300">
        Saldo registrado para novos empréstimos. Considere os compromissos futuros e confirme os valores com o caixa real.
      </p>
      {mayWrite && <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={() => openMovement("CONTRIBUTION")}
          className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
          <Plus className="h-4 w-4 shrink-0" aria-hidden /> Adicionar dinheiro
        </button>
        <Button onClick={() => openMovement("WITHDRAWAL")} variant="outline" className="min-w-0 border-white/30 bg-white/10 px-3 text-white hover:bg-white/20">
          <Minus className="h-4 w-4" aria-hidden /> Retirar dinheiro
        </Button>
        <Button onClick={() => openMovement("EXPENSE")} variant="outline" className="col-span-2 min-w-0 border-white/30 bg-white/10 px-3 text-white hover:bg-white/20">
          <ReceiptText className="h-4 w-4" aria-hidden /> Registrar despesa
        </Button>
      </div>}
    </section>
    <section aria-label="Indicadores financeiros" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cashCards.map(({ name, value, detail, Icon }) => <Card key={name} className="min-w-0 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{name}</p>
          <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        </div>
        <p className={"mt-3 break-words text-xl font-semibold tabular-nums sm:text-2xl " + ((value ?? 0) < 0 ? "text-destructive" : "")}>{brl(value ?? 0)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </Card>)}
    </section>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[
        ["Aportes", data.contributions],
        ["Retiradas", data.withdrawals],
        ["Despesas", data.expenses],
        ["Principal recuperado", data.principalRecovered],
      ].map(([label, value]) => <Card key={String(label)} className="min-w-0 p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 break-words text-base font-semibold tabular-nums">{brl(Number(value ?? 0))}</p>
      </Card>)}
    </div>

    {mayWrite && showEntryForm && <Card id="cash-movement-form" className="scroll-mt-4 space-y-4 p-5">
      <div><h2 className="text-lg font-semibold">Registrar movimentação</h2>
        <p className="mt-1 text-xs text-muted-foreground">Pagamentos dos clientes entram automaticamente pelo módulo <Link to="/payments" className="font-semibold text-primary underline-offset-2 hover:underline">Recebimentos <ArrowRight className="inline h-3 w-3" /></Link>. Não os registre novamente como aporte.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo de movimentação</Label>
          <Select value={kind} onValueChange={v => { setKind(v as FinanceEntryType); setLoanId(""); setAmount(""); }}>
            <option value="CONTRIBUTION">Aporte de capital</option>
            <option value="WITHDRAWAL">Retirada de sócio</option>
            <option value="EXPENSE">Despesa operacional</option>
            <option value="DISBURSEMENT">Desembolso de empréstimo</option>
          </Select>
        </div>
        {kind === "DISBURSEMENT" ? <div className="space-y-2">
          <Label>Empréstimo apto ao desembolso</Label>
          <Select value={loanId} onValueChange={setLoanId}>
            <option value="">Selecione o contrato...</option>
            {(eligibleLoans ?? []).map(loan => <option key={loan.id} value={loan.id}>{loan.code} · {loan.clientName} · {brl(loan.principalAmount)}</option>)}
          </Select>
          <p className="text-xs text-muted-foreground">Somente contratos criados após a abertura, ativos, sem pagamentos e sem desembolso anterior.</p>
        </div> : <div className="space-y-2">
          <Label htmlFor="financeAmount">Valor (R$)</Label>
          <Input id="financeAmount" inputMode="decimal" placeholder="Ex.: 250,00" value={amount} onChange={e => setAmount(e.target.value)}/>
        </div>}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="financeDescription">Descrição ou justificativa</Label>
          <Input id="financeDescription" maxLength={500} placeholder="Ex.: tarifa bancária, aporte do sócio, transferência ao cliente..." value={description} onChange={e => setDescription(e.target.value)}/>
        </div>
      </div>
      <Button disabled={mutationEntry.isPending || !description.trim() || (kind === "DISBURSEMENT" ? !selectedLoan : !(moneyValue(amount) && moneyValue(amount)! > 0))}
        onClick={() => {
          const total = kind === "DISBURSEMENT" ? selectedLoan?.principalAmount : moneyValue(amount);
          if (kind !== "CONTRIBUTION" && total && !window.confirm("Confirma a saída de " + brl(total) + " do caixa?")) return;
          mutationEntry.mutate();
        }}>
        <Plus className="mr-2 h-4 w-4"/>{mutationEntry.isPending ? "Registrando..." : kind === "CONTRIBUTION" ? "Adicionar ao caixa" : kind === "WITHDRAWAL" ? "Confirmar retirada" : kind === "EXPENSE" ? "Registrar despesa" : "Registrar desembolso"}
      </Button>
    </Card>}

    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Extrato do caixa</h2>
          <p className="text-xs text-muted-foreground">Pagamentos e movimentações com histórico de estornos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="A partir de" type="date" className="w-36" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}/>
          <Input aria-label="Até" type="date" className="w-36" min={from || undefined} value={to} onChange={e => { setTo(e.target.value); setPage(1); }}/>
        </div>
      </div>
      {loadingMovements ? <p className="text-sm text-muted-foreground">Carregando movimentações...</p> :
      rows.length === 0 ? <p className="py-5 text-sm text-muted-foreground">Nenhuma movimentação encontrada.</p> :
      <div className="divide-y divide-border">
        {rows.map(row => <div key={row.source + row.id} className="flex items-center gap-3 py-3">
          <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted " + (cashPositive(row.type) ? "text-emerald-600" : "text-destructive")}>
            {cashPositive(row.type) ? <ArrowDownLeft className="h-4 w-4"/> : <ArrowUpRight className="h-4 w-4"/>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{labels[row.type]}{row.reversed ? " · Estornado" : ""}</p>
            <p className="truncate text-xs text-muted-foreground" title={row.description}>{row.description}</p>
            <p className="text-xs text-muted-foreground">{dateTimeBr(row.date)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={"text-sm font-semibold tabular-nums " + (row.reversed ? "text-muted-foreground line-through" : cashPositive(row.type) ? "text-emerald-600" : "text-destructive")}>
              {cashPositive(row.type) ? "+" : "−"}{brl(row.amount)}
            </p>
            {mayWrite && row.source === "MANUAL" && !row.reversed &&
              <Button size="sm" variant="ghost" className="mt-1 h-8 px-2 text-xs" disabled={mutationReverse.isPending} onClick={() => reverseEntry(row)}><Undo2 className="mr-1 h-3 w-3"/> Estornar</Button>}
          </div>
        </div>)}
      </div>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{movements?.meta.total ?? 0} movimentações · página {page}</p>
        <Pagination page={page} totalPages={movements?.meta.totalPages ?? 1} onPageChange={setPage}/>
      </div>
    </Card>
    <p className="text-xs text-muted-foreground">O resultado operacional é uma medida de caixa e não representa lucro líquido contábil. Perdas de crédito, impostos não registrados e despesas fora do sistema não são estimados.</p>
  </div>;
}
