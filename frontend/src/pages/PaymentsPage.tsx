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
import { exportToCsv } from "@/lib/csv";
import type { Installment } from "@/types/api";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  TRANSFER: "Transferência",
  CHECK: "Cheque",
  OTHER: "Outro",
};

function nowLocalInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm() {
  return { loanId: "", receivedAmount: "", receivedAt: nowLocalInput(), method: "PIX", reference: "", observations: "" };
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const res = await api.get("/api/v1/payments?page=1&pageSize=50");
      return res.data.data.items;
    },
  });

  const { data: activeLoans } = useQuery({
    queryKey: ["loans", "active"],
    queryFn: async () => {
      const res = await api.get("/api/v1/loans?page=1&pageSize=100&status=ACTIVE");
      return res.data.data.items as any[];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const { data: installments, isLoading: loadingInstallments } = useQuery({
    queryKey: ["installments", "loan", form.loanId],
    enabled: !!form.loanId,
    queryFn: async () => {
      const res = await api.get(`/api/v1/installments?loanId=${form.loanId}&page=1&pageSize=100`);
      return res.data.data.items as Installment[];
    },
  });

  useEffect(() => {
    setAllocations({});
    setForm((prev) => ({ ...prev, receivedAmount: "" }));
  }, [form.loanId]);

  const openInstallments = (installments ?? []).filter(
    (i) => i.status !== "PAID" && i.status !== "CANCELED" && Number(i.remainingBalance) > 0.005,
  );
  const totalOpen = openInstallments.reduce((sum, i) => sum + Number(i.remainingBalance), 0);

  const selectedLoan = (activeLoans ?? []).find((l) => l.id === form.loanId);

  const totalAllocated = openInstallments.reduce((sum, i) => sum + Number(allocations[i.id] ?? 0), 0);

  function setAllocation(installmentId: string, value: string) {
    const amount = value === "" ? 0 : Math.max(0, Number(value) || 0);
    const inst = openInstallments.find((i) => i.id === installmentId);
    if (inst && amount > Number(inst.remainingBalance) + 0.005) return;
    setAllocations((prev) => ({ ...prev, [installmentId]: amount }));
  }

  function buildManualAllocations() {
    const result: {
      installmentId: string;
      principalAmount: number;
      interestAmount: number;
      chargesAmount: number;
    }[] = [];

    for (const inst of openInstallments) {
      const allocatedCents = Math.round(Number(allocations[inst.id] ?? 0) * 100);
      if (allocatedCents <= 0) continue;

      const remainingCents = Math.round(Number(inst.remainingBalance) * 100);
      if (allocatedCents > remainingCents) continue;

      const totalDueCents = Math.round(Number(inst.totalDue) * 100) || allocatedCents;
      const chargesDueCents = Math.round(Number(inst.chargesDue) * 100);
      const interestDueCents = Math.round(Number(inst.interestDue) * 100);

      let charges = Math.min(allocatedCents, Math.round((chargesDueCents / totalDueCents) * allocatedCents));
      let interest = Math.min(
        allocatedCents - charges,
        Math.round((interestDueCents / totalDueCents) * allocatedCents),
      );
      const principal = allocatedCents - charges - interest;

      result.push({
        installmentId: inst.id,
        principalAmount: principal / 100,
        interestAmount: interest / 100,
        chargesAmount: charges / 100,
      });
    }

    return result;
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.loanId || !selectedLoan) throw new Error("Selecione um empréstimo ativo");
      const amount = Number(form.receivedAmount);
      if (!(amount > 0)) throw new Error("Informe um valor recebido maior que zero");

      if (openInstallments.length === 0) {
        throw new Error("Este empréstimo não possui parcelas em aberto");
      }
      if (Math.round(totalAllocated * 100) <= 0) {
        throw new Error("Selecione ao menos uma parcela e informe o valor a ser alocado");
      }
      if (Math.round(totalAllocated * 100) !== Math.round(amount * 100)) {
        throw new Error(
          `O total alocado nas parcelas (R$ ${totalAllocated.toFixed(2)}) deve ser igual ao valor recebido (R$ ${amount.toFixed(2)})`,
        );
      }
      if (Math.round(totalAllocated * 100) > Math.round(totalOpen * 100)) {
        throw new Error(`O valor excede o saldo em aberto de R$ ${totalOpen.toFixed(2)}`);
      }

      return api.post("/api/v1/payments", {
        clientId: selectedLoan.clientId,
        loanId: form.loanId,
        receivedAmount: amount,
        receivedAt: new Date(form.receivedAt).toISOString(),
        method: form.method,
        reference: form.reference || undefined,
        observations: form.observations || undefined,
        allocations: buildManualAllocations(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      setOpen(false);
      setForm(emptyForm());
      toast({ title: "Pagamento lançado" });
    },
    onError: (err: any) =>
      toast({
        title: "Erro",
        description: err.response?.data?.message || err.message || "Não foi possível lançar o pagamento",
        variant: "destructive",
      }),
  });

  const columns = [
    { key: "clientName", label: "Cliente" },
    { key: "receivedAmount", label: "Valor recebido", render: (v: any) => `R$ ${Number(v).toFixed(2)}` },
    { key: "method", label: "Método", render: (v: any) => METHOD_LABELS[v] ?? v },
    { key: "receivedAt", label: "Recebido em", render: (v: any) => (v ? new Date(v).toLocaleString("pt-BR") : "") },
    { key: "userName", label: "Usuário" },
    { key: "status", label: "Status", render: (v: any) => (v === "REVERSED" ? "Estornado" : "Registrado") },
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
                data: isLoading ? [] : data,
                columns,
              })
            }
          >
            Exportar CSV
          </Button>
        </div>
      </div>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <Card>
        <CardHeader><CardTitle>Pagamentos lançados</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable columns={columns} data={isLoading ? [] : data} />
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
                    {l.clientName} — R$ {Number(l.principalAmount).toFixed(2)} ({l.installmentCount} parcelas)
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
                  <span>Total alocado nas parcelas</span>
                  <span className={totalAllocated > 0 ? "text-primary" : "text-muted-foreground"}>
                    R$ {totalAllocated.toFixed(2)}
                  </span>
                </div>
                {loadingInstallments ? (
                  <p className="text-xs text-muted-foreground">Carregando parcelas...</p>
                ) : openInstallments.length === 0 ? (
                  <p className="text-xs text-destructive">Nenhuma parcela em aberto neste empréstimo.</p>
                ) : (
                  <div className="max-h-32 overflow-auto border rounded-md p-2 text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground">
                          <th className="p-2 w-16">Selecionar</th>
                          <th className="p-2">Parcela</th>
                          <th className="p-2 text-right">Vencimento</th>
                          <th className="p-2 text-right">Saldo (R$)</th>
                          <th className="p-2 text-right">Valor a alocar (R$)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openInstallments.map((i) => {
                          const amount = allocations[i.id] ?? 0;
                          const exceeds = amount > Number(i.remainingBalance) + 0.005;
                          return (
                            <tr key={i.id} className="border-b border-border hover:bg-accent/50">
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  checked={amount > 0}
                                  onChange={() =>
                                    setAllocation(i.id, amount > 0 ? "0" : Number(i.remainingBalance).toFixed(2))
                                  }
                                />
                              </td>
                              <td className="p-2">
                                Parcela {i.number} — venc.{" "}
                                {new Date(i.dueDate).toLocaleDateString("pt-BR")} (
                                {i.status === "OVERDUE" ? "atrasada" : i.status === "PARTIALLY_PAID" ? "parcial" : "pendente"}
                                )
                              </td>
                              <td className="p-2 text-right">{Number(i.remainingBalance).toFixed(2)}</td>
                              <td className="p-2 text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={amount === 0 ? "" : amount.toFixed(2)}
                                  onChange={(e) => setAllocation(i.id, e.target.value)}
                                  className="w-full text-right"
                                  disabled={exceeds}
                                />
                                {exceeds ? (
                                  <p className="text-[10px] text-destructive mt-0">Excede o saldo</p>
                                ) : null}
                              </td>
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
              <Label>Valor recebido (R$)</Label>
              <Input required type="number" min="0.01" step="0.01" value={form.receivedAmount} onChange={(e) => setForm({ ...form, receivedAmount: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Escolha as parcelas e informe o valor a ser alocado em cada uma. O total alocado deve ser igual ao valor recebido.
            </p>
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
