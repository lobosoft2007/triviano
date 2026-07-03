export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ajustes_estoque: {
        Row: {
          ajuste_fino: number | null
          conciliado_at: string | null
          conciliado_by: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          insumo_id: string
          nf_referencia: string | null
          observacao: string | null
          quantidade: number
          quantidade_nf: number | null
          saldo_apos: number | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ajuste_fino?: number | null
          conciliado_at?: string | null
          conciliado_by?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          insumo_id: string
          nf_referencia?: string | null
          observacao?: string | null
          quantidade: number
          quantidade_nf?: number | null
          saldo_apos?: number | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ajuste_fino?: number | null
          conciliado_at?: string | null
          conciliado_by?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          insumo_id?: string
          nf_referencia?: string | null
          observacao?: string | null
          quantidade?: number
          quantidade_nf?: number | null
          saldo_apos?: number | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          allows_half: boolean
          combo_role: string
          cor_fonte: string
          created_at: string
          empresa_id: string
          id: string
          id_impressora_destino: string | null
          min_items: number
          name: string
          slug: string
          sort_order: number
          tamanho_fonte: string
        }
        Insert: {
          allows_half?: boolean
          combo_role?: string
          cor_fonte?: string
          created_at?: string
          empresa_id?: string
          id?: string
          id_impressora_destino?: string | null
          min_items?: number
          name: string
          slug: string
          sort_order?: number
          tamanho_fonte?: string
        }
        Update: {
          allows_half?: boolean
          combo_role?: string
          cor_fonte?: string
          created_at?: string
          empresa_id?: string
          id?: string
          id_impressora_destino?: string | null
          min_items?: number
          name?: string
          slug?: string
          sort_order?: number
          tamanho_fonte?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_id_impressora_destino_fkey"
            columns: ["id_impressora_destino"]
            isOneToOne: false
            referencedRelation: "config_impressoras"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_cashback: {
        Row: {
          cliente_id: string
          created_at: string
          empresa_id: string
          id: string
          saldo_acumulado: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          empresa_id?: string
          id?: string
          saldo_acumulado?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          saldo_acumulado?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_cashback_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_fiado: {
        Row: {
          ativo: boolean
          autorizado_fiado: boolean
          created_at: string
          empresa_id: string
          id: string
          limite_credito: number
          saldo_devedor_atual: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          autorizado_fiado?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          limite_credito?: number
          saldo_devedor_atual?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          autorizado_fiado?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          limite_credito?: number
          saldo_devedor_atual?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_fiado_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      composicao_subproduto: {
        Row: {
          created_at: string
          id: string
          insumo_id: string
          quantidade: number
          subproduto_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id: string
          quantidade?: number
          subproduto_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string
          quantidade?: number
          subproduto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "composicao_subproduto_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composicao_subproduto_subproduto_id_fkey"
            columns: ["subproduto_id"]
            isOneToOne: false
            referencedRelation: "subprodutos"
            referencedColumns: ["id"]
          },
        ]
      }
      config_impressoras: {
        Row: {
          ativo: boolean
          caminho_usb: string | null
          cor: string
          created_at: string
          endereco_ip: string | null
          id: string
          is_default: boolean
          nome: string
          porta: number | null
          tipo_conexao: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          caminho_usb?: string | null
          cor?: string
          created_at?: string
          endereco_ip?: string | null
          id?: string
          is_default?: boolean
          nome: string
          porta?: number | null
          tipo_conexao?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          caminho_usb?: string | null
          cor?: string
          created_at?: string
          endereco_ip?: string | null
          id?: string
          is_default?: boolean
          nome?: string
          porta?: number | null
          tipo_conexao?: string
          updated_at?: string
        }
        Relationships: []
      }
      config_pagamentos: {
        Row: {
          ambiente_emissao: Database["public"]["Enums"]["ambiente_emissao_tipo"]
          ativo: boolean
          certificado_a1_nome: string
          certificado_a1_path: string
          certificado_a1_senha_criptografada: string
          certificado_a1_validade: string | null
          chave_pix_padrao: string
          cidade_recebedor: string
          client_id: string
          client_secret: string
          created_at: string
          gateway_banco: string
          id: string
          nome_recebedor: string
          updated_at: string
        }
        Insert: {
          ambiente_emissao?: Database["public"]["Enums"]["ambiente_emissao_tipo"]
          ativo?: boolean
          certificado_a1_nome?: string
          certificado_a1_path?: string
          certificado_a1_senha_criptografada?: string
          certificado_a1_validade?: string | null
          chave_pix_padrao?: string
          cidade_recebedor?: string
          client_id?: string
          client_secret?: string
          created_at?: string
          gateway_banco?: string
          id?: string
          nome_recebedor?: string
          updated_at?: string
        }
        Update: {
          ambiente_emissao?: Database["public"]["Enums"]["ambiente_emissao_tipo"]
          ativo?: boolean
          certificado_a1_nome?: string
          certificado_a1_path?: string
          certificado_a1_senha_criptografada?: string
          certificado_a1_validade?: string | null
          chave_pix_padrao?: string
          cidade_recebedor?: string
          client_id?: string
          client_secret?: string
          created_at?: string
          gateway_banco?: string
          id?: string
          nome_recebedor?: string
          updated_at?: string
        }
        Relationships: []
      }
      contas_financeiras: {
        Row: {
          ativo: boolean
          created_at: string
          dias_liquidacao: number
          empresa_id: string
          id: string
          id_meio_pagamento: string | null
          nome: string
          saldo_atual: number
          taxa_percentual: number
          tipo_conta: Database["public"]["Enums"]["tipo_conta_financeira"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_liquidacao?: number
          empresa_id?: string
          id?: string
          id_meio_pagamento?: string | null
          nome: string
          saldo_atual?: number
          taxa_percentual?: number
          tipo_conta?: Database["public"]["Enums"]["tipo_conta_financeira"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_liquidacao?: number
          empresa_id?: string
          id?: string
          id_meio_pagamento?: string | null
          nome?: string
          saldo_atual?: number
          taxa_percentual?: number
          tipo_conta?: Database["public"]["Enums"]["tipo_conta_financeira"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_financeiras_id_meio_pagamento_fkey"
            columns: ["id_meio_pagamento"]
            isOneToOne: false
            referencedRelation: "meios_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ativo: boolean
          bairro: string
          cashback_ativo: boolean
          cep: string
          cidade: string
          complemento: string
          cor_primaria: string
          cor_secundaria: string
          created_at: string
          dominio_customizado: string | null
          estado: string
          id: string
          logotipo_url: string
          logradouro: string
          modo_fundo: string
          nome_fantasia: string
          numero: string
          percentual_cashback: number
          taxa_servico_mesa: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string
          cashback_ativo?: boolean
          cep?: string
          cidade?: string
          complemento?: string
          cor_primaria?: string
          cor_secundaria?: string
          created_at?: string
          dominio_customizado?: string | null
          estado?: string
          id?: string
          logotipo_url?: string
          logradouro?: string
          modo_fundo?: string
          nome_fantasia?: string
          numero?: string
          percentual_cashback?: number
          taxa_servico_mesa?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string
          cashback_ativo?: boolean
          cep?: string
          cidade?: string
          complemento?: string
          cor_primaria?: string
          cor_secundaria?: string
          created_at?: string
          dominio_customizado?: string | null
          estado?: string
          id?: string
          logotipo_url?: string
          logradouro?: string
          modo_fundo?: string
          nome_fantasia?: string
          numero?: string
          percentual_cashback?: number
          taxa_servico_mesa?: number
          updated_at?: string
        }
        Relationships: []
      }
      entradas_avulsas_estoque: {
        Row: {
          created_at: string
          id: string
          id_fornecedor: string | null
          numero_documento_interno: number
          observacao: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          id?: string
          id_fornecedor?: string | null
          numero_documento_interno?: number
          observacao?: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          id?: string
          id_fornecedor?: string | null
          numero_documento_interno?: number
          observacao?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "entradas_avulsas_estoque_id_fornecedor_fkey"
            columns: ["id_fornecedor"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      extrato_cashback: {
        Row: {
          cliente_id: string
          created_at: string
          empresa_id: string
          id: string
          pedido_id: string | null
          saldo_residual: number
          tipo_movimentacao: Database["public"]["Enums"]["cashback_mov_tipo"]
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          empresa_id?: string
          id?: string
          pedido_id?: string | null
          saldo_residual?: number
          tipo_movimentacao: Database["public"]["Enums"]["cashback_mov_tipo"]
          valor?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          pedido_id?: string | null
          saldo_residual?: number
          tipo_movimentacao?: Database["public"]["Enums"]["cashback_mov_tipo"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extrato_cashback_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extrato_conta_corrente: {
        Row: {
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          id_pedido: string | null
          saldo_devedor_momento: number
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          id_pedido?: string | null
          saldo_devedor_momento?: number
          tipo: string
          user_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          id_pedido?: string | null
          saldo_devedor_momento?: number
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extrato_conta_corrente_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      extrato_fiado: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          id_pedido: string | null
          id_usuario: string
          saldo_devedor_momento: number
          tipo: Database["public"]["Enums"]["fiado_tipo"]
          valor: number
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          id_pedido?: string | null
          id_usuario: string
          saldo_devedor_momento?: number
          tipo: Database["public"]["Enums"]["fiado_tipo"]
          valor?: number
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          id_pedido?: string | null
          id_usuario?: string
          saldo_devedor_momento?: number
          tipo?: Database["public"]["Enums"]["fiado_tipo"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extrato_fiado_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extrato_fiado_id_pedido_fkey"
            columns: ["id_pedido"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas_tecnicas: {
        Row: {
          created_at: string
          dados_fiscais: Json
          id: string
          modo_preparo_final: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dados_fiscais?: Json
          id?: string
          modo_preparo_final?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dados_fiscais?: Json
          id?: string
          modo_preparo_final?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fichas_tecnicas_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      fluxo_caixa: {
        Row: {
          created_at: string
          data_hora_abertura: string
          data_hora_fechamento: string | null
          id: string
          id_usuario: string
          metadados_abertura: Json | null
          metadados_fechamento: Json | null
          status: string
          updated_at: string
          valor_abertura: number
          valor_fechamento: number | null
        }
        Insert: {
          created_at?: string
          data_hora_abertura?: string
          data_hora_fechamento?: string | null
          id?: string
          id_usuario: string
          metadados_abertura?: Json | null
          metadados_fechamento?: Json | null
          status?: string
          updated_at?: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Update: {
          created_at?: string
          data_hora_abertura?: string
          data_hora_fechamento?: string | null
          id?: string
          id_usuario?: string
          metadados_abertura?: Json | null
          metadados_fechamento?: Json | null
          status?: string
          updated_at?: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cnpj: string | null
          contato: string | null
          created_at: string
          email: string | null
          endereco: string | null
          fornecedor: string
          i_estadual: string | null
          id: string
          prazo: number | null
          site: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          fornecedor: string
          i_estadual?: string | null
          id?: string
          prazo?: number | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          fornecedor?: string
          i_estadual?: string | null
          id?: string
          prazo?: number | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      historico_cashback: {
        Row: {
          created_at: string
          descricao: string
          empresa_id: string | null
          id: string
          id_pedido: string | null
          id_usuario: string
          tipo: Database["public"]["Enums"]["cashback_tipo"]
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string
          empresa_id?: string | null
          id?: string
          id_pedido?: string | null
          id_usuario: string
          tipo: Database["public"]["Enums"]["cashback_tipo"]
          valor?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          empresa_id?: string | null
          id?: string
          id_pedido?: string | null
          id_usuario?: string
          tipo?: Database["public"]["Enums"]["cashback_tipo"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "historico_cashback_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_cashback_id_pedido_fkey"
            columns: ["id_pedido"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredientes_produto: {
        Row: {
          created_at: string
          id: string
          insumo_id: string | null
          nome: string
          permitir_exclusao: boolean
          price_option_id: string | null
          product_id: string
          quantidade: number
          sort_order: number
          subproduto_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id?: string | null
          nome: string
          permitir_exclusao?: boolean
          price_option_id?: string | null
          product_id: string
          quantidade?: number
          sort_order?: number
          subproduto_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string | null
          nome?: string
          permitir_exclusao?: boolean
          price_option_id?: string | null
          product_id?: string
          quantidade?: number
          sort_order?: number
          subproduto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredientes_produto_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredientes_produto_price_option_id_fkey"
            columns: ["price_option_id"]
            isOneToOne: false
            referencedRelation: "produtos_price_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredientes_produto_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredientes_produto_subproduto_id_fkey"
            columns: ["subproduto_id"]
            isOneToOne: false
            referencedRelation: "subprodutos"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          controlado: boolean
          created_at: string
          custo_anterior: number | null
          custo_anterior_at: string | null
          custo_unitario: number
          empresa_id: string
          estocavel: boolean
          estoque_maximo: number
          estoque_minimo: number
          fator_conversao: number
          fornecedor_id: string | null
          id: string
          nome: string
          saldo_estoque: number
          setor_id: string | null
          unidade_estoque: string | null
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          controlado?: boolean
          created_at?: string
          custo_anterior?: number | null
          custo_anterior_at?: string | null
          custo_unitario?: number
          empresa_id?: string
          estocavel?: boolean
          estoque_maximo?: number
          estoque_minimo?: number
          fator_conversao?: number
          fornecedor_id?: string | null
          id?: string
          nome: string
          saldo_estoque?: number
          setor_id?: string | null
          unidade_estoque?: string | null
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          controlado?: boolean
          created_at?: string
          custo_anterior?: number | null
          custo_anterior_at?: string | null
          custo_unitario?: number
          empresa_id?: string
          estocavel?: boolean
          estoque_maximo?: number
          estoque_minimo?: number
          fator_conversao?: number
          fornecedor_id?: string | null
          id?: string
          nome?: string
          saldo_estoque?: number
          setor_id?: string | null
          unidade_estoque?: string | null
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_entrada_avulsa: {
        Row: {
          custo_anterior_momento: number
          custo_unitario_momento: number
          id: string
          id_entrada_avulsa: string
          id_insumo: string
          quantidade: number
        }
        Insert: {
          custo_anterior_momento?: number
          custo_unitario_momento?: number
          id?: string
          id_entrada_avulsa: string
          id_insumo: string
          quantidade?: number
        }
        Update: {
          custo_anterior_momento?: number
          custo_unitario_momento?: number
          id?: string
          id_entrada_avulsa?: string
          id_insumo?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_entrada_avulsa_id_entrada_avulsa_fkey"
            columns: ["id_entrada_avulsa"]
            isOneToOne: false
            referencedRelation: "entradas_avulsas_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_entrada_avulsa_id_insumo_fkey"
            columns: ["id_insumo"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_ordem_compra: {
        Row: {
          created_at: string
          custo_unitario: number
          id: string
          id_ordem_compra: string
          nome: string
          quantidade: number
          ref_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          id?: string
          id_ordem_compra: string
          nome: string
          quantidade?: number
          ref_id?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          id?: string
          id_ordem_compra?: string
          nome?: string
          quantidade?: number
          ref_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_ordem_compra_id_ordem_compra_fkey"
            columns: ["id_ordem_compra"]
            isOneToOne: false
            referencedRelation: "ordens_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_tesouraria: {
        Row: {
          categoria_fluxo: string
          created_at: string
          data_competencia: string
          data_liquidacao: string
          descricao: string
          empresa_id: string
          id: string
          id_conta_financeira: string
          id_pedido: string | null
          tipo: Database["public"]["Enums"]["tipo_lancamento_tesouraria"]
          valor: number
        }
        Insert: {
          categoria_fluxo?: string
          created_at?: string
          data_competencia?: string
          data_liquidacao?: string
          descricao?: string
          empresa_id?: string
          id?: string
          id_conta_financeira: string
          id_pedido?: string | null
          tipo: Database["public"]["Enums"]["tipo_lancamento_tesouraria"]
          valor?: number
        }
        Update: {
          categoria_fluxo?: string
          created_at?: string
          data_competencia?: string
          data_liquidacao?: string
          descricao?: string
          empresa_id?: string
          id?: string
          id_conta_financeira?: string
          id_pedido?: string | null
          tipo?: Database["public"]["Enums"]["tipo_lancamento_tesouraria"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_tesouraria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tesouraria_id_conta_financeira_fkey"
            columns: ["id_conta_financeira"]
            isOneToOne: false
            referencedRelation: "contas_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_tesouraria_id_pedido_fkey"
            columns: ["id_pedido"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      meios_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          exige_maquineta: boolean
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          exige_maquineta?: boolean
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          exige_maquineta?: boolean
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes_caixa: {
        Row: {
          created_at: string
          id: string
          id_caixa: string
          id_meio_pagamento: string | null
          motivo: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          id_caixa: string
          id_meio_pagamento?: string | null
          motivo?: string
          tipo: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          id_caixa?: string
          id_meio_pagamento?: string | null
          motivo?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_caixa_id_caixa_fkey"
            columns: ["id_caixa"]
            isOneToOne: false
            referencedRelation: "fluxo_caixa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_caixa_id_meio_pagamento_fkey"
            columns: ["id_meio_pagamento"]
            isOneToOne: false
            referencedRelation: "meios_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_cliente: {
        Row: {
          created_at: string
          id: string
          id_pedido: string | null
          id_usuario: string
          lida: boolean
          mensagem: string
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_pedido?: string | null
          id_usuario: string
          lida?: boolean
          mensagem: string
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          id_pedido?: string | null
          id_usuario?: string
          lida?: boolean
          mensagem?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_cliente_id_pedido_fkey"
            columns: ["id_pedido"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_compra: {
        Row: {
          created_at: string
          id: string
          id_fornecedor: string | null
          numero: number
          observacao: string
          origem: string
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          id?: string
          id_fornecedor?: string | null
          numero?: number
          observacao?: string
          origem?: string
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          id?: string
          id_fornecedor?: string | null
          numero?: number
          observacao?: string
          origem?: string
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_compra_id_fornecedor_fkey"
            columns: ["id_fornecedor"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          addons: Json
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          remocoes: string[]
          second_flavor: string
          size: string
          unit_price: number
        }
        Insert: {
          addons?: Json
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          remocoes?: string[]
          second_flavor?: string
          size?: string
          unit_price: number
        }
        Update: {
          addons?: Json
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          remocoes?: string[]
          second_flavor?: string
          size?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cashback_usado: number
          created_at: string
          delivery_address: string
          desconto_manual: number
          discount: number
          empresa_id: string
          estoque_baixado: boolean
          id: string
          impresso_conta: boolean
          impresso_cozinha: boolean
          notes: string
          numero_mesa: number | null
          observacoes_operador: string
          phone: string
          status: string
          status_pedido: string
          tipo_atendimento: Database["public"]["Enums"]["attendance_type"]
          total: number
          user_id: string
        }
        Insert: {
          cashback_usado?: number
          created_at?: string
          delivery_address?: string
          desconto_manual?: number
          discount?: number
          empresa_id?: string
          estoque_baixado?: boolean
          id?: string
          impresso_conta?: boolean
          impresso_cozinha?: boolean
          notes?: string
          numero_mesa?: number | null
          observacoes_operador?: string
          phone?: string
          status?: string
          status_pedido?: string
          tipo_atendimento?: Database["public"]["Enums"]["attendance_type"]
          total: number
          user_id: string
        }
        Update: {
          cashback_usado?: number
          created_at?: string
          delivery_address?: string
          desconto_manual?: number
          discount?: number
          empresa_id?: string
          estoque_baixado?: boolean
          id?: string
          impresso_conta?: boolean
          impresso_cozinha?: boolean
          notes?: string
          numero_mesa?: number | null
          observacoes_operador?: string
          phone?: string
          status?: string
          status_pedido?: string
          tipo_atendimento?: Database["public"]["Enums"]["attendance_type"]
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_pedido: {
        Row: {
          created_at: string
          id: string
          id_meio_pagamento: string | null
          id_pedido: string
          valor_pago: number
        }
        Insert: {
          created_at?: string
          id?: string
          id_meio_pagamento?: string | null
          id_pedido: string
          valor_pago?: number
        }
        Update: {
          created_at?: string
          id?: string
          id_meio_pagamento?: string | null
          id_pedido?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_pedido_id_meio_pagamento_fkey"
            columns: ["id_meio_pagamento"]
            isOneToOne: false
            referencedRelation: "meios_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_pedido_id_pedido_fkey"
            columns: ["id_pedido"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          category_id: string
          created_at: string
          custo_anterior: number | null
          custo_anterior_at: string | null
          description: string
          eixo_variacao: string
          empresa_id: string
          estoque_maximo: number
          estoque_minimo: number
          fornecedor_id: string | null
          free_addon_limit: number
          id: string
          image_url: string
          manipulado: boolean
          name: string
          price: number
          saldo_estoque: number
          setor_id: string | null
          sort_order: number
        }
        Insert: {
          available?: boolean
          category_id: string
          created_at?: string
          custo_anterior?: number | null
          custo_anterior_at?: string | null
          description?: string
          eixo_variacao?: string
          empresa_id?: string
          estoque_maximo?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          free_addon_limit?: number
          id?: string
          image_url?: string
          manipulado?: boolean
          name: string
          price: number
          saldo_estoque?: number
          setor_id?: string | null
          sort_order?: number
        }
        Update: {
          available?: boolean
          category_id?: string
          created_at?: string
          custo_anterior?: number | null
          custo_anterior_at?: string | null
          description?: string
          eixo_variacao?: string
          empresa_id?: string
          estoque_maximo?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          free_addon_limit?: number
          id?: string
          image_url?: string
          manipulado?: boolean
          name?: string
          price?: number
          saldo_estoque?: number
          setor_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_addons: {
        Row: {
          created_at: string
          id: string
          insumo_id: string | null
          nome: string
          preco: number
          produto_id: string
          quantidade: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id?: string | null
          nome: string
          preco?: number
          produto_id: string
          quantidade?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string | null
          nome?: string
          preco?: number
          produto_id?: string
          quantidade?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_addons_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_addons_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_free_addons: {
        Row: {
          created_at: string
          id: string
          insumo_id: string | null
          nome: string
          preco: number
          produto_id: string
          quantidade: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id?: string | null
          nome: string
          preco?: number
          produto_id: string
          quantidade?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string | null
          nome?: string
          preco?: number
          produto_id?: string
          quantidade?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_free_addons_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_free_addons_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_price_options: {
        Row: {
          created_at: string
          id: string
          preco: number
          produto_id: string
          sort_order: number
          tamanho: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          preco?: number
          produto_id: string
          sort_order?: number
          tamanho: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          preco?: number
          produto_id?: string
          sort_order?: number
          tamanho?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_price_options_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string
          bairro: string
          bloqueado: boolean
          cep: string
          complemento: string
          created_at: string
          ddd: string
          empresa_id: string | null
          estado: string
          fiado_autorizado: boolean
          full_name: string
          id: string
          latitude: number | null
          limite_fiado: number
          logradouro: string
          longitude: number | null
          municipio: string
          numero: string
          phone: string
          push_token: string | null
          saldo_cashback: number
          saldo_devedor_fiado: number
          telefone: string
          tipo_logradouro: string
          updated_at: string
        }
        Insert: {
          address?: string
          bairro?: string
          bloqueado?: boolean
          cep?: string
          complemento?: string
          created_at?: string
          ddd?: string
          empresa_id?: string | null
          estado?: string
          fiado_autorizado?: boolean
          full_name?: string
          id: string
          latitude?: number | null
          limite_fiado?: number
          logradouro?: string
          longitude?: number | null
          municipio?: string
          numero?: string
          phone?: string
          push_token?: string | null
          saldo_cashback?: number
          saldo_devedor_fiado?: number
          telefone?: string
          tipo_logradouro?: string
          updated_at?: string
        }
        Update: {
          address?: string
          bairro?: string
          bloqueado?: boolean
          cep?: string
          complemento?: string
          created_at?: string
          ddd?: string
          empresa_id?: string | null
          estado?: string
          fiado_autorizado?: boolean
          full_name?: string
          id?: string
          latitude?: number | null
          limite_fiado?: number
          logradouro?: string
          longitude?: number | null
          municipio?: string
          numero?: string
          phone?: string
          push_token?: string | null
          saldo_cashback?: number
          saldo_devedor_fiado?: number
          telefone?: string
          tipo_logradouro?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_combos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          frase_promocional: string | null
          id: string
          id_categoria_1: string | null
          id_categoria_2: string | null
          id_categoria_3: string | null
          nome_combo: string
          quantidade_requerida: number
          tipo_promocao: Database["public"]["Enums"]["tipo_promocao_enum"]
          updated_at: string
          valor_desconto: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          frase_promocional?: string | null
          id?: string
          id_categoria_1?: string | null
          id_categoria_2?: string | null
          id_categoria_3?: string | null
          nome_combo: string
          quantidade_requerida?: number
          tipo_promocao?: Database["public"]["Enums"]["tipo_promocao_enum"]
          updated_at?: string
          valor_desconto?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          frase_promocional?: string | null
          id?: string
          id_categoria_1?: string | null
          id_categoria_2?: string | null
          id_categoria_3?: string | null
          nome_combo?: string
          quantidade_requerida?: number
          tipo_promocao?: Database["public"]["Enums"]["tipo_promocao_enum"]
          updated_at?: string
          valor_desconto?: number
        }
        Relationships: [
          {
            foreignKeyName: "regras_combos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_combos_id_categoria_1_fkey"
            columns: ["id_categoria_1"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_combos_id_categoria_2_fkey"
            columns: ["id_categoria_2"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_combos_id_categoria_3_fkey"
            columns: ["id_categoria_3"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          created_at: string
          id: string
          ordem_exibicao: number
          setor: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem_exibicao?: number
          setor: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem_exibicao?: number
          setor?: string
          updated_at?: string
        }
        Relationships: []
      }
      subprodutos: {
        Row: {
          created_at: string
          id: string
          modo_preparo: string
          nome: string
          rendimento_porcoes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          modo_preparo?: string
          nome: string
          rendimento_porcoes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          modo_preparo?: string
          nome?: string
          rendimento_porcoes?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      view_products_public: {
        Row: {
          available: boolean | null
          category_id: string | null
          description: string | null
          eixo_variacao: string | null
          empresa_id: string | null
          free_addon_limit: number | null
          id: string | null
          image_url: string | null
          name: string | null
          price: number | null
          sort_order: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      abater_fiado_com_cashback: {
        Args: { p_user_id: string; p_valor?: number }
        Returns: {
          abatido: number
          saldo_cashback: number
          saldo_devedor: number
        }[]
      }
      admin_get_empresa_config: {
        Args: never
        Returns: {
          ativo: boolean
          bairro: string
          cashback_ativo: boolean
          cep: string
          cidade: string
          complemento: string
          cor_primaria: string
          cor_secundaria: string
          dominio_customizado: string
          estado: string
          id: string
          logotipo_url: string
          logradouro: string
          modo_fundo: string
          nome_fantasia: string
          numero: string
          percentual_cashback: number
          taxa_servico_mesa: number
        }[]
      }
      admin_get_ingredientes: {
        Args: { p_product_id: string }
        Returns: {
          id: string
          insumo_id: string
          nome: string
          permitir_exclusao: boolean
          price_option_id: string
          product_id: string
          quantidade: number
          sort_order: number
          subproduto_id: string
        }[]
      }
      admin_get_products: {
        Args: { p_id?: string; p_only_manipulado_false?: boolean }
        Returns: {
          available: boolean
          category_id: string
          custo_anterior: number
          description: string
          eixo_variacao: string
          estoque_maximo: number
          estoque_minimo: number
          fornecedor_id: string
          free_addon_limit: number
          id: string
          image_url: string
          manipulado: boolean
          name: string
          price: number
          saldo_estoque: number
          setor_id: string
          sort_order: number
        }[]
      }
      admin_list_empresas: {
        Args: never
        Returns: {
          ativo: boolean
          bairro: string
          cashback_ativo: boolean
          cep: string
          cidade: string
          complemento: string
          cor_primaria: string
          cor_secundaria: string
          created_at: string
          dominio_customizado: string
          estado: string
          id: string
          logotipo_url: string
          logradouro: string
          modo_fundo: string
          nome_fantasia: string
          numero: string
          percentual_cashback: number
          taxa_servico_mesa: number
        }[]
      }
      admin_update_cliente: {
        Args: {
          p_bairro: string
          p_cep: string
          p_complemento: string
          p_ddd: string
          p_estado: string
          p_full_name: string
          p_latitude: number
          p_logradouro: string
          p_longitude: number
          p_municipio: string
          p_numero: string
          p_telefone: string
          p_tipo_logradouro: string
          p_user_id: string
        }
        Returns: undefined
      }
      ajuste_rapido_estoque: {
        Args: {
          p_insumo_id: string
          p_observacao?: string
          p_quantidade: number
        }
        Returns: number
      }
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      conciliar_ajuste_nf: {
        Args: {
          p_ajuste_id: string
          p_nf_referencia?: string
          p_quantidade_nf: number
        }
        Returns: number
      }
      criar_ordem_compra: {
        Args: {
          p_fornecedor: string
          p_itens: Json
          p_observacao: string
          p_origem: string
        }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      explode_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      finalize_order_paid: { Args: { p_order_id: string }; Returns: number }
      get_active_pix_config: {
        Args: never
        Returns: {
          chave_pix_padrao: string
          cidade_recebedor: string
          gateway_banco: string
          nome_recebedor: string
        }[]
      }
      get_menu_availability: {
        Args: never
        Returns: {
          esgotado: boolean
          id: string
        }[]
      }
      get_patrimonio_estoque: { Args: never; Returns: number }
      get_public_menu: {
        Args: never
        Returns: {
          available: boolean
          category_id: string
          description: string
          eixo_variacao: string
          empresa_id: string
          free_addon_limit: number
          id: string
          image_url: string
          name: string
          price: number
          sort_order: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_cashback: {
        Args: { p_tipo: string; p_user: string; p_valor: number }
        Returns: undefined
      }
      notify_fiado: {
        Args: { p_tipo: string; p_user: string; p_valor: number }
        Returns: undefined
      }
      pay_fiado: {
        Args: {
          p_descricao: string
          p_id_meio: string
          p_user_id: string
          p_valor: number
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_cashback_for_order: {
        Args: { p_amount: number; p_order_id: string }
        Returns: number
      }
      registrar_entrada_avulsa: {
        Args: {
          p_conta_financeira: string
          p_fornecedor: string
          p_itens: Json
          p_observacao: string
        }
        Returns: number
      }
      reverse_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      set_cliente_bloqueado: {
        Args: { p_bloqueado: boolean; p_user_id: string }
        Returns: undefined
      }
      set_fiado_config: {
        Args: { p_autorizado: boolean; p_limite: number; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      ambiente_emissao_tipo: "Homologação/Testes" | "Produção"
      app_role: "admin" | "user" | "super_admin"
      attendance_type: "Delivery" | "Presencial"
      cashback_mov_tipo:
        | "credito_ganho"
        | "debito_uso"
        | "debito_abatimento_fiado"
      cashback_tipo: "Credito" | "Debito"
      fiado_tipo: "Debito_Compra" | "Credito_Pagamento"
      tipo_conta_financeira: "Físico" | "Banco" | "Recebível_Futuro"
      tipo_lancamento_tesouraria: "Entrada" | "Saída"
      tipo_promocao_enum: "Combo" | "Pack"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ambiente_emissao_tipo: ["Homologação/Testes", "Produção"],
      app_role: ["admin", "user", "super_admin"],
      attendance_type: ["Delivery", "Presencial"],
      cashback_mov_tipo: [
        "credito_ganho",
        "debito_uso",
        "debito_abatimento_fiado",
      ],
      cashback_tipo: ["Credito", "Debito"],
      fiado_tipo: ["Debito_Compra", "Credito_Pagamento"],
      tipo_conta_financeira: ["Físico", "Banco", "Recebível_Futuro"],
      tipo_lancamento_tesouraria: ["Entrada", "Saída"],
      tipo_promocao_enum: ["Combo", "Pack"],
    },
  },
} as const
