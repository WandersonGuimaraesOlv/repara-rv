export type UserRole = 'client' | 'provider' | 'admin'

export type RideStatus =
  | 'searching'
  | 'accepted'
  | 'on_the_way'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_providers_available'

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
  payment_status?: PaymentStatus
  pix_payment_id?: string | null
  pix_qr_code?: string | null
  pix_copy_paste?: string | null
  created_at: string
  accepted_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
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
