import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Lock,
  Save,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Gift,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchFullProfile,
  updateProfileAddress,
  fetchExtratoContaCorrente,
} from "@/lib/profile";
import {
  fetchExtratoCashback,
  abaterFiadoComCashback,
  cashbackLabel,
  isCashbackCredito,
} from "@/lib/cashback";
import { geocodeAddress } from "@/lib/cep";
import { formatBRL } from "@/lib/format";
import { AddressFields, type AddressState } from "@/components/AddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell, ShellHeader, ShellBody } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState<AddressState | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["full-profile", user?.id],
    queryFn: () => fetchFullProfile(user!.id),
    enabled: !!user,
  });

  const { data: extrato } = useQuery({
    queryKey: ["extrato-cc", user?.id],
    queryFn: () => fetchExtratoContaCorrente(user!.id),
    enabled: !!user,
  });

  const { data: extratoCashback } = useQuery({
    queryKey: ["extrato-cashback", user?.id],
    queryFn: () => fetchExtratoCashback(user!.id),
    enabled: !!user,
  });

  const [abating, setAbating] = useState(false);

  async function handleAbater() {
    if (!user) return;
    setAbating(true);
    try {
      const res = await abaterFiadoComCashback({ userId: user.id });
      toast.success(
        `${formatBRL(res.abatido)} de cashback usados. Novo saldo devedor: ${formatBRL(
          res.saldo_devedor,
        )}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["full-profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["extrato-cashback", user.id] });
      queryClient.invalidateQueries({ queryKey: ["extrato-cc", user.id] });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível abater o fiado.",
      );
    } finally {
      setAbating(false);
    }
  }

  useEffect(() => {
    if (profile && address === null) {
      setFullName(profile.full_name);

      setAddress({
        cep: profile.cep,
        tipo_logradouro: profile.tipo_logradouro,
        logradouro: profile.logradouro,
        numero: profile.numero,
        complemento: profile.complemento,
        bairro: profile.bairro,
        municipio: profile.municipio,
        estado: profile.estado,
        ddd: profile.ddd,
        telefone: profile.telefone,
      });
    }
  }, [profile, address]);

  async function handleSave() {
    if (!user || !address) return;
    if (!fullName.trim()) {
      toast.error("Informe seu nome.");
      return;
    }
    setSaving(true);
    try {
      const geo = await geocodeAddress({
        logradouro: address.logradouro,
        numero: address.numero,
        bairro: address.bairro,
        municipio: address.municipio,
        estado: address.estado,
        cep: address.cep,
      });
      await updateProfileAddress(user.id, {
        full_name: fullName.trim(),
        ...address,
        latitude: geo?.latitude ?? profile?.latitude ?? null,
        longitude: geo?.longitude ?? profile?.longitude ?? null,
      });
      toast.success("Dados atualizados com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["full-profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch {
      toast.error("Não foi possível salvar seus dados.");
    } finally {
      setSaving(false);
    }
  }

  const limiteDisponivel = profile
    ? Math.max(0, profile.limite_fiado - profile.saldo_devedor_fiado)
    : 0;

  return (
    <AppShell>
      <ShellHeader className="border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3.5 sm:px-6">
          <Link
            to="/"
            aria-label="Voltar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-lg font-bold">Meus Dados</h1>
        </div>
      </ShellHeader>

      <ShellBody>
        <main className="mx-auto max-w-2xl px-4 py-6 pb-16 sm:px-6">
        {isLoading || !address ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Conta corrente card (only for fiado-authorized customers) */}
            {profile?.fiado_autorizado && (
              <section className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-float">
                <div className="flex items-center gap-2 text-primary">
                  <Wallet className="h-5 w-5" />
                  <p className="text-xs font-semibold uppercase tracking-widest">
                    Conta Corrente
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo atual (devedor)</p>
                    <p className="mt-1 font-display text-2xl font-bold">
                      {formatBRL(profile.saldo_devedor_fiado)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Crédito disponível</p>
                    <p className="mt-1 font-display text-2xl font-bold text-primary">
                      {formatBRL(limiteDisponivel)}
                    </p>
                  </div>
                </div>
                {/* Gráfico minimalista de progresso do limite */}
                {(() => {
                  const limite = profile.limite_fiado || 0;
                  const usado = Math.min(
                    profile.saldo_devedor_fiado,
                    limite || profile.saldo_devedor_fiado,
                  );
                  const pct =
                    limite > 0
                      ? Math.min(100, Math.round((usado / limite) * 100))
                      : 0;
                  const alerta = pct >= 85;
                  return (
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Limite utilizado
                        </span>
                        <span
                          className={`font-semibold ${
                            alerta ? "text-destructive" : "text-primary"
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full transition-all ${
                            alerta ? "bg-destructive" : "bg-primary"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Limite total de crédito:{" "}
                        <span className="font-medium text-foreground">
                          {formatBRL(profile.limite_fiado)}
                        </span>
                      </p>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* Cashback card */}
            {profile && (profile.saldo_cashback > 0 || profile.fiado_autorizado) && (
              <section className="overflow-hidden rounded-2xl border border-secondary/40 bg-gradient-to-br from-secondary/15 via-card to-card p-5 shadow-float">
                <div className="flex items-center gap-2 text-secondary">
                  <Gift className="h-5 w-5" />
                  <p className="text-xs font-semibold uppercase tracking-widest">
                    Meu Cashback
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Saldo disponível</p>
                  <p className="mt-1 font-display text-3xl font-bold text-secondary">
                    {formatBRL(profile.saldo_cashback)}
                  </p>
                </div>

                {profile.fiado_autorizado &&
                  profile.saldo_cashback > 0 &&
                  profile.saldo_devedor_fiado > 0 && (
                    <div className="mt-4">
                      <Button
                        variant="success"
                        className="h-11 w-full rounded-xl font-semibold"
                        disabled={abating}
                        onClick={handleAbater}
                      >
                        {abating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Gift className="mr-2 h-4 w-4" />
                            Usar{" "}
                            {formatBRL(
                              Math.min(
                                profile.saldo_cashback,
                                profile.saldo_devedor_fiado,
                              ),
                            )}{" "}
                            para abater o fiado
                          </>
                        )}
                      </Button>
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        O valor é descontado do seu cashback e abate sua dívida
                        na hora, restabelecendo seu limite.
                      </p>
                    </div>
                  )}
              </section>
            )}

            {/* Extrato de cashback */}
            {extratoCashback && extratoCashback.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Extrato de cashback
                </h2>
                <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
                  {extratoCashback.map((row) => {
                    const credito = isCashbackCredito(row.tipo_movimentacao);
                    return (
                      <li key={row.id} className="flex items-center gap-3 p-4">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            credito
                              ? "bg-secondary/20 text-secondary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {credito ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {cashbackLabel(row.tipo_movimentacao)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(row.created_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <p
                          className={`shrink-0 text-sm font-semibold ${
                            credito ? "text-secondary" : "text-muted-foreground"
                          }`}
                        >
                          {credito ? "+" : "−"}
                          {formatBRL(row.valor)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {profile?.fiado_autorizado && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Extrato de movimentações
                </h2>
                {extrato && extrato.length > 0 ? (
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
                    {extrato.map((row) => {
                      const credito = row.tipo === "Credito";
                      return (
                        <li key={row.id} className="flex items-center gap-3 p-4">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              credito
                                ? "bg-primary/15 text-primary"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {credito ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{row.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(row.created_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <p
                            className={`shrink-0 text-sm font-semibold ${
                              credito ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {credito ? "+" : "−"}
                            {formatBRL(row.valor)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
                    Nenhuma movimentação registrada ainda.
                  </p>
                )}
              </section>
            )}

            {/* Dados pessoais */}
            <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Dados pessoais
              </h2>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  className="h-12 rounded-xl"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> E-mail
                </Label>
                <Input
                  id="email"
                  disabled
                  className="h-12 rounded-xl opacity-70"
                  value={user?.email ?? ""}
                />
                <p className="text-xs text-muted-foreground">
                  O e-mail não pode ser alterado. Para usar outro e-mail, crie
                  uma nova conta.
                </p>
              </div>
            </section>

            {/* Endereço */}
            <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Endereço e contato
              </h2>
              <AddressFields value={address} onChange={setAddress} />
            </section>

            <Button
              size="lg"
              className="h-12 rounded-2xl"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Salvar alterações
                </>
              )}
            </Button>
          </div>
        )}
        </main>
      </ShellBody>
    </AppShell>
  );
}
