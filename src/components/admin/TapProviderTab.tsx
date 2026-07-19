import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Nfc, CheckCircle2, Rocket, FlaskConical, Save, PowerOff, HelpCircle, QrCode, CreditCard, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  listTapProviderConfigs,
  saveTapProviderConfig,
  disableTapProvider,
  type TapAmbiente,
  type TapProvider,
} from "@/lib/tapProvider";

type FormState = {
  provider: TapProvider;
  ambiente: TapAmbiente;
  ativo: boolean;
  // Mercado Pago
  mp_access_token: string;
  mp_user_id: string;
  mp_store_id: string;
  mp_pos_id: string;
  mp_application_id: string;
  // PagBank
  pb_client_id: string;
  pb_client_secret: string;
  pb_token_aplicacao: string;
  pb_codigo_ativacao: string;
};

const EMPTY: FormState = {
  provider: "mercadopago",
  ambiente: "sandbox",
  ativo: false,
  mp_access_token: "",
  mp_user_id: "",
  mp_store_id: "",
  mp_pos_id: "",
  mp_application_id: "",
  pb_client_id: "",
  pb_client_secret: "",
  pb_token_aplicacao: "",
  pb_codigo_ativacao: "",
};

/**
 * Aba "Tap on Phone" — escolha do provedor (Mercado Pago | PagBank),
 * ambiente e credenciais que o app garçom Tap vai usar. As credenciais
 * ficam isoladas por empresa via RLS e nunca chegam ao app garçom em
 * texto puro (apenas o RPC `get_my_tap_provider`, sem segredo).
 */
