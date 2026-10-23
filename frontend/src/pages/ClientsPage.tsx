"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectItem, SelectContent } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SimpleTable } from "@/components/SimpleTable";
import { Pagination } from "@/components/Pagination";
import { QUERY_KEYS } from "@/lib/query-keys";
import { Client, ClientDocument } from "@/types/api";

type DocType = "RG" | "PROOF_OF_ADDRESS";
type PendingDocument = { file: File; type: DocType };

type ClientForm = {
  name: string;
  cpf: string;
  phone: string;
  birthDate: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  active: boolean;
};

const emptyForm: ClientForm = {
  name: "", cpf: "", phone: "", birthDate: "", cep: "", address: "", number: "",
  complement: "", neighborhood: "", city: "", state: "", active: true,
};

const docTypeLabel = (type: DocType) =>
  type === "RG" ? "RG" : "Comprovante de residência";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

async function uploadDocument(clientId: string, pending: PendingDocument) {
  const formData = new FormData();
  formData.append("file", pending.file);
  formData.append("type", pending.type);
  return api.post(`/api/v1/clients/${clientId}/documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export default function ClientsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", debouncedSearch, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await api.get(`/api/v1/clients?${params.toString()}`);
      return res.data.data as { items: Client[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
    },
  });

  const clients = data?.items ?? [];
  const meta = data?.meta;

  const [open, setOpen] = useState(false);
  const [urlParams, setUrlParams] = useSearchParams();
  useEffect(() => {
    if (urlParams.get("new") === "1") {
      setEditing(null);
      setForm(emptyForm);
      setOpen(true);
      setUrlParams(previous => { const next = new URLSearchParams(previous); next.delete("new"); return next; }, { replace: true });
    }
  }, [urlParams, setUrlParams]);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [loanDialog, setLoanDialog] = useState<{ client: Client; loans: any[]; loading: boolean } | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const navigate = useNavigate();
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [docType, setDocType] = useState<DocType>("RG");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docInputKey, setDocInputKey] = useState(0);

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: QUERY_KEYS.documents.byClient(editing?.id ?? ""),
    queryFn: async () => {
      const res = await api.get(`/api/v1/clients/${editing!.id}/documents`);
      return res.data.data.documents as ClientDocument[];
    },
    enabled: !!editing?.id && open,
  });

  const invalidateClients = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients.root });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loans.root });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboards.root });
  };

  const openClientLoans = (client: Client) => {
    setLoanDialog({ client, loans: [], loading: true });
    api
      .get(`/api/v1/loans?clientId=${client.id}&page=1&pageSize=100`)
      .then((res) => {
        setLoanDialog((prev) =>
          prev && prev.client.id === client.id
            ? { ...prev, loans: res.data.data.items, loading: false }
            : prev,
        );
      })
      .catch(() => {
        setLoanDialog((prev) => (prev && prev.client.id === client.id ? { ...prev, loading: false } : prev));
      });
  };

  const resetDocState = () => {
    setPendingDocs([]);
    setDocFile(null);
    setDocType("RG");
    setDocInputKey((key) => key + 1);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    resetDocState();
    setOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    setForm({
      name: client.name,
      cpf: client.cpf,
      phone: client.phone ?? "",
      birthDate: client.birthDate ? client.birthDate.slice(0, 10) : "",
      cep: client.cep,
      address: client.address,
      number: client.number,
      complement: client.complement ?? "",
      neighborhood: client.neighborhood,
      city: client.city,
      state: client.state,
      active: client.active,
    });
    resetDocState();
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    resetDocState();
  };

  const addPendingDoc = () => {
    if (!docFile) return;
    if (docFile.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é 5 MB.", variant: "destructive" });
      return;
    }
    setPendingDocs((prev) => [...prev, { file: docFile, type: docType }]);
    setDocFile(null);
    setDocInputKey((key) => key + 1);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const birthDate = form.birthDate
        ? new Date(`${form.birthDate}T00:00:00.000Z`).toISOString()
        : form.birthDate;
      const payload = {
        ...form,
        birthDate,
        phone: form.phone || undefined,
        complement: form.complement || undefined,
        state: form.state.toUpperCase(),
      };
      const res = editing
        ? await api.patch(`/api/v1/clients/${editing.id}`, payload)
        : await api.post("/api/v1/clients", payload);
      const clientId: string = editing?.id ?? res.data.data.client.id;

      const failed: string[] = [];
      for (const pending of pendingDocs) {
        try {
          await uploadDocument(clientId, pending);
        } catch {
          failed.push(pending.file.name);
        }
      }
      return { wasEditing: !!editing, failed };
    },
    onSuccess: ({ wasEditing, failed }) => {
      invalidateClients();
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      closeDialog();
      if (failed.length > 0) {
        toast({
          title: "Cliente salvo com pendências",
          description: `Não foi possível anexar: ${failed.join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({ title: wasEditing ? "Cliente atualizado" : "Cliente cadastrado" });
      }
    },
    onError: (err: any) =>
      toast({ title: "Erro", description: err.response?.data?.message || "", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/clients/${id}`),
    onSuccess: () => {
      invalidateClients();
      setDeleteTarget(null);
      toast({ title: "Cliente excluído" });
    },
    onError: (err: any) =>
      toast({
        title: "Erro",
        description: err.response?.data?.message || "Não foi possível excluir o cliente",
        variant: "destructive",
      }),
  });

  const removeDocMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Documento excluído" });
    },
    onError: (err: any) =>
      toast({
        title: "Erro",
        description: err.response?.data?.message || "Não foi possível excluir o documento",
        variant: "destructive",
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Clientes</h2>
        <Button onClick={openCreate}>Novo cliente</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Pesquisar por nome, CPF..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Listagem</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable
            columns={[
              { key: "name", label: "Nome" },
              { key: "cpfMasked", label: "CPF" },
              { key: "phone", label: "Telefone", render: (v) => v ?? "-" },
              { key: "city", label: "Cidade" },
              { key: "state", label: "UF" },
              { key: "active", label: "Situação", render: (v) => (v ? "Ativo" : "Inativo") },
              {
                key: "actions",
                label: "",
                render: (_v, row) => (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}>Editar</Button>
                    <Button variant="outline" size="sm" onClick={() => openClientLoans(row)}>
                      Ver empréstimos
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(row)}>Excluir</Button>
                  </div>
                ),
              },
            ]}
            data={isLoading ? [] : clients}
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

      <Dialog open={open} onOpenChange={(value) => { if (!value) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <Separator />
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            <div className="space-y-2"><Label>Nome completo</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>CPF</Label><Input required value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone (WhatsApp)</Label><Input required placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" required value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>CEP</Label><Input required value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></div>
            <div className="space-y-2"><Label>Logradouro</Label><Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Número</Label><Input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
            <div className="space-y-2"><Label>Complemento</Label><Input value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} /></div>
            <div className="space-y-2"><Label>Bairro</Label><Input required value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></div>
            <div className="space-y-2"><Label>Cidade</Label><Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="space-y-2"><Label>UF</Label><Input required maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} /></div>
            {editing ? (
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Cliente ativo
              </label>
            ) : null}

            <div className="md:col-span-2 space-y-3">
              <Separator />
              <div>
                <h3 className="text-sm font-semibold">Documentos</h3>
                <p className="text-xs text-muted-foreground">RG e comprovante de residência (JPEG, PNG ou PDF).</p>
              </div>

              {editing ? (
                <div className="space-y-2">
                  {documentsLoading ? <p className="text-sm text-muted-foreground">Carregando documentos...</p> : null}
                  {!documentsLoading && (documents?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
                  ) : null}
                  {(documents ?? []).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{doc.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {docTypeLabel(doc.type as DocType)} · {formatBytes(doc.sizeBytes)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => window.open(doc.downloadUrl, "_blank")}>
                          Baixar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={removeDocMutation.isPending}
                          onClick={() => removeDocMutation.mutate(doc.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={docType} onValueChange={(value) => setDocType(value as DocType)}>
                    <SelectTrigger><SelectValue>{docTypeLabel(docType)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RG">RG</SelectItem>
                      <SelectItem value="PROOF_OF_ADDRESS">Comprovante de residência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Arquivo</Label>
                  <input
                    key={docInputKey}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                </div>
                <Button type="button" variant="outline" disabled={!docFile} onClick={addPendingDoc}>
                  Adicionar anexo
                </Button>
              </div>

              {pendingDocs.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Anexos pendentes (enviados ao salvar)</p>
                  {pendingDocs.map((pending, index) => (
                    <div
                      key={`${pending.file.name}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-dashed p-2 text-sm"
                    >
                      <span className="truncate">{docTypeLabel(pending.type)} · {pending.file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDocs((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!loanDialog} onOpenChange={(value) => { if (!value) setLoanDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empréstimos de {loanDialog?.client.name}</DialogTitle>
          </DialogHeader>
          {loanDialog?.loading ? (
            <p className="p-4 text-muted-foreground">Carregando empréstimos...</p>
          ) : loanDialog && loanDialog.loans.length === 0 ? (
            <p className="p-4 text-muted-foreground">Este cliente não possui empréstimos.</p>
          ) : loanDialog ? (
            <SimpleTable
              columns={[
                { key: "id", label: "ID", render: (v) => String(v ?? "").slice(-6) },
                { key: "principalAmount", label: "Principal", render: (v) => `R$ ${Number(v).toFixed(2)}` },
                { key: "status", label: "Status", render: (v) => (v === "ACTIVE" ? "Ativo" : v === "DRAFT" ? "Rascunho" : v) },
                { key: "grantedAt", label: "Concessão", render: (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "") },
                {
                  key: "actions",
                  label: "",
                  render: (_v, row: any) => (
                    <Button size="sm" onClick={() => { setLoanDialog(null); navigate(`/loans/${row.id}`); }}>
                      Detalhes
                    </Button>
                  ),
                },
              ]}
              data={loanDialog.loans}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(value) => { if (!value) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cliente</DialogTitle>
          </DialogHeader>
          <p className="p-4 text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Clientes com histórico
            financeiro (empréstimos ou pagamentos) não podem ser excluídos — nesse caso, edite e desative o cliente.
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
