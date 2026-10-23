"use client";

import type { MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleTable } from "@/components/SimpleTable";
import { QUERY_KEYS } from "@/lib/query-keys";
import { brl, dateBr } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import { installmentStatusLabel } from "@/lib/status-labels";
import type { Installment } from "@/types/api";

function buildWhatsappUrl(installment: Installment) {
  const digits = (installment.clientPhone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const phone = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  const lines = [
    `Olá, ${installment.clientName ?? "cliente"}!`,
    "",
    `Passando para lembrar da parcela ${installment.number} do seu empréstimo.`,
    `Vencimento: ${dateBr(installment.dueDate)}`,
    `Valor da parcela: ${brl(installment.totalDue)}`,
    `Saldo em aberto: ${brl(installment.remainingBalance)}`,
  ];
  if (installment.daysOverdue > 0) {
    lines.push(`Atraso: ${installment.daysOverdue} dia(s)`);
  }
  const lateCharges = installment.lateCharges?.totalLateCharges ?? 0;
  if (lateCharges > 0) {
    lines.push(
      `Multa e juros de atraso: ${brl(lateCharges)}`,
      `Total atualizado: ${brl(installment.remainingBalance + lateCharges)}`,
    );
  }
  lines.push("", "Qualquer dúvida, estamos à disposição.");
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function closeMenu(event: MouseEvent<HTMLElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

export function InstallmentActions({ installment }: { installment: Installment }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const payMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/installments/${installment.id}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.installments.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.payments.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loans.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboards.root });
      const lateCharges = installment.lateCharges?.totalLateCharges ?? 0;
      toast({
        title: "Parcela baixada como paga",
        description: lateCharges > 0 ? `Encargos de atraso cobrados: ${brl(lateCharges)}` : undefined,
      });
    },
    onError: (err: unknown) =>
      toast({
        title: "Erro",
        description: getApiErrorMessage(err, "Não foi possível baixar a parcela"),
        variant: "destructive",
      }),
  });

  const closed = installment.status === "PAID" || installment.status === "CANCELED";

  const handleCharge = (event: MouseEvent<HTMLButtonElement>) => {
    closeMenu(event);
    const url = buildWhatsappUrl(installment);
    if (!url) {
      toast({
        title: "Telefone não cadastrado",
        description: "Cadastre o telefone no perfil do cliente para cobrar pelo WhatsApp.",
        variant: "destructive",
      });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <details className="relative">
      <summary
        className="list-none cursor-pointer rounded-md px-2 py-1 text-center text-lg leading-none hover:bg-muted [&::-webkit-details-marker]:hidden"
        title="Opções"
      >
        ...
      </summary>
      <div className="absolute right-0 z-50 mt-1 w-36 rounded-md border bg-background p-1 shadow-md">
        <button
          type="button"
          onClick={handleCharge}
          className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
        >
          Cobrar
        </button>
        <button
          type="button"
          disabled={closed || payMutation.isPending}
          onClick={(event) => {
            closeMenu(event);
            payMutation.mutate();
          }}
          className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
        >
          {payMutation.isPending ? "Baixando..." : "Pago"}
        </button>
      </div>
    </details>
  );
}

export default function InstallmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.installments.list,
    queryFn: async () => {
      const res = await api.get("/api/v1/installments?page=1&pageSize=20");
      return res.data.data.items as Installment[];
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Parcelas</h2>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <Card>
        <CardHeader><CardTitle>Obrigações</CardTitle></CardHeader>
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
              { key: "status", label: "Status", render: (_v, row) => installmentStatusLabel(row.effectiveStatus ?? row.status) },
              { key: "daysOverdue", label: "Atraso (dias)" },
              { key: "actions", label: "", render: (_v, row) => <InstallmentActions installment={row} /> },
            ]}
            data={isLoading ? [] : data ?? []}
            mobileActionsAlign="center"
          />
        </CardContent>
      </Card>
    </div>
  );
}
