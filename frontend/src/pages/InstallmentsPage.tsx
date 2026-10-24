"use client";

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleTable } from "@/components/SimpleTable";
import { Pagination } from "@/components/Pagination";
import { QUERY_KEYS } from "@/lib/query-keys";
import { brl, dateBr } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import { installmentStatusLabel } from "@/lib/status-labels";
import type { Installment } from "@/types/api";

export function buildWhatsappUrl(installment: Installment) {
  const digits = (installment.clientPhone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const phone = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  const lines = [
    `Olá, ${installment.clientName ?? "cliente"}!`,
    "",
    `Passando para lembrar da parcela ${installment.number} do seu empréstimo.`,
    `Vencimento: ${dateBr(installment.dueDate)}`,
    `Valor original da parcela: ${brl(installment.totalDue)}`,
    `Devido atualizado: ${brl(installment.updatedTotalDue)}`,
    `Em aberto atualizado: ${brl(installment.updatedRemainingBalance)}`,
  ];
  if (installment.daysOverdue > 0) {
    lines.push(`Atraso: ${installment.daysOverdue} dia(s)`);
  }
  const lateCharges = installment.lateCharges?.totalLateCharges ?? 0;
  if (lateCharges > 0) {
    lines.push(`Multa e juros de atraso: ${brl(lateCharges)}`);
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loans.detail(installment.loanId) });
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
    <div className="flex items-center gap-2">
      <Button size="sm" variant="whatsapp" onClick={handleCharge}>
        WhatsApp
      </Button>
      <Button
        size="sm"
        variant="default"
        disabled={closed || payMutation.isPending}
        onClick={() => payMutation.mutate()}
      >
        {payMutation.isPending ? "Baixando..." : "Pagar"}
      </Button>
    </div>
  );
}

export default function InstallmentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.installments.list, debouncedSearch, page, pageSize],
    refetchInterval: 60_000,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await api.get(`/api/v1/installments?${params.toString()}`);
      return res.data.data as { items: Installment[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
    },
  });

  const installments = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-5 pb-6 sm:space-y-6">
      <header>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[.15em] text-primary">Carteira</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Parcelas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vencimentos, pagamentos e encargos atualizados.</p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Pesquisar por empréstimo, cliente..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <Card>
        <CardHeader><CardTitle>Obrigações</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable
            columns={[
              {
                key: "loanCode",
                label: "Empréstimo",
                render: (v) => <span className="font-mono text-xs">{v ?? "-"}</span>,
              },
              { key: "clientName", label: "Cliente", render: (v) => v ?? "-" },
              { key: "number", label: "Nº" },
              { key: "dueDate", label: "Vencimento", render: (v) => dateBr(v) },
              { key: "totalDue", label: "Original", render: (v) => brl(Number(v)) },
              { key: "updatedTotalDue", label: "Devido", render: (v) => brl(Number(v)) },
              { key: "paidAmount", label: "Pago", render: (v) => brl(Number(v)) },
              { key: "lateCharges", label: "Encargos", render: (v) => brl(Number((v as any)?.totalLateCharges ?? 0)) },
              { key: "status", label: "Status", render: (_v, row) => installmentStatusLabel(row.effectiveStatus ?? row.status) },
              { key: "daysOverdue", label: "Atraso (dias)" },
              { key: "actions", label: "", render: (_v, row) => <InstallmentActions installment={row} /> },
            ]}
            data={isLoading ? [] : installments}
            mobileActionsAlign="center"
          />
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
    </div>
  );
}
