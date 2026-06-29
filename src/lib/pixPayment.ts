/**
 * Geração de PIX "Copia e Cola" (BR Code) seguindo o padrão EMV®Co
 * regulamentado pelo Banco Central do Brasil (Bacen).
 *
 * Toda a string é montada localmente (offline) a partir da chave PIX,
 * nome do recebedor, cidade e valor exato. O checksum CRC16/CCITT-FALSE
 * é calculado ao final para que o código seja válido em qualquer
 * aplicativo bancário.
 *
 * ──────────────────────────────────────────────────────────────────────
 * NOTA DE PRODUÇÃO (FUTURA API DE BAIXA AUTOMÁTICA):
 * Nesta fase o BR Code é estático/local. Para a fase de produção, esta
 * geração deve ser substituída por uma chamada de API (fetch/POST) ao
 * endpoint do Banco ou gateway de pagamento (ex.: PSP/PIX Cob), que
 * retornará a string oficial do BR Code + o QR Code e um identificador
 * de cobrança (txid). Esse mesmo gateway dispara um WEBHOOK de
 * confirmação de pagamento em tempo real, permitindo a baixa automática
 * do pedido sem conferência manual de comprovante.
 * ──────────────────────────────────────────────────────────────────────
 */

export interface PixPayloadParams {
  /** Chave PIX do recebedor (telefone, e-mail, CPF/CNPJ ou aleatória). */
  pixKey: string;
  /** Nome do recebedor (máx. 25 caracteres no BR Code). */
  merchantName: string;
  /** Cidade do recebedor (máx. 15 caracteres no BR Code). */
  merchantCity: string;
  /** Valor exato da transação (em reais). */
  amount: number;
  /** Identificador da transação (txid). Default "***" (não informado). */
  txid?: string;
}

/** Monta um campo EMV no formato ID + tamanho(2 dígitos) + valor. */
function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/**
 * Remove acentos e caracteres não-ASCII e força maiúsculas, mantendo o
 * BR Code compatível com a tabela de caracteres aceita pelos bancos.
 */
function sanitizeText(text: string, maxLength: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, "") // remove símbolos
    .toUpperCase()
    .trim()
    .slice(0, maxLength);
}

/**
 * CRC16/CCITT-FALSE — polinômio 0x1021, valor inicial 0xFFFF.
 * É calculado sobre toda a string já contendo "6304".
 */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Gera a string completa do PIX Copia e Cola (BR Code) com checksum.
 */
export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txid = "***",
}: PixPayloadParams): string {
  // ID 26 — Merchant Account Information (arranjo PIX)
  const merchantAccountInfo =
    emvField("00", "br.gov.bcb.pix") + emvField("01", pixKey);

  // ID 62 — Additional Data Field Template (txid / Reference Label)
  const additionalData = emvField("05", txid || "***");

  const payloadWithoutCrc =
    emvField("00", "01") + // Payload Format Indicator
    emvField("01", "12") + // Point of Initiation Method (12 = uso único)
    emvField("26", merchantAccountInfo) + // Merchant Account Information
    emvField("52", "0000") + // Merchant Category Code
    emvField("53", "986") + // Moeda (986 = BRL)
    emvField("54", amount.toFixed(2)) + // Valor exato (2 casas)
    emvField("58", "BR") + // País
    emvField("59", sanitizeText(merchantName, 25)) + // Nome do recebedor
    emvField("60", sanitizeText(merchantCity, 15)) + // Cidade do recebedor
    emvField("62", additionalData) + // Dados adicionais (txid)
    "6304"; // ID + tamanho do CRC (calculado a seguir)

  return payloadWithoutCrc + crc16(payloadWithoutCrc);
}
