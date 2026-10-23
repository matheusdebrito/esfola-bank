import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, ChartNoAxesCombined } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await api.post("/api/v1/auth/login", { email: email.trim(), password });
      queryClient.removeQueries({ queryKey: ["auth", "me"] });
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      toast({
        title: "Não foi possível entrar",
        description: error?.response?.data?.message ?? "Confira seu e-mail e sua senha.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return <div className="flex min-h-[100dvh] bg-background">
    <section className="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-[#13243C] px-10 py-12 text-white lg:flex xl:px-16" aria-label="Esfola Bank">
      <div className="pointer-events-none absolute -right-36 -top-32 h-[440px] w-[440px] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-14 -top-10 h-[300px] w-[300px] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-48 -left-36 h-[520px] w-[520px] rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-lg">
          <img src="/logo-nova.jpg" alt="" className="h-full w-full object-contain" />
        </div>
        <div>
          <p className="text-lg font-bold tracking-tight">Esfola Bank</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-[.17em] text-slate-400">Gestão de empréstimos</p>
        </div>
      </div>
      <div className="relative max-w-[560px] space-y-8">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-4 py-2 text-xs font-semibold text-blue-100">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sua operação sob controle
        </p>
        <h1 className="text-4xl font-semibold leading-[1.13] tracking-tight xl:text-5xl">
          Mais clareza.<br />
          <span className="text-blue-300">Melhores decisões.</span>
        </h1>
        <p className="max-w-[430px] text-base leading-relaxed text-slate-300">
          Organize empréstimos, acompanhe recebimentos e priorize cobranças em um único lugar.
        </p>
        <div className="grid gap-4 border-t border-white/15 pt-7 sm:grid-cols-2">
          <div className="flex items-start gap-3"><ChartNoAxesCombined className="mt-1 h-5 w-5 shrink-0 text-emerald-400" /><div><p className="text-sm font-semibold">Visão da carteira</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Indicadores claros para o dia a dia.</p></div></div>
          <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-400" /><div><p className="text-sm font-semibold">Operação organizada</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Acessos e registros de movimentações.</p></div></div>
        </div>
      </div>
      <p className="relative text-xs text-slate-500">Esfola Bank · Acesso restrito</p>
    </section>

    <main className="flex min-w-0 flex-1 flex-col items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-[425px]">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-sm">
            <img src="/logo-nova.jpg" alt="" className="h-full w-full object-contain" />
          </div>
          <div><p className="text-base font-bold text-foreground">Esfola Bank</p><p className="text-xs text-muted-foreground">Gestão de empréstimos</p></div>
        </div>
        <div className="mb-8">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.15em] text-primary">Bem-vindo de volta</p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Entre na sua conta</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Informe suas credenciais para acessar sua operação.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="username" placeholder="seu@email.com" value={email}
              onChange={event => setEmail(event.target.value)} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="current-password" placeholder="Sua senha"
              value={password} onChange={event => setPassword(event.target.value)} required disabled={loading} />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Autenticando…" : <>Entrar na plataforma <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> Acesso exclusivo para usuários autorizados
        </div>
      </div>
    </main>
  </div>;
}