export function TapProviderTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["tap-provider-config"],
    queryFn: listTapProviderConfigs,
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Sempre que trocarmos o provedor no dropdown, refletimos os valores
  // já salvos daquele provedor (se existirem).
  useEffect(() => {
    if (!data) return;
    const cur = data.find((c) => c.provider === form.provider);
    if (!cur) {
      setForm((f) => ({
        ...EMPTY,
        provider: f.provider,
        ambiente: "sandbox",
        ativo: false,
      }));
      return;
    }
    const creds = (cur.credentials ?? {}) as Record<string, string>;
    setForm({
      provider: cur.provider,
      ambiente: cur.ambiente,
      ativo: cur.ativo,
      mp_access_token: creds.access_token ?? "",
      mp_user_id: creds.user_id ?? "",
      mp_store_id: creds.store_id ?? "",
      mp_pos_id: creds.pos_id ?? "",
      mp_application_id: creds.application_id ?? "",
      pb_client_id: creds.client_id ?? "",
      pb_client_secret: creds.client_secret ?? "",
      pb_token_aplicacao: creds.token_aplicacao ?? "",
      pb_codigo_ativacao: creds.codigo_ativacao ?? "",
    });
    // Só reagimos à mudança do provedor ou à chegada de novos dados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.provider, data]);

  const currentActive = data?.find((c) => c.ativo);

  async function handleSave() {
    setSaving(true);
    try {
      const credentials: Record<string, string> =
        form.provider === "mercadopago"
          ? {
              access_token: form.mp_access_token.trim(),
              user_id: form.mp_user_id.trim(),
              store_id: form.mp_store_id.trim(),
              pos_id: form.mp_pos_id.trim(),
              application_id: form.mp_application_id.trim(),
            }
          : {
              client_id: form.pb_client_id.trim(),
              client_secret: form.pb_client_secret.trim(),
              token_aplicacao: form.pb_token_aplicacao.trim(),
              codigo_ativacao: form.pb_codigo_ativacao.trim(),
            };

      // Validação mínima para não gravar linha ativa sem credencial.
      if (form.ativo) {
        const filled = Object.values(credentials).some((v) => v.length > 0);
        if (!filled) {
          toast.error("Preencha ao menos uma credencial antes de ativar.");
          setSaving(false);
          return;
        }
      }

      await saveTapProviderConfig({
        provider: form.provider,
        ambiente: form.ambiente,
        credentials,
        ativo: form.ativo,
      });
      await qc.invalidateQueries({ queryKey: ["tap-provider-config"] });
      toast.success("Configuração Tap salva!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableAll() {
    if (!confirm("Desativar o Tap on Phone para esta empresa?")) return;
    try {
      await disableTapProvider();
      await qc.invalidateQueries({ queryKey: ["tap-provider-config"] });
      toast.success("Tap on Phone desativado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desativar.");
    }
  }

  return (
    <section className="w-full space-y-5">
      <header>
        <div className="flex items-center gap-2">
          <Nfc className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">
            Tap on Phone (App Garçom)
          </h2>
          <PagBankHelpDialog />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o provedor que o app garçom Tap usará para cobrar por
          aproximação (crédito/débito no NFC do celular) e para gerar QR-Code
          PIX dinâmico. As credenciais são isoladas por empresa e nunca são
          expostas ao app garçom em texto puro.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Status atual */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            {currentActive ? (
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold">
                  Ativo:{" "}
                  {currentActive.provider === "mercadopago"
                    ? "Mercado Pago Point Tap"
                    : "PagBank Tap to Pay"}
                </span>
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  {currentActive.ambiente === "prod" ? (
                    <>
                      <Rocket className="h-3 w-3" /> Produção
                    </>
                  ) : (
                    <>
                      <FlaskConical className="h-3 w-3" /> Sandbox
                    </>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive"
                  onClick={handleDisableAll}
                >
                  <PowerOff className="mr-1 h-4 w-4" /> Desativar
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum provedor Tap ativo. O app garçom Tap ficará em modo
                simulador até uma configuração ser ativada.
              </p>
            )}
          </div>

          {/* Formulário */}
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Provedor</Label>
                <select
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value as TapProvider })
                  }
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="mercadopago">Mercado Pago (Point Tap)</option>
                  <option value="pagbank">PagBank (Tap to Pay)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <select
                  value={form.ambiente}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ambiente: e.target.value as TapAmbiente,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="sandbox">Sandbox (testes)</option>
                  <option value="prod">Produção (dinheiro real)</option>
                </select>
              </div>
            </div>

            {form.provider === "mercadopago" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="mp_at">Access Token</Label>
                  <Input
                    id="mp_at"
                    type="password"
                    value={form.mp_access_token}
                    onChange={(e) =>
                      setForm({ ...form, mp_access_token: e.target.value })
                    }
                    placeholder="APP_USR-..."
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mp_uid">User ID</Label>
                    <Input
                      id="mp_uid"
                      value={form.mp_user_id}
                      onChange={(e) =>
                        setForm({ ...form, mp_user_id: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mp_app">Application ID</Label>
                    <Input
                      id="mp_app"
                      value={form.mp_application_id}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          mp_application_id: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mp_store">Store ID</Label>
                    <Input
                      id="mp_store"
                      value={form.mp_store_id}
                      onChange={(e) =>
                        setForm({ ...form, mp_store_id: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mp_pos">POS ID</Label>
                    <Input
                      id="mp_pos"
                      value={form.mp_pos_id}
                      onChange={(e) =>
                        setForm({ ...form, mp_pos_id: e.target.value })
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cadastre uma aplicação em{" "}
                  <span className="font-mono">developers.mercadopago.com</span>{" "}
                  → Suas integrações → Point/Tap on Phone.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Só o <span className="font-mono">Token do Aplicativo</span> é obrigatório
                  </div>
                  Sem <b>Código de Ativação</b> o Tap funciona apenas em modo{" "}
                  <b>PIX (QR Code dinâmico)</b>. Para cobrar cartão por aproximação,
                  peça as credenciais <b>PlugPag Tap to Pay</b> ao comercial do PagBank.
                  Toque em <HelpCircle className="inline h-3 w-3 -mt-0.5" /> no topo para o guia completo.
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pb_tok">
                      Token do Aplicativo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="pb_tok"
                      type="password"
                      value={form.pb_token_aplicacao}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          pb_token_aplicacao: e.target.value,
                        })
                      }
                      placeholder="Bearer ... (do portal do desenvolvedor)"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Token de sandbox/produção da API REST PagBank Connect.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pb_cod">
                      Código de Ativação{" "}
                      <span className="text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="pb_cod"
                      value={form.pb_codigo_ativacao}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          pb_codigo_ativacao: e.target.value,
                        })
                      }
                      placeholder="Enviado pelo comercial PagBank"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Necessário só para cartão por aproximação (PlugPag).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pb_cid">
                      Client ID <span className="text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="pb_cid"
                      value={form.pb_client_id}
                      onChange={(e) =>
                        setForm({ ...form, pb_client_id: e.target.value })
                      }
                      placeholder="OAuth — deixe em branco se não usa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pb_sec">
                      Client Secret{" "}
                      <span className="text-muted-foreground">(opcional)</span>
                    </Label>
                    <Input
                      id="pb_sec"
                      type="password"
                      value={form.pb_client_secret}
                      onChange={(e) =>
                        setForm({ ...form, pb_client_secret: e.target.value })
                      }
                      placeholder="OAuth — deixe em branco se não usa"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cadastre em{" "}
                  <span className="font-mono">dev.pagbank.uol.com.br</span> →
                  PlugPag Tap to Pay. Não sabe onde acha cada campo? Toque em{" "}
                  <HelpCircle className="inline h-3 w-3" /> no topo desta seção.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <Label className="cursor-pointer">
                  Ativar este provedor no app garçom
                </Label>
                <p className="text-xs text-muted-foreground">
                  Apenas um provedor pode estar ativo por vez. Salvar como
                  ativo desativa qualquer outro Tap desta empresa.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                Salvar configuração
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function PagBankHelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary"
          aria-label="Ajuda sobre as credenciais PagBank"
          title="Como preencher as credenciais PagBank"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Como preencher as credenciais do PagBank
          </DialogTitle>
          <DialogDescription>
            O PagBank tem <b>dois "mundos"</b> diferentes de API. O portal do
            desenvolvedor entrega credenciais só de um deles — o outro
            (cartão por aproximação) vem por contrato comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <section className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <QrCode className="h-4 w-4 text-primary" />
              Mundo 1 — PagBank Connect (API REST) → PIX
            </h3>
            <p className="text-muted-foreground">
              É o que você já tem se recebeu <b>e-mail + token</b> em{" "}
              <span className="font-mono">dev.pagbank.uol.com.br</span>. Serve
              para gerar cobranças PIX dinâmicas (QR Code), consultar e
              estornar. É o mínimo pra o Tap funcionar.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <CreditCard className="h-4 w-4 text-primary" />
              Mundo 2 — PlugPag Tap to Pay → Cartão por aproximação
            </h3>
            <p className="text-muted-foreground">
              É o SDK nativo do PagBank que faz o celular do garçom virar
              maquininha NFC. As credenciais <b>não</b> saem do portal do dev:
              o comercial do PagBank envia por e-mail após o credenciamento
              do CNPJ.
            </p>
          </section>

          <section>
            <h3 className="mb-2 font-semibold">O que cada campo significa</h3>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 font-semibold">Campo</th>
                    <th className="p-2 font-semibold">De onde vem</th>
                    <th className="p-2 font-semibold">Pra que serve</th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-t [&>tr]:border-border">
                  <tr>
                    <td className="p-2 font-mono">Token do Aplicativo *</td>
                    <td className="p-2 text-muted-foreground">
                      Portal do desenvolvedor PagBank (token de sandbox ou
                      produção). <b>Se o portal já entregou com o prefixo</b>{" "}
                      <span className="font-mono">Bearer</span>, cole aqui
                      completo (ex: <span className="font-mono">Bearer abc123...</span>).
                      Se entregou só o token cru, acrescente você mesmo{" "}
                      <span className="font-mono">Bearer </span> na frente.
                    </td>
                    <td className="p-2 text-muted-foreground">
                      Chamar a API REST — <b>PIX dinâmico</b>, consultar
                      status, estornar.
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">Código de Ativação</td>
                    <td className="p-2 text-muted-foreground">
                      Comercial PagBank (junto do credenciamento do CNPJ).
                    </td>
                    <td className="p-2 text-muted-foreground">
                      Ativar <b>PlugPag Tap to Pay</b> no aparelho — cartão
                      por aproximação.
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono">Client ID / Client Secret</td>
                    <td className="p-2 text-muted-foreground">
                      Portal → <i>Minhas aplicações</i> → <b>Criar aplicação</b>{" "}
                      (OAuth). Só existem depois de criar a aplicação.
                    </td>
                    <td className="p-2 text-muted-foreground">
                      OAuth de terceiros — deixe em branco se você usa a
                      própria conta.
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="border-t border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
                * único campo realmente obrigatório
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <h3 className="mb-2 font-semibold text-emerald-700 dark:text-emerald-400">
              Recomendação prática
            </h3>
            <ol className="ml-5 list-decimal space-y-1 text-muted-foreground">
              <li>
                <b>Agora:</b> cole apenas o <span className="font-mono">Token do Aplicativo</span>{" "}
                (sandbox) e salve. Isso já libera cobrança PIX no Tap.
              </li>
              <li>
                <b>Cartão NFC:</b> abra chamado comercial no PagBank pedindo
                credenciais <b>PlugPag Tap to Pay</b>. Quando chegarem, cole em{" "}
                <span className="font-mono">Código de Ativação</span>.
              </li>
              <li>
                <b>Quer testar cartão hoje?</b> Use <b>Mercado Pago (Point Tap)</b>
                — o sandbox libera tudo direto no portal, sem espera comercial.
              </li>
            </ol>
          </section>

          <section className="rounded-xl border border-border p-4">
            <h3 className="mb-2 font-semibold">Segurança</h3>
            <p className="text-muted-foreground">
              As credenciais ficam isoladas por empresa (RLS) e o app garçom
              nunca as recebe em texto puro. As chamadas de cobrança/estorno
              passam pelos endpoints do Triviano, que assinam a requisição
              com o token do seu tenant.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
