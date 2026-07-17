export type FiscalProvider = "tecnospeed" | "acbr" | "nativo";

export type FiscalAmbiente = "homologacao" | "producao";

export type RegimeTributario =
  | "simples_nacional"
  | "lucro_presumido"
  | "lucro_real";

export type TipoDocumentoFiscal = "NFCE" | "NFE";

export type StatusNotaFiscal =
  | "pendente"
  | "autorizada"
  | "cancelada"
  | "denegada"
  | "contingencia"
  | "erro";

export type TipoEventoManifestacao =
  | "ciencia"
  | "confirmacao"
  | "desconhecimento"
  | "opnr";

export interface EnderecoFiscal {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface EmitenteFiscal {
  cnpj: string;
  inscricao_estadual?: string;
  razao_social: string;
  nome_fantasia: string;
  endereco: EnderecoFiscal;
  regime_tributario: RegimeTributario;
}

export interface DestinatarioFiscal {
  nome: string;
  cpf?: string;
  cnpj?: string;
  endereco?: EnderecoFiscal;
}

export interface ItemNotaFiscal {
  produto_id?: string;
  descricao: string;
  ncm?: string;
  ean?: string;
  cfop?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  csosn?: string;
  cst_icms?: string;
  origem_icms?: string;
}

export interface RequisicaoEmissao {
  empresa_id: string;
  pedido_id?: string;
  tipo: TipoDocumentoFiscal;
  emitente: EmitenteFiscal;
  destinatario?: DestinatarioFiscal;
  itens: ItemNotaFiscal[];
  valor_total: number;
  serie: string;
  numero?: number;
  ambiente: FiscalAmbiente;
}

export interface RespostaEmissao {
  sucesso: boolean;
  chave_acesso?: string;
  numero?: string;
  serie?: string;
  status: StatusNotaFiscal;
  protocolo?: string;
  xml_envio?: string;
  xml_autorizacao?: string;
  pdf_url?: string;
  mensagem?: string;
}

export interface RequisicaoConsultaDFe {
  empresa_id: string;
  cnpj: string;
  ultimo_nsu?: string;
}

export interface DocumentoDFe {
  chave_acesso: string;
  nsu?: string;
  cnpj_emitente?: string;
  nome_emitente?: string;
  valor?: number;
  data_emissao?: string;
  xml?: string;
}

export interface RequisicaoManifestacao {
  empresa_id: string;
  chave_acesso: string;
  tipo_evento: TipoEventoManifestacao;
  justificativa?: string;
}

export interface FiscalAdapter {
  readonly name: FiscalProvider;
  emitirNFCe(req: RequisicaoEmissao): Promise<RespostaEmissao>;
  emitirNFe(req: RequisicaoEmissao): Promise<RespostaEmissao>;
  consultarDFe(req: RequisicaoConsultaDFe): Promise<DocumentoDFe[]>;
  manifestarNFe(req: RequisicaoManifestacao): Promise<{
    sucesso: boolean;
    mensagem?: string;
  }>;
}
