import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getAdapter } from "@/lib/fiscal/adapters";
import type {
  DestinatarioFiscal,
  EmitenteFiscal,
  EnderecoFiscal,
  FiscalAmbiente,
  ItemNotaFiscal,
  RequisicaoEmissao,
  RequisicaoManifestacao,
  RespostaEmissao,
  TipoDocumentoFiscal,
} from "@/lib/fiscal/types";

function createAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

function parseAmbiente(v: string | null | undefined): FiscalAmbiente {
  return v === "producao" ? "producao" : "homologacao";
}

async function loadEmpresa(supabase: ReturnType<typeof createAdminClient>, empresaId: string) {
  const { data, error } = await supabase
    .from("empresas")
    .select(
      "id, nome_fantasia, cnpj, inscricao_estadual, regime_tributario, logradouro, numero, complemento, bairro, cidade, estado, cep",
    )
    .eq("id", empresaId)
    .single();
  if (error || !data) throw new Error(`Empresa não encontrada: ${error?.message}`);
  return data;
}

async function loadConfigFiscal(
  supabase: ReturnType<typeof createAdminClient>,
  empresaId: string,
) {
  const { data, error } = await supabase
    .from("config_fiscal")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(
      `Configuração fiscal não encontrada para a empresa. Cadastre-a em /caixa?tab=fiscal`,
    );
  }
  return data;
}


async function loadOrder(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, user_id, total, delivery_address, phone, status_pedido, empresa_id",
    )
    .eq("id", orderId)
    .single();
  if (error || !data) throw new Error(`Pedido não encontrado: ${error?.message}`);
  return data;
}

async function loadOrderItems(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
) {
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "id, product_id, product_name, unit_price, quantity, size, second_flavor, addons, remocoes",
    )
    .eq("order_id", orderId);
  if (error) throw new Error(`Erro ao carregar itens: ${error.message}`);
  return data ?? [];
}

async function loadProducts(
  supabase: ReturnType<typeof createAdminClient>,
  productIds: string[],
) {
  if (productIds.length === 0) return new Map<string, Record<string, unknown>>();
  const { data, error } = await supabase
    .from("products")
    .select("id, ncm, ean, cfop, csosn, cst_icms, origem_icms")
    .in("id", productIds);
  if (error) throw new Error(`Erro ao carregar produtos: ${error.message}`);
  const map = new Map<string, Record<string, unknown>>();
  for (const p of data ?? []) {
    if (p.id) map.set(p.id, p);
  }
  return map;
}

async function loadProfile(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, logradouro, numero, complemento, bairro, municipio, estado, cep",
    )
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

function buildEnderecoEmpresa(empresa: Awaited<ReturnType<typeof loadEmpresa>>): EnderecoFiscal {
  return {
    logradouro: empresa.logradouro || "",
    numero: empresa.numero || "",
    complemento: empresa.complemento || undefined,
    bairro: empresa.bairro || "",
    cidade: empresa.cidade || "",
    estado: empresa.estado || "",
    cep: empresa.cep || "",
  };
}

function buildEmitente(empresa: Awaited<ReturnType<typeof loadEmpresa>>): EmitenteFiscal {
  return {
    cnpj: empresa.cnpj || "",
    inscricao_estadual: empresa.inscricao_estadual || undefined,
    razao_social: empresa.nome_fantasia || "",
    nome_fantasia: empresa.nome_fantasia || "",
    endereco: buildEnderecoEmpresa(empresa),
    regime_tributario:
      (empresa.regime_tributario as EmitenteFiscal["regime_tributario"]) ||
      "simples_nacional",
  };
}

function buildDestinatario(
  order: Awaited<ReturnType<typeof loadOrder>>,
  profile: Awaited<ReturnType<typeof loadProfile>> | null,
): DestinatarioFiscal | undefined {
  const nome = profile?.full_name || "Consumidor";

  const endereco: EnderecoFiscal | undefined = profile
    ? {
        logradouro: profile.logradouro || "",
        numero: profile.numero || "",
        complemento: profile.complemento || undefined,
        bairro: profile.bairro || "",
        cidade: profile.municipio || "",
        estado: profile.estado || "",
        cep: profile.cep || "",
      }
    : undefined;

  return {
    nome,
    endereco,
  };
}

