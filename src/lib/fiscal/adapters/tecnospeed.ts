import type {
  FiscalAdapter,
  FiscalProvider,
  RequisicaoEmissao,
  RespostaEmissao,
  RequisicaoConsultaDFe,
  DocumentoDFe,
  RequisicaoManifestacao,
} from "@/lib/fiscal/types";

/**
 * Adapter para o PlugNotas (produto REST da Tecnospeed / plugnotas.com.br).
 *
 * - Auth: header `x-api-key`.
 * - Sandbox: https://api.sandbox.plugnotas.com.br
 * - Produção: https://api.plugnotas.com.br
 *
 * Referências: https://dev.plugnotas.com.br/docs
 */

export interface TecnospeedCredentials {
  base_url?: string;
  api_key?: string;
  bearer_token?: string; // legado — não usado pelo PlugNotas
}

const SANDBOX_URL = "https://api.sandbox.plugnotas.com.br";
const PROD_URL = "https://api.plugnotas.com.br";

function baseUrl(cred: TecnospeedCredentials): string {
  return (cred.base_url || SANDBOX_URL).replace(/\/$/, "");
}

function authHeaders(cred: TecnospeedCredentials): Record<string, string> {
  const key = cred.api_key || cred.bearer_token || "";
  const h: Record<string, string> = {
    Accept: "application/json",
  };
  if (key) h["x-api-key"] = key;
  return h;
}

function jsonHeaders(cred: TecnospeedCredentials): Record<string, string> {
  return { ...authHeaders(cred), "Content-Type": "application/json" };
}

function mapStatus(status?: string): RespostaEmissao["status"] {
  if (!status) return "pendente";
  const s = String(status).toUpperCase();
  if (s.includes("AUTORIZAD")) return "autorizada";
  if (s.includes("CANCEL")) return "cancelada";
  if (s.includes("DENEGAD")) return "denegada";
  if (s.includes("CONTINGENC")) return "contingencia";
  if (s.includes("REJEIT") || s.includes("ERRO")) return "erro";
  if (s.includes("PROCESS") || s.includes("PENDENT") || s.includes("ENVIAD"))
    return "pendente";
  return "pendente";
}

function extractError(status: number, body: unknown): string {
  if (!body || typeof body !== "object") return `HTTP ${status}`;
  const b = body as Record<string, unknown>;
  const errs = (b.error ?? b.errors ?? b.message) as unknown;
  if (Array.isArray(errs)) {
    return errs
      .map((e) => {
        if (typeof e === "string") return e;
        if (e && typeof e === "object") {
          const o = e as Record<string, unknown>;
          return [o.campo, o.mensagem ?? o.message].filter(Boolean).join(": ");
        }
        return String(e);
      })
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof errs === "string") return errs;
  return `HTTP ${status}`;
}

function resolveCredentials(
  provided?: TecnospeedCredentials,
): TecnospeedCredentials {
  if (provided && (provided.base_url || provided.api_key || provided.bearer_token)) {
    return provided;
  }
  const raw = process.env.TECNOSPEED_CREDENTIALS;
  if (raw) {
    try {
      return JSON.parse(raw) as TecnospeedCredentials;
    } catch {
      // ignore
    }
  }
  return {
    base_url: process.env.TECNOSPEED_BASE_URL,
    api_key: process.env.TECNOSPEED_API_KEY,
    bearer_token: process.env.TECNOSPEED_BEARER_TOKEN,
  };
}

export class TecnospeedAdapter implements FiscalAdapter {
  readonly name: FiscalProvider = "tecnospeed";
  private cred: TecnospeedCredentials;

  constructor(cred?: TecnospeedCredentials) {
    this.cred = resolveCredentials(cred);
  }

  // ---------------- Ping / status ----------------

