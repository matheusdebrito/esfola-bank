import { useState } from "react";
import { api } from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/v1/auth/login", { email, password });
      navigate("/");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Erro ao fazer login";
      toast({ title: "Falha no login", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-4 py-8">
      <img
        src="/logo.webp"
        alt="Esfola Bank"
        className="h-40 w-auto max-h-[40vh] object-contain sm:h-52"
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="sr-only">Esfola Bank</CardTitle>
          <CardDescription>Entre com suas credenciais para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-xs text-center text-muted-foreground">
            Acesse com um usuário cadastrado pelo administrador.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
