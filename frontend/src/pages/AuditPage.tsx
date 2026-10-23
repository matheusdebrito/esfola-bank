"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleTable } from "@/components/SimpleTable";

export default function AuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const res = await api.get("/api/v1/audit?page=1&pageSize=20");
      return res.data.data.items;
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Auditoria</h2>
      <p className="text-sm text-muted-foreground">Trilha de operações sensíveis do sistema.</p>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <Card>
        <CardHeader><CardTitle>Log de auditoria</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable
            columns={[
              { key: "user.name", label: "Usuário" },
              { key: "action", label: "Ação" },
              { key: "entityType", label: "Entidade" },
              { key: "entityId", label: "ID entidade" },
              { key: "createdAt", label: "Data/hora" },
            ]}
            data={isLoading ? [] : data}
          />
        </CardContent>
      </Card>
    </div>
  );
}
