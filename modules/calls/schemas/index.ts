// =============================================================================
// modules/calls/schemas/index.ts
// Schemas Zod para validação de fronteira do domínio de chamados.
// Todo dado externo (Server Actions, Route Handlers) passa por estes schemas
// ANTES de qualquer interação com o banco de dados.
// =============================================================================

import { z } from 'zod';

// ─── Criar Chamado ──────────────────────────────────────────────────────────
export const createCallSchema = z.object({
  serviceId:     z.string().uuid('ID de serviço inválido'),
  clientId:      z.string().uuid('ID de cliente inválido'),
  neighborhood:  z.string().min(2, 'Informe o bairro'),
  clientAddress: z.string().min(5, 'Informe o endereço completo'),
  latitude:      z.number().min(-90).max(90),
  longitude:     z.number().min(-180).max(180),
});

export type CreateCallInput = z.infer<typeof createCallSchema>;

// ─── Aceitar Chamado (Anti-Corrida via RPC claim_queued_call) ───────────────
export const claimCallSchema = z.object({
  callId:     z.string().uuid('ID do chamado inválido'),
  providerId: z.string().uuid('ID do prestador inválido'),
});

export type ClaimCallInput = z.infer<typeof claimCallSchema>;

// ─── Cancelar Chamado ───────────────────────────────────────────────────────
export const cancelCallSchema = z.object({
  callId: z.string().uuid('ID do chamado inválido'),
  reason: z.enum([
    'client_request',
    'provider_absent',
    'wrong_address',
    'technical_issue',
    'no_provider_found',
    'other',
  ]),
  note: z.string().max(500).optional(),
});

export type CancelCallInput = z.infer<typeof cancelCallSchema>;

// ─── Completar Chamado ──────────────────────────────────────────────────────
export const completeCallSchema = z.object({
  callId:     z.string().uuid('ID do chamado inválido'),
  providerId: z.string().uuid('ID do prestador inválido'),
});

export type CompleteCallInput = z.infer<typeof completeCallSchema>;

// ─── Atualizar Status ───────────────────────────────────────────────────────
export const updateCallStatusSchema = z.object({
  callId: z.string().uuid('ID do chamado inválido'),
  status: z.enum(['on_the_way', 'in_progress']),
});

export type UpdateCallStatusInput = z.infer<typeof updateCallStatusSchema>;
