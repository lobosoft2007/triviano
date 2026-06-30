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
      categories: {
        Row: {
          allows_half: boolean
          combo_role: string
          created_at: string
          id: string
          id_impressora_destino: string | null
          min_items: number
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          allows_half?: boolean
          combo_role?: string
          created_at?: string
          id?: string
          id_impressora_destino?: string | null
          min_items?: number
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          allows_half?: boolean
          combo_role?: string
          created_at?: string
          id?: string
          id_impressora_destino?: string | null
          min_items?: number
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_id_impressora_destino_fkey"
            columns: ["id_impressora_destino"]
            isOneToOne: false
            referencedRelation: "config_impressoras"
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
      extrato_fiado: {
        Row: {
          created_at: string
          id: string
          id_pedido: string | null
          id_usuario: string
          saldo_devedor_momento: number
          tipo: Database["public"]["Enums"]["fiado_tipo"]
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          id_pedido?: string | null
          id_usuario: string
          saldo_devedor_momento?: number
          tipo: Database["public"]["Enums"]["fiado_tipo"]
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          id_pedido?: string | null
          id_usuario?: string
          saldo_devedor_momento?: number
          tipo?: Database["public"]["Enums"]["fiado_tipo"]
          valor?: number
        }
        Relationships: [
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
          id: string
          id_pedido: string | null
          id_usuario: string
          tipo: Database["public"]["Enums"]["cashback_tipo"]
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string
          id?: string
          id_pedido?: string | null
          id_usuario: string
          tipo: Database["public"]["Enums"]["cashback_tipo"]
          valor?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          id_pedido?: string | null
          id_usuario?: string
          tipo?: Database["public"]["Enums"]["cashback_tipo"]
          valor?: number
        }
        Relationships: [
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
          created_at: string
          custo_anterior: number | null
          custo_anterior_at: string | null
          custo_unitario: number
          estocavel: boolean
          fornecedor_id: string | null
          id: string
          nome: string
          setor_id: string | null
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_anterior?: number | null
          custo_anterior_at?: string | null
          custo_unitario?: number
          estocavel?: boolean
          fornecedor_id?: string | null
          id?: string
          nome: string
          setor_id?: string | null
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_anterior?: number | null
          custo_anterior_at?: string | null
          custo_unitario?: number
          estocavel?: boolean
          fornecedor_id?: string | null
          id?: string
          nome?: string
          setor_id?: string | null
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
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
        Relationships: []
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
          fornecedor_id: string | null
          free_addon_limit: number
          id: string
          image_url: string
          manipulado: boolean
          name: string
          price: number
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
          fornecedor_id?: string | null
          free_addon_limit?: number
          id?: string
          image_url?: string
          manipulado?: boolean
          name: string
          price: number
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
          fornecedor_id?: string | null
          free_addon_limit?: number
          id?: string
          image_url?: string
          manipulado?: boolean
          name?: string
          price?: number
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
          nome: string
          preco: number
          produto_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          preco?: number
          produto_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          preco?: number
          produto_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
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
          nome: string
          preco: number
          produto_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          preco?: number
          produto_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          preco?: number
          produto_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
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
          created_at: string
          fiado_autorizado: boolean
          full_name: string
          id: string
          limite_fiado: number
          phone: string
          push_token: string | null
          saldo_cashback: number
          saldo_devedor_fiado: number
          updated_at: string
        }
        Insert: {
          address?: string
          created_at?: string
          fiado_autorizado?: boolean
          full_name?: string
          id: string
          limite_fiado?: number
          phone?: string
          push_token?: string | null
          saldo_cashback?: number
          saldo_devedor_fiado?: number
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          fiado_autorizado?: boolean
          full_name?: string
          id?: string
          limite_fiado?: number
          phone?: string
          push_token?: string | null
          saldo_cashback?: number
          saldo_devedor_fiado?: number
          updated_at?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      redeem_cashback_for_order: {
        Args: { p_amount: number; p_order_id: string }
        Returns: number
      }
      set_fiado_config: {
        Args: { p_autorizado: boolean; p_limite: number; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      ambiente_emissao_tipo: "Homologação/Testes" | "Produção"
      app_role: "admin" | "user"
      attendance_type: "Delivery" | "Presencial"
      cashback_tipo: "Credito" | "Debito"
      fiado_tipo: "Debito_Compra" | "Credito_Pagamento"
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
      app_role: ["admin", "user"],
      attendance_type: ["Delivery", "Presencial"],
      cashback_tipo: ["Credito", "Debito"],
      fiado_tipo: ["Debito_Compra", "Credito_Pagamento"],
    },
  },
} as const
