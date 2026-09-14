// =============================================================================
// modules/compliance/index.ts — Contrato público do domínio de compliance
// =============================================================================

export {
  checkBan,
  createBan,
  revokeBan,
} from './services/ban-service';

export type { CreateBanInput, CheckBanInput } from './services/ban-service';
