import type {
  FiscalAdapter,
  FiscalProvider,
  RequisicaoEmissao,
  RespostaEmissao,
  RequisicaoConsultaDFe,
  DocumentoDFe,
  RequisicaoManifestacao,
} from "@/lib/fiscal/types";

export interface TecnospeedCredentials {
  base_url?: string;
  api_key?: string;
  bearer_token?: string;
}

function getAuthHeaders(cred: TecnospeedCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (cred.bearer_token) {
    headers.Authorization = `Bearer ${cred.bearer_token}`;
  } else if (cred.api_key) {
    headers["X-API-Key"] = cred.api_key;
  }
  return headers;
}

function baseUrl(cred: TecnospeedCredentials): string {
  return (cred.base_url || "https://api.tecnospeed.com.br").replace(/\/$/, "");
}

function ambienteLabel(ambiente: string): string {
  return ambiente === "producao" ? "producao" : "homologacao";
}

function mapStatus(status?: string): RespostaEmissao["status"] {
  if (!status) return "pendente";
  const s = status.toLowerCase();
  if (s === "autorizada") return "autorizada";
  if (s === "cancelada") return "cancelada";
  if (s === "denegada") return "denegada";
  if (s === "contingencia") return "contingencia";
  return "erro";
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
      // fall through
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
      headers: getAuthHeaders(this.cred),
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // resposta não-JSON
    }

    if (!res.ok) {
      return {
        sucesso: false,
        status: "erro",
        mensagem: `Erro ${res.status}: ${text || res.statusText}`,
      };
    }

    return {
      sucesso: true,
      chave_acesso: (data.chave_acesso as string) || (data.chave as string),
      numero: String(data.numero ?? ""),
      serie: String(data.serie ?? req.serie),
      status: mapStatus(data.status as string),
      protocolo: (data.protocolo as string) || (data.numero_protocolo as string),
      xml_envio: (data.xml as string) || (data.xml_envio as string),
      xml_autorizacao:
        (data.xml_autorizacao as string) ||
        (data.xml_protocolo as string) ||
        (data.xml as string),
      pdf_url: (data.pdf as string) || (data.url_pdf as string),
      mensagem: (data.mensagem as string) || (data.mensagem_sefaz as string),
    };
  }

  private buildPayload(
    req: RequisicaoEmissao,
    path: "nfce" | "nfe",
  ): Record<string, unknown> {
    const ambiente = ambienteLabel(req.ambiente);
    const payload: Record<string, unknown> = {
      ambiente,
      serie: req.serie,
      numero: req.numero,
      emitente: {
        cnpj: req.emitente.cnpj,
        ie: req.emitente.inscricao_estadual || undefined,
        razaoSocial: req.emitente.razao_social,
        nomeFantasia: req.emitente.nome_fantasia,
        endereco: req.emitente.endereco,
      },
      destinatario: req.destinatario
        ? {
            nome: req.destinatario.nome,
            cpf: req.destinatario.cpf,
            cnpj: req.destinatario.cnpj,
            endereco: req.destinatario.endereco,
          }
        : undefined,
      itens: req.itens.map((item) => ({
        descricao: item.descricao,
        ncm: item.ncm,
        ean: item.ean,
        cfop: item.cfop,
        quantidade: item.quantidade,
        valorUnitario: item.valor_unitario,
        valorTotal: item.valor_total,
        csosn: item.csosn,
        cstIcms: item.cst_icms,
        origem: item.origem_icms,
      })),
      totais: {
        valorTotal: req.valor_total,
      },
    };

    if (path === "nfce") {
      // NFC-e normalmente não exige destinatário identificado para valores baixos
      // mas exige indicador de presença.
      payload.presenca = "1";
    }

    return payload;
  }

  async consultarDFe(req: RequisicaoConsultaDFe): Promise<DocumentoDFe[]> {
    const url = new URL(`${baseUrl(this.cred)}/dfe`);
    url.searchParams.set("cnpj", req.cnpj);
    if (req.ultimo_nsu) url.searchParams.set("ultimoNsu", req.ultimo_nsu);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthHeaders(this.cred),
    });

    if (!res.ok) {
      throw new Error(`Falha ao consultar DFe: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as {
      documentos?: Array<Record<string, unknown>>;
    };
    return (data.documentos || []).map((doc) => ({
      chave_acesso: String(doc.chave_acesso || doc.chave || ""),
      nsu: String(doc.nsu || ""),
      cnpj_emitente: String(doc.cnpj_emitente || doc.emitente || ""),
      nome_emitente: String(doc.nome_emitente || doc.nomeEmitente || ""),
      valor: Number(doc.valor || 0),
      data_emissao: String(doc.data_emissao || doc.dataEmissao || ""),
      xml: String(doc.xml || ""),
    }));
  }

  async manifestarNFe(
    req: RequisicaoManifestacao,
  ): Promise<{ sucesso: boolean; mensagem?: string }> {
    const url = `${baseUrl(this.cred)}/manifestacao`;

    const body = {
      chave_acesso: req.chave_acesso,
      tipo_evento: req.tipo_evento,
      justificativa: req.justificativa,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(this.cred),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        sucesso: false,
        mensagem: `Erro ${res.status}: ${text || res.statusText}`,
      };
    }

    const data = (await res.json()) as { mensagem?: string };
    return {
      sucesso: true,
      mensagem: data.mensagem,
    };
  }
}
