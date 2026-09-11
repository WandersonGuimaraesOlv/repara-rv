export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'client' | 'provider' | 'admin'
          full_name: string
          phone: string
          cpf_or_cnpj: string
          avatar_url: string | null
          terms_accepted_at: string | null
          self_declaration_signed: boolean | null
          created_at: string | null
          background_check_status?: 'pending' | 'approved' | 'rejected' | null
          is_blocked?: boolean | null
          completed_orders_count?: number | null
          rating_avg?: number | null
          mercado_pago_connected?: boolean | null
        }
        Insert: {
          id: string
          role?: 'client' | 'provider' | 'admin'
          full_name: string
          phone: string
          cpf_or_cnpj?: string
          avatar_url?: string | null
          terms_accepted_at?: string | null
          self_declaration_signed?: boolean | null
          created_at?: string | null
          background_check_status?: 'pending' | 'approved' | 'rejected' | null
          is_blocked?: boolean | null
          completed_orders_count?: number | null
          rating_avg?: number | null
          mercado_pago_connected?: boolean | null
        }
        Update: {
          id?: string
          role?: 'client' | 'provider' | 'admin'
          full_name?: string
          phone?: string
          cpf_or_cnpj?: string
          avatar_url?: string | null
          terms_accepted_at?: string | null
          self_declaration_signed?: boolean | null
          created_at?: string | null
          background_check_status?: 'pending' | 'approved' | 'rejected' | null
          is_blocked?: boolean | null
          completed_orders_count?: number | null
          rating_avg?: number | null
          mercado_pago_connected?: boolean | null
        }
      }
      provider_status: {
        Row: {
          provider_id: string
          is_online: boolean | null
          current_location: unknown | null
          pix_key: string
          pix_key_type: string
          recipient_gateway_id: string | null
          updated_at: string | null
        }
        Insert: {
          provider_id: string
          is_online?: boolean | null
          current_location?: unknown | null
          pix_key: string
          pix_key_type: string
          recipient_gateway_id?: string | null
          updated_at?: string | null
        }
        Update: {
          provider_id?: string
          is_online?: boolean | null
          current_location?: unknown | null
          pix_key?: string
          pix_key_type?: string
          recipient_gateway_id?: string | null
          updated_at?: string | null
        }
      }
      quick_services: {
        Row: {
          id: string
          name: string
          category: string
          description: string | null
          fixed_price: number
          platform_fee: number
          icon: string | null
          color: string | null
          is_active: boolean | null
          sort_order: number | null
        }
        Insert: {
          id?: string
          name: string
          category: string
          description?: string | null
          fixed_price: number
          platform_fee?: number
          icon?: string | null
          color?: string | null
          is_active?: boolean | null
          sort_order?: number | null
        }
        Update: {
          id?: string
          name?: string
          category?: string
          description?: string | null
          fixed_price?: number
          platform_fee?: number
          icon?: string | null
          color?: string | null
          is_active?: boolean | null
          sort_order?: number | null
        }
      }
      service_calls: {
        Row: {
          id: string
          client_id: string
          provider_id: string | null
          service_id: string
          total_price: number
          platform_fee: number
          provider_cut: number
          status: 'searching' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_providers_available'
          neighborhood: string
          client_address: string
          client_location: unknown
          arrived_at: string | null
          cancelled_by: string | null
          cancelled_by_role: 'client' | 'provider' | 'admin' | null
          cancellation_reason: string | null
          cancellation_stage: string | null
          cancel_reason: 'client_request' | 'provider_absent' | 'wrong_address' | 'technical_issue' | 'no_provider_found' | 'other' | null
          cancel_note: string | null
          cancel_by: string | null
          cancel_metadata: Json | null
          payment_status: 'pending' | 'paid' | 'refunded' | null
          pix_payment_id: string | null
          pix_qr_code: string | null
          pix_copy_paste: string | null
          created_at: string | null
          accepted_at: string | null
          completed_at: string | null
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          client_id: string
          provider_id?: string | null
          service_id: string
          total_price: number
          platform_fee: number
          provider_cut: number
          status?: 'searching' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_providers_available'
          neighborhood?: string
          client_address: string
          client_location: unknown
          arrived_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: 'client' | 'provider' | 'admin' | null
          cancellation_reason?: string | null
          cancellation_stage?: string | null
          cancel_reason?: 'client_request' | 'provider_absent' | 'wrong_address' | 'technical_issue' | 'no_provider_found' | 'other' | null
          cancel_note?: string | null
          cancel_by?: string | null
          cancel_metadata?: Json | null
          payment_status?: 'pending' | 'paid' | 'refunded' | null
          pix_payment_id?: string | null
          pix_qr_code?: string | null
          pix_copy_paste?: string | null
          created_at?: string | null
          accepted_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          provider_id?: string | null
          service_id?: string
          total_price?: number
          platform_fee?: number
          provider_cut?: number
          status?: 'searching' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_providers_available'
          neighborhood?: string
          client_address?: string
          client_location?: unknown
          arrived_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: 'client' | 'provider' | 'admin' | null
          cancellation_reason?: string | null
          cancellation_stage?: string | null
          cancel_reason?: 'client_request' | 'provider_absent' | 'wrong_address' | 'technical_issue' | 'no_provider_found' | 'other' | null
          cancel_note?: string | null
          cancel_by?: string | null
          cancel_metadata?: Json | null
          payment_status?: 'pending' | 'paid' | 'refunded' | null
          pix_payment_id?: string | null
          pix_qr_code?: string | null
          pix_copy_paste?: string | null
          created_at?: string | null
          accepted_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
        }
      }
      service_audit_logs: {
        Row: {
          id: string
          call_id: string
          action: string
          previous_status: 'searching' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_providers_available' | null
          new_status: 'searching' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_providers_available'
          changed_by: string | null
          cancellation_reason: string | null
          cancellation_stage: string | null
          old_payload: Json | null
          new_payload: Json | null
          cancel_reason: 'client_request' | 'provider_absent' | 'wrong_address' | 'technical_issue' | 'no_provider_found' | 'other' | null
          cancel_note: string | null
          cancel_by: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          call_id: string
          action?: string
          previous_status?: 'searching' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_providers_available' | null
          new_status: 'searching' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_providers_available'
          changed_by?: string | null
          cancellation_reason?: string | null
          cancellation_stage?: string | null
          old_payload?: Json | null
          new_payload?: Json | null
          cancel_reason?: 'client_request' | 'provider_absent' | 'wrong_address' | 'technical_issue' | 'no_provider_found' | 'other' | null
          cancel_note?: string | null
          cancel_by?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          call_id?: string
          action?: string
          previous_status?: 'searching' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_providers_available' | null
          new_status?: 'searching' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_providers_available'
          changed_by?: string | null
          cancellation_reason?: string | null
          cancellation_stage?: string | null
          old_payload?: Json | null
          new_payload?: Json | null
          cancel_reason?: 'client_request' | 'provider_absent' | 'wrong_address' | 'technical_issue' | 'no_provider_found' | 'other' | null
          cancel_note?: string | null
          cancel_by?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      service_ratings: {
        Row: {
          id: string
          call_id: string
          rating: number | null
          comment: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          call_id: string
          rating?: number | null
          comment?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          call_id?: string
          rating?: number | null
          comment?: string | null
          created_at?: string | null
        }
      }
      emergency_alerts: {
        Row: {
          id: string
          call_id: string
          triggered_by: string
          user_role: 'client' | 'provider' | 'admin'
          latitude: number | null
          longitude: number | null
          resolved: boolean | null
          resolved_notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          call_id: string
          triggered_by: string
          user_role: 'client' | 'provider' | 'admin'
          latitude?: number | null
          longitude?: number | null
          resolved?: boolean | null
          resolved_notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          call_id?: string
          triggered_by?: string
          user_role?: 'client' | 'provider' | 'admin'
          latitude?: number | null
          longitude?: number | null
          resolved?: boolean | null
          resolved_notes?: string | null
          created_at?: string | null
        }
      }
    }
    Functions: {
      find_nearest_provider: {
        Args: {
          call_location: unknown
          excluded_ids?: string[]
        }
        Returns: string | null
      }
    }
  }
}
