// =============================================================================
// modules/calls/services/call-service.ts
// Regras de negócio puras do domínio de chamados.
// Nunca chama módulos externos pelos caminhos internos — apenas via contratos
// públicos exportados pelos index.ts dos respectivos módulos.
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import type {
  CreateCallInput,
  ClaimCallInput,
  CancelCallInput,
  CompleteCallInput,
  UpdateCallStatusInput,
} from '../schemas';

// ─── Tipos de resposta ───────────────────────────────────────────────────────

type ServiceResult<T> =
  | { success: true;  data: T }
  | { success: false; error: string; code?: number };

// ─── Criar Chamado ──────────────────────────────────────────────────────────
export async function createCall(
  input: CreateCallInput
): Promise<ServiceResult<{ id: string; status: string }>> {
  const supabase = await createClient();

  // Valida e obtém preço fixo do serviço (fonte única de verdade: banco)
  const { data: service, error: serviceError } = await supabase
    .from('quick_services')
    .select('fixed_price, platform_fee, is_active')
    .eq('id', input.serviceId)
    .single();

  if (serviceError || !service) {
    return { success: false, error: 'Serviço não localizado', code: 404 };
  }

  if (!service.is_active) {
    return { success: false, error: 'Serviço temporariamente indisponível', code: 422 };
  }

  const totalPrice  = Number(service.fixed_price);
  const platformFee = Number(service.platform_fee);
  const providerCut = totalPrice - platformFee;

  // Piso de R$ 50 líquidos — regra financeira inegociável
  if (providerCut < 50) {
    return {
      success: false,
      error: `Repasse líquido (R$ ${providerCut.toFixed(2)}) abaixo do piso de R$ 50,00`,
      code: 422,
    };
  }

  const { data, error } = await supabase
    .from('service_calls')
    .insert({
      client_id:       input.clientId,
      service_id:      input.serviceId,
      total_price:     totalPrice,
      platform_fee:    platformFee,
      provider_cut:    providerCut,
      neighborhood:    input.neighborhood,
      client_address:  input.clientAddress,
      // Formato WKT compatível com PostGIS (longitude primeiro)
      client_location: `POINT(${input.longitude} ${input.latitude})`,
      status:          'searching',
    })
    .select('id, status')
    .single();

  if (error) {
    console.error('[call-service] createCall error:', error.message);
    return { success: false, error: 'Falha ao abrir chamado técnico', code: 500 };
  }

  return { success: true, data };
}

// ─── Aceitar Chamado (Anti-Corrida via RPC atômica) ────────────────────────
export async function claimCall(
  input: ClaimCallInput
): Promise<ServiceResult<{ id: string; status: string; provider_id: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('claim_queued_call', {
      p_call_id:     input.callId,
      p_provider_id: input.providerId,
    })
    .single();

  if (error) {
    console.error('[call-service] claimCall RPC error:', error.message);
    return { success: false, error: 'Falha ao aceitar chamado', code: 500 };
  }

  if (!data) {
    // RPC retornou vazio: chamado já foi aceito por outro prestador ou expirou
    return {
      success: false,
      error: 'Chamado não disponível — pode ter sido aceito por outro prestador',
      code: 409,
    };
  }

  return { success: true, data: data as { id: string; status: string; provider_id: string } };
}

// ─── Cancelar Chamado ───────────────────────────────────────────────────────
export async function cancelCall(
  input: CancelCallInput,
  requesterId: string
): Promise<ServiceResult<{ id: string }>> {
  const supabase = await createClient();

  // Verifica se o solicitante é o cliente ou o prestador do chamado
  const { data: call, error: fetchError } = await supabase
    .from('service_calls')
    .select('id, client_id, provider_id, status')
    .eq('id', input.callId)
    .single();

  if (fetchError || !call) {
    return { success: false, error: 'Chamado não encontrado', code: 404 };
  }

  const isClient   = call.client_id   === requesterId;
  const isProvider = call.provider_id === requesterId;

  if (!isClient && !isProvider) {
    return { success: false, error: 'Sem autorização para cancelar este chamado', code: 403 };
  }

  const terminalStatuses = ['completed', 'cancelled', 'expired'];
  if (terminalStatuses.includes(call.status)) {
    return { success: false, error: `Chamado já está em status "${call.status}"`, code: 422 };
  }

  const { data, error } = await supabase
    .from('service_calls')
    .update({
      status:          'cancelled',
      cancel_reason:   input.reason,
      cancel_note:     input.note ?? null,
      cancelled_at:    new Date().toISOString(),
    })
    .eq('id', input.callId)
    .select('id')
    .single();

  if (error) {
    console.error('[call-service] cancelCall error:', error.message);
    return { success: false, error: 'Falha ao cancelar chamado', code: 500 };
  }

  return { success: true, data: data as { id: string } };
}

// ─── Completar Chamado ──────────────────────────────────────────────────────
export async function completeCall(
  input: CompleteCallInput
): Promise<ServiceResult<{ id: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('service_calls')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', input.callId)
    .eq('provider_id', input.providerId)
    .eq('status', 'in_progress')
    .select('id')
    .single();

  if (error || !data) {
    return { success: false, error: 'Não foi possível concluir o chamado', code: 422 };
  }

  return { success: true, data: data as { id: string } };
}

// ─── Atualizar Status (on_the_way / in_progress) ───────────────────────────
export async function updateCallStatus(
  input: UpdateCallStatusInput,
  providerId: string
): Promise<ServiceResult<{ id: string; status: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('service_calls')
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq('id', input.callId)
    .eq('provider_id', providerId)
    .select('id, status')
    .single();

  if (error || !data) {
    return { success: false, error: 'Falha ao atualizar status do chamado', code: 422 };
  }

  return { success: true, data: data as { id: string; status: string } };
}
