"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { SimpleTable } from "@/components/SimpleTable";

const ROLES = [
  { value: "OPERATOR", label: "Operador" },
  { value: "MANAGER", label: "Gerente" },
  { value: "AUDITOR", label: "Auditor" },
  { value: "ADMIN", label: "Administrador" },
];

const EMPTY_FORM = { name: "", email: "", password: "", role: "OPERATOR" };

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await api.get("/api/v1/users?page=1&pageSize=20");
      return res.data.data.items;
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: async () => api.post("/api/v1/users", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Usuário criado" });
    },
    onError: (err: any) =>
      toast({
        title: "Erro",
        description: err.response?.data?.message || "Não foi possível criar o usuário",
        variant: "destructive",
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Usuários</h2>
        <Button onClick={() => setOpen(true)}>Novo usuário</Button>
      </div>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : null}
      <Card>
        <CardHeader><CardTitle>Usuários internos</CardTitle></CardHeader>
        <CardContent>
          <SimpleTable
            columns={[
              { key: "name", label: "Nome" },
              { key: "email", label: "E-mail" },
              { key: "role", label: "Perfil", render: (v) => ROLES.find((r) => r.value === v)?.label ?? v },
              { key: "active", label: "Ativo", render: (v) => (v ? "Sim" : "Não") },
              { key: "createdAt", label: "Criado em", render: (v) => (v ? new Date(v).toLocaleString("pt-BR") : "") },
            ]}
            data={isLoading ? [] : data}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <Separator />
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="grid grid-cols-1 gap-4 p-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
