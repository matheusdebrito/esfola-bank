import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockKeyhole, Mail, ShieldCheck, UserRound, Eye, EyeOff } from "lucide-react";

const roleNames: Record<string, string> = { ADMIN: "Administrador", MANAGER: "Gerente", OPERATOR: "Operador", AUDITOR: "Auditor" };

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmation: "" });
  const currentName = name ?? user?.name ?? "";

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = currentName.trim();
    if (clean.length < 2 || clean.length > 255) return;
    setSavingName(true);
    try {
      await api.patch("/api/v1/users/me", { name: clean });
      queryClient.setQueryData(["auth", "me"], (old: typeof user) => old ? { ...old, name: clean } : old);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setName(null);
      toast({ title: "Nome atualizado com sucesso" });
    } catch (err) {
      toast({ title: "Não foi possível atualizar", description: getApiErrorMessage(err, "Tente novamente."), variant: "destructive" });
    } finally { setSavingName(false); }
  }
  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.newPassword !== password.confirmation) {
      toast({ title: "As novas senhas não coincidem", variant: "destructive" });
      return;
    }
    if (password.newPassword.length < 6 || password.newPassword.length > 128 || !password.currentPassword) return;
    setSavingPassword(true);
    try {
      await api.post("/api/v1/users/me/password", { currentPassword: password.currentPassword, newPassword: password.newPassword });
      setPassword({ currentPassword: "", newPassword: "", confirmation: "" });
      // Reautenticação exigida após troca: tokens de atualização já foram revogados no backend.
      await api.post("/api/v1/auth/logout");
      queryClient.clear();
      toast({ title: "Senha alterada. Entre novamente com sua nova senha." });
      navigate("/login", { replace: true });
    } catch (err) {
      toast({ title: "Não foi possível alterar a senha", description: getApiErrorMessage(err, "Confira a senha atual."), variant: "destructive" });
    } finally { setSavingPassword(false); }
  }

  if (isLoading) return <p className="p-5 text-sm text-muted-foreground">Carregando perfil...</p>;
  if (!user) return <p className="p-5 text-sm text-muted-foreground">Faça login para editar seu perfil.</p>;

  return <div className="mx-auto max-w-3xl space-y-5 pb-8">
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[.16em] text-primary">Minha conta</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Meu perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">Atualize seus dados pessoais e proteja sua conta.</p>
    </div>
    <Card className="flex items-center gap-4 border border-slate-200 p-5 shadow-sm">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-700">{user.name.charAt(0).toUpperCase()}</span>
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-slate-900">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"><ShieldCheck className="h-3.5 w-3.5"/> {roleNames[user.role] ?? user.role}</p>
      </div>
    </Card>
    <Card className="space-y-5 border border-slate-200 p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <UserRound className="h-5 w-5 text-blue-600" />
        <div><h2 className="font-semibold text-slate-900">Informações pessoais</h2><p className="text-xs text-muted-foreground">Seu nome aparece nos registros da aplicação.</p></div>
      </div>
      <form onSubmit={updateName} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Nome completo</Label>
          <Input id="profile-name" required minLength={2} maxLength={255} value={currentName} onChange={e => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">E-mail de acesso</Label>
          <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input id="profile-email" className="pl-10" type="email" value={user.email} disabled readOnly /></div>
          <p className="text-xs text-muted-foreground">O e-mail é permanente e não pode ser alterado.</p>
        </div>
        <div className="flex justify-end"><Button type="submit" disabled={savingName || currentName.trim() === user.name || currentName.trim().length < 2}>{savingName ? "Salvando..." : "Salvar nome"}</Button></div>
      </form>
    </Card>
    <Card className="space-y-5 border border-slate-200 p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <LockKeyhole className="h-5 w-5 text-blue-600"/>
        <div><h2 className="font-semibold text-slate-900">Alterar senha</h2><p className="text-xs text-muted-foreground">Informe sua senha atual para confirmar a alteração.</p></div>
      </div>
      <form onSubmit={updatePassword} className="space-y-4">
        {[
          { key: "currentPassword" as const, label: "Senha atual", autoComplete: "current-password" },
          { key: "newPassword" as const, label: "Nova senha", autoComplete: "new-password" },
          { key: "confirmation" as const, label: "Confirmar nova senha", autoComplete: "new-password" },
        ].map(field => <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          <div className="relative">
            <Input id={field.key} required type={showPasswords ? "text" : "password"} minLength={field.key === "currentPassword" ? 1 : 6}
              maxLength={128} autoComplete={field.autoComplete} className="pr-11" value={password[field.key]}
              onChange={e => setPassword(old => ({ ...old, [field.key]: e.target.value }))} />
            <button type="button" onClick={() => setShowPasswords(v => !v)} aria-label={showPasswords ? "Ocultar senhas" : "Mostrar senhas"} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
              {showPasswords ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
            </button>
          </div>
        </div>)}
        <p className="text-xs text-muted-foreground">A nova senha deve ter de 6 a 128 caracteres. Você precisará entrar novamente após alterá-la.</p>
        <div className="flex justify-end"><Button type="submit" disabled={savingPassword || !password.currentPassword || password.newPassword.length < 6 || password.newPassword !== password.confirmation}>{savingPassword ? "Alterando..." : "Atualizar senha"}</Button></div>
      </form>
    </Card>
  </div>;
}
