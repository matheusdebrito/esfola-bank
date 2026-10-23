"use client";

import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SimpleTable } from "@/components/SimpleTable";

export default function ClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/clients/${clientId}`);
      return res.data.data.client;
    },
    enabled: !!clientId,
  });

  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ["client-loans", clientId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/loans?clientId=${clientId}&page=1&pageSize=100`);
      return res.data.data.items;
    },
    enabled: !!clientId,
  });

  if (clientLoading || loansLoading) return <div className="p-4 text-muted-foreground">Carregando...</div>;
  if (!client) return <div className="p-4 text-red-600">Cliente não encontrado</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{client.name}</h2>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados cadastrais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><span className="text-muted-foreground font-medium">CPF:</span> {client.cpfMasked}</p>
          <p><span className="text-muted-foreground font-medium">Telefone:</span> {client.phone || "-"}</p>
          <p><span className="text-muted-foreground font-medium">Nascimento:</span> {new Date(client.birthDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>
          <p><span className="text-muted-foreground font-medium">CEP:</span> {client.cep}</p>
          <p><span className="text-muted-foreground font-medium">Endereço:</span> {client.address}, {client.number}</p>
          <p><span className="text-muted-foreground font-medium">Bairro:</span> {client.neighborhood}</p>
          <p><span className="text-muted-foreground font-medium">Cidade/UF:</span> {client.city} - {client.state}</p>
          <p><span className="text-muted-foreground font-medium">Situação:</span> <Badge variant={client.active ? "default" : "secondary"}>{client.active ? "Ativo" : "Inativo"}</Badge></p>
        </CardContent>
      </Card>

      <Separator />
      <h3 className="text-lg font-semibold">Documentos</h3>
      <SimpleTable
        columns={[
          { key: "type", label: "Tipo" },
          { key: "originalName", label: "Arquivo" },
          { key: "mimeType", label: "MIME" },
          { key: "sizeBytes", label: "Tamanho (bytes)", render: (v) => Number(v).toLocaleString() },
          { key: "uploadedAt", label: "Enviado em" },
        ]}
        data={client.documents || []}
      />

      <Separator />
      <h3 className="text-lg font-semibold">Empréstimos</h3>
      <SimpleTable
        columns={[
          { key: "id", label: "ID", render: (v) => String(v ?? "").slice(-6) },
          { key: "principalAmount", label: "Principal", render: (v) => `R$ ${Number(v).toFixed(2)}` },
          { key: "status", label: "Status", render: (v) => (v === "ACTIVE" ? "Ativo" : v === "DRAFT" ? "Rascunho" : v) },
          { key: "grantedAt", label: "Concessão" },
          {
            key: "actions",
            label: "",
            render: (_v, row: any) => (
              <Button size="sm" onClick={() => navigate(`/loans/${row.id}`)}>Detalhes</Button>
            ),
          },
        ]}
        data={loans || []}
      />
    </div>
  );
}
