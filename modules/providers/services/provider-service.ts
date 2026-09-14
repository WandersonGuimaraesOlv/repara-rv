// =============================================================================
// modules/providers/services/provider-service.ts
// Regras de negócio do domínio de prestadores: status online, GPS, Pix.
// =============================================================================

import { createClient } from '@/lib/supabase/server';

type ServiceResult<T> =
  | { success: true;  data: T }
  | { success: false; error: string; code?: number };

export interface GoOnlineInput {
  providerId: string;
  latitude:   number;
  longitude:  number;
}

export interface UpdateLocationInput {
  providerId: string;
  latitude:   number;
  longitude:  number;
}

// Coloca prestador online — valida pix_key e bloqueio antes de atualizar
export async function goOnline(input: GoOnlineInput): Promise<ServiceResult<{ is_online: boolean }>> {
  const supabase = await createClient();

  // Verifica se o prestador está bloqueado e se tem pix_key cadastrada
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_blocked, pix_key')
    .eq('id', input.providerId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'Perfil não encontrado', code: 404 };
  }

  if (profile.is_blocked) {
    return { success: false, error: 'Conta suspensa. Entre em contato com o suporte.', code: 403 };
  }

  if (!profile.pix_key || profile.pix_key.trim() === '') {
    return {
      success: false,
      error: 'Cadastre sua Chave Pix antes de ficar online.',
      code: 422,
    };
  }

  // Upsert em provider_status com localização WKT (PostGIS)
  const { error } = await supabase
    .from('provider_status')
    .upsert(
      {
        provider_id: input.providerId,
        is_online:   true,
        location:    `POINT(${input.longitude} ${input.latitude})`,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'provider_id' }
    );

  if (error) {
    console.error('[provider-service] goOnline error:', error.message);
    return { success: false, error: 'Falha ao atualizar status online', code: 500 };
  }

  return { success: true, data: { is_online: true } };
}

// Coloca prestador offline
export async function goOffline(providerId: string): Promise<ServiceResult<{ is_online: boolean }>> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('provider_status')
    .update({ is_online: false, updated_at: new Date().toISOString() })
    .eq('provider_id', providerId);

  if (error) {
    console.error('[provider-service] goOffline error:', error.message);
    return { success: false, error: 'Falha ao atualizar status offline', code: 500 };
  }

  return { success: true, data: { is_online: false } };
}

// Atualiza localização em tempo real (chamado pelo GPS do app)
export async function updateLocation(
  input: UpdateLocationInput
): Promise<ServiceResult<{ updated: boolean }>> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('provider_status')
    .update({
      location:   `POINT(${input.longitude} ${input.latitude})`,
      updated_at: new Date().toISOString(),
    })
    .eq('provider_id', input.providerId)
    .eq('is_online', true); // Só atualiza se estiver online

  if (error) {
    console.error('[provider-service] updateLocation error:', error.message);
    return { success: false, error: 'Falha ao atualizar localização', code: 500 };
  }

  return { success: true, data: { updated: true } };
}
