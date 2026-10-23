"use client";

import { useState } from "react";
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
import { QUERY_KEYS } from "@/lib/query-keys";

const EMPTY_FORM = {
  name: "",
  description: "",
  interestRatePercent: "30",
  lateFeeAmount: "10",
  dailyLateInterestPercent: "0.33",
  roundingMode: "HALF_UP",
  toleranceDays: "0",
  active: true,
};

type PolicyForm = typeof EMPTY_FORM;

function policyToForm(policy: any): PolicyForm {
  return {
    name: policy.name ?? "",
    description: policy.description ?? "",
    interestRatePercent: String(policy.interestRatePercent ?? 0),
    lateFeeAmount: String(policy.lateFeeAmount ?? 0),
    dailyLateInterestPercent: String(policy.dailyLateInterestPercent ?? 0),
    roundingMode: policy.roundingMode ?? "HALF_UP",
    toleranceDays: String(policy.toleranceDays ?? 0),
    active: Boolean(policy.active),
  };
}

export default function FinancialPoliciesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.policies.root,
    queryFn: async () => {
      const res = await api.get("/api/v1/financial-policies?page=1&pageSize=20");
      return res.data.data.items;
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<PolicyForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (policy: any) => {
    setEditing(policy);
    setForm(policyToForm(policy));
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        interestRatePercent: Number(form.interestRatePercent),
        lateFeeAmount: Number(form.lateFeeAmount),
        dailyLateInterestPercent: Number(form.dailyLateInterestPercent),
        roundingMode: form.roundingMode,
        toleranceDays: Number(form.toleranceDays),
        active: form.active,
      };

      if (editing) {
        return api.patch(`/api/v1/financial-policies/${editing.id}`, payload);
      }
      return api.post("/api/v1/financial-policies", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.policies.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.policies.options });
      toast({ title: editing ? "Política atualizada" : "Política criada" });
      closeDialog();
    },
    onError: (err: any) =>
      toast({
        title: "Erro",
        description: err.response?.data?.message || "Não foi possível salvar a política",
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/financial-policies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.policies.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.policies.options });
      setDeleteTarget(null);
      toast({ title: "Política excluída" });
    },
    onError: (err: any) =>
      toast({
        title: "Erro",
        description: err.response?.data?.message || "Não foi possível excluir a política",
        variant: "destructive",
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Políticas financeiras</h2>
        <Button onClick={openCreate}>Nova política</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Juros flat sobre o valor do empréstimo, multa fixa por parcela atrasada e juros de mora diário.
      </p>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <Card>
        <CardHeader><CardTitle>Políticas cadastradas</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable
            columns={[
              { key: "name", label: "Nome" },
              { key: "interestRatePercent", label: "Juros flat (%)", render: (v) => Number(v).toFixed(2) },
              { key: "lateFeeAmount", label: "Multa atraso (R$)", render: (v) => Number(v).toFixed(2) },
              { key: "dailyLateInterestPercent", label: "Juros diário (%)", render: (v) => Number(v).toFixed(2) },
              { key: "toleranceDays", label: "Tolerância (dias)" },
              { key: "active", label: "Ativo", render: (v) => (v ? "Sim" : "Não") },
              {
                key: "actions",
                label: "",
                render: (_v, row: any) => (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}>Editar</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(row)}
                    >
                      Excluir
                    </Button>
                  </div>
                ),
              },
            ]}
            data={isLoading ? [] : data ?? []}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(value) => { if (!value) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar política financeira" : "Nova política financeira"}</DialogTitle>
          </DialogHeader>
          <Separator />
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome</Label>
              <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Juros flat (%)</Label>
              <Input required type="number" min={0} max={1000} step="0.01" value={form.interestRatePercent} onChange={(e) => setForm({ ...form, interestRatePercent: e.target.value })} />
              <p className="text-xs text-muted-foreground">Percentual aplicado sobre o valor do empréstimo.</p>
            </div>
            <div className="space-y-2">
              <Label>Multa por parcela atrasada (R$)</Label>
              <Input required type="number" min={0} step="0.01" value={form.lateFeeAmount} onChange={(e) => setForm({ ...form, lateFeeAmount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Juros de mora diário (%)</Label>
              <Input required type="number" min={0} max={100} step="0.01" value={form.dailyLateInterestPercent} onChange={(e) => setForm({ ...form, dailyLateInterestPercent: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tolerância (dias)</Label>
              <Input required type="number" min={0} step={1} value={form.toleranceDays} onChange={(e) => setForm({ ...form, toleranceDays: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Arredondamento</Label>
              <Select value={form.roundingMode} onValueChange={(roundingMode) => setForm({ ...form, roundingMode })}>
                <option value="HALF_UP">Meio para cima</option>
                <option value="HALF_EVEN">Meio par</option>
                <option value="DOWN">Para baixo</option>
                <option value="UP">Para cima</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Ativa
            </label>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(value) => { if (!value) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir política financeira</DialogTitle>
          </DialogHeader>
          <p className="p-4 text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Políticas padrão ou em uso
            por empréstimos não podem ser excluídas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
