"use client";

import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SimpleTable } from "@/components/SimpleTable";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InstallmentActions } from "@/pages/InstallmentsPage";
import type { Installment, Loan, Payment } from "@/types/api";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dateBr = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    DRAFT: "Rascunho",
    ACTIVE: "Ativo",
    LIQUIDATED: "Liquidado",
    CANCELED: "Cancelado",
    RENEGOTIATED: "Renegociado",
    PENDING: "Pendente",
    PARTIALLY_PAID: "Parcialmente paga",
    PAID: "Paga",
    OVERDUE: "Atrasada",
  };
  return labels[status] ?? status;
};

export default function LoanDetailPage() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: loan, isLoading: loanLoading } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/loans/${loanId}`);
      return res.data.data.loan as Loan;
    },
    enabled: !!loanId,
  });

  const { data: installments, isLoading: instLoading } = useQuery({
    queryKey: ["installments", "loan", loanId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/installments?loanId=${loanId}&page=1&pageSize=100`);
      return res.data.data.items as Installment[];
    },
    enabled: !!loanId,
  });

  const [reverseTarget, setReverseTarget] = useState<Payment | null>(null);
  const [reverseJustification, setReverseJustification] = useState("");

  const reverseMutation = useMutation({
    mutationFn: async () => {
      if (!reverseTarget) throw new Error("Pagamento não selecionado");
      if (!reverseJustification.trim()) throw new Error("Justificativa é obrigatória");
      await api.post(`/api/v1/payments/${reverseTarget.id}/reverse`, {
        justification: reverseJustification.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["installments", "loan", loanId] });
      queryClient.invalidateQueries({ queryKey: ["loan", loanId] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setReverseTarget(null);
      setReverseJustification("");
      toast({ title: "Pagamento estornado" });
    },
    onError: (err: any) =>
      toast({
        title: "Erro ao estornar",
        description: err.response?.data?.message || "",
        variant: "destructive",
      }),
  });

  if (loanLoading || instLoading) return <div className="p-4 text-muted-foreground">Carregando...</div>;
  if (!loan) return <div className="p-4 text-red-600">Empréstimo não encontrado</div>;

  const insts = installments ?? [];
  const totalDue = insts.reduce((s, i) => s + Number(i.totalDue), 0);
  const paidTotal = insts.reduce((s, i) => s + Number(i.paidAmount), 0);
  const remainingTotal = insts.reduce((s, i) => s + Number(i.remainingBalance), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/loans")}>
          ← Voltar aos empréstimos
        </Button>
        <h2 className="text-xl font-semibold">Empréstimo #{loan.id.slice(-6)}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{loan.clientName ?? "Cliente"}</CardTitle>
          <CardDescription>
            {loan.clientCpfMasked ? `CPF: ${loan.clientCpfMasked} ·` : null}
            Contrato {loan.contractTerms ? "com termos" : "sem termos"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Valor principal</p>
            <p className="font-semibold">{brl(loan.principalAmount)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Juros flat</p>
            <p className="font-semibold">{Number(loan.interestRatePercent).toFixed(2)}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Periodicidade</p>
            <p className="font-semibold">{loan.periodicity === "DAILY" ? "Diário" : "Mensal"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-semibold">
              <Badge
                variant={loan.status === "ACTIVE" ? "default" : "secondary"}
                className="capitalize"
              >
                {statusLabel(loan.status)}
              </Badge>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Concessão</p>
            <p className="font-semibold">{dateBr(loan.grantedAt)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Primeiro vencimento</p>
            <p className="font-semibold">{dateBr(loan.dueDate)}</p>
          </div>
        </CardContent>
        <CardContent className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total devido</p>
              <p className="font-semibold">{brl(totalDue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total pago</p>
              <p className="font-semibold">{brl(paidTotal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Saldo em aberto</p>
              <p className="font-semibold">{brl(remainingTotal)}</p>
            </div>
          </div>
          {loan.observations ? (
            <div className="mt-4 border rounded-md p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground">Observações</p>
              <p className="text-sm">{loan.observations}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Parcelas</h3>
        <p className="text-sm text-muted-foreground">
          {insts.length} parcela(s)
        </p>
      </div>
      <Card>
        <CardContent>
          <SimpleTable
            columns={[
              { key: "clientName", label: "Cliente", render: (v) => v ?? "-" },
              { key: "number", label: "Nº" },
              { key: "dueDate", label: "Vencimento", render: (v) => dateBr(v) },
              { key: "totalDue", label: "Devido", render: (v) => brl(Number(v)) },
              { key: "paidAmount", label: "Pago", render: (v) => brl(Number(v)) },
              { key: "remainingBalance", label: "Saldo", render: (v) => brl(Number(v)) },
              { key: "lateCharges", label: "Encargos", render: (v) => brl(Number((v as any)?.totalLateCharges ?? 0)) },
              { key: "status", label: "Status", render: (v) => statusLabel(v) },
              { key: "daysOverdue", label: "Atraso (dias)" },
              { key: "actions", label: "", render: (_v, row) => <InstallmentActions installment={row} /> },
            ]}
            data={insts}
            mobileActionsAlign="center"
          />
        </CardContent>
      </Card>

      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Pagamentos registrados</h3>
      </div>
      <Card>
        <CardContent>
          <SimpleTable
            columns={[
              { key: "id", label: "ID", render: (v) => String(v ?? "").slice(-6) },
              { key: "method", label: "Método" },
              { key: "receivedAmount", label: "Valor", render: (v) => brl(Number(v)) },
              { key: "receivedAt", label: "Recebido em", render: (v) => dateBr(v) },
              { key: "userName", label: "Usuário", render: (v) => v ?? "-" },
              { key: "status", label: "Status", render: (v) => statusLabel(v) },
              {
                key: "actions",
                label: "",
                render: (_v, row: Payment) => (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={row.status === "REVERSED" || reverseMutation.isPending}
                    onClick={() => {
                      setReverseTarget(row);
                      setReverseJustification("");
                    }}
                  >
                    Estornar
                  </Button>
                ),
              },
            ]}
            data={loan.payments ?? []}
          />
        </CardContent>
      </Card>

      <Dialog open={!!reverseTarget} onOpenChange={(value) => { if (!value) setReverseTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estornar pagamento</DialogTitle>
          </DialogHeader>
          <Separator />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              reverseMutation.mutate();
            }}
            className="space-y-4 p-4"
          >
            <div className="space-y-2">
              <Label>Justificativa</Label>
              <Textarea
                value={reverseJustification}
                onChange={(e) => setReverseJustification(e.target.value)}
                placeholder="Informe o motivo do estorno"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReverseTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={reverseMutation.isPending || !reverseJustification.trim()}>
                {reverseMutation.isPending ? "Estornando..." : "Confirmar estorno"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
