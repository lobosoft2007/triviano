import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { empresaQueryOptions } from "@/lib/empresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth_/update-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Clube 23" },
      { name: "description", content: "Defina uma nova senha para sua conta." },
    ],
  }),
  component: UpdatePasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, { message: "A senha precisa ter ao menos 8 caracteres" }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

function UpdatePasswordPage() {
  const navigate = useNavigate();
  const { data: empresa } = useQuery(empresaQueryOptions);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    // The recovery link opens a temporary session; wait for it to hydrate.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setSubmitting(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("pwned") || msg.includes("leaked") || msg.includes("weak")) {
        toast.error("Senha muito fraca ou vazada. Escolha outra.");
      } else {
        toast.error("Não foi possível redefinir a senha. Solicite um novo link.");
      }
      return;
    }
    toast.success("Senha redefinida com sucesso!");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <Link
          to="/auth"
          className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Entrar
        </Link>

        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">Nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {empresa?.nome_fantasia ?? "Clube 23"}
          </p>
        </div>

        {!ready ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : hasSession ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mín. 8 caracteres"
                autoComplete="new-password"
                className="h-12 rounded-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita a senha"
                autoComplete="new-password"
                className="h-12 rounded-xl"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="mt-2 h-12 rounded-2xl" disabled={submitting}>
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Redefinir senha"}
            </Button>
          </form>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
            <p>
              Link inválido ou expirado. Volte para a tela de acesso e solicite
              um novo link de redefinição.
            </p>
            <Button asChild variant="secondary" className="mt-4 rounded-xl">
              <Link to="/auth">Voltar ao acesso</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
