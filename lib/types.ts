export type UserRole = 'client' | 'provider' | 'admin'

export type RideStatus =
  | 'searching'
  | 'queued'
  | 'accepted'
  | 'on_the_way'
  | 'in_progress'
  // Técnico concluiu; o cliente confere antes do Pix (migration
  // 20260924_client_approves_completion.sql)
  | 'awaiting_approval'
  | 'completed'
  | 'cancelled'
  | 'no_providers_available'
  // Ficou as 2h da fila sem técnico (app/api/cron/stale-calls-radar)
  | 'expired'

export type PaymentStatus = 'pending' | 'paid' | 'refunded'

export type CancelReason =
  | 'client_request'
  | 'provider_absent'
  | 'wrong_address'
  | 'technical_issue'
  | 'no_provider_found'
  | 'other'

export type PixKeyType = 'cpf' | 'phone' | 'email' | 'random'

// ─── Perfil ────────────────────────────────────────────────
export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone: string
  cpf_or_cnpj?: string
  avatar_url?: string | null
  terms_accepted_at?: string
  self_declaration_signed?: boolean
  created_at: string
  pix_key?: string
  pix_key_type?: PixKeyType
  is_active?: boolean
  background_check_status?: 'pending' | 'approved' | 'rejected'
  verified_at?: string | null
  verified_by?: string | null
  rejection_reason?: string | null
  is_blocked?: boolean
  completed_orders_count?: number
  rating_avg?: number
  mercado_pago_connected?: boolean
}

// ─── Status do Prestador ───────────────────────────────────
export interface ProviderStatus {
  provider_id: string
  is_online: boolean
  current_location: GeoPoint | null
  pix_key: string
  pix_key_type: PixKeyType
  updated_at: string
}

// ─── Geo Point (formato GeoJSON simplificado do PostGIS) ───
export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number] // [lng, lat]
}

// ─── Serviço Rápido ────────────────────────────────────────
export interface QuickService {
  id: string
  name: string
  category: string
  description: string | null
  fixed_price: number
  platform_fee: number
  icon: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  created_at?: string
  included?: string[]
  not_included?: string[]
  duration_est?: string | null
}

// ─── Chamado de Serviço ────────────────────────────────────
export interface ServiceCall {
  id: string
  client_id: string
  provider_id?: string | null
  service_id: string
  total_price: number
  platform_fee: number
  provider_cut: number
  status: RideStatus
  client_address: string
  client_location: GeoPoint
  cancel_reason?: CancelReason | null
  cancel_note?: string | null
  cancelled_by_role?: UserRole | null
  payment_status?: PaymentStatus
  pix_payment_id?: string | null
  pix_qr_code?: string | null
  pix_copy_paste?: string | null
  created_at: string
  accepted_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  expires_at?: string | null
  updated_at?: string | null
  cancel_metadata?: Record<string, any>
  neighborhood?: string | null
  // Taxa de deslocamento (no-show, R$25) — ver migration 20260917_no_show_fee.sql
  no_show_fee_status?: 'pending' | 'paid' | null
  no_show_fee_payment_id?: string | null
  no_show_fee_pix_qr_code?: string | null
  no_show_fee_pix_copy_paste?: string | null
  // Verificação de identidade do prestador — ver migration
  // 20260918_provider_identity_verification.sql
  arrival_pin?: string | null
  started_at?: string | null
  // Conferência do cliente antes do Pix — ver migration
  // 20260924_client_approves_completion.sql
  completion_requested_at?: string | null
  completion_approved_at?: string | null
  completion_approved_by?: string | null
  completion_issue?: string | null
  completion_issue_count?: number
  // Joins opcionais
  service?: QuickService
  client?: Profile
  provider?: Profile
}

// ─── Avaliação ─────────────────────────────────────────────
export interface ServiceRating {
  id: string
  call_id: string
  rating: number
  comment: string | null
  created_at: string
}

// ─── Payloads de API ───────────────────────────────────────
export interface CreateCallPayload {
  service_id: string
  client_address: string
  client_lat: number
  client_lng: number
}

export interface CancelCallPayload {
  call_id: string
  reason: CancelReason
  note?: string
}

export interface PixCreatePayload {
  call_id: string
  amount: number
  description: string
  payer_email?: string
}

export interface PixWebhookPayload {
  action: string
  data: { id: string }
}

// ─── Alertas de Emergência (Central de Segurança / Botão SOS) ─
export interface EmergencyAlert {
  id: string
  call_id: string
  triggered_by: string
  user_role: UserRole
  latitude?: number | null
  longitude?: number | null
  resolved: boolean
  resolved_notes?: string | null
  created_at: string
}

export interface EmergencyNotifyPayload {
  call_id: string
  user_role: UserRole
  latitude?: number | null
  longitude?: number | null
  triggered_by?: string
}

// ─── Mensagens do Chamado (Chat em Tempo Real) ─────────────
export interface CallMessage {
  id: string
  call_id: string
  sender_id: string
  sender_role: UserRole
  message: string
  created_at: string
}


