// =============================================================================
// modules/providers/index.ts — Contrato público do domínio de prestadores
// =============================================================================

export {
  goOnline,
  goOffline,
  updateLocation,
} from './services/provider-service';

export type {
  GoOnlineInput,
  UpdateLocationInput,
} from './services/provider-service';
