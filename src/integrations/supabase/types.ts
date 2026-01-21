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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_account_movements: {
        Row: {
          amount: number
          balance_after: number
          client_id: string
          created_at: string
          id: string
          movement_date: string
          movement_type: string
          notes: string | null
          organization_id: string
          payment_method: string | null
          reference_number: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          amount: number
          balance_after?: number
          client_id: string
          created_at?: string
          id?: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          organization_id: string
          payment_method?: string | null
          reference_number?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          client_id?: string
          created_at?: string
          id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          organization_id?: string
          payment_method?: string | null
          reference_number?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_account_movements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_account_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_balance: number
          address: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_name: string | null
          country: string
          created_at: string
          email: string | null
          first_name: string | null
          governorate: string | null
          id: string
          identifier_type: string
          identifier_value: string
          last_name: string | null
          organization_id: string
          phone: string | null
          phone_prefix: string | null
          postal_code: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          whatsapp: string | null
          whatsapp_prefix: string | null
        }
        Insert: {
          account_balance?: number
          address?: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          governorate?: string | null
          id?: string
          identifier_type: string
          identifier_value: string
          last_name?: string | null
          organization_id: string
          phone?: string | null
          phone_prefix?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          whatsapp?: string | null
          whatsapp_prefix?: string | null
        }
        Update: {
          account_balance?: number
          address?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          governorate?: string | null
          id?: string
          identifier_type?: string
          identifier_value?: string
          last_name?: string | null
          organization_id?: string
          phone?: string | null
          phone_prefix?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          whatsapp?: string | null
          whatsapp_prefix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_lines: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string | null
          discount_percent: number
          id: string
          invoice_line_id: string | null
          line_order: number
          line_total_ht: number
          line_total_ttc: number
          line_vat: number
          product_id: string | null
          quantity: number
          return_reason: string | null
          stock_restored: boolean
          unit_price_ht: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_line_id?: string | null
          line_order?: number
          line_total_ht?: number
          line_total_ttc?: number
          line_vat?: number
          product_id?: string | null
          quantity?: number
          return_reason?: string | null
          stock_restored?: boolean
          unit_price_ht?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_line_id?: string | null
          line_order?: number
          line_total_ht?: number
          line_total_ttc?: number
          line_vat?: number
          product_id?: string | null
          quantity?: number
          return_reason?: string | null
          stock_restored?: boolean
          unit_price_ht?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_invoice_line_id_fkey"
            columns: ["invoice_line_id"]
            isOneToOne: false
            referencedRelation: "invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          client_id: string
          created_at: string
          credit_available: number
          credit_blocked: number
          credit_generated: number
          credit_note_counter: number
          credit_note_date: string
          credit_note_number: string
          credit_note_prefix: string
          credit_note_type: Database["public"]["Enums"]["credit_note_type"]
          credit_note_year: number
          credit_used: number
          currency: string
          id: string
          invoice_id: string
          net_amount: number
          notes: string | null
          organization_id: string
          reason: string | null
          stamp_duty_amount: number
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal_ht: number
          total_ttc: number
          total_vat: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          credit_available?: number
          credit_blocked?: number
          credit_generated?: number
          credit_note_counter: number
          credit_note_date?: string
          credit_note_number: string
          credit_note_prefix: string
          credit_note_type: Database["public"]["Enums"]["credit_note_type"]
          credit_note_year: number
          credit_used?: number
          currency?: string
          id?: string
          invoice_id: string
          net_amount?: number
          notes?: string | null
          organization_id: string
          reason?: string | null
          stamp_duty_amount?: number
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal_ht?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          credit_available?: number
          credit_blocked?: number
          credit_generated?: number
          credit_note_counter?: number
          credit_note_date?: string
          credit_note_number?: string
          credit_note_prefix?: string
          credit_note_type?: Database["public"]["Enums"]["credit_note_type"]
          credit_note_year?: number
          credit_used?: number
          currency?: string
          id?: string
          invoice_id?: string
          net_amount?: number
          notes?: string | null
          organization_id?: string
          reason?: string | null
          stamp_duty_amount?: number
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal_ht?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_families: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          created_at: string
          from_currency: string
          id: string
          is_default: boolean
          organization_id: string
          rate: number
          to_currency: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_currency: string
          id?: string
          is_default?: boolean
          organization_id: string
          rate: number
          to_currency?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_currency?: string
          id?: string
          is_default?: boolean
          organization_id?: string
          rate?: number
          to_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_folder_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          import_folder_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          import_folder_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          import_folder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_folder_logs_import_folder_id_fkey"
            columns: ["import_folder_id"]
            isOneToOne: false
            referencedRelation: "import_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      import_folders: {
        Row: {
          country: string
          created_at: string
          folder_month: number
          folder_number: string
          folder_year: number
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["import_folder_status"]
          updated_at: string
        }
        Insert: {
          country: string
          created_at?: string
          folder_month: number
          folder_number: string
          folder_year: number
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["import_folder_status"]
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          folder_month?: number
          folder_number?: string
          folder_year?: number
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["import_folder_status"]
          updated_at?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          invoice_id: string
          line_order: number
          line_total_ht: number
          line_total_ttc: number
          line_vat: number
          product_id: string
          quantity: number
          unit_price_ht: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id: string
          line_order?: number
          line_total_ht?: number
          line_total_ttc?: number
          line_vat?: number
          product_id: string
          quantity: number
          unit_price_ht: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id?: string
          line_order?: number
          line_total_ht?: number
          line_total_ttc?: number
          line_vat?: number
          product_id?: string
          quantity?: number
          unit_price_ht?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          client_type: string
          created_at: string
          credit_note_count: number
          currency: string
          due_date: string | null
          exchange_rate: number | null
          id: string
          invoice_counter: number
          invoice_date: string
          invoice_number: string
          invoice_prefix: string
          invoice_year: number
          net_payable: number
          notes: string | null
          organization_id: string
          paid_amount: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          stamp_duty_amount: number
          stamp_duty_enabled: boolean
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_ht: number
          total_credited: number
          total_discount: number
          total_ttc: number
          total_vat: number
          updated_at: string
          withholding_amount: number
          withholding_applied: boolean
          withholding_rate: number
        }
        Insert: {
          client_id: string
          client_type: string
          created_at?: string
          credit_note_count?: number
          currency?: string
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_counter: number
          invoice_date: string
          invoice_number: string
          invoice_prefix: string
          invoice_year: number
          net_payable?: number
          notes?: string | null
          organization_id: string
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          stamp_duty_amount?: number
          stamp_duty_enabled?: boolean
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_ht?: number
          total_credited?: number
          total_discount?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string
          withholding_amount?: number
          withholding_applied?: boolean
          withholding_rate?: number
        }
        Update: {
          client_id?: string
          client_type?: string
          created_at?: string
          credit_note_count?: number
          currency?: string
          due_date?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_counter?: number
          invoice_date?: string
          invoice_number?: string
          invoice_prefix?: string
          invoice_year?: number
          net_payable?: number
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          stamp_duty_amount?: number
          stamp_duty_enabled?: boolean
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_ht?: number
          total_credited?: number
          total_discount?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string
          withholding_amount?: number
          withholding_applied?: boolean
          withholding_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_banks: {
        Row: {
          bank_name: string | null
          created_at: string
          iban: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          iban: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          iban?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_banks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          governorate: string
          id: string
          identifier: string | null
          identifier_locked: boolean
          identifier_type: string | null
          logo_url: string | null
          name: string
          org_type: string
          phone: string
          postal_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          governorate: string
          id?: string
          identifier?: string | null
          identifier_locked?: boolean
          identifier_type?: string | null
          logo_url?: string | null
          name: string
          org_type: string
          phone: string
          postal_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          governorate?: string
          id?: string
          identifier?: string | null
          identifier_locked?: boolean
          identifier_type?: string | null
          logo_url?: string | null
          name?: string
          org_type?: string
          phone?: string
          postal_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          net_amount: number
          notes: string | null
          payment_date: string
          payment_method: string
          reference_number: string | null
          updated_at: string
          withholding_amount: number
          withholding_rate: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          net_amount: number
          notes?: string | null
          payment_date?: string
          payment_method: string
          reference_number?: string | null
          updated_at?: string
          withholding_amount?: number
          withholding_rate?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          net_amount?: number
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          updated_at?: string
          withholding_amount?: number
          withholding_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_public_uploads: {
        Row: {
          analysis_data: Json | null
          created_at: string
          customs_declaration_number: string | null
          customs_office: string | null
          document_category: string | null
          document_date: string | null
          document_number: string | null
          document_type: string | null
          file_hash: string | null
          id: string
          import_folder_id: string | null
          importer_name: string | null
          new_filename: string | null
          organization_id: string
          original_filename: string
          quittance_type: string | null
          status: string
          storage_path: string
          supplier_detected: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          analysis_data?: Json | null
          created_at?: string
          customs_declaration_number?: string | null
          customs_office?: string | null
          document_category?: string | null
          document_date?: string | null
          document_number?: string | null
          document_type?: string | null
          file_hash?: string | null
          id?: string
          import_folder_id?: string | null
          importer_name?: string | null
          new_filename?: string | null
          organization_id: string
          original_filename: string
          quittance_type?: string | null
          status?: string
          storage_path: string
          supplier_detected?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          analysis_data?: Json | null
          created_at?: string
          customs_declaration_number?: string | null
          customs_office?: string | null
          document_category?: string | null
          document_date?: string | null
          document_number?: string | null
          document_type?: string | null
          file_hash?: string | null
          id?: string
          import_folder_id?: string | null
          importer_name?: string | null
          new_filename?: string | null
          organization_id?: string
          original_filename?: string
          quittance_type?: string | null
          status?: string
          storage_path?: string
          supplier_detected?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_public_uploads_import_folder_id_fkey"
            columns: ["import_folder_id"]
            isOneToOne: false
            referencedRelation: "import_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_public_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reservations: {
        Row: {
          client_id: string
          created_at: string
          expiration_date: string | null
          id: string
          notes: string | null
          organization_id: string
          product_id: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          product_id: string
          quantity: number
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reservations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_out_of_stock_sale: boolean | null
          created_at: string
          current_stock: number | null
          ean: string | null
          id: string
          max_discount: number | null
          name: string
          organization_id: string
          price_ht: number
          price_ttc: number
          product_type: Database["public"]["Enums"]["product_type"]
          purchase_year: number
          reference: string | null
          reserved_stock: number
          status: Database["public"]["Enums"]["product_status"]
          unit: string | null
          unlimited_stock: boolean
          updated_at: string
          vat_rate: number
        }
        Insert: {
          allow_out_of_stock_sale?: boolean | null
          created_at?: string
          current_stock?: number | null
          ean?: string | null
          id?: string
          max_discount?: number | null
          name: string
          organization_id: string
          price_ht: number
          price_ttc: number
          product_type: Database["public"]["Enums"]["product_type"]
          purchase_year?: number
          reference?: string | null
          reserved_stock?: number
          status?: Database["public"]["Enums"]["product_status"]
          unit?: string | null
          unlimited_stock?: boolean
          updated_at?: string
          vat_rate: number
        }
        Update: {
          allow_out_of_stock_sale?: boolean | null
          created_at?: string
          current_stock?: number | null
          ean?: string | null
          id?: string
          max_discount?: number | null
          name?: string
          organization_id?: string
          price_ht?: number
          price_ttc?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          purchase_year?: number
          reference?: string | null
          reserved_stock?: number
          status?: Database["public"]["Enums"]["product_status"]
          unit?: string | null
          unlimited_stock?: boolean
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_upload_links: {
        Row: {
          access_code: string
          access_token: string
          created_at: string
          file_prefix: string | null
          id: string
          is_active: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          access_code: string
          access_token: string
          created_at?: string
          file_prefix?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          access_token?: string
          created_at?: string
          file_prefix?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_upload_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_documents: {
        Row: {
          created_at: string
          credit_note_count: number
          currency: string
          document_family_id: string | null
          exchange_rate: number
          id: string
          import_folder_id: string | null
          invoice_date: string | null
          invoice_number: string | null
          net_payable: number
          notes: string | null
          organization_id: string
          paid_amount: number
          payment_status: Database["public"]["Enums"]["purchase_payment_status"]
          pdf_hash: string | null
          pdf_url: string | null
          stamp_duty_amount: number
          status: Database["public"]["Enums"]["purchase_status"]
          subtotal_ht: number
          supplier_id: string | null
          total_credited: number
          total_discount: number
          total_ttc: number
          total_vat: number
          updated_at: string
          withholding_amount: number
          withholding_applied: boolean
          withholding_rate: number
        }
        Insert: {
          created_at?: string
          credit_note_count?: number
          currency?: string
          document_family_id?: string | null
          exchange_rate?: number
          id?: string
          import_folder_id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          net_payable?: number
          notes?: string | null
          organization_id: string
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["purchase_payment_status"]
          pdf_hash?: string | null
          pdf_url?: string | null
          stamp_duty_amount?: number
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal_ht?: number
          supplier_id?: string | null
          total_credited?: number
          total_discount?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string
          withholding_amount?: number
          withholding_applied?: boolean
          withholding_rate?: number
        }
        Update: {
          created_at?: string
          credit_note_count?: number
          currency?: string
          document_family_id?: string | null
          exchange_rate?: number
          id?: string
          import_folder_id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          net_payable?: number
          notes?: string | null
          organization_id?: string
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["purchase_payment_status"]
          pdf_hash?: string | null
          pdf_url?: string | null
          stamp_duty_amount?: number
          status?: Database["public"]["Enums"]["purchase_status"]
          subtotal_ht?: number
          supplier_id?: string | null
          total_credited?: number
          total_discount?: number
          total_ttc?: number
          total_vat?: number
          updated_at?: string
          withholding_amount?: number
          withholding_applied?: boolean
          withholding_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_documents_document_family_id_fkey"
            columns: ["document_family_id"]
            isOneToOne: false
            referencedRelation: "document_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_documents_import_folder_id_fkey"
            columns: ["import_folder_id"]
            isOneToOne: false
            referencedRelation: "import_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_lines: {
        Row: {
          created_at: string
          discount_percent: number
          ean: string | null
          id: string
          is_existing_product: boolean
          is_new_product: boolean
          line_order: number
          line_total_ht: number
          line_total_ttc: number
          line_vat: number
          name: string
          product_id: string | null
          product_type: string
          purchase_document_id: string
          quantity: number
          reference: string | null
          unit_price_ht: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          ean?: string | null
          id?: string
          is_existing_product?: boolean
          is_new_product?: boolean
          line_order?: number
          line_total_ht?: number
          line_total_ttc?: number
          line_vat?: number
          name: string
          product_id?: string | null
          product_type?: string
          purchase_document_id: string
          quantity?: number
          reference?: string | null
          unit_price_ht?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          discount_percent?: number
          ean?: string | null
          id?: string
          is_existing_product?: boolean
          is_new_product?: boolean
          line_order?: number
          line_total_ht?: number
          line_total_ttc?: number
          line_vat?: number
          name?: string
          product_id?: string | null
          product_type?: string
          purchase_document_id?: string
          quantity?: number
          reference?: string | null
          unit_price_ht?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_lines_purchase_document_id_fkey"
            columns: ["purchase_document_id"]
            isOneToOne: false
            referencedRelation: "purchase_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          net_amount: number
          notes: string | null
          payment_date: string
          payment_method: string
          purchase_document_id: string
          reference_number: string | null
          updated_at: string
          withholding_amount: number
          withholding_rate: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          net_amount: number
          notes?: string | null
          payment_date?: string
          payment_method: string
          purchase_document_id: string
          reference_number?: string | null
          updated_at?: string
          withholding_amount?: number
          withholding_rate?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          net_amount?: number
          notes?: string | null
          payment_date?: string
          payment_method?: string
          purchase_document_id?: string
          reference_number?: string | null
          updated_at?: string
          withholding_amount?: number
          withholding_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payments_purchase_document_id_fkey"
            columns: ["purchase_document_id"]
            isOneToOne: false
            referencedRelation: "purchase_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_request_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_order: number
          notes: string | null
          quantity: number | null
          quote_request_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_order?: number
          notes?: string | null
          quantity?: number | null
          quote_request_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_order?: number
          notes?: string | null
          quantity?: number | null
          quote_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_request_items_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_request_links: {
        Row: {
          access_code: string
          access_token: string
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          access_code: string
          access_token: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          access_token?: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_request_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_request_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          quote_request_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          quote_request_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          quote_request_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_request_messages_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          address: string | null
          ai_conversation_summary: string | null
          ai_extracted_needs: string | null
          client_id: string | null
          client_type: string
          company_name: string | null
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          governorate: string | null
          id: string
          identifier_type: string | null
          identifier_value: string | null
          last_name: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          phone_prefix: string | null
          postal_code: string | null
          request_date: string
          request_number: string
          status: string
          updated_at: string
          whatsapp: string | null
          whatsapp_prefix: string | null
        }
        Insert: {
          address?: string | null
          ai_conversation_summary?: string | null
          ai_extracted_needs?: string | null
          client_id?: string | null
          client_type: string
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          governorate?: string | null
          id?: string
          identifier_type?: string | null
          identifier_value?: string | null
          last_name?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          phone_prefix?: string | null
          postal_code?: string | null
          request_date?: string
          request_number: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
          whatsapp_prefix?: string | null
        }
        Update: {
          address?: string | null
          ai_conversation_summary?: string | null
          ai_extracted_needs?: string | null
          client_id?: string | null
          client_type?: string
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          governorate?: string | null
          id?: string
          identifier_type?: string | null
          identifier_value?: string | null
          last_name?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          phone_prefix?: string | null
          postal_code?: string | null
          request_date?: string
          request_number?: string
          status?: string
          updated_at?: string
          whatsapp?: string | null
          whatsapp_prefix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          previous_stock: number
          product_id: string
          quantity: number
          reason_category: string
          reason_detail: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          previous_stock: number
          product_id: string
          quantity: number
          reason_category: string
          reason_detail: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          new_stock?: number
          previous_stock?: number
          product_id?: string
          quantity?: number
          reason_category?: string
          reason_detail?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          google_maps_link: string | null
          governorate: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          google_maps_link?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          google_maps_link?: string | null
          governorate?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_credit_note_lines: {
        Row: {
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          line_order: number
          line_total_ht: number
          line_total_ttc: number
          line_vat: number
          product_id: string | null
          purchase_line_id: string | null
          quantity: number
          return_reason: string | null
          stock_deducted: boolean
          supplier_credit_note_id: string
          unit_price_ht: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          line_order?: number
          line_total_ht?: number
          line_total_ttc?: number
          line_vat?: number
          product_id?: string | null
          purchase_line_id?: string | null
          quantity?: number
          return_reason?: string | null
          stock_deducted?: boolean
          supplier_credit_note_id: string
          unit_price_ht?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          line_order?: number
          line_total_ht?: number
          line_total_ttc?: number
          line_vat?: number
          product_id?: string | null
          purchase_line_id?: string | null
          quantity?: number
          return_reason?: string | null
          stock_deducted?: boolean
          supplier_credit_note_id?: string
          unit_price_ht?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_credit_note_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_credit_note_lines_purchase_line_id_fkey"
            columns: ["purchase_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_credit_note_lines_supplier_credit_note_id_fkey"
            columns: ["supplier_credit_note_id"]
            isOneToOne: false
            referencedRelation: "supplier_credit_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_credit_notes: {
        Row: {
          created_at: string
          credit_available: number
          credit_blocked: number
          credit_generated: number
          credit_note_counter: number
          credit_note_date: string
          credit_note_number: string
          credit_note_prefix: string
          credit_note_type: string
          credit_note_year: number
          credit_used: number
          currency: string
          exchange_rate: number
          id: string
          net_amount: number
          notes: string | null
          organization_id: string
          purchase_document_id: string
          reason: string | null
          stamp_duty_amount: number
          status: string
          subtotal_ht: number
          supplier_id: string
          total_ttc: number
          total_vat: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_available?: number
          credit_blocked?: number
          credit_generated?: number
          credit_note_counter: number
          credit_note_date?: string
          credit_note_number: string
          credit_note_prefix: string
          credit_note_type: string
          credit_note_year: number
          credit_used?: number
          currency?: string
          exchange_rate?: number
          id?: string
          net_amount?: number
          notes?: string | null
          organization_id: string
          purchase_document_id: string
          reason?: string | null
          stamp_duty_amount?: number
          status?: string
          subtotal_ht?: number
          supplier_id: string
          total_ttc?: number
          total_vat?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_available?: number
          credit_blocked?: number
          credit_generated?: number
          credit_note_counter?: number
          credit_note_date?: string
          credit_note_number?: string
          credit_note_prefix?: string
          credit_note_type?: string
          credit_note_year?: number
          credit_used?: number
          currency?: string
          exchange_rate?: number
          id?: string
          net_amount?: number
          notes?: string | null
          organization_id?: string
          purchase_document_id?: string
          reason?: string | null
          stamp_duty_amount?: number
          status?: string
          subtotal_ht?: number
          supplier_id?: string
          total_ttc?: number
          total_vat?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_credit_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_credit_notes_purchase_document_id_fkey"
            columns: ["purchase_document_id"]
            isOneToOne: false
            referencedRelation: "purchase_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_credit_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company_name: string | null
          country: string
          created_at: string
          email: string | null
          first_name: string | null
          governorate: string | null
          id: string
          identifier_type: string | null
          identifier_value: string | null
          last_name: string | null
          organization_id: string
          phone: string | null
          phone_prefix: string | null
          postal_code: string | null
          status: Database["public"]["Enums"]["supplier_status"]
          supplier_type: Database["public"]["Enums"]["supplier_type"]
          updated_at: string
          whatsapp: string | null
          whatsapp_prefix: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          governorate?: string | null
          id?: string
          identifier_type?: string | null
          identifier_value?: string | null
          last_name?: string | null
          organization_id: string
          phone?: string | null
          phone_prefix?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          supplier_type: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
          whatsapp?: string | null
          whatsapp_prefix?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          governorate?: string | null
          id?: string
          identifier_type?: string | null
          identifier_value?: string | null
          last_name?: string | null
          organization_id?: string
          phone?: string | null
          phone_prefix?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          supplier_type?: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
          whatsapp?: string | null
          whatsapp_prefix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_client_balance: { Args: { p_client_id: string }; Returns: number }
      has_organization: { Args: never; Returns: boolean }
      is_credit_note_owner: {
        Args: { credit_note_id: string }
        Returns: boolean
      }
      is_import_folder_owner: { Args: { folder_id: string }; Returns: boolean }
      is_invoice_owner: { Args: { invoice_id: string }; Returns: boolean }
      is_organization_owner: { Args: { org_id: string }; Returns: boolean }
      is_product_owner: { Args: { product_id: string }; Returns: boolean }
      is_purchase_document_owner: {
        Args: { purchase_doc_id: string }
        Returns: boolean
      }
      is_purchase_payment_owner: {
        Args: { payment_id: string }
        Returns: boolean
      }
      is_reservation_owner: {
        Args: { reservation_id: string }
        Returns: boolean
      }
      is_supplier_credit_note_owner: {
        Args: { scn_id: string }
        Returns: boolean
      }
    }
    Enums: {
      client_status: "active" | "archived"
      client_type: "individual_local" | "business_local" | "foreign"
      credit_note_status: "draft" | "validated" | "cancelled"
      credit_note_type: "financial" | "product_return"
      import_folder_status: "open" | "closed"
      invoice_status: "created" | "draft" | "validated"
      payment_status: "unpaid" | "partial" | "paid"
      product_status: "active" | "archived"
      product_type: "physical" | "service"
      purchase_payment_status: "unpaid" | "partial" | "paid"
      purchase_status: "pending" | "validated" | "cancelled"
      stock_movement_type: "add" | "remove"
      supplier_status: "active" | "archived"
      supplier_type: "individual_local" | "business_local" | "foreign"
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
      client_status: ["active", "archived"],
      client_type: ["individual_local", "business_local", "foreign"],
      credit_note_status: ["draft", "validated", "cancelled"],
      credit_note_type: ["financial", "product_return"],
      import_folder_status: ["open", "closed"],
      invoice_status: ["created", "draft", "validated"],
      payment_status: ["unpaid", "partial", "paid"],
      product_status: ["active", "archived"],
      product_type: ["physical", "service"],
      purchase_payment_status: ["unpaid", "partial", "paid"],
      purchase_status: ["pending", "validated", "cancelled"],
      stock_movement_type: ["add", "remove"],
      supplier_status: ["active", "archived"],
      supplier_type: ["individual_local", "business_local", "foreign"],
    },
  },
} as const
