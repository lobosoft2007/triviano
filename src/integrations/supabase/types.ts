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
          min_items?: number
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
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
          status?: string
          updated_at?: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Relationships: []
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
          custo_unitario: number
          id: string
          nome: string
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          id?: string
          nome: string
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          id?: string
          nome?: string
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes_caixa: {
        Row: {
          created_at: string
          id: string
          id_caixa: string
          motivo: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          id_caixa: string
          motivo?: string
          tipo: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          id_caixa?: string
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
          created_at: string
          delivery_address: string
          discount: number
          id: string
          impresso_conta: boolean
          impresso_cozinha: boolean
          notes: string
          numero_mesa: number | null
          phone: string
          status: string
          tipo_atendimento: Database["public"]["Enums"]["attendance_type"]
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_address?: string
          discount?: number
          id?: string
          impresso_conta?: boolean
          impresso_cozinha?: boolean
          notes?: string
          numero_mesa?: number | null
          phone?: string
          status?: string
          tipo_atendimento?: Database["public"]["Enums"]["attendance_type"]
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_address?: string
          discount?: number
          id?: string
          impresso_conta?: boolean
          impresso_cozinha?: boolean
          notes?: string
          numero_mesa?: number | null
          phone?: string
          status?: string
          tipo_atendimento?: Database["public"]["Enums"]["attendance_type"]
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          addons: Json
          available: boolean
          category_id: string
          created_at: string
          description: string
          free_addon_limit: number
          free_addon_price: number
          free_addons: Json
          id: string
          image_url: string
          name: string
          price: number
          price_options: Json
          sort_order: number
        }
        Insert: {
          addons?: Json
          available?: boolean
          category_id: string
          created_at?: string
          description?: string
          free_addon_limit?: number
          free_addon_price?: number
          free_addons?: Json
          id?: string
          image_url?: string
          name: string
          price: number
          price_options?: Json
          sort_order?: number
        }
        Update: {
          addons?: Json
          available?: boolean
          category_id?: string
          created_at?: string
          description?: string
          free_addon_limit?: number
          free_addon_price?: number
          free_addons?: Json
          id?: string
          image_url?: string
          name?: string
          price?: number
          price_options?: Json
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
        ]
      }
      profiles: {
        Row: {
          address: string
          created_at: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string
          created_at?: string
          full_name?: string
          id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      attendance_type: "Delivery" | "Presencial"
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
      app_role: ["admin", "user"],
      attendance_type: ["Delivery", "Presencial"],
    },
  },
} as const
