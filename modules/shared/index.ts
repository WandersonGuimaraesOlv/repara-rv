// =============================================================================
// modules/shared/index.ts
// Contrato público do módulo shared.
// Re-exporta utilitários globais e clientes Supabase para uso pelos módulos.
// REGRA: Apenas importar deste arquivo, nunca de caminhos profundos de lib/.
// =============================================================================

// Clientes Supabase
export { createClient as createServerClient } from '@/lib/supabase/server';

// Utilitários
export { cn } from '@/lib/utils';

// Tipos globais partilhados entre módulos
export type {
  UserRole,
  RideStatus,
  PaymentStatus,
  CancelReason,
  PixKeyType,
  Profile,
  ProviderStatus,
  GeoPoint,
  QuickService,
  ServiceCall,
  EmergencyAlert,
  CallMessage,
} from '@/lib/types';
