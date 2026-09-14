// =============================================================================
// modules/calls/index.ts — Contrato público do domínio de chamados
// REGRA DE ISOLAMENTO: Outros módulos importam EXCLUSIVAMENTE deste arquivo.
// Proibido: import { x } from '@/modules/calls/services/call-service'
// Correto:  import { createCall } from '@/modules/calls'
// =============================================================================

// Schemas Zod (para validação nos Route Handlers e Server Actions)
export {
  createCallSchema,
  claimCallSchema,
  cancelCallSchema,
  completeCallSchema,
  updateCallStatusSchema,
} from './schemas';

export type {
  CreateCallInput,
  ClaimCallInput,
  CancelCallInput,
  CompleteCallInput,
  UpdateCallStatusInput,
} from './schemas';

// Serviços de negócio
export {
  createCall,
  claimCall,
  cancelCall,
  completeCall,
  updateCallStatus,
} from './services/call-service';
