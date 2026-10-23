"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { SimpleTable } from "@/components/SimpleTable";
import { Pagination } from "@/components/Pagination";
import { exportToCsv } from "@/lib/csv";
import { QUERY_KEYS } from "@/lib/query-keys";
import { brl, dateBr, dateTimeBr, toDateTimeInputValue } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import { installmentStatusLabel, paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";
import type { Installment } from "@/types/api";

function emptyForm() {
  return {
    loanId: "",
    receivedAt: toDateTimeInputValue(),
    method: "PIX",
    reference: "",
    observations: "",
  };
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.payments.list, debouncedSearch, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await api.get(`/api/v1/payments?${params.toString()}`);
      return res.data.data as { items: any[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
    },
  });

  const payments = data?.items ?? [];
  const meta = data?.meta;

  const { data: activeLoans } = useQuery({
    queryKey: QUERY_KEYS.loans.active,
    queryFn: async () => {
      const res = await api.get("/api/v1/loans?page=1&pageSize=100&status=ACTIVE");
      return res.data.data.items as any[];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [selectedInstallments, setSelectedInstallments] = useState<Set<string>>(new Set());

  const { data: installments, isLoading: loadingInstallments } = useQuery({
    queryKey: QUERY_KEYS.installments.byLoan(form.loanId),
    enabled: !!form.loanId,
    queryFn: async () => {
      const res = await api.get(`/api/v1/installments?loanId=${form.loanId}&page=1&pageSize=100`);
      return res.data.data.items as Installment[];
    },
  });

  useEffect(() => {
    setSelectedInstallments(new Set());
  }, [form.loanId]);

  const openInstallments = (installments ?? []).filter(
    (i) => i.status !== "PAID" && i.status !== "CANCELED" && Number(i.remainingBalance) > 0.005,
  );

  const totalOpen = openInstallments.reduce((sum, i) => sum + Number(i.remainingBalance), 0);

  const selectedLoan = (activeLoans ?? []).find((l) => l.id === form.loanId);

  // Total a pagar = soma dos saldos + encargos de atraso das parcelas selecionadas
  const totalToPay = openInstallments.reduce((sum, i) => {
    if (!selectedInstallments.has(i.id)) return sum;
    const lateCharges = i.lateCharges?.totalLateCharges ?? 0;
    return sum + Number(i.remainingBalance) + lateCharges;
  }, 0);

  function toggleInstallment(installmentId: string) {
    setSelectedInstallments((prev) => {
      const next = new Set(prev);
      if (next.has(installmentId)) {
        next.delete(installmentId);
      } else {
        next.add(installmentId);
      }
      return next;
    });
  }

  function installmentTotal(inst: Installment): number {
    return Number(inst.remainingBalance) + (inst.lateCharges?.totalLateCharges ?? 0);
  }

  function buildAllocations() {
    const result: {
      installmentId: string;
      principalAmount: number;
      interestAmount: number;
      chargesAmount: number;
    }[] = [];

    for (const inst of openInstallments) {
      if (!selectedInstallments.has(inst.id)) continue;

      const remainingCents = Math.round(Number(inst.remainingBalance) * 100);
      const lateChargesCents = Math.round((inst.lateCharges?.totalLateCharges ?? 0) * 100);
      const interestCents = Math.min(remainingCents, Math.round(Number(inst.interestDue) * 100));
      const principalCents = remainingCents - interestCents;
      const chargesCents = lateChargesCents;

      result.push({
        installmentId: inst.id,
        principalAmount: principalCents / 100,
        interestAmount: interestCents / 100,
        chargesAmount: chargesCents / 100,
      });
    }

    return result;
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.loanId || !selectedLoan) throw new Error("Selecione um empréstimo ativo");
      if (openInstallments.length === 0) {
        throw new Error("Este empréstimo não possui parcelas em aberto");
      }
      if (selectedInstallments.size === 0) {
        throw new Error("Selecione ao menos uma parcela para pagar");
      }

      const allocations = buildAllocations();
      const totalAmount = totalToPay;

      return api.post("/api/v1/payments", {
        clientId: selectedLoan.clientId,
        loanId: form.loanId,
        receivedAmount: totalAmount,
        receivedAt: new Date(form.receivedAt).toISOString(),
        method: form.method,
        reference: form.reference || undefined,
        observations: form.observations || undefined,
        allocations,
      });
    },
    onSuccess: () => {
      const loanId = form.loanId;
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.payments.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.installments.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loans.root });
      if (loanId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loans.detail(loanId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboards.root });
      setOpen(false);
      setForm(emptyForm());
      setSelectedInstallments(new Set());
      toast({ title: "Pagamento lançado" });
    },
    onError: (err: unknown) =>
      toast({
        title: "Erro",
        description: getApiErrorMessage(err, "Não foi possível lançar o pagamento"),
        variant: "destructive",
      }),
  });

  const columns = [
    { key: "clientName", label: "Cliente" },
    {
      key: "loanCode",
      label: "Empréstimo",
      render: (v: any) => <span className="font-mono text-xs">{v ?? "—"}</span>,
    },
    {
      key: "allocations",
      label: "Parcelas",
      render: (v: any) =>
        Array.isArray(v) && v.length > 0 ? v.map((a) => `#${a.installmentNumber}`).join(", ") : "—",
    },
    { key: "receivedAmount", label: "Valor recebido", render: (v: any) => brl(Number(v)) },
    { key: "method", label: "Método", render: (v: any) => paymentMethodLabel(v) },
    { key: "receivedAt", label: "Recebido em", render: (v: any) => dateTimeBr(v) },
    { key: "userName", label: "Usuário" },
    { key: "status", label: "Status", render: (v: any) => paymentStatusLabel(v) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Recebimentos</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => setOpen(true)}>Lançar pagamento</Button>
          <Button
            variant="outline"
            onClick={() =>
              exportToCsv({
                filename: "recebimentos",
                data: isLoading ? [] : payments,
                columns,
              })
            }
          >
            Exportar CSV
          </Button>
        </div>
      </div>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Pesquisar por cliente, empréstimo, referência..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Pagamentos lançados</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable columns={columns} data={isLoading ? [] : payments} />
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>
            <Pagination page={page} totalPages={meta?.totalPages ?? 1} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar pagamento</DialogTitle>
          </DialogHeader>
          <Separator />
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Empréstimo ativo</Label>
              <Select required value={form.loanId} onValueChange={(loanId) => setForm({ ...form, loanId })}>
                <option value="">Selecione um empréstimo</option>
                {(activeLoans ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.clientName} — R$ {Number(l.principalAmount).toFixed(2)} ({l.installmentCount} parcelas)
                  </option>
                ))}
              </Select>
            </div>

            {form.loanId ? (
              <div className="md:col-span-2 rounded-md border border-border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between font-medium">
                  <span>Saldo em aberto</span>
                  <span>R$ {totalOpen.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Total selecionado</span>
                  <span className={totalToPay > 0 ? "text-primary font-medium" : "text-muted-foreground"}>
                    R$ {totalToPay.toFixed(2)}
                  </span>
                </div>
                {loadingInstallments ? (
                  <p className="text-xs text-muted-foreground">Carregando parcelas...</p>
                ) : openInstallments.length === 0 ? (
                  <p className="text-xs text-destructive">Nenhuma parcela em aberto neste empréstimo.</p>
                ) : (
                  <div className="max-h-40 overflow-auto border rounded-md p-2 text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground">
                          <th className="p-2 w-10 text-center">Pagar</th>
                          <th className="p-2">Parcela</th>
                          <th className="p-2 text-right">Vencimento</th>
                          <th className="p-2 text-right">Saldo</th>
                          <th className="p-2 text-right">Encargos</th>
                          <th className="p-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openInstallments.map((i) => {
                          const isSelected = selectedInstallments.has(i.id);
                          const lateCharges = i.lateCharges?.totalLateCharges ?? 0;
                          const total = installmentTotal(i);
                          return (
                            <tr
                              key={i.id}
                              className={`border-b border-border hover:bg-accent/50 cursor-pointer ${
                                isSelected ? "bg-primary/5" : ""
                              }`}
                              onClick={() => toggleInstallment(i.id)}
                            >
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleInstallment(i.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-2">
                                Parcela {i.number} (
                                {installmentStatusLabel(i.effectiveStatus ?? i.status)})
                              </td>
                              <td className="p-2 text-right">{dateBr(i.dueDate)}</td>
                              <td className="p-2 text-right">{brl(Number(i.remainingBalance))}</td>
                              <td className="p-2 text-right">
                                {lateCharges > 0 ? (
                                  <span className="text-destructive">{brl(lateCharges)}</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-2 text-right font-medium">{brl(total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Data do recebimento</Label>
              <Input required type="datetime-local" value={form.receivedAt} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={form.method} onValueChange={(method) => setForm({ ...form, method })}>
                <option value="PIX">PIX</option>
                <option value="CASH">Dinheiro</option>
                <option value="TRANSFER">Transferência</option>
                <option value="CHECK">Cheque</option>
                <option value="OTHER">Outro</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referência</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
            </div>

            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || selectedInstallments.size === 0}>
                {createMutation.isPending ? "Salvando..." : `Lançar pagamento (R$ ${totalToPay.toFixed(2)})`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}