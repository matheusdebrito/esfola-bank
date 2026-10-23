"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useNavigate } from "react-router-dom";
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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  LIQUIDATED: "Liquidado",
  CANCELED: "Cancelado",
  RENEGOTIATED: "Renegociado",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  clientId: "",
  policyId: "",
  principalAmount: "",
  periodicity: "MONTHLY",
  installmentCount: "12",
  startDate: today(),
  contractTerms: "",
  observations: "",
  activate: true,
};

export default function LoansPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await api.get("/api/v1/loans?page=1&pageSize=20");
      return res.data.data.items;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients", "options"],
    queryFn: async () => {
      const res = await api.get("/api/v1/clients?page=1&pageSize=100");
      return res.data.data.items;
    },
  });

  const { data: policies } = useQuery({
    queryKey: ["policies", "options"],
    queryFn: async () => {
      const res = await api.get("/api/v1/financial-policies?page=1&pageSize=100");
      return (res.data.data.items as any[]).filter((p) => p.active);
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const navigate = useNavigate();

  useEffect(() => {
    if (form.policyId || !policies?.length) return;
    const preferred = policies[0];
    setForm((current) => (current.policyId ? current : { ...current, policyId: preferred.id }));
  }, [policies, form.policyId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/api/v1/loans", {
        clientId: form.clientId,
        policyId: form.policyId,
        principalAmount: Number(form.principalAmount),
        periodicity: form.periodicity,
        billingModel: "FIXED_INSTALLMENTS",
        installmentCount: Number(form.installmentCount),
        startDate: new Date(`${form.startDate}T00:00:00.000Z`).toISOString(),
        contractTerms: form.contractTerms || undefined,
        observations: form.observations || undefined,
      });

      const loan = res.data.data.loan;
      let activationError: string | null = null;
      if (form.activate) {
        try {
          await api.patch(`/api/v1/loans/${loan.id}/status`, {
            status: "ACTIVE",
            justification: "Ativação no cadastro",
          });
        } catch (err: any) {
          activationError = err.response?.data?.message || "Não foi possível ativar o empréstimo";
        }
      }
      return { loan, activationError };
    },
    onSuccess: ({ activationError }) => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["installments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      setOpen(false);
      setForm({ ...EMPTY_FORM, startDate: today() });
      if (activationError) {
        toast({ title: "Empréstimo salvo como rascunho", description: activationError, variant: "destructive" });
      } else if (form.activate) {
        toast({ title: "Empréstimo criado e ativado", description: "Parcelas geradas automaticamente." });
      } else {
        toast({ title: "Empréstimo criado como rascunho" });
      }
    },
    onError: (err: any) =>
      toast({
        title: "Erro",
        description: err.response?.data?.message || "Não foi possível criar o empréstimo",
        variant: "destructive",
      }),
  });

  const noPolicies = policies !== undefined && policies.length === 0;

  const selectedPolicy =
    (policies ?? []).find((p: any) => p.id === form.policyId) ??
    (policies ?? [])[0];
  const previewTotal =
    form.principalAmount && selectedPolicy
      ? Number(form.principalAmount) * (1 + Number(selectedPolicy.interestRatePercent) / 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Empréstimos</h2>
        <Button onClick={() => setOpen(true)}>Novo empréstimo</Button>
      </div>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <Card>
        <CardHeader><CardTitle>Carteira</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable
            columns={[
              { key: "clientName", label: "Cliente" },
              { key: "principalAmount", label: "Principal", render: (v) => `R$ ${Number(v).toFixed(2)}` },
              { key: "interestRatePercent", label: "Juros flat (%)", render: (v) => Number(v).toFixed(2) },
              { key: "periodicity", label: "Periodicidade", render: (v) => (v === "DAILY" ? "Diário" : "Mensal") },
              { key: "policyName", label: "Política" },
              { key: "installmentCount", label: "Parcelas" },
              { key: "status", label: "Status", render: (v) => STATUS_LABELS[v] ?? v },
              { key: "createdAt", label: "Criado em", render: (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "") },
              {
                key: "actions",
                label: "",
                render: (_v, row: any) => (
                  <Button size="sm" onClick={() => navigate(`/loans/${row.id}`)}>Detalhes</Button>
                ),
              },
            ]}
            data={isLoading ? [] : data}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo empréstimo</DialogTitle>
          </DialogHeader>
          <Separator />
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Cliente</Label>
              <Select required value={form.clientId} onValueChange={(clientId) => setForm({ ...form, clientId })}>
                <option value="">Selecione um cliente</option>
                {(clients ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.cpfMasked}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Política financeira</Label>
              <Select required value={form.policyId} onValueChange={(policyId) => setForm({ ...form, policyId })}>
                <option value="" disabled>Selecione uma política</option>
                {(policies ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} — {Number(p.interestRatePercent).toFixed(2)}% flat</option>
                ))}
              </Select>
              {noPolicies ? (
                <p className="text-xs text-destructive">
                  Nenhuma política ativa. Cadastre uma política antes de criar empréstimos.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Valor principal (R$)</Label>
              <Input required type="number" min="0.01" step="0.01" value={form.principalAmount} onChange={(e) => setForm({ ...form, principalAmount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Periodicidade</Label>
              <Select value={form.periodicity} onValueChange={(periodicity) => setForm({ ...form, periodicity })}>
                <option value="MONTHLY">Mensal (uma parcela por mês)</option>
                <option value="DAILY">Diário (uma parcela por dia)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade de parcelas</Label>
              <Input required type="number" min={1} step={1} value={form.installmentCount} onChange={(e) => setForm({ ...form, installmentCount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Primeiro vencimento</Label>
              <Input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            {previewTotal !== null ? (
              <p className="text-sm md:col-span-2">
                Total a pagar: <strong>R$ {previewTotal.toFixed(2)}</strong>
                {Number(form.installmentCount) > 0
                  ? ` em ${form.installmentCount}x de R$ ${(previewTotal / Number(form.installmentCount)).toFixed(2)}`
                  : null}
              </p>
            ) : null}
            <div className="space-y-2 md:col-span-2">
              <Label>Termos do contrato</Label>
              <Textarea value={form.contractTerms} onChange={(e) => setForm({ ...form, contractTerms: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={form.activate} onChange={(e) => setForm({ ...form, activate: e.target.checked })} />
              Ativar imediatamente e gerar as parcelas
            </label>
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
