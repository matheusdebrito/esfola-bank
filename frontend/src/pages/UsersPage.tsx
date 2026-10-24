import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination } from "@/components/Pagination";
import { Pencil, Plus, Trash2, UsersRound, ShieldCheck } from "lucide-react";

type UserRow = { id: string; name: string; email: string; role: string; active: boolean; createdAt: string };
type UsersResponse = { items: UserRow[]; meta: { total: number; page: number; pageSize: number; totalPages: number } };
const roles = [
  { value: "OPERATOR", label: "Operador" },
  { value: "MANAGER", label: "Gerente" },
  { value: "AUDITOR", label: "Auditor" },
  { value: "ADMIN", label: "Administrador" },
];
const labelRole = (role: string) => roles.find(r => r.value === role)?.label ?? role;
const emptyCreate = { name: "", email: "", password: "", role: "OPERATOR" };

export default function UsersPage() {
  const { user: me, can } = useAuth();
  const canManage = can("users:update") && me?.role === "ADMIN";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [edit, setEdit] = useState({ name: "", role: "OPERATOR", active: true });
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const listing = useQuery({
    queryKey: ["users", page, search],
    queryFn: async () => (await api.get("/api/v1/users", { params: { page, pageSize: 20, search: search || undefined } })).data.data as UsersResponse,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["auth", "me"] }); };
  const create = useMutation({
    mutationFn: () => api.post("/api/v1/users", createForm),
    onSuccess: () => { refresh();setCreateOpen(false);setCreateForm(emptyCreate);toast({ title: "Usuário criado" }); },
    onError: (error: unknown) => toast({ title: "Não foi possível criar", description: getApiErrorMessage(error,"Confira os dados."), variant:"destructive" }),
  });
  const update = useMutation({
    mutationFn: () => {
      if (!editUser) throw new Error("Nenhum usuário selecionado");
      return api.patch("/api/v1/users/" + editUser.id, { name: edit.name.trim(), role: edit.role, active: edit.active });
    },
    onSuccess: () => { refresh();setEditUser(null);toast({ title: "Usuário atualizado" }); },
    onError: (error: unknown) => toast({ title: "Não foi possível atualizar", description: getApiErrorMessage(error,"Confira os dados."), variant:"destructive" }),
  });
  const remove = useMutation({
    mutationFn: () => {
      if (!deleteUser) throw new Error("Nenhum usuário selecionado");
      return api.delete("/api/v1/users/" + deleteUser.id);
    },
    onSuccess: () => { refresh();setDeleteUser(null);setDeleteConfirmation("");toast({ title: "Conta excluída", description: "Acesso bloqueado e histórico financeiro preservado." }); },
    onError: (error: unknown) => toast({ title: "Não foi possível excluir", description: getApiErrorMessage(error,"Tente novamente."), variant:"destructive" }),
  });
  function openEdit(user: UserRow) { setEditUser(user);setEdit({ name:user.name,role:user.role,active:user.active }); }
  function submitEdit(event: FormEvent<HTMLFormElement>) { event.preventDefault();if(!canManage || !editUser || edit.name.trim().length < 2 || update.isPending)return;update.mutate(); }

  return <div className="space-y-5 pb-7">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-primary">Administração</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie os acessos da sua equipe. O e-mail de login é permanente.</p></div>
      {can("users:create") && <Button onClick={() => { setCreateForm(emptyCreate);setCreateOpen(true); }}><Plus className="h-4 w-4"/> Novo usuário</Button>}
    </header>
    <Card className="min-w-0 border border-slate-200 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold"><UsersRound className="h-5 w-5 text-blue-600"/> Equipe cadastrada</h2>
        <span className="text-xs text-muted-foreground">{listing.data?.meta.total ?? 0} usuário(s)</span>
      </div>
      <Input aria-label="Buscar usuário" placeholder="Buscar por nome ou e-mail..." value={search}
        onChange={e => { setSearch(e.target.value);setPage(1); }} className="mb-4 w-full sm:max-w-sm"/>
      {listing.isPending && <p className="py-6 text-sm text-muted-foreground">Carregando usuários...</p>}
      {listing.isError && <p role="alert" className="py-5 text-sm text-red-600">{getApiErrorMessage(listing.error,"Não foi possível consultar usuários.")} <button className="underline" onClick={() => listing.refetch()}>Tentar novamente</button></p>}
      {listing.data && (!listing.data.items.length ? <p className="py-7 text-sm text-muted-foreground">Nenhum usuário encontrado.</p> : <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600"><tr>
              {["Usuário", "E-mail (imutável)", "Perfil", "Status", "Ações"].map(h => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}
            </tr></thead><tbody className="divide-y divide-slate-100">{listing.data.items.map(row => <tr key={row.id}>
              <td className="px-3 py-3 font-semibold text-slate-900">{row.name}{me?.id === row.id && <span className="ml-2 text-[10px] text-blue-600">(você)</span>}</td>
              <td className="px-3 py-3 text-slate-600">{row.email}</td>
              <td className="px-3 py-3 text-slate-700">{labelRole(row.role)}</td>
              <td className="px-3 py-3"><span className={"rounded-full px-2 py-1 text-[11px] font-medium " + (row.active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500")}>{row.active ? "Ativo" : "Inativo"}</span></td>
              <td className="px-3 py-3">{canManage && me?.id !== row.id ? <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5"/>Editar</Button>
                <Button size="sm" variant="destructive" onClick={() => { setDeleteUser(row);setDeleteConfirmation(""); }}><Trash2 className="h-3.5 w-3.5"/>Excluir</Button>
              </div> : <span className="text-xs text-muted-foreground">{me?.id === row.id ? "Meu perfil" : "Somente leitura"}</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">{listing.data.items.map(row => <div key={row.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0">
            <p className="break-words text-sm font-bold text-slate-900">{row.name} {me?.id === row.id && <span className="text-xs font-normal text-blue-600">(você)</span>}</p>
            <p className="mt-0.5 break-all text-xs text-slate-500">{row.email}</p>
          </div><span className={"shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold " + (row.active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600")}>{row.active ? "Ativo" : "Inativo"}</span></div>
          <p className="mt-2 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>{labelRole(row.role)}</p>
          {canManage && me?.id !== row.id && <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil className="h-4 w-4"/>Editar</Button>
            <Button size="sm" variant="destructive" onClick={() => { setDeleteUser(row);setDeleteConfirmation(""); }}><Trash2 className="h-4 w-4"/>Excluir</Button>
          </div>}
        </div>)}</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <span className="text-xs text-muted-foreground">Página {page} de {Math.max(1,listing.data.meta.totalPages)}</span>
          <Pagination page={page} totalPages={Math.max(1,listing.data.meta.totalPages)} onPageChange={setPage}/>
        </div>
      </>)}
    </Card>
    <Dialog open={createOpen} onOpenChange={v => { if (!create.isPending) setCreateOpen(v); }}>
      <DialogHeader><DialogTitle>Novo usuário</DialogTitle><DialogDescription>O e-mail informado no cadastro não poderá ser alterado posteriormente.</DialogDescription></DialogHeader>
      <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault();create.mutate(); }}>
        <div className="space-y-2"><Label htmlFor="new-user-name">Nome completo</Label><Input id="new-user-name" required minLength={2} maxLength={255} value={createForm.name} onChange={e => setCreateForm(old=>({...old,name:e.target.value}))}/></div>
        <div className="space-y-2"><Label htmlFor="new-user-email">E-mail</Label><Input id="new-user-email" type="email" required maxLength={255} autoComplete="off" value={createForm.email} onChange={e => setCreateForm(old=>({...old,email:e.target.value}))}/></div>
        <div className="space-y-2"><Label htmlFor="new-user-password">Senha inicial</Label><Input id="new-user-password" type="password" required minLength={6} maxLength={128} autoComplete="new-password" value={createForm.password} onChange={e=>setCreateForm(old=>({...old,password:e.target.value}))}/></div>
        <div className="space-y-2"><Label htmlFor="new-user-role">Perfil</Label><Select id="new-user-role" value={createForm.role} onValueChange={role=>setCreateForm(old=>({...old,role}))}>{roles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</Select></div>
        <DialogFooter><Button variant="outline" onClick={()=>setCreateOpen(false)} disabled={create.isPending}>Cancelar</Button><Button type="submit" disabled={create.isPending}>{create.isPending?"Criando...":"Criar usuário"}</Button></DialogFooter>
      </form>
    </Dialog>
    <Dialog open={!!editUser} onOpenChange={v => { if(!v && !update.isPending)setEditUser(null); }}>
      <DialogHeader><DialogTitle>Editar usuário</DialogTitle><DialogDescription>O nome, perfil e situação podem ser alterados. O e-mail permanece imutável.</DialogDescription></DialogHeader>
      <form className="mt-4 space-y-4" onSubmit={submitEdit}>
        <div className="space-y-2"><Label htmlFor="edit-user-email">E-mail de acesso (não editável)</Label><Input id="edit-user-email" disabled readOnly value={editUser?.email??""}/></div>
        <div className="space-y-2"><Label htmlFor="edit-user-name">Nome completo</Label><Input id="edit-user-name" required minLength={2} maxLength={255} value={edit.name} onChange={e=>setEdit(v=>({...v,name:e.target.value}))}/></div>
        <div className="space-y-2"><Label htmlFor="edit-user-role">Perfil</Label><Select id="edit-user-role" value={edit.role} onValueChange={role=>setEdit(v=>({...v,role}))}>{roles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</Select></div>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={edit.active} onChange={e=>setEdit(v=>({...v,active:e.target.checked}))} className="h-4 w-4 accent-blue-600"/>Conta ativa</label>
        <DialogFooter><Button variant="outline" onClick={()=>setEditUser(null)} disabled={update.isPending}>Cancelar</Button><Button type="submit" disabled={update.isPending || edit.name.trim().length<2}>{update.isPending?"Salvando...":"Salvar alterações"}</Button></DialogFooter>
      </form>
    </Dialog>
    <Dialog open={!!deleteUser} onOpenChange={v => { if(!v && !remove.isPending)setDeleteUser(null); }}>
      <DialogHeader><DialogTitle>Excluir conta</DialogTitle><DialogDescription>O usuário perderá acesso imediatamente. Empréstimos, pagamentos e registros de auditoria serão preservados.</DialogDescription></DialogHeader>
      <div className="mt-4 space-y-4">
        <p className="break-words text-sm text-slate-800">Excluir <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?</p>
        <div className="space-y-2"><Label htmlFor="delete-user-confirm">Digite EXCLUIR para confirmar</Label><Input id="delete-user-confirm" autoComplete="off" value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)}/></div>
        <DialogFooter><Button variant="outline" onClick={()=>setDeleteUser(null)} disabled={remove.isPending}>Cancelar</Button>
          <Button variant="destructive" disabled={remove.isPending || deleteConfirmation !== "EXCLUIR"} onClick={()=>remove.mutate()}>{remove.isPending?"Excluindo...":"Confirmar exclusão"}</Button></DialogFooter>
      </div>
    </Dialog>
  </div>;
}
