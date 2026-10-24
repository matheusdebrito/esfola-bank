"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { PaymentEntryDialog } from "@/components/PaymentEntryDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleTable } from "@/components/SimpleTable";
import { Pagination } from "@/components/Pagination";
import { exportToCsv } from "@/lib/csv";
import { QUERY_KEYS } from "@/lib/query-keys";
import { brl, dateTimeBr } from "@/lib/format";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";
import { useAuth } from "@/hooks/useAuth";

export default function PaymentsPage() {
  const { can } = useAuth();
  // Dependência booleana estável: o callback can() é recriado a cada render.
  const canRegisterPayment = can("payments:register");

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

  const [open, setOpen] = useState(false);
  const [initialLoanId, setInitialLoanId] = useState<string | undefined>();
  const [urlParams, setUrlParams] = useSearchParams();

  useEffect(() => {
    if (urlParams.get("new") !== "1" || !canRegisterPayment) return;
    setInitialLoanId(urlParams.get("loanId") ?? undefined);
    setOpen(true);
    setUrlParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete("new");
      next.delete("loanId");
      return next;
    }, { replace: true });
  }, [urlParams, setUrlParams, canRegisterPayment]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setInitialLoanId(undefined);
  }

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
    <div className="space-y-5 pb-6 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[.15em] text-primary">Movimentação</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Recebimentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pagamentos confirmados e lançamentos em contratos.</p>
        </div>
        <div className="flex items-center gap-2">
          {canRegisterPayment && <Button onClick={() => { setInitialLoanId(undefined); setOpen(true); }}>Lançar pagamento</Button>}
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
      </header>
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

      <PaymentEntryDialog open={open} initialLoanId={initialLoanId} onOpenChange={handleOpenChange} />
    </div>
  );
}