"use client";

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleTable } from "@/components/SimpleTable";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/csv";
import { QUERY_KEYS } from "@/lib/query-keys";
import { brl, dateBr } from "@/lib/format";
import { installmentStatusLabel } from "@/lib/status-labels";
import type { Installment } from "@/types/api";

export default function DefaultsPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.installments.root, "overdue"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await api.get("/api/v1/installments?page=1&pageSize=100&overdueOnly=true");
      return res.data.data.items as Installment[];
    },
  });

  const columns = [
    {
      key: "loanCode",
      label: "Empréstimo",
      render: (v: string | null) => <span className="font-mono text-xs">{v ?? "-"}</span>,
    },
    { key: "clientName", label: "Cliente", render: (v: string | null) => v ?? "-" },
    { key: "number", label: "Parcela", render: (v: number) => `#${v}` },
    { key: "dueDate", label: "Vencimento", render: (v: string) => dateBr(v) },
    { key: "totalDue", label: "Original", render: (v: number) => brl(v) },
    { key: "updatedTotalDue", label: "Devido", render: (v: number) => brl(v) },
    { key: "updatedRemainingBalance", label: "Em aberto atualizado", render: (v: number) => brl(v) },
    { key: "daysOverdue", label: "Dias de atraso" },
    {
      key: "lateCharges",
      label: "Encargos",
      render: (v: Installment["lateCharges"]) => brl(v?.totalLateCharges ?? 0),
    },
    {
      key: "effectiveStatus",
      label: "Status",
      render: (v: string | undefined, row: Installment) => installmentStatusLabel(v ?? row.status),
    },
    {
      key: "actions",
      label: "",
      render: (_v: unknown, row: Installment) => (
        <Button variant="outline" size="sm" onClick={() => navigate(`/loans/${row.loanId}`)}>
          Abrir empréstimo
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Inadimplência</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportToCsv({
                filename: "inadimplencia",
                data: isLoading ? [] : data ?? [],
                columns,
              })
            }
          >
            Exportar CSV
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Parcelas vencidas e não quitadas (calculado pela data de vencimento).
      </p>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Parcelas em atraso</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleTable columns={columns} data={isLoading ? [] : data ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
