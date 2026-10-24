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
    <section className="relative hidden w-[48%] flex-col items-center justify-center overflow-hidden bg-[#101114] px-10 py-12 text-white lg:flex xl:px-16" aria-label="Esfola Bank">
      <div className="pointer-events-none absolute -right-36 -top-32 h-[440px] w-[440px] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-14 -top-10 h-[300px] w-[300px] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-48 -left-36 h-[520px] w-[520px] rounded-full bg-[#CDB78A]/10 blur-3xl" />
      <div className="relative flex w-full max-w-[420px] flex-col items-center justify-center gap-4 text-center">
        <img src="/favicon-corvo.svg" alt="Símbolo do corvo Esfola Bank" className="h-[240px] w-[240px] object-contain drop-shadow-[0_12px_35px_rgba(212,173,89,.2)]" />
        <div className="font-serif text-[clamp(3.5rem,6vw,5.5rem)] font-bold leading-none tracking-tight text-[#EBC77D]">ESFOLA</div>
        <div className="text-xl font-semibold tracking-[.55em] text-[#E5C582]">BANK</div>
      </div>
    </section>

    <main className="flex min-w-0 flex-1 flex-col items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-[425px]">
        <div className="mb-8 flex items-center justify-center gap-4 lg:hidden">
          <div className="flex h-[116px] w-[116px] shrink-0 items-center justify-center" aria-hidden="true">
            <img src="/favicon-corvo.svg" alt="" className="h-[105px] w-[105px] object-contain" />
          </div>
          <div><p className="text-base font-bold text-foreground">Esfola Bank</p><p className="text-xs text-muted-foreground">Gestão de empréstimos</p></div>
        </div>
        <div className="mb-8">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.15em] text-primary">Bem-vindo de volta</p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Entre na sua conta</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Informe suas credenciais para acessar sua operação.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-[#49463F] bg-[#191B1E] p-5 shadow-[0_20px_50px_rgba(0,0,0,.3)] sm:p-7">
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
            {loading ? "Autenticando…" : <>Entrar <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> Acesso exclusivo para usuários autorizados
        </div>
      </div>
    </main>
  </div>;
}
