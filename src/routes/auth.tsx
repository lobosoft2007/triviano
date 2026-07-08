import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { empresaQueryOptions, DEFAULT_EMPRESA_ID } from "@/lib/empresa";
import { AddressFields, emptyAddress, type AddressState } from "@/components/AddressFields";
import { geocodeAddress } from "@/lib/cep";
import { FOOD_PLACEHOLDER } from "@/lib/imageFallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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

const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, { message: "Informe seu nome" }).max(100),
    email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
    password: z.string().min(8, { message: "A senha precisa ter ao menos 8 caracteres" }),
    confirmPassword: z.string(),
    telefone: z.string().trim().min(8, { message: "Informe um telefone válido" }).max(20),
    logradouro: z.string().trim().min(1, { message: "Informe o endereço (use o CEP)" }),
    numero: z.string().trim().min(1, { message: "Informe o número" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

type Mode = "auth" | "otp" | "forgot";

const isCheckoutNeutralZone = () => typeof window !== "undefined" && window.location.pathname === "/checkout";

const isAdminUser = (user: ReturnType<typeof useAuth>["user"]) => {
  if (!user) return false;
  const directRole = (user as { role?: string }).role;
  const metadataRole = (user.app_metadata as { role?: string } | undefined)?.role;
  return directRole === "admin" || metadataRole === "admin";
};

const clearCorruptedAuthStorageForCheckout = (error: unknown) => {
  const maybeError = error as { message?: string; status?: number; code?: string } | null;
  const message = String(maybeError?.message ?? error ?? "").toLowerCase();
  const isRefreshToken400 =
    maybeError?.status === 400 && (message.includes("refresh_token") || message.includes("refresh token"));

  if (!isRefreshToken400 || !isCheckoutNeutralZone()) return false;

  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") || key.includes("supabase") || key.includes("auth-token"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore storage errors */
  }

  console.warn("Sessão corrompida limpa no checkout; prosseguindo como anônimo.");
  return true;
};

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: empresa } = useQuery(empresaQueryOptions);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>("auth");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState("");

  // Signup form state
  const [signup, setSignup] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [address, setAddress] = useState<AddressState>(emptyAddress);

  type LandingPath = "/" | "/checkout" | "/caixa" | "/admin";

  const sanitizeLandingPath = (path: string | null): LandingPath | null => {
    if (!path) return null;
    if (path.includes("/admin")) return "/admin";
    if (path.includes("/caixa")) return "/caixa";
    if (path.includes("/checkout")) return "/checkout";
    if (path === "/" || path.includes("/menu") || path.includes("/cardapio")) return "/";
    return null;
  };

  const readSavedLanding = (): LandingPath | null => {
    try {
      const saved = sessionStorage.getItem("post_login_redirect");
      return sanitizeLandingPath(saved);
    } catch {
      /* ignore storage errors */
    }
    return null;
  };

  // Route context is the only post-login authority. Never send a customer or
  // admin to Caixa just because of their role; only a Caixa-origin login returns there.
  const resolveLanding = (): LandingPath => {
    const saved = readSavedLanding();
    if (saved) return saved;

    const currentPath = typeof window === "undefined" ? null : window.location.pathname;
    const current = sanitizeLandingPath(currentPath);
    if (current) return current;

    return "/";
  };

  const clearSavedLanding = () => {
    try {
      sessionStorage.removeItem("post_login_redirect");
    } catch {
      /* ignore storage errors */
    }
  };

  useEffect(() => {
    // 1. Prioridade Máxima: Se estamos no checkout, ABORTE qualquer lógica de redirecionamento.
    if (window.location.pathname.includes("/checkout")) {
      console.log("[AUTH] Zona neutra detectada: Redirecionamento abortado.");
      return;
    }

    if (loading) return;

    // 2. Se o usuário estiver logado, decida para onde ele deve ir
    if (user) {
      // Se for ADMIN, ele tem passe livre, não redirecione para a home
      if (isAdminUser(user)) {
        console.log("[AUTH] Admin detectado: Mantendo na rota atual.");
        return;
      }

      const to = resolveLanding();

      // 3. Só redirecione se o destino for diferente da página atual e não for checkout
      if (to && to !== window.location.pathname && to !== "/checkout") {
        clearSavedLanding();
        console.log("REDIRECIONAMENTO DISPARADO POR: src/routes/auth.tsx para:", to);
        navigate({ to, replace: true });
      }
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
      if (clearCorruptedAuthStorageForCheckout(error)) return;
      const msg = error.message.toLowerCase();
      if (msg.includes("not confirmed") || msg.includes("confirm")) {
        setPendingEmail(parsed.data.email);
        setMode("otp");
        toast.error("Confirme seu e-mail para entrar. Enviamos um código.");
        return;
      }
      toast.error("Não foi possível entrar. Verifique e-mail e senha.");
      return;
    }
    toast.success("Bem-vindo de volta!");
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({
      full_name: signup.full_name,
      email: signup.email,
      password: signup.password,
      confirmPassword: signup.confirmPassword,
      telefone: address.telefone,
      logradouro: address.logradouro,
      numero: address.numero,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);

    // Background geocoding so lat/long is persisted at signup time (via trigger).
    const geo = await geocodeAddress({
      logradouro: address.logradouro,
      numero: address.numero,
      bairro: address.bairro,
      municipio: address.municipio,
      estado: address.estado,
      cep: address.cep,
    });

    const composedAddress = [
      [address.tipo_logradouro, address.logradouro].filter(Boolean).join(" "),
      address.numero,
      address.bairro,
      address.municipio,
      address.estado,
    ]
      .filter(Boolean)
      .join(", ");
    const phone = [address.ddd, address.telefone].filter(Boolean).join(" ").trim();

    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.full_name,
          phone,
          address: composedAddress,
          empresa_id: empresa?.id ?? DEFAULT_EMPRESA_ID,
          tipo_logradouro: address.tipo_logradouro,
          logradouro: address.logradouro,
          numero: address.numero,
          complemento: address.complemento,
          bairro: address.bairro,
          municipio: address.municipio,
          estado: address.estado,
          cep: address.cep,
          ddd: address.ddd,
          telefone: address.telefone,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
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
    setPendingEmail(parsed.data.email);
    setOtp("");
    setMode("otp");
    toast.success("Enviamos um código de 6 dígitos para o seu e-mail.");
  }

  async function handleVerifyOtp(code: string) {
    setSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: code,
      type: "email",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Código inválido ou expirado. Verifique e tente novamente.");
      return;
    }
    toast.success("E-mail confirmado! Bem-vindo ao Clube 23.");
  }

  async function handleResend() {
    if (!pendingEmail) return;
    setSubmitting(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível reenviar agora. Aguarde alguns instantes.");
      return;
    }
    toast.success("Novo código enviado para o seu e-mail.");
  }

  async function handleForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar o link agora.");
      return;
    }
    toast.success("Enviamos um link de redefinição para o seu e-mail.");
    setMode("auth");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        {mode === "auth" ? (
          <Link
            to="/"
            className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Início
          </Link>
        ) : (
          <button
            onClick={() => setMode("auth")}
            className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        )}

        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={empresa?.logo_display_url || FOOD_PLACEHOLDER}
            alt={empresa?.nome_fantasia || "Logotipo"}
            className="h-auto w-full max-w-[200px] object-contain"
          />

          <h1 className="mt-4 font-display text-2xl font-bold">{empresa?.nome_fantasia ?? ""}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "otp"
              ? "Confirme seu e-mail"
              : mode === "forgot"
                ? "Recuperar acesso"
                : "Entre para fazer seu pedido"}
          </p>
        </div>

        {mode === "otp" && (
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                <MailCheck className="h-7 w-7" />
              </div>
              <p className="text-sm text-muted-foreground">
                Digite o código de 6 dígitos enviado para
                <br />
                <span className="font-semibold text-foreground">{pendingEmail}</span>
              </p>
            </div>
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(v) => {
                setOtp(v);
                if (v.length === 6) void handleVerifyOtp(v);
              }}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="h-12 w-11 rounded-xl text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button
              size="lg"
              className="h-12 w-full rounded-2xl"
              disabled={submitting || otp.length !== 6}
              onClick={() => void handleVerifyOtp(otp)}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar código"}
            </Button>
            <button
              onClick={() => void handleResend()}
              disabled={submitting}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Não recebeu? Reenviar código
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Informe seu e-mail e enviaremos um link seguro e temporário para você redefinir sua senha.
            </p>
            <Field label="E-mail" name="email" type="email" placeholder="voce@email.com" autoComplete="email" />
            <Button type="submit" size="lg" className="mt-2 h-12 rounded-2xl" disabled={submitting}>
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar link de redefinição"}
            </Button>
          </form>
        )}

        {mode === "auth" && (
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
                <Field label="E-mail" name="email" type="email" placeholder="voce@email.com" autoComplete="email" />
                <Field
                  label="Senha"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Esqueci minha senha
                </button>
                <Button type="submit" size="lg" className="mt-2 h-12 rounded-2xl" disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input
                    id="full_name"
                    placeholder="Maria Silva"
                    autoComplete="name"
                    className="h-12 rounded-xl"
                    value={signup.full_name}
                    onChange={(e) => setSignup((s) => ({ ...s, full_name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="signup_email">E-mail</Label>
                  <Input
                    id="signup_email"
                    type="email"
                    placeholder="voce@email.com"
                    autoComplete="email"
                    className="h-12 rounded-xl"
                    value={signup.email}
                    onChange={(e) => setSignup((s) => ({ ...s, email: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="signup_password">Senha</Label>
                    <Input
                      id="signup_password"
                      type="password"
                      placeholder="Mín. 8 caracteres"
                      autoComplete="new-password"
                      className="h-12 rounded-xl"
                      value={signup.password}
                      onChange={(e) => setSignup((s) => ({ ...s, password: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirm_password">Confirme a senha</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      className="h-12 rounded-xl"
                      value={signup.confirmPassword}
                      onChange={(e) => setSignup((s) => ({ ...s, confirmPassword: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="mt-2 border-t border-border/60 pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Endereço de entrega
                  </p>
                  <AddressFields value={address} onChange={setAddress} />
                </div>

                <Button type="submit" size="lg" className="mt-2 h-12 rounded-2xl" disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
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