function buildItens(
  orderItems: Awaited<ReturnType<typeof loadOrderItems>>,
  productMap: Map<string, Record<string, unknown>>,
): ItemNotaFiscal[] {
  return orderItems.map((item) => {
    const product = item.product_id ? productMap.get(item.product_id) : null;
    const qtd = Number(item.quantity ?? 1);
    const unit = Number(item.unit_price ?? 0);
    const descricao = [item.product_name, item.size, item.second_flavor]
      .filter(Boolean)
      .join(" / ");
    return {
      produto_id: item.product_id || undefined,
      descricao,
      ncm: (product?.ncm as string) || undefined,
      ean: (product?.ean as string) || undefined,
      cfop: (product?.cfop as string) || undefined,
      quantidade: qtd,
      valor_unitario: unit,
      valor_total: Number((qtd * unit).toFixed(2)),
      csosn: (product?.csosn as string) || undefined,
      cst_icms: (product?.cst_icms as string) || undefined,
      origem_icms: (product?.origem_icms as string) || "0",
    };
  });
}

export async function isEmissaoAtiva(empresaId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("config_fiscal")
    .select("ativo")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return Boolean(data?.ativo);
}

export async function emitirNotaFiscalPorPedido(
  empresaId: string,
  orderId: string,
  tipo: TipoDocumentoFiscal,
): Promise<RespostaEmissao> {
  const supabase = createAdminClient();

  const [empresa, config, order] = await Promise.all([
    loadEmpresa(supabase, empresaId),
    loadConfigFiscal(supabase, empresaId),
    loadOrder(supabase, orderId),
  ]);

  if (!config.ativo) {
    console.log(
      `[fiscal] Emissão desativada para empresa ${empresaId}; pedido ${orderId} não gerou nota.`,
    );
    return {
      sucesso: true,
      status: "pendente",
      mensagem: "Emissão fiscal desativada pela empresa",
    };
  }

  if (order.empresa_id && order.empresa_id !== empresaId) {
    throw new Error("Pedido não pertence à empresa informada.");
  }


  const [orderItems, profile] = await Promise.all([
    loadOrderItems(supabase, orderId),
    order.user_id ? loadProfile(supabase, order.user_id) : null,
  ]);

  const productIds = orderItems
    .map((i) => i.product_id)
    .filter((id): id is string => Boolean(id));
  const productMap = await loadProducts(supabase, productIds);

  const isNfce = tipo === "NFCE";
  const serie = isNfce ? config.serie_nfce : config.serie_nfe;
  const numero = isNfce ? config.numero_nfce_proximo : config.numero_nfe_proximo;
  const ambiente = parseAmbiente(config.ambiente);

  const req: RequisicaoEmissao = {
    empresa_id: empresaId,
    pedido_id: orderId,
    tipo,
    emitente: buildEmitente(empresa),
    destinatario: buildDestinatario(order, profile),
    itens: buildItens(orderItems, productMap),
    valor_total: Number(order.total ?? 0),
    serie,
    numero,
    ambiente,
  };

  const adapter = getAdapter(config.provider as "tecnospeed", config.credenciais as Record<string, string>);
  const res = isNfce
    ? await adapter.emitirNFCe(req)
    : await adapter.emitirNFe(req);

  // Persistir resultado
  const { data: nota, error: insertError } = await supabase
    .from("notas_fiscais")
    .insert({
      empresa_id: empresaId,
      pedido_id: orderId,
      tipo,
      chave_acesso: res.chave_acesso,
      numero: res.numero || String(numero),
      serie: res.serie || serie,
      status: res.status,
      xml_envio: res.xml_envio,
      xml_autorizacao: res.xml_autorizacao,
      pdf_url: res.pdf_url,
      valor_total: req.valor_total,
      data_emissao: new Date().toISOString(),
      protocolo: res.protocolo,
      mensagem_retorno: res.mensagem,
      ambiente: config.ambiente,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[fiscal] Falha ao persistir nota fiscal:", insertError);
  } else if (nota) {
    const itens = req.itens.map((item) => ({
      nota_fiscal_id: nota.id,
      produto_id: item.produto_id,
      descricao: item.descricao,
      ncm: item.ncm,
      cfop: item.cfop,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
      csosn: item.csosn,
      cst_icms: item.cst_icms,
      origem_icms: item.origem_icms,
    }));
    const { error: itensError } = await supabase
      .from("notas_fiscais_itens")
      .insert(itens);
    if (itensError) {
      console.error("[fiscal] Falha ao persistir itens da nota:", itensError);
    }
  }

  // Incrementar contador apenas se autorizada
  if (res.sucesso && res.status === "autorizada") {
    if (isNfce) {
      await supabase
        .from("config_fiscal")
        .update({ numero_nfce_proximo: numero + 1 })
        .eq("id", config.id);
    } else {
      await supabase
        .from("config_fiscal")
        .update({ numero_nfe_proximo: numero + 1 })
        .eq("id", config.id);
    }
  }

  return res;
}

export async function consultarDFe(
  empresaId: string,
  cnpj: string,
  ultimoNsu?: string,
) {
  const supabase = createAdminClient();
  const config = await loadConfigFiscal(supabase, empresaId);
  const adapter = getAdapter(config.provider as "tecnospeed", config.credenciais as Record<string, string>);
  return adapter.consultarDFe({ empresa_id: empresaId, cnpj, ultimo_nsu: ultimoNsu });
}

export async function manifestarNFe(
  empresaId: string,
  chaveAcesso: string,
  tipoEvento: RequisicaoManifestacao["tipo_evento"],
  justificativa?: string,
) {
  const supabase = createAdminClient();
  const config = await loadConfigFiscal(supabase, empresaId);
  const adapter = getAdapter(config.provider as "tecnospeed", config.credenciais as Record<string, string>);
  return adapter.manifestarNFe({
    empresa_id: empresaId,
    chave_acesso: chaveAcesso,
    tipo_evento: tipoEvento,
    justificativa,
  });
}

// ============================================================
// Sincronização com o provedor (PlugNotas): empresa + certificado
// e utilitários de sandbox
// ============================================================

import { TecnospeedAdapter } from "@/lib/fiscal/adapters/tecnospeed";

function getTecnospeedAdapter(config: Awaited<ReturnType<typeof loadConfigFiscal>>) {
  return new TecnospeedAdapter(
    (config.credenciais as Record<string, string>) || {},
  );
}

function decodeSenhaB64(v: string | null | undefined): string {
  if (!v) return "";
  try {
    return Buffer.from(v, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

export async function pingProvedor(empresaId: string) {
  const supabase = createAdminClient();
  const config = await loadConfigFiscal(supabase, empresaId);
  if (config.provider !== "tecnospeed") {
    return { ok: false, status: 0, latency_ms: 0, mensagem: "Provedor sem ping implementado." };
  }
  const adapter = getTecnospeedAdapter(config);
  const r = await adapter.ping();
  return { ok: r.ok, status: r.status, latency_ms: r.latency_ms };
}

export async function sincronizarEmpresaFiscal(empresaId: string) {
  const supabase = createAdminClient();
  const [empresa, config] = await Promise.all([
    loadEmpresa(supabase, empresaId),
    loadConfigFiscal(supabase, empresaId),
  ]);

  if (config.provider !== "tecnospeed") {
    throw new Error("Sincronização disponível apenas para o provedor Tecnospeed/PlugNotas.");
  }
  if (!empresa.cnpj) throw new Error("CNPJ da empresa não cadastrado.");

  const adapter = getTecnospeedAdapter(config);
  const payload = {
    cpfCnpj: empresa.cnpj.replace(/\D/g, ""),
    inscricaoEstadual: empresa.inscricao_estadual || undefined,
    razaoSocial: empresa.nome_fantasia,
    nomeFantasia: empresa.nome_fantasia,
    regimeTributario:
      empresa.regime_tributario === "simples_nacional" ? 1 : 3,
    endereco: {
      logradouro: empresa.logradouro || "",
      numero: empresa.numero || "",
      complemento: empresa.complemento || undefined,
      bairro: empresa.bairro || "",
      municipio: empresa.cidade || "",
      uf: empresa.estado || "",
      cep: (empresa.cep || "").replace(/\D/g, ""),
    },
    nfce: {
      ativo: true,
      config: {
        producaoIntegracao: false,
      },
    },
  };

  const r = await adapter.sincronizarEmpresa(payload);
  if (r.sucesso) {
    await supabase
      .from("config_fiscal")
      .update({ emitente_sincronizado_em: new Date().toISOString() })
      .eq("id", config.id);
  }
  return r;
}

export async function sincronizarCertificadoFiscal(empresaId: string) {
  const supabase = createAdminClient();
  const [empresa, config] = await Promise.all([
    loadEmpresa(supabase, empresaId),
    loadConfigFiscal(supabase, empresaId),
  ]);

  if (config.provider !== "tecnospeed") {
    throw new Error("Sincronização de certificado disponível apenas para Tecnospeed/PlugNotas.");
  }
  if (!empresa.cnpj) throw new Error("CNPJ da empresa não cadastrado.");
  if (!config.certificado_a1_path) throw new Error("Envie o certificado A1 (.pfx) primeiro.");
  const senha = decodeSenhaB64(config.certificado_a1_senha_criptografada);
  if (!senha) throw new Error("Informe a senha do certificado A1 e salve antes de sincronizar.");

  // Baixa o .pfx do bucket privado
  const { data: file, error: dlErr } = await supabase
    .storage
    .from("certificados-fiscais")
    .download(config.certificado_a1_path);
  if (dlErr || !file) {
    throw new Error(`Falha ao baixar certificado: ${dlErr?.message || "arquivo não encontrado"}`);
  }

  const adapter = getTecnospeedAdapter(config);
  const r = await adapter.sincronizarCertificado({
    cnpj: empresa.cnpj.replace(/\D/g, ""),
    pfx: file,
    senha,
    filename: config.certificado_a1_nome || "certificado.pfx",
  });

  if (r.sucesso) {
    await supabase
      .from("config_fiscal")
      .update({
        certificado_provider_id: r.id || null,
        certificado_sincronizado_em: new Date().toISOString(),
      })
      .eq("id", config.id);
  }
  return r;
}

export async function emitirNFCeTeste(empresaId: string): Promise<RespostaEmissao> {
  const supabase = createAdminClient();
  const [empresa, config] = await Promise.all([
    loadEmpresa(supabase, empresaId),
    loadConfigFiscal(supabase, empresaId),
  ]);

  if (config.ambiente !== "homologacao") {
    throw new Error(
      "Emissão de teste só é permitida com ambiente em 'homologacao'.",
    );
  }
  if (config.provider !== "tecnospeed") {
    throw new Error("Emissão de teste disponível apenas para Tecnospeed/PlugNotas.");
  }

  const numero = config.numero_nfce_proximo;
  const serie = config.serie_nfce;

  const req: RequisicaoEmissao = {
    empresa_id: empresaId,
    pedido_id: `TESTE-${Date.now()}`,
    tipo: "NFCE",
    emitente: buildEmitente(empresa),
    destinatario: undefined,
    itens: [
      {
        descricao: "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO",
        ncm: "22021000",
        cfop: "5102",
        quantidade: 1,
        valor_unitario: 0.01,
        valor_total: 0.01,
        csosn: "102",
        origem_icms: "0",
      },
    ],
    valor_total: 0.01,
    serie,
    numero,
    ambiente: "homologacao",
  };

  const adapter = getTecnospeedAdapter(config);
  const res = await adapter.emitirNFCe(req);

  await supabase.from("notas_fiscais").insert({
    empresa_id: empresaId,
    pedido_id: null,
    tipo: "NFCE",
    chave_acesso: res.chave_acesso,
    numero: res.numero || String(numero),
    serie: res.serie || serie,
    status: res.status,
    xml_envio: res.xml_envio,
    xml_autorizacao: res.xml_autorizacao,
    pdf_url: res.pdf_url,
    valor_total: 0.01,
    data_emissao: new Date().toISOString(),
    protocolo: res.protocolo,
    mensagem_retorno: res.mensagem || "Emissão de teste (sandbox)",
    ambiente: "homologacao",
  });

  if (res.sucesso && res.status === "autorizada") {
    await supabase
      .from("config_fiscal")
      .update({ numero_nfce_proximo: numero + 1 })
      .eq("id", config.id);
  }

  return res;
}
