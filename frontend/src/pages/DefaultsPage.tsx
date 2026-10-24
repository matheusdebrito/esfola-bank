import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleTable } from "@/components/SimpleTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/Pagination";
import { exportToCsv } from "@/lib/csv";
import { brl, dateBr } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api-error";
import { AlertTriangle, ArrowRight, Search, MessageCircle } from "lucide-react";
import { buildWhatsappUrl } from "@/pages/InstallmentsPage";
import type { Installment, Paged } from "@/types/api";

const ageFilters = [
  { value: "all", label: "Todos os atrasos" },
  { value: "1-7", label: "1 a 7 dias" },
  { value: "8-30", label: "8 a 30 dias" },
  { value: "31+", label: "Mais de 30 dias" },
];
export default function DefaultsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [bucket, setBucket] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["installments", "overdue", debounced, bucket, page],
    queryFn: async () => {
      const q = new URLSearchParams({
        overdueOnly: "true",
        page: String(page),
        pageSize: String(pageSize),
        ageBucket: bucket,
      });
      if (debounced) q.set("search", debounced);
      const response = await api.get("/api/v1/installments?" + q.toString());
      return response.data.data as Paged<Installment>;
    },
    refetchInterval: 60_000,
  });
  const items = data?.items ?? [];
  const columns = [
    { key: "clientName", label: "Cliente" },
    { key: "loanCode", label: "Empréstimo" },
    { key: "number", label: "Parcela", render: (v: number) => "#" + v },
    { key: "dueDate", label: "Vencimento", render: (v: string) => dateBr(v) },
    { key: "daysOverdue", label: "Dias em atraso" },
    { key: "updatedRemainingBalance", label: "Em aberto", render: (v: number) => brl(v) },
    { key: "lateCharges", label: "Encargos", render: (v: Installment["lateCharges"]) => brl(v?.totalLateCharges ?? 0) },
    { key: "actions", label: "", render: (_v: unknown, row: Installment) => (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => navigate("/loans/" + row.loanId)}>Abrir contrato <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="whatsapp" title={row.clientPhone ? "Enviar mensagem de cobrança" : "Cliente sem telefone cadastrado"} disabled={!buildWhatsappUrl(row)}
          onClick={() => { const url = buildWhatsappUrl(row); if (url) window.open(url, "_blank", "noopener,noreferrer"); }}>
          <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
        </Button>
      </div>
    ) },
  ];

  return <div className="space-y-5 pb-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Cobranças</h1>
        <p className="mt-1 text-sm text-muted-foreground">Parcelas vencidas, saldo atualizado e acesso aos contratos.</p>
      </div>
      <Button variant="outline" disabled={isPending || items.length === 0} onClick={() => exportToCsv({
        filename: "cobrancas-pagina-" + page, data: items, columns,
      })}>Exportar página em CSV</Button>
    </header>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
        <Input className="pl-9" aria-label="Buscar cliente ou empréstimo" placeholder="Buscar cliente, CPF ou empréstimo..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <Select value={bucket} onValueChange={v => { setBucket(v); setPage(1); }}>
        {ageFilters.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    </div>
    {isError ? <Card className="space-y-3 p-5">
      <p className="text-sm text-destructive">{getApiErrorMessage(error, "Erro ao carregar cobranças")}</p>
      <Button onClick={() => refetch()}>Tentar novamente</Button>
    </Card> : <>
      <p className="text-sm text-muted-foreground">
        {isPending ? "Carregando..." : String(data?.meta.total ?? 0) + " parcela(s) encontrada(s). Ordenadas por vencimento mais antigo."}
      </p>
      {items.length === 0 && !isPending ? <Card className="p-5 text-sm text-muted-foreground"><AlertTriangle className="mr-2 inline h-4 w-4"/>Nenhuma cobrança encontrada para este filtro.</Card> : <>
        <Card className="hidden min-w-0 overflow-hidden p-4 md:block">
          <CardContent><SimpleTable columns={columns} data={items}/></CardContent>
        </Card>
        <div className="space-y-3 md:hidden">
          {items.map(row => <Card key={row.id} className="min-w-0 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 break-words text-sm font-semibold leading-snug">{row.clientName ?? "Cliente"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.loanCode} · parcela #{row.number}</p>
                <p className="mt-1 text-xs text-destructive">{row.daysOverdue} dias em atraso · {dateBr(row.dueDate)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{brl(row.updatedRemainingBalance)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Encargos {brl(row.lateCharges?.totalLateCharges ?? 0)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={() => navigate("/loans/" + row.loanId)}>Contrato <ArrowRight className="ml-1 h-4 w-4"/></Button>
              <Button size="sm" variant="whatsapp" className="min-w-0 flex-1" disabled={!buildWhatsappUrl(row)}
                title={row.clientPhone ? "Enviar cobrança" : "Cliente sem telefone cadastrado"}
                onClick={() => { const url = buildWhatsappUrl(row); if (url) window.open(url, "_blank", "noopener,noreferrer"); }}>
                <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
              </Button>
            </div>
          </Card>)}
        </div>
      </>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Página {data?.meta.page ?? 1} de {data?.meta.totalPages ?? 1}</p>
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPageChange={setPage}/>
      </div>
    </>}
  </div>;
}
