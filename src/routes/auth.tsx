import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Clube 23" },
      {
        name: "description",
        content: "Entre ou crie sua conta para pedir no Clube 23.",
      },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  password: z.string().min(6, { message: "A senha precisa ter ao menos 6 caracteres" }),
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, { message: "Informe seu nome" }).max(100),
  phone: z.string().trim().min(8, { message: "Informe um telefone válido" }).max(20),
  address: z.string().trim().min(5, { message: "Informe o endereço de entrega" }).max(300),
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  password: z.string().min(6, { message: "A senha precisa ter ao menos 6 caracteres" }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/menu", replace: true });
    }
  }, [user, loading, navigate]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível entrar. Verifique e-mail e senha.");
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/menu", replace: true });
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      full_name: form.get("full_name"),
      phone: form.get("phone"),
      address: form.get("address"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          address: parsed.data.address,
        },
      },
    });
    setSubmitting(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        toast.error("Este e-mail já está cadastrado. Tente entrar.");
      } else if (msg.includes("password") || msg.includes("pwned") || msg.includes("leaked")) {
        toast.error("Senha muito fraca ou vazada. Escolha uma senha mais segura.");
      } else {
        toast.error("Não foi possível criar a conta.");
      }
      return;
    }
    toast.success("Conta criada com sucesso!");
    navigate({ to: "/menu", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <Link
          to="/"
          className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Início
        </Link>

        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Clube 23"
            width={128}
            height={128}
            className="h-32 w-32 rounded-2xl object-cover shadow-float ring-1 ring-border"
          />
          <h1 className="mt-4 font-display text-2xl font-bold">Clube 23</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre para fazer seu pedido
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
              <Field label="E-mail" name="email" type="email" placeholder="voce@email.com" autoComplete="email" />
              <Field label="Senha" name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
              <Button type="submit" size="lg" className="mt-2 h-12 rounded-2xl" disabled={submitting}>
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="mt-6 flex flex-col gap-4">
              <Field label="Nome completo" name="full_name" placeholder="Maria Silva" autoComplete="name" />
              <Field label="Telefone" name="phone" type="tel" placeholder="(11) 99999-9999" autoComplete="tel" />
              <Field label="Endereço de entrega" name="address" placeholder="Rua, número, bairro" autoComplete="street-address" />
              <Field label="E-mail" name="email" type="email" placeholder="voce@email.com" autoComplete="email" />
              <Field label="Senha" name="password" type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
              <Button type="submit" size="lg" className="mt-2 h-12 rounded-2xl" disabled={submitting}>
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-12 rounded-xl"
        required
      />
    </div>
  );
}