  async ping(): Promise<{ ok: boolean; status: number; latency_ms: number; body?: unknown }> {
    const t0 = Date.now();
    const res = await fetch(`${baseUrl(this.cred)}/status`, {
      method: "GET",
      headers: authHeaders(this.cred),
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    return {
      ok: res.ok,
      status: res.status,
      latency_ms: Date.now() - t0,
      body,
    };
  }

  // ---------------- Emitente ----------------

  async sincronizarEmpresa(payload: Record<string, unknown>): Promise<{
    sucesso: boolean;
    mensagem?: string;
    id?: string;
  }> {
    const url = `${baseUrl(this.cred)}/empresa`;
    // Estratégia: tenta PATCH (atualiza se já existe pelo CNPJ) e cai para POST.
    let res = await fetch(url, {
      method: "PATCH",
      headers: jsonHeaders(this.cred),
      body: JSON.stringify(payload),
    });
    if (res.status === 404 || res.status === 405) {
      res = await fetch(url, {
        method: "POST",
        headers: jsonHeaders(this.cred),
        body: JSON.stringify(payload),
      });
    }
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      console.error("[plugnotas] sincronizarEmpresa", res.status, body);
      return { sucesso: false, mensagem: extractError(res.status, body) };
    }
    const b = body as Record<string, unknown>;
    return { sucesso: true, id: (b.id as string) || (b.cnpj as string) };
  }

  // ---------------- Certificado A1 ----------------

  async sincronizarCertificado(input: {
    cnpj: string;
    pfx: Blob;
    senha: string;
    filename?: string;
  }): Promise<{ sucesso: boolean; mensagem?: string; id?: string }> {
    const url = `${baseUrl(this.cred)}/certificado`;
    const form = new FormData();
    form.append("cnpj", input.cnpj);
    form.append("senha", input.senha);
    form.append("arquivo", input.pfx, input.filename || "certificado.pfx");

    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(this.cred),
      body: form,
    });
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      console.error("[plugnotas] sincronizarCertificado", res.status, body);
      return { sucesso: false, mensagem: extractError(res.status, body) };
    }
    const b = body as Record<string, unknown>;
    return { sucesso: true, id: (b.id as string) || (b.cnpj as string) };
  }

  // ---------------- Emissão ----------------

  async emitirNFCe(req: RequisicaoEmissao): Promise<RespostaEmissao> {
    return this.emitirDocumento(req, "nfce");
  }

  async emitirNFe(req: RequisicaoEmissao): Promise<RespostaEmissao> {
    return this.emitirDocumento(req, "nfe");
  }

  private async emitirDocumento(
    req: RequisicaoEmissao,
    path: "nfce" | "nfe",
  ): Promise<RespostaEmissao> {
    const url = `${baseUrl(this.cred)}/${path}`;
    const body = this.buildPayload(req, path);

    const res = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(this.cred),
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      console.error(`[plugnotas] emitir ${path}`, res.status, data);
      return {
        sucesso: false,
        status: "erro",
        mensagem: extractError(res.status, data),
      };
    }

    // PlugNotas responde de forma assíncrona: retorna {protocolo, id} e depois
    // consulta-se por /{path}/consultar/{id}. Se já vier `status`, usamos direto.
    const id = (data.id as string) || (data.protocolo as string);
    const status = (data.status as string) || (data.situacao as string);

    let finalData: Record<string, unknown> = data;
    if (id && (!status || mapStatus(status) === "pendente")) {
      finalData = await this.consultarPorId(path, id).catch(() => data);
    }

    const chave =
      (finalData.chave as string) ||
      (finalData.chaveAcesso as string) ||
      (finalData.chave_acesso as string);
    const finalStatus = mapStatus(
      (finalData.status as string) || (finalData.situacao as string) || status,
    );

    return {
      sucesso: true,
      chave_acesso: chave,
      numero: String(finalData.numero ?? req.numero ?? ""),
      serie: String(finalData.serie ?? req.serie),
      status: finalStatus,
      protocolo:
        (finalData.protocolo as string) ||
        (finalData.numeroProtocolo as string) ||
        (finalData.nProt as string),
      xml_envio: (finalData.xml as string) || undefined,
      xml_autorizacao:
        (finalData.xmlAutorizacao as string) ||
        (finalData.xmlProtocolo as string) ||
        undefined,
      pdf_url: chave
        ? `${baseUrl(this.cred)}/${path}/pdf/${chave}`
        : undefined,
      mensagem:
        (finalData.mensagem as string) ||
        (finalData.motivo as string) ||
        (finalData.xMotivo as string),
    };
  }

  private async consultarPorId(
    path: "nfce" | "nfe",
    id: string,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${baseUrl(this.cred)}/${path}/consultar/${id}`, {
      method: "GET",
      headers: authHeaders(this.cred),
    });
    if (!res.ok) return {};
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private buildPayload(
    req: RequisicaoEmissao,
    path: "nfce" | "nfe",
  ): Record<string, unknown> {
    const ambiente = req.ambiente === "producao" ? 1 : 2; // PlugNotas: 1=prod, 2=homolog

    const emit = req.emitente;
    const enderecoEmit = emit.endereco;

    const payload: Record<string, unknown> = {
      idIntegracao: req.pedido_id || `pedido-${req.numero ?? Date.now()}`,
      enviarEmail: false,
      natureza: "VENDA DE MERCADORIA",
      serie: Number(req.serie) || 1,
      numero: req.numero,
      presenca: 1, // 1 = operação presencial (NFC-e balcão)
      ambiente,
      emitente: {
        cpfCnpj: emit.cnpj.replace(/\D/g, ""),
        inscricaoEstadual: emit.inscricao_estadual || undefined,
        razaoSocial: emit.razao_social,
        nomeFantasia: emit.nome_fantasia,
        regimeTributario:
          emit.regime_tributario === "simples_nacional" ? 1 :
          emit.regime_tributario === "lucro_presumido" ? 3 : 3,
        endereco: {
          logradouro: enderecoEmit.logradouro,
          numero: enderecoEmit.numero,
          complemento: enderecoEmit.complemento || undefined,
          bairro: enderecoEmit.bairro,
          municipio: enderecoEmit.cidade,
          uf: enderecoEmit.estado,
          cep: (enderecoEmit.cep || "").replace(/\D/g, ""),
        },
      },
      destinatario: req.destinatario
        ? {
            cpfCnpj:
              (req.destinatario.cpf || req.destinatario.cnpj || "").replace(
                /\D/g,
                "",
              ) || undefined,
            razaoSocial: req.destinatario.nome,
            endereco: req.destinatario.endereco
              ? {
                  logradouro: req.destinatario.endereco.logradouro,
                  numero: req.destinatario.endereco.numero,
                  bairro: req.destinatario.endereco.bairro,
                  municipio: req.destinatario.endereco.cidade,
                  uf: req.destinatario.endereco.estado,
                  cep: (req.destinatario.endereco.cep || "").replace(/\D/g, ""),
                }
              : undefined,
          }
        : undefined,
      itens: req.itens.map((item, idx) => ({
        numero: idx + 1,
        codigo: item.produto_id || `item-${idx + 1}`,
        descricao: item.descricao.slice(0, 120),
        ncm: item.ncm || "22021000",
        cfop: item.cfop || "5102",
        unidade: "UN",
        quantidade: Number(item.quantidade.toFixed(4)),
        valorUnitario: Number(item.valor_unitario.toFixed(4)),
        valorTotal: Number(item.valor_total.toFixed(2)),
        ean: item.ean || undefined,
        origem: Number(item.origem_icms ?? 0),
        impostos: {
          icms: {
            origem: Number(item.origem_icms ?? 0),
            csosn: item.csosn || "102",
            cst: item.cst_icms || undefined,
          },
          pis: { cst: "49" },
          cofins: { cst: "49" },
        },
      })),
      pagamentos: [
        {
          formaPagamento: 99, // outros — o Caixa injeta a real depois
          valor: Number(req.valor_total.toFixed(2)),
        },
      ],
      totais: {
        valorTotal: Number(req.valor_total.toFixed(2)),
      },
    };

    if (path === "nfe") {
      (payload as Record<string, unknown>).finalidade = 1;
      (payload as Record<string, unknown>).consumidorFinal = 1;
    }

    return payload;
  }

  // ---------------- DFe (documentos destinados) ----------------

  async consultarDFe(req: RequisicaoConsultaDFe): Promise<DocumentoDFe[]> {
    const url = new URL(`${baseUrl(this.cred)}/nfe/mde`);
    url.searchParams.set("cnpj", req.cnpj.replace(/\D/g, ""));
    if (req.ultimo_nsu) url.searchParams.set("nsu", req.ultimo_nsu);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: authHeaders(this.cred),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha ao consultar DFe [${res.status}]: ${text}`);
    }

    const data = (await res.json()) as {
      documentos?: Array<Record<string, unknown>>;
      data?: Array<Record<string, unknown>>;
    };
    const list = data.documentos || data.data || [];
    return list.map((doc) => ({
      chave_acesso: String(doc.chave || doc.chaveAcesso || doc.chave_acesso || ""),
      nsu: String(doc.nsu || ""),
      cnpj_emitente: String(doc.cnpjEmitente || doc.cnpj_emitente || ""),
      nome_emitente: String(doc.razaoSocial || doc.nome_emitente || ""),
      valor: Number(doc.valor || doc.valorTotal || 0),
      data_emissao: String(doc.dataEmissao || doc.data_emissao || ""),
      xml: String(doc.xml || ""),
    }));
  }

  async manifestarNFe(
    req: RequisicaoManifestacao,
  ): Promise<{ sucesso: boolean; mensagem?: string }> {
    const url = `${baseUrl(this.cred)}/nfe/manifestacao`;
    const tipoMap: Record<string, string> = {
      ciencia: "CIENCIA",
      confirmacao: "CONFIRMACAO",
      desconhecimento: "DESCONHECIMENTO",
      opnr: "NAO_REALIZADA",
    };

    const body = {
      chave: req.chave_acesso,
      tipo: tipoMap[req.tipo_evento] || req.tipo_evento,
      justificativa: req.justificativa,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(this.cred),
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      console.error("[plugnotas] manifestacao", res.status, data);
      return { sucesso: false, mensagem: extractError(res.status, data) };
    }
    const d = data as Record<string, unknown>;
    return { sucesso: true, mensagem: (d.mensagem as string) || (d.motivo as string) };
  }
}
