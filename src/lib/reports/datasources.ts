import type { ReportDataSource, FilterOp, AggregationFn } from "./spec";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "money" | "date" | "boolean";
  /** Filter operators allowed on this field. */
  ops: FilterOp[];
  /** Whether this field may appear in groupBy. */
  groupable?: boolean;
  /** Aggregations allowed when this field is a metric column. */
  aggs?: AggregationFn[];
}

export interface DataSourceDef {
  key: ReportDataSource;
  label: string;
  description: string;
  fields: FieldDef[];
}

const TEXT_OPS: FilterOp[] = ["eq", "neq", "in", "like", "is_null", "not_null"];
const NUM_OPS: FilterOp[] = ["eq", "neq", "gte", "lte", "between", "is_null", "not_null"];
const DATE_OPS: FilterOp[] = ["gte", "lte", "between", "is_null", "not_null"];
const BOOL_OPS: FilterOp[] = ["eq"];
const NUM_AGGS: AggregationFn[] = ["sum", "count", "avg", "min", "max"];

export const DATA_SOURCES_CATALOG: DataSourceDef[] = [
  {
    key: "clientes",
    label: "Clientes",
    description: "Cadastro de clientes: contato, endereço, cashback, fiado.",
    fields: [
      { key: "id", label: "ID", type: "text", ops: TEXT_OPS },
      { key: "nome", label: "Nome", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "telefone", label: "Telefone", type: "text", ops: TEXT_OPS },
      { key: "email", label: "E-mail", type: "text", ops: TEXT_OPS },
      { key: "cidade", label: "Cidade", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "bairro", label: "Bairro", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "estado", label: "UF", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "cashback", label: "Cashback (R$)", type: "money", ops: NUM_OPS, aggs: NUM_AGGS },
      { key: "saldo_devedor_fiado", label: "Saldo devedor fiado (R$)", type: "money", ops: NUM_OPS, aggs: NUM_AGGS },
      { key: "limite_fiado", label: "Limite fiado (R$)", type: "money", ops: NUM_OPS, aggs: NUM_AGGS },
      { key: "fiado_autorizado", label: "Fiado autorizado", type: "boolean", ops: BOOL_OPS, groupable: true },
      { key: "bloqueado", label: "Bloqueado", type: "boolean", ops: BOOL_OPS, groupable: true },
      { key: "created_at", label: "Cadastro", type: "date", ops: DATE_OPS, groupable: true },
    ],
  },
  {
    key: "vendas",
    label: "Vendas / Pedidos",
    description: "Pedidos (orders): total, canal, status, cidade/bairro de entrega, meio de pagamento agregado.",
    fields: [
      { key: "id", label: "Pedido", type: "text", ops: TEXT_OPS },
      { key: "created_at", label: "Data", type: "date", ops: DATE_OPS, groupable: true },
      { key: "canal", label: "Canal", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "status", label: "Status", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "tipo_atendimento", label: "Tipo de atendimento", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "total", label: "Total (R$)", type: "money", ops: NUM_OPS, aggs: NUM_AGGS },
      { key: "cidade_entrega", label: "Cidade (entrega)", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "bairro_entrega", label: "Bairro (entrega)", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "cliente_nome", label: "Cliente", type: "text", ops: TEXT_OPS, groupable: true },
    ],
  },
  {
    key: "produtos_estoque",
    label: "Produtos / Estoque",
    description: "Produtos do cardápio com estoque atual e custo. Sem giro histórico nesta fase.",
    fields: [
      { key: "id", label: "ID", type: "text", ops: TEXT_OPS },
      { key: "name", label: "Nome", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "category_id", label: "Categoria (ID)", type: "text", ops: TEXT_OPS, groupable: true },
      { key: "price", label: "Preço (R$)", type: "money", ops: NUM_OPS, aggs: NUM_AGGS },
      { key: "custo_compra", label: "Custo (R$)", type: "money", ops: NUM_OPS, aggs: NUM_AGGS },
      { key: "estoque_atual", label: "Estoque atual", type: "number", ops: NUM_OPS, aggs: NUM_AGGS },
      { key: "ativo", label: "Ativo", type: "boolean", ops: BOOL_OPS, groupable: true },
      { key: "esgotado", label: "Esgotado", type: "boolean", ops: BOOL_OPS, groupable: true },
      { key: "manipulado", label: "Manipulado", type: "boolean", ops: BOOL_OPS, groupable: true },
    ],
  },
];

export function getDataSource(key: ReportDataSource): DataSourceDef {
  const ds = DATA_SOURCES_CATALOG.find((d) => d.key === key);
  if (!ds) throw new Error(`Fonte de dados desconhecida: ${key}`);
  return ds;
}

export function getField(source: ReportDataSource, key: string): FieldDef {
  const ds = getDataSource(source);
  const f = ds.fields.find((x) => x.key === key);
  if (!f) throw new Error(`Campo "${key}" não existe na fonte "${source}".`);
  return f;
}
