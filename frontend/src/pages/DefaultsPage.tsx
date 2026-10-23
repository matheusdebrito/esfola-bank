"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleTable } from "@/components/SimpleTable";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/csv";

export default function DefaultsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["defaults"],
    queryFn: async () => {
      const res = await api.get("/api/v1/installments?page=1&pageSize=50&status=OVERDUE");
      return res.data.data.items;
    },
  });

  const columns = [
    { key: "loan.clientName", label: "Cliente" },
    { key: "number", label: "Parcela" },
    { key: "dueDate", label: "Vencimento" },
    { key: "totalDue", label: "Devido", render: (v: any) => `R$ ${Number(v).toFixed(2)}` },
    { key: "remainingBalance", label: "Saldo devedor", render: (v: any) => `R$ ${Number(v).toFixed(2)}` },
    { key: "daysOverdue", label: "Dias atraso" },
    { key: "lateCharges", label: "Encargos", render: (v: any) => `R$ ${Number((v as any)?.totalLateCharges || 0).toFixed(2)}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Inadimplência</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={() =>
              exportToCsv({
                filename: "inadimplencia",
                data: isLoading ? [] : data,
                columns,
              })
            }
          >
            Exportar CSV
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Parcelas vencidas e não quitadas.</p>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <Card>
        <CardHeader><CardTitle>Parcelas em atraso</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable columns={columns} data={isLoading ? [] : data} />
        </CardContent>
      </Card>
    </div>
  );
}
