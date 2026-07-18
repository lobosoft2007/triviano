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
            foreignKeyName: "categories_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
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
      category_horarios: {
        Row: {
          categoria_id: string
          created_at: string
          dia_semana: number
          empresa_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          updated_at: string
        }
        Insert: {
          categoria_id: string
          created_at?: string
          dia_semana: number
          empresa_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string
          created_at?: string
          dia_semana?: number
          empresa_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_horarios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
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
          empresa_id?: string
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
          {
            foreignKeyName: "clientes_fiado_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      comanda_ativa: {
        Row: {
          created_at: string
          empresa_id: string
          fechada_em: string | null
          id: string
          motivo_cancelamento: string | null
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_status: string | null
          nome_cliente: string
          numero_mesa: number
          pago_online: boolean
          solicitacao_id: string | null
          status: Database["public"]["Enums"]["comanda_status"]
          total_parcial: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          fechada_em?: string | null
          id?: string
          motivo_cancelamento?: string | null
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_status?: string | null
          nome_cliente?: string
          numero_mesa: number
          pago_online?: boolean
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["comanda_status"]
          total_parcial?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          fechada_em?: string | null
          id?: string
          motivo_cancelamento?: string | null
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_status?: string | null
          nome_cliente?: string
          numero_mesa?: number
          pago_online?: boolean
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["comanda_status"]
          total_parcial?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comanda_ativa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_ativa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_ativa_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_mesa"
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
      config_fiscal: {
        Row: {
          ambiente: string
          ativo: boolean
          certificado_a1_nome: string | null
          certificado_a1_path: string | null
          certificado_a1_senha_criptografada: string | null
          certificado_a1_validade: string | null
          certificado_provider_id: string | null
          certificado_sincronizado_em: string | null
          created_at: string
          credenciais: Json
          emitente_sincronizado_em: string | null
          empresa_id: string
          id: string
          numero_nfce_proximo: number
          numero_nfe_proximo: number
          provider: string
          regime_tributario: string
          serie_nfce: string
          serie_nfe: string
          updated_at: string
        }
        Insert: {
          ambiente?: string
          ativo?: boolean
          certificado_a1_nome?: string | null
          certificado_a1_path?: string | null
          certificado_a1_senha_criptografada?: string | null
          certificado_a1_validade?: string | null
          certificado_provider_id?: string | null
          certificado_sincronizado_em?: string | null
          created_at?: string
          credenciais?: Json
          emitente_sincronizado_em?: string | null
          empresa_id: string
          id?: string
          numero_nfce_proximo?: number
          numero_nfe_proximo?: number
          provider?: string
          regime_tributario?: string
          serie_nfce?: string
          serie_nfe?: string
          updated_at?: string
        }
        Update: {
          ambiente?: string
          ativo?: boolean
          certificado_a1_nome?: string | null
          certificado_a1_path?: string | null
          certificado_a1_senha_criptografada?: string | null
          certificado_a1_validade?: string | null
          certificado_provider_id?: string | null
          certificado_sincronizado_em?: string | null
          created_at?: string
          credenciais?: Json
          emitente_sincronizado_em?: string | null
          empresa_id?: string
          id?: string
          numero_nfce_proximo?: number
          numero_nfe_proximo?: number
          provider?: string
          regime_tributario?: string
          serie_nfce?: string
          serie_nfe?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_fiscal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_fiscal_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas_public_branding"
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
          empresa_id: string
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
          empresa_id?: string
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
          empresa_id?: string
          endereco_ip?: string | null
          id?: string
          is_default?: boolean
          nome?: string
          porta?: number | null
          tipo_conexao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_impressoras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_impressoras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      config_pagamentos: {
        Row: {
          aceita_cartao_online: boolean
          aceita_na_entrega: boolean
          aceita_pix_online: boolean
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
          empresa_id: string
          gateway_banco: string
          id: string
          mp_access_token: string
          mp_access_token_prod: string
          mp_access_token_test: string
          mp_ambiente: string
          mp_ativo: boolean
          mp_public_key: string
          mp_public_key_prod: string
          mp_public_key_test: string
          mp_webhook_secret: string
          nome_recebedor: string
          updated_at: string
        }
        Insert: {
          aceita_cartao_online?: boolean
          aceita_na_entrega?: boolean
          aceita_pix_online?: boolean
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
          empresa_id?: string
          gateway_banco?: string
          id?: string
          mp_access_token?: string
          mp_access_token_prod?: string
          mp_access_token_test?: string
          mp_ambiente?: string
          mp_ativo?: boolean
          mp_public_key?: string
          mp_public_key_prod?: string
          mp_public_key_test?: string
          mp_webhook_secret?: string
          nome_recebedor?: string
          updated_at?: string
        }
        Update: {
          aceita_cartao_online?: boolean
          aceita_na_entrega?: boolean
          aceita_pix_online?: boolean
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
          empresa_id?: string
          gateway_banco?: string
          id?: string
          mp_access_token?: string
          mp_access_token_prod?: string
          mp_access_token_test?: string
          mp_ambiente?: string
          mp_ativo?: boolean
          mp_public_key?: string
          mp_public_key_prod?: string
          mp_public_key_test?: string
          mp_webhook_secret?: string
          nome_recebedor?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      contadores_senha: {
        Row: {
          contador: number
          created_at: string
          dia: string
          empresa_id: string
          updated_at: string
        }
        Insert: {
          contador?: number
          created_at?: string
          dia: string
          empresa_id: string
          updated_at?: string
        }
        Update: {
          contador?: number
          created_at?: string
          dia?: string
          empresa_id?: string
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
            foreignKeyName: "contas_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
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
          ai_report_api_key: string | null
          ai_report_model: string | null
          ai_report_provider: string
          ativo: boolean
          bairro: string
          cashback_ativo: boolean
          cep: string
          cidade: string
          cnpj: string
          complemento: string
          cor_primaria: string
          cor_secundaria: string
          created_at: string
          dominio_customizado: string | null
          estado: string
          geofence_raio_m: number
          id: string
          inscricao_estadual: string
          latitude: number | null
          logotipo_url: string
          logradouro: string
          longitude: number | null
          markup_ifood_percentual: number
          mesa_exige_geofence: boolean
          mesa_qr_secret: string
          modo_fundo: string
          monitor_bar: boolean
          monitor_cozinha: boolean
          monitor_pizzaria: boolean
          nome_fantasia: string
          numero: string
          percentual_cashback: number
          regime_tributario: string
          subdominio: string | null
          taxa_entrega_valor: number
          taxa_servico_mesa: number
          updated_at: string
        }
        Insert: {
          ai_report_api_key?: string | null
          ai_report_model?: string | null
          ai_report_provider?: string
          ativo?: boolean
          bairro?: string
          cashback_ativo?: boolean
          cep?: string
          cidade?: string
          cnpj?: string
          complemento?: string
          cor_primaria?: string
          cor_secundaria?: string
          created_at?: string
          dominio_customizado?: string | null
          estado?: string
          geofence_raio_m?: number
          id?: string
          inscricao_estadual?: string
          latitude?: number | null
          logotipo_url?: string
          logradouro?: string
          longitude?: number | null
          markup_ifood_percentual?: number
          mesa_exige_geofence?: boolean
          mesa_qr_secret?: string
          modo_fundo?: string
          monitor_bar?: boolean
          monitor_cozinha?: boolean
          monitor_pizzaria?: boolean
          nome_fantasia?: string
          numero?: string
          percentual_cashback?: number
          regime_tributario?: string
          subdominio?: string | null
          taxa_entrega_valor?: number
          taxa_servico_mesa?: number
          updated_at?: string
        }
        Update: {
          ai_report_api_key?: string | null
          ai_report_model?: string | null
          ai_report_provider?: string
          ativo?: boolean
          bairro?: string
          cashback_ativo?: boolean
          cep?: string
          cidade?: string
          cnpj?: string
          complemento?: string
          cor_primaria?: string
          cor_secundaria?: string
          created_at?: string
          dominio_customizado?: string | null
          estado?: string
          geofence_raio_m?: number
          id?: string
          inscricao_estadual?: string
          latitude?: number | null
          logotipo_url?: string
          logradouro?: string
          longitude?: number | null
          markup_ifood_percentual?: number
          mesa_exige_geofence?: boolean
          mesa_qr_secret?: string
          modo_fundo?: string
          monitor_bar?: boolean
          monitor_cozinha?: boolean
          monitor_pizzaria?: boolean
          nome_fantasia?: string
          numero?: string
          percentual_cashback?: number
          regime_tributario?: string
          subdominio?: string | null
          taxa_entrega_valor?: number
          taxa_servico_mesa?: number
          updated_at?: string
        }
        Relationships: []
      }
      entradas_avulsas_estoque: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          id_fornecedor: string | null
          numero_documento_interno: number
          observacao: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          id?: string
          id_fornecedor?: string | null
          numero_documento_interno?: number
          observacao?: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          id_fornecedor?: string | null
          numero_documento_interno?: number
          observacao?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "entradas_avulsas_estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_avulsas_estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_avulsas_estoque_id_fornecedor_fkey"
            columns: ["id_fornecedor"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      entregador_sessoes: {
        Row: {
          created_at: string
          empresa_id: string
          entregador_id: string
          fim: string | null
          id: string
          inicio: string
          total_comissao: number
          total_entregas: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          entregador_id: string
          fim?: string | null
          id?: string
          inicio?: string
          total_comissao?: number
          total_entregas?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          entregador_id?: string
          fim?: string | null
          id?: string
          inicio?: string
          total_comissao?: number
          total_entregas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregador_sessoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregador_sessoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregador_sessoes_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
        ]
      }
      entregadores: {
        Row: {
          ativo: boolean
          comissao_fixa_por_entrega: number
          comissao_percentual: number
          cpf: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          placa_veiculo: string | null
          telefone: string | null
          tipo_veiculo: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          comissao_fixa_por_entrega?: number
          comissao_percentual?: number
          cpf?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          placa_veiculo?: string | null
          telefone?: string | null
          tipo_veiculo?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          comissao_fixa_por_entrega?: number
          comissao_percentual?: number
          cpf?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          placa_veiculo?: string | null
          telefone?: string | null
          tipo_veiculo?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregadores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregadores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          canal: string
          coord_destino: Json | null
          coord_origem: Json | null
          created_at: string
          distancia_km: number | null
          empresa_id: string
          entregador_id: string | null
          entregue_em: string | null
          id: string
          observacao: string | null
          order_id: string
          saiu_para_entrega_em: string | null
          status: string
          taxa_entrega: number
          updated_at: string
          valor_comissao: number
        }
        Insert: {
          canal?: string
          coord_destino?: Json | null
          coord_origem?: Json | null
          created_at?: string
          distancia_km?: number | null
          empresa_id: string
          entregador_id?: string | null
          entregue_em?: string | null
          id?: string
          observacao?: string | null
          order_id: string
          saiu_para_entrega_em?: string | null
          status?: string
          taxa_entrega?: number
          updated_at?: string
          valor_comissao?: number
        }
        Update: {
          canal?: string
          coord_destino?: Json | null
          coord_origem?: Json | null
          created_at?: string
          distancia_km?: number | null
          empresa_id?: string
          entregador_id?: string | null
          entregue_em?: string | null
          id?: string
          observacao?: string | null
          order_id?: string
          saiu_para_entrega_em?: string | null
          status?: string
          taxa_entrega?: number
          updated_at?: string
          valor_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "entregas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      extrato_cashback: {
        Row: {
          cliente_id: string
          created_at: string
          descricao: string | null
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
          descricao?: string | null
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
          descricao?: string | null
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
          {
            foreignKeyName: "extrato_conta_corrente_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
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
            foreignKeyName: "extrato_fiado_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
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
          empresa_id: string
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
          empresa_id?: string
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
          empresa_id?: string
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
          empresa_id: string
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
          empresa_id?: string
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
          empresa_id?: string
          endereco?: string | null
          fornecedor?: string
          i_estadual?: string | null
          id?: string
          prazo?: number | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "historico_cashback_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
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
      ifood_event_log: {
        Row: {
          created_at: string
          empresa_id: string
          erro: string | null
          event_id: string | null
          event_type: string | null
          id: string
          merchant_id: string
          order_id_ifood: string | null
          payload: Json | null
          processado_em: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          erro?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          merchant_id: string
          order_id_ifood?: string | null
          payload?: Json | null
          processado_em?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          erro?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          merchant_id?: string
          order_id_ifood?: string | null
          payload?: Json | null
          processado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ifood_event_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifood_event_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      ifood_merchants: {
        Row: {
          access_token: string | null
          client_id: string | null
          client_secret: string | null
          created_at: string
          empresa_id: string
          id: string
          merchant_id: string
          nome: string
          polling_enabled: boolean
          refresh_token: string | null
          status_loja: string
          token_expires_at: string | null
          ultima_sincronizacao: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          merchant_id: string
          nome: string
          polling_enabled?: boolean
          refresh_token?: string | null
          status_loja?: string
          token_expires_at?: string | null
          ultima_sincronizacao?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          merchant_id?: string
          nome?: string
          polling_enabled?: boolean
          refresh_token?: string | null
          status_loja?: string
          token_expires_at?: string | null
          ultima_sincronizacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ifood_merchants_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifood_merchants_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      ifood_produto_map: {
        Row: {
          created_at: string
          disponivel: boolean
          empresa_id: string
          id: string
          ifood_category_id: string | null
          ifood_item_id: string
          product_id: string
          ultimo_sync: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          disponivel?: boolean
          empresa_id: string
          id?: string
          ifood_category_id?: string | null
          ifood_item_id: string
          product_id: string
          ultimo_sync?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          disponivel?: boolean
          empresa_id?: string
          id?: string
          ifood_category_id?: string | null
          ifood_item_id?: string
          product_id?: string
          ultimo_sync?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ifood_produto_map_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifood_produto_map_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifood_produto_map_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
            foreignKeyName: "insumos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
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
      itens_entrada_produto: {
        Row: {
          created_at: string
          custo_anterior_momento: number
          custo_unitario_momento: number
          id: string
          id_entrada_avulsa: string
          id_produto: string
          quantidade: number
          saldo_apos: number | null
        }
        Insert: {
          created_at?: string
          custo_anterior_momento?: number
          custo_unitario_momento: number
          id?: string
          id_entrada_avulsa: string
          id_produto: string
          quantidade: number
          saldo_apos?: number | null
        }
        Update: {
          created_at?: string
          custo_anterior_momento?: number
          custo_unitario_momento?: number
          id?: string
          id_entrada_avulsa?: string
          id_produto?: string
          quantidade?: number
          saldo_apos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_entrada_produto_id_entrada_avulsa_fkey"
            columns: ["id_entrada_avulsa"]
            isOneToOne: false
            referencedRelation: "entradas_avulsas_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_entrada_produto_id_produto_fkey"
            columns: ["id_produto"]
            isOneToOne: false
            referencedRelation: "products"
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
            foreignKeyName: "lancamentos_tesouraria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
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
      manifestacoes_destinatario: {
        Row: {
          chave_acesso: string
          cnpj_emitente: string | null
          created_at: string
          data_emissao: string | null
          data_manifestacao: string | null
          empresa_id: string
          id: string
          nome_emitente: string | null
          nsu: string | null
          status: string
          tipo_evento: string | null
          updated_at: string
          valor: number | null
          xml_path: string | null
        }
        Insert: {
          chave_acesso: string
          cnpj_emitente?: string | null
          created_at?: string
          data_emissao?: string | null
          data_manifestacao?: string | null
          empresa_id: string
          id?: string
          nome_emitente?: string | null
          nsu?: string | null
          status?: string
          tipo_evento?: string | null
          updated_at?: string
          valor?: number | null
          xml_path?: string | null
        }
        Update: {
          chave_acesso?: string
          cnpj_emitente?: string | null
          created_at?: string
          data_emissao?: string | null
          data_manifestacao?: string | null
          empresa_id?: string
          id?: string
          nome_emitente?: string | null
          nsu?: string | null
          status?: string
          tipo_evento?: string | null
          updated_at?: string
          valor?: number | null
          xml_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manifestacoes_destinatario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifestacoes_destinatario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      meios_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          exige_maquineta: boolean
          id: string
          is_sistema: boolean
          nome: string
          percentual_cashback: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          exige_maquineta?: boolean
          id?: string
          is_sistema?: boolean
          nome: string
          percentual_cashback?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          exige_maquineta?: boolean
          id?: string
          is_sistema?: boolean
          nome?: string
          percentual_cashback?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meios_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meios_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_caixa: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          id_caixa: string
          id_meio_pagamento: string | null
          motivo: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          id?: string
          id_caixa: string
          id_meio_pagamento?: string | null
          motivo?: string
          tipo: string
          valor?: number
        }
        Update: {
          created_at?: string
          empresa_id?: string
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
      niveis_acesso: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          is_admin_local: boolean
          nome_nivel: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          id?: string
          is_admin_local?: boolean
          nome_nivel: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          is_admin_local?: boolean
          nome_nivel?: string
          updated_at?: string
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          ambiente: string
          chave_acesso: string | null
          created_at: string
          data_emissao: string | null
          empresa_id: string
          id: string
          mensagem_retorno: string | null
          numero: string | null
          pdf_path: string | null
          pdf_url: string | null
          pedido_id: string | null
          protocolo: string | null
          serie: string | null
          status: string
          tipo: string
          updated_at: string
          valor_total: number
          xml_autorizacao: string | null
          xml_envio: string | null
        }
        Insert: {
          ambiente?: string
          chave_acesso?: string | null
          created_at?: string
          data_emissao?: string | null
          empresa_id: string
          id?: string
          mensagem_retorno?: string | null
          numero?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          pedido_id?: string | null
          protocolo?: string | null
          serie?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor_total?: number
          xml_autorizacao?: string | null
          xml_envio?: string | null
        }
        Update: {
          ambiente?: string
          chave_acesso?: string | null
          created_at?: string
          data_emissao?: string | null
          empresa_id?: string
          id?: string
          mensagem_retorno?: string | null
          numero?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          pedido_id?: string | null
          protocolo?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_total?: number
          xml_autorizacao?: string | null
          xml_envio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais_itens: {
        Row: {
          cfop: string | null
          created_at: string
          csosn: string | null
          cst_icms: string | null
          descricao: string
          id: string
          ncm: string | null
          nota_fiscal_id: string
          origem_icms: string | null
          produto_id: string | null
          quantidade: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          cfop?: string | null
          created_at?: string
          csosn?: string | null
          cst_icms?: string | null
          descricao: string
          id?: string
          ncm?: string | null
          nota_fiscal_id: string
          origem_icms?: string | null
          produto_id?: string | null
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          cfop?: string | null
          created_at?: string
          csosn?: string | null
          cst_icms?: string | null
          descricao?: string
          id?: string
          ncm?: string | null
          nota_fiscal_id?: string
          origem_icms?: string | null
          produto_id?: string | null
          quantidade?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          empresa_id: string
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
          empresa_id?: string
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
          empresa_id?: string
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
            foreignKeyName: "ordens_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
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
          aguardando_pagamento: boolean
          canal_venda: Database["public"]["Enums"]["canal_venda_enum"]
          cashback_usado: number
          comanda_id: string | null
          created_at: string
          delivery_address: string
          desconto_manual: number
          discount: number
          empresa_id: string
          entrega_id: string | null
          entregador_id: string | null
          estoque_baixado: boolean
          id: string
          impresso_conta: boolean
          impresso_cozinha: boolean
          mp_order_id: string | null
          mp_payment_id: string | null
          mp_status: string | null
          notes: string
          numero_mesa: number | null
          observacoes_operador: string
          pago_online: boolean
          pedido_externo_id: string | null
          phone: string
          senha: string | null
          senha_diaria: number | null
          status: string
          status_pedido: string
          tipo_atendimento: Database["public"]["Enums"]["attendance_type"]
          tipo_pagamento: string
          total: number
          user_id: string
        }
        Insert: {
          aguardando_pagamento?: boolean
          canal_venda?: Database["public"]["Enums"]["canal_venda_enum"]
          cashback_usado?: number
          comanda_id?: string | null
          created_at?: string
          delivery_address?: string
          desconto_manual?: number
          discount?: number
          empresa_id?: string
          entrega_id?: string | null
          entregador_id?: string | null
          estoque_baixado?: boolean
          id?: string
          impresso_conta?: boolean
          impresso_cozinha?: boolean
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_status?: string | null
          notes?: string
          numero_mesa?: number | null
          observacoes_operador?: string
          pago_online?: boolean
          pedido_externo_id?: string | null
          phone?: string
          senha?: string | null
          senha_diaria?: number | null
          status?: string
          status_pedido?: string
          tipo_atendimento?: Database["public"]["Enums"]["attendance_type"]
          tipo_pagamento?: string
          total: number
          user_id: string
        }
        Update: {
          aguardando_pagamento?: boolean
          canal_venda?: Database["public"]["Enums"]["canal_venda_enum"]
          cashback_usado?: number
          comanda_id?: string | null
          created_at?: string
          delivery_address?: string
          desconto_manual?: number
          discount?: number
          empresa_id?: string
          entrega_id?: string | null
          entregador_id?: string | null
          estoque_baixado?: boolean
          id?: string
          impresso_conta?: boolean
          impresso_cozinha?: boolean
          mp_order_id?: string | null
          mp_payment_id?: string | null
          mp_status?: string | null
          notes?: string
          numero_mesa?: number | null
          observacoes_operador?: string
          pago_online?: boolean
          pedido_externo_id?: string | null
          phone?: string
          senha?: string | null
          senha_diaria?: number | null
          status?: string
          status_pedido?: string
          tipo_atendimento?: Database["public"]["Enums"]["attendance_type"]
          tipo_pagamento?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comanda_ativa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_entrega_fk"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_entregador_fk"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
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
      permissoes_matriz: {
        Row: {
          acesso_abrir_fechar_caixa: boolean
          acesso_atendimento_balcao: boolean
          acesso_bar: boolean
          acesso_cadastro_produtos: boolean
          acesso_delivery: boolean
          acesso_entrada_estoque: boolean
          acesso_entregas: boolean
          acesso_financeiro: boolean
          acesso_kds_cozinha: boolean
          acesso_mesas: boolean
          acesso_rh: boolean
          acesso_sangria_suprimento: boolean
          created_at: string
          empresa_id: string
          id: string
          nivel_id: string
          updated_at: string
        }
        Insert: {
          acesso_abrir_fechar_caixa?: boolean
          acesso_atendimento_balcao?: boolean
          acesso_bar?: boolean
          acesso_cadastro_produtos?: boolean
          acesso_delivery?: boolean
          acesso_entrada_estoque?: boolean
          acesso_entregas?: boolean
          acesso_financeiro?: boolean
          acesso_kds_cozinha?: boolean
          acesso_mesas?: boolean
          acesso_rh?: boolean
          acesso_sangria_suprimento?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nivel_id: string
          updated_at?: string
        }
        Update: {
          acesso_abrir_fechar_caixa?: boolean
          acesso_atendimento_balcao?: boolean
          acesso_bar?: boolean
          acesso_cadastro_produtos?: boolean
          acesso_delivery?: boolean
          acesso_entrada_estoque?: boolean
          acesso_entregas?: boolean
          acesso_financeiro?: boolean
          acesso_kds_cozinha?: boolean
          acesso_mesas?: boolean
          acesso_rh?: boolean
          acesso_sangria_suprimento?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nivel_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_matriz_nivel_id_fkey"
            columns: ["nivel_id"]
            isOneToOne: true
            referencedRelation: "niveis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_devices: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          empresa_id: string
          flavor: string
          id: string
          last_seen_at: string | null
          nome: string
          revogado_em: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          empresa_id: string
          flavor: string
          id?: string
          last_seen_at?: string | null
          nome: string
          revogado_em?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          empresa_id?: string
          flavor?: string
          id?: string
          last_seen_at?: string | null
          nome?: string
          revogado_em?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_devices_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_devices_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_pair_codes: {
        Row: {
          code: string
          created_at: string
          criado_por: string | null
          empresa_id: string
          expira_em: string
          flavor: string
          id: string
          nome: string
          usado_em: string | null
        }
        Insert: {
          code: string
          created_at?: string
          criado_por?: string | null
          empresa_id: string
          expira_em?: string
          flavor: string
          id?: string
          nome: string
          usado_em?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          expira_em?: string
          flavor?: string
          id?: string
          nome?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_pair_codes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_pair_codes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          category_id: string
          cfop: string | null
          created_at: string
          csosn: string | null
          cst_icms: string | null
          custo_anterior: number | null
          custo_anterior_at: string | null
          custo_compra: number
          custo_total: number | null
          description: string
          ean: string | null
          eixo_variacao: string
          empresa_id: string
          estoque_maximo: number
          estoque_minimo: number
          fornecedor_id: string | null
          free_addon_limit: number
          id: string
          image_url: string
          manipulado: boolean
          margem_revenda: number
          name: string
          ncm: string | null
          origem_icms: string | null
          preco_ideal_revenda: number | null
          preco_ifood: number | null
          price: number
          saldo_estoque: number
          setor_id: string | null
          sort_order: number
        }
        Insert: {
          available?: boolean
          category_id: string
          cfop?: string | null
          created_at?: string
          csosn?: string | null
          cst_icms?: string | null
          custo_anterior?: number | null
          custo_anterior_at?: string | null
          custo_compra?: number
          custo_total?: number | null
          description?: string
          ean?: string | null
          eixo_variacao?: string
          empresa_id?: string
          estoque_maximo?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          free_addon_limit?: number
          id?: string
          image_url?: string
          manipulado?: boolean
          margem_revenda?: number
          name: string
          ncm?: string | null
          origem_icms?: string | null
          preco_ideal_revenda?: number | null
          preco_ifood?: number | null
          price: number
          saldo_estoque?: number
          setor_id?: string | null
          sort_order?: number
        }
        Update: {
          available?: boolean
          category_id?: string
          cfop?: string | null
          created_at?: string
          csosn?: string | null
          cst_icms?: string | null
          custo_anterior?: number | null
          custo_anterior_at?: string | null
          custo_compra?: number
          custo_total?: number | null
          description?: string
          ean?: string | null
          eixo_variacao?: string
          empresa_id?: string
          estoque_maximo?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          free_addon_limit?: number
          id?: string
          image_url?: string
          manipulado?: boolean
          margem_revenda?: number
          name?: string
          ncm?: string | null
          origem_icms?: string | null
          preco_ideal_revenda?: number | null
          preco_ifood?: number | null
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
            foreignKeyName: "products_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
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
          preco_ifood: number | null
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
          preco_ifood?: number | null
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
          preco_ifood?: number | null
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
      produtos_fornecedor: {
        Row: {
          ativo: boolean
          codigo_fornecedor: string | null
          created_at: string
          descricao_fornecedor: string | null
          fator_conversao: number
          fornecedor_id: string
          id: string
          insumo_id: string | null
          produto_id: string | null
          subproduto_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo_fornecedor?: string | null
          created_at?: string
          descricao_fornecedor?: string | null
          fator_conversao?: number
          fornecedor_id: string
          id?: string
          insumo_id?: string | null
          produto_id?: string | null
          subproduto_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo_fornecedor?: string | null
          created_at?: string
          descricao_fornecedor?: string | null
          fator_conversao?: number
          fornecedor_id?: string
          id?: string
          insumo_id?: string | null
          produto_id?: string | null
          subproduto_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_fornecedor_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedor_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedor_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedor_subproduto_id_fkey"
            columns: ["subproduto_id"]
            isOneToOne: false
            referencedRelation: "subprodutos"
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
          preco_ifood: number | null
          produto_id: string
          sort_order: number
          tamanho: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          preco?: number
          preco_ifood?: number | null
          produto_id: string
          sort_order?: number
          tamanho: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          preco?: number
          preco_ifood?: number | null
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
          nivel_id: string | null
          numero: string
          phone: string
          pin_pos_hash: string | null
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
          nivel_id?: string | null
          numero?: string
          phone?: string
          pin_pos_hash?: string | null
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
          nivel_id?: string | null
          numero?: string
          phone?: string
          pin_pos_hash?: string | null
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
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_nivel_id_fkey"
            columns: ["nivel_id"]
            isOneToOne: false
            referencedRelation: "niveis_acesso"
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
            foreignKeyName: "regras_combos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
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
      relatorios_salvos: {
        Row: {
          created_at: string
          criado_por: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          spec: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome: string
          spec: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          spec?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_salvos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_salvos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          ordem_exibicao: number
          setor: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          id?: string
          ordem_exibicao?: number
          setor: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          ordem_exibicao?: number
          setor?: string
          updated_at?: string
        }
        Relationships: []
      }
      solicitacoes_mesa: {
        Row: {
          created_at: string
          empresa_id: string
          host_origem: string | null
          id: string
          liberada_em: string | null
          liberada_por: string | null
          nome_cliente: string
          numero_mesa: number
          status: Database["public"]["Enums"]["solicitacao_mesa_status"]
          telefone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          host_origem?: string | null
          id?: string
          liberada_em?: string | null
          liberada_por?: string | null
          nome_cliente?: string
          numero_mesa: number
          status?: Database["public"]["Enums"]["solicitacao_mesa_status"]
          telefone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          host_origem?: string | null
          id?: string
          liberada_em?: string | null
          liberada_por?: string | null
          nome_cliente?: string
          numero_mesa?: number
          status?: Database["public"]["Enums"]["solicitacao_mesa_status"]
          telefone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_mesa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_mesa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_public_branding"
            referencedColumns: ["id"]
          },
        ]
      }
      subprodutos: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          modo_preparo: string
          nome: string
          rendimento_porcoes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          id?: string
          modo_preparo?: string
          nome: string
          rendimento_porcoes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
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
      tap_card_charges: {
        Row: {
          ambiente: string
          autorizacao: string | null
          bandeira: string | null
          created_at: string
          empresa_id: string
          external_id: string | null
          id: string
          modalidade: string | null
          nsu: string | null
          order_id: string | null
          paid_at: string | null
          parcelas: number | null
          pos_device_id: string | null
          provider: string
          raw_response: Json | null
          status: string
          updated_at: string
          valor: number
          valor_reembolsado: number
        }
        Insert: {
          ambiente?: string
          autorizacao?: string | null
          bandeira?: string | null
          created_at?: string
          empresa_id: string
          external_id?: string | null
          id?: string
          modalidade?: string | null
          nsu?: string | null
          order_id?: string | null
          paid_at?: string | null
          parcelas?: number | null
          pos_device_id?: string | null
          provider: string
          raw_response?: Json | null
          status?: string
          updated_at?: string
          valor: number
          valor_reembolsado?: number
        }
        Update: {
          ambiente?: string
          autorizacao?: string | null
          bandeira?: string | null
          created_at?: string
          empresa_id?: string
          external_id?: string | null
          id?: string
          modalidade?: string | null
          nsu?: string | null
          order_id?: string | null
          paid_at?: string | null
          parcelas?: number | null
          pos_device_id?: string | null
          provider?: string
          raw_response?: Json | null
          status?: string
          updated_at?: string
          valor?: number
          valor_reembolsado?: number
        }
        Relationships: []
      }
      tap_pix_charges: {
        Row: {
          ambiente: string
          copia_e_cola: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          expires_at: string | null
          external_id: string | null
          id: string
          order_id: string | null
          paid_at: string | null
          pos_device_id: string | null
          provider: string
          qr_code: string | null
          qr_code_base64: string | null
          raw_response: Json | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          ambiente: string
          copia_e_cola?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          pos_device_id?: string | null
          provider: string
          qr_code?: string | null
          qr_code_base64?: string | null
          raw_response?: Json | null
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          ambiente?: string
          copia_e_cola?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          pos_device_id?: string | null
          provider?: string
          qr_code?: string | null
          qr_code_base64?: string | null
          raw_response?: Json | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "tap_pix_charges_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tap_pix_charges_pos_device_id_fkey"
            columns: ["pos_device_id"]
            isOneToOne: false
            referencedRelation: "pos_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      tap_provider_config: {
        Row: {
          ambiente: string
          ativo: boolean
          created_at: string
          credentials: Json
          empresa_id: string
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          ambiente?: string
          ativo?: boolean
          created_at?: string
          credentials?: Json
          empresa_id?: string
          id?: string
          provider: string
          updated_at?: string
        }
        Update: {
          ambiente?: string
          ativo?: boolean
          created_at?: string
          credentials?: Json
          empresa_id?: string
          id?: string
          provider?: string
          updated_at?: string
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
      empresas_public_branding: {
        Row: {
          ativo: boolean | null
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string | null
          dominio_customizado: string | null
          id: string | null
          logotipo_url: string | null
          modo_fundo: string | null
          nome_fantasia: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string | null
          dominio_customizado?: string | null
          id?: string | null
          logotipo_url?: string | null
          modo_fundo?: string | null
          nome_fantasia?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string | null
          dominio_customizado?: string | null
          id?: string | null
          logotipo_url?: string | null
          modo_fundo?: string | null
          nome_fantasia?: string | null
        }
        Relationships: []
      }
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
      _finalize_order_financials: {
        Args: { p_order_id: string }
        Returns: number
      }
      _settle_comanda: {
        Args: { p_comanda_id: string; p_meio_id: string; p_online: boolean }
        Returns: undefined
      }
      abater_fiado_com_cashback: {
        Args: { p_user_id: string; p_valor?: number }
        Returns: {
          abatido: number
          saldo_cashback: number
          saldo_devedor: number
        }[]
      }
      abrir_solicitacao_mesa: {
        Args: {
          p_host: string
          p_nome: string
          p_numero_mesa: number
          p_telefone: string
          p_token: string
        }
        Returns: string
      }
      admin_credit_cashback: {
        Args: { p_cliente_id: string; p_motivo: string; p_valor: number }
        Returns: number
      }
      admin_get_empresa_config: {
        Args: never
        Returns: {
          ai_report_has_key: boolean
          ai_report_model: string
          ai_report_provider: string
          ativo: boolean
          bairro: string
          cashback_ativo: boolean
          cep: string
          cidade: string
          cnpj: string
          complemento: string
          cor_primaria: string
          cor_secundaria: string
          dominio_customizado: string
          estado: string
          id: string
          inscricao_estadual: string
          logotipo_url: string
          logradouro: string
          markup_ifood_percentual: number
          modo_fundo: string
          monitor_bar: boolean
          monitor_cozinha: boolean
          monitor_pizzaria: boolean
          nome_fantasia: string
          numero: string
          percentual_cashback: number
          regime_tributario: string
          taxa_entrega_valor: number
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
          custo_compra: number
          custo_total: number
          description: string
          disponivel: boolean
          eixo_variacao: string
          estoque_maximo: number
          estoque_minimo: number
          fornecedor_id: string
          free_addon_limit: number
          id: string
          image_url: string
          manipulado: boolean
          margem_revenda: number
          name: string
          preco_ideal_revenda: number
          price: number
          saldo_estoque: number
          setor_id: string
          sort_order: number
        }[]
      }
      admin_list_empresas: {
        Args: never
        Returns: {
          ai_report_model: string
          ativo: boolean
          bairro: string
          cashback_ativo: boolean
          cep: string
          cidade: string
          cnpj: string
          complemento: string
          cor_primaria: string
          cor_secundaria: string
          created_at: string
          dominio_customizado: string
          estado: string
          id: string
          inscricao_estadual: string
          logotipo_url: string
          logradouro: string
          modo_fundo: string
          nome_fantasia: string
          numero: string
          percentual_cashback: number
          regime_tributario: string
          taxa_servico_mesa: number
        }[]
      }
      admin_list_funcionarios: {
        Args: never
        Returns: {
          bloqueado: boolean
          created_at: string
          full_name: string
          id: string
          nivel_id: string
          nome_nivel: string
        }[]
      }
      admin_set_category_horarios: {
        Args: { p_categoria_id: string; p_horarios: Json }
        Returns: undefined
      }
      admin_set_funcionario_bloqueado: {
        Args: { p_bloqueado: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_set_funcionario_nivel: {
        Args: { p_nivel_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_update_ai_report_config: {
        Args: {
          p_api_key?: string
          p_clear_key?: boolean
          p_model: string
          p_provider: string
        }
        Returns: undefined
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
      apply_ifood_markup: {
        Args: { p_empresa_id: string; p_overwrite?: boolean }
        Returns: number
      }
      can_manage_empresa: { Args: { _empresa_id: string }; Returns: boolean }
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      claim_tenant_by_host: { Args: { p_host: string }; Returns: string }
      compute_product_cmv: { Args: { p_product_id: string }; Returns: number }
      conciliar_ajuste_nf: {
        Args: {
          p_ajuste_id: string
          p_nf_referencia?: string
          p_quantidade_nf: number
        }
        Returns: number
      }
      create_order: {
        Args: {
          p_cashback_used?: number
          p_delivery_address: string
          p_host?: string
          p_items: Json
          p_notes: string
          p_numero_mesa: number
          p_pagamento_online?: boolean
          p_phone: string
          p_tipo_atendimento: string
        }
        Returns: string
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
      current_empresa_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_meio_pagamento: { Args: { p_id: string }; Returns: undefined }
      desistir_solicitacao_mesa: {
        Args: { p_solicitacao_id: string }
        Returns: undefined
      }
      discard_unpaid_drafts: { Args: { p_host?: string }; Returns: number }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enviar_pedido_mesa: {
        Args: {
          p_comanda_id: string
          p_host: string
          p_items: Json
          p_notes?: string
        }
        Returns: string
      }
      explode_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      fechar_comanda: { Args: { p_comanda_id: string }; Returns: undefined }
      finalize_comanda_paid: {
        Args: { p_comanda_id: string; p_meio_id: string }
        Returns: undefined
      }
      finalize_comanda_split: {
        Args: { p_comanda_id: string; p_pagamentos: Json }
        Returns: undefined
      }
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
      get_ai_report_credentials: {
        Args: never
        Returns: {
          api_key: string
          model: string
          provider: string
        }[]
      }
      get_empresa_checkout_config: {
        Args: never
        Returns: {
          ativo: boolean
          cor_primaria: string
          cor_secundaria: string
          dominio_customizado: string
          id: string
          logotipo_url: string
          modo_fundo: string
          nome_fantasia: string
          taxa_servico_mesa: number
        }[]
      }
      get_menu_availability: {
        Args: never
        Returns: {
          esgotado: boolean
          id: string
        }[]
      }
      get_mp_public_config: {
        Args: { p_ambiente?: string; p_host?: string }
        Returns: {
          aceita_cartao_online: boolean
          aceita_na_entrega: boolean
          aceita_pix_online: boolean
          ambiente: string
          ativo: boolean
          empresa_id: string
          public_key: string
        }[]
      }
      get_my_permissions: {
        Args: never
        Returns: {
          acesso_abrir_fechar_caixa: boolean
          acesso_atendimento_balcao: boolean
          acesso_bar: boolean
          acesso_cadastro_produtos: boolean
          acesso_delivery: boolean
          acesso_entrada_estoque: boolean
          acesso_entregas: boolean
          acesso_financeiro: boolean
          acesso_kds_cozinha: boolean
          acesso_mesas: boolean
          acesso_rh: boolean
          acesso_sangria_suprimento: boolean
          is_admin: boolean
          is_funcionario: boolean
          is_manager: boolean
        }[]
      }
      get_my_tap_provider: {
        Args: never
        Returns: {
          ambiente: string
          ativo: boolean
          provider: string
        }[]
      }
      get_next_opening: {
        Args: { p_empresa_id: string }
        Returns: {
          categoria_nome: string
          dia_semana: number
          hora_inicio: string
          quando: string
        }[]
      }
      get_painel_retirada: {
        Args: { _empresa_id?: string }
        Returns: {
          created_at: string
          senha: string
          senha_diaria: number
          status_pedido: string
        }[]
      }
      get_patrimonio_estoque: { Args: never; Returns: number }
      get_pix_static_config: {
        Args: { p_host?: string }
        Returns: {
          chave_pix: string
          cidade_recebedor: string
          empresa_id: string
          nome_recebedor: string
        }[]
      }
      get_public_branding: {
        Args: never
        Returns: {
          ativo: boolean
          cor_primaria: string
          cor_secundaria: string
          created_at: string
          dominio_customizado: string
          id: string
          logotipo_url: string
          modo_fundo: string
          nome_fantasia: string
          subdominio: string
        }[]
      }
      get_public_branding_by_host: {
        Args: { p_host: string }
        Returns: {
          ativo: boolean
          cor_primaria: string
          cor_secundaria: string
          created_at: string
          dominio_customizado: string
          id: string
          logotipo_url: string
          modo_fundo: string
          nome_fantasia: string
          subdominio: string
        }[]
      }
      get_public_branding_by_slug: {
        Args: { p_slug: string }
        Returns: {
          ativo: boolean
          cor_primaria: string
          cor_secundaria: string
          created_at: string
          dominio_customizado: string
          id: string
          logotipo_url: string
          modo_fundo: string
          nome_fantasia: string
          subdominio: string
        }[]
      }
      get_public_combos_by_host: {
        Args: { p_host: string }
        Returns: {
          frase_promocional: string
          id: string
          nome_combo: string
          quantidade_requerida: number
          slug1: string
          slug2: string
          slug3: string
          tipo_promocao: string
          valor_desconto: number
        }[]
      }
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
      get_public_menu_by_host: {
        Args: { p_host: string }
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
      is_categoria_aberta: {
        Args: { p_at?: string; p_categoria_id: string }
        Returns: boolean
      }
      is_empresa_ativa: { Args: { _empresa_id: string }; Returns: boolean }
      is_local_admin: { Args: never; Returns: boolean }
      is_master_admin: { Args: never; Returns: boolean }
      is_produto_publico: { Args: { _produto_id: string }; Returns: boolean }
      liberar_mesa: {
        Args: { p_forcar?: boolean; p_solicitacao_id: string }
        Returns: string
      }
      mesa_token: {
        Args: { p_empresa: string; p_numero: number }
        Returns: string
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
      mp_env_for_host: { Args: { p_host: string }; Returns: string }
      mp_get_comanda_status: {
        Args: { p_comanda_id: string }
        Returns: {
          mp_status: string
          pago_online: boolean
          status: string
          total_parcial: number
        }[]
      }
      mp_get_order_status: {
        Args: { p_order_id: string }
        Returns: {
          aguardando_pagamento: boolean
          mp_status: string
          pago_online: boolean
          status_pedido: string
        }[]
      }
      normalize_host: { Args: { p_host: string }; Returns: string }
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
      pos_generate_pair_code: {
        Args: { p_empresa: string; p_flavor: string; p_nome: string }
        Returns: string
      }
      pos_login_pin: {
        Args: { p_device: string; p_pin: string; p_token: string }
        Returns: Json
      }
      pos_pair_device: {
        Args: { p_code: string; p_fingerprint: string }
        Returns: Json
      }
      pos_revoke_device: { Args: { p_device: string }; Returns: undefined }
      pos_set_pin: {
        Args: { p_pin: string; p_user: string }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_manipulado_preco_ideal: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      record_tap_card_paid: {
        Args: {
          _ambiente: string
          _autorizacao: string
          _bandeira: string
          _empresa_id: string
          _external_id: string
          _modalidade: string
          _nsu: string
          _order_id: string
          _parcelas: number
          _pos_device_id: string
          _provider: string
          _raw: Json
          _valor: number
        }
        Returns: string
      }
      record_tap_card_refund: {
        Args: { _charge_id: string; _raw: Json; _valor: number }
        Returns: {
          id: string
          status: string
          valor_reembolsado: number
        }[]
      }
      record_tap_pix_paid: {
        Args: {
          p_charge_id: string
          p_external_id: string
          p_raw: Json
          p_valor: number
        }
        Returns: undefined
      }
      recusar_solicitacao_mesa: {
        Args: { p_solicitacao_id: string }
        Returns: undefined
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
      registrar_entrada_produtos: {
        Args: {
          p_conta_financeira: string
          p_fornecedor: string
          p_itens: Json
          p_observacao: string
        }
        Returns: number
      }
      repeat_order: {
        Args: { p_host?: string; p_order_id: string }
        Returns: Json
      }
      resolve_empresa_id_by_host: { Args: { p_host: string }; Returns: string }
      reverse_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      save_tap_provider_config: {
        Args: {
          p_ambiente: string
          p_ativo: boolean
          p_credentials: Json
          p_provider: string
        }
        Returns: string
      }
      set_cliente_bloqueado: {
        Args: { p_bloqueado: boolean; p_user_id: string }
        Returns: undefined
      }
      set_fiado_config: {
        Args: { p_autorizado: boolean; p_limite: number; p_user_id: string }
        Returns: undefined
      }
      storage_path_empresa_allowed: {
        Args: { _name: string }
        Returns: boolean
      }
      storage_path_is_empresa_ativa: {
        Args: { _name: string }
        Returns: boolean
      }
      storage_path_is_empresa_prefixed: {
        Args: { _name: string }
        Returns: boolean
      }
      subproduto_unit_cost: { Args: { p_sub_id: string }; Returns: number }
      tap_daily_reconciliation: {
        Args: { _dia: string; _empresa_id: string }
        Returns: {
          bruto: number
          liquido: number
          modalidade: string
          provider: string
          qtd: number
          reembolsado: number
          tipo: string
        }[]
      }
      user_empresa_id: { Args: { _user_id: string }; Returns: string }
      verify_pos_device: {
        Args: { p_device: string; p_token: string }
        Returns: {
          empresa_id: string
          flavor: string
        }[]
      }
    }
    Enums: {
      ambiente_emissao_tipo: "Homologação/Testes" | "Produção"
      app_role: "admin" | "user" | "super_admin"
      attendance_type: "Delivery" | "Presencial"
      canal_venda_enum: "PWA" | "CAIXA" | "MESA" | "IFOOD" | "TELEFONE"
      cashback_mov_tipo:
        | "credito_ganho"
        | "debito_uso"
        | "debito_abatimento_fiado"
        | "ajuste_admin"
      cashback_tipo: "Credito" | "Debito"
      comanda_status:
        | "aberta"
        | "aguardando_fechamento"
        | "fechada"
        | "cancelada"
      fiado_tipo: "Debito_Compra" | "Credito_Pagamento"
      solicitacao_mesa_status:
        | "aguardando"
        | "liberada"
        | "recusada"
        | "expirada"
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
      canal_venda_enum: ["PWA", "CAIXA", "MESA", "IFOOD", "TELEFONE"],
      cashback_mov_tipo: [
        "credito_ganho",
        "debito_uso",
        "debito_abatimento_fiado",
        "ajuste_admin",
      ],
      cashback_tipo: ["Credito", "Debito"],
      comanda_status: [
        "aberta",
        "aguardando_fechamento",
        "fechada",
        "cancelada",
      ],
      fiado_tipo: ["Debito_Compra", "Credito_Pagamento"],
      solicitacao_mesa_status: [
        "aguardando",
        "liberada",
        "recusada",
        "expirada",
      ],
      tipo_conta_financeira: ["Físico", "Banco", "Recebível_Futuro"],
      tipo_lancamento_tesouraria: ["Entrada", "Saída"],
      tipo_promocao_enum: ["Combo", "Pack"],
    },
  },
} as const
