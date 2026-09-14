// =============================================================================
// modules/compliance/services/ban-service.ts
// Regras de negócio para bans, bloqueios e auditoria anti-abuso.
// =============================================================================

import { createClient } from '@/lib/supabase/server';

type ServiceResult<T> =
  | { success: true;  data: T }
  | { success: false; error: string; code?: number };

export interface CreateBanInput {
  profileId?:    string;
  phoneClean?:   string;
  documentHash?: string; // SHA-256 do CPF/CNPJ — nunca em claro
  reason:        string;
  bannedBy:      string; // ID do admin que aplicou
  expiresAt?:    string; // ISO8601 — null = ban permanente
}

export interface CheckBanInput {
  profileId?:    string;
  phoneClean?:   string;
  documentHash?: string;
}

// Verifica se um usuário/telefone/documento está banido
export async function checkBan(
  input: CheckBanInput
): Promise<{ isBanned: boolean; reason?: string }> {
  if (!input.profileId && !input.phoneClean && !input.documentHash) {
    return { isBanned: false };
  }

  const supabase = await createClient();

  const query = supabase
    .from('compliance_bans')
    .select('reason, expires_at')
    .eq('is_active', true)
    .or([
      input.profileId    ? `profile_id.eq.${input.profileId}`       : null,
      input.phoneClean   ? `phone_clean.eq.${input.phoneClean}`     : null,
      input.documentHash ? `document_hash.eq.${input.documentHash}` : null,
    ].filter(Boolean).join(','));

  const { data, error } = await query.limit(1).maybeSingle();

  if (error || !data) return { isBanned: false };

  // Ban temporário expirado?
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { isBanned: false };
  }

  return { isBanned: true, reason: data.reason };
}

// Aplica um ban (somente admins)
export async function createBan(
  input: CreateBanInput
): Promise<ServiceResult<{ id: string }>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('compliance_bans')
    .insert({
      profile_id:    input.profileId    ?? null,
      phone_clean:   input.phoneClean   ?? null,
      document_hash: input.documentHash ?? null,
      reason:        input.reason,
      banned_by:     input.bannedBy,
      expires_at:    input.expiresAt    ?? null,
      is_active:     true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ban-service] createBan error:', error.message);
    return { success: false, error: 'Falha ao registrar ban', code: 500 };
  }

  // Se tiver profile_id, bloqueia o perfil imediatamente
  if (input.profileId) {
    await supabase
      .from('profiles')
      .update({ is_blocked: true })
      .eq('id', input.profileId);
  }

  return { success: true, data: data as { id: string } };
}

// Revoga ban (somente admins)
export async function revokeBan(
  banId: string
): Promise<ServiceResult<{ revoked: boolean }>> {
  const supabase = await createClient();

  const { data: ban, error: fetchError } = await supabase
    .from('compliance_bans')
    .select('id, profile_id')
    .eq('id', banId)
    .single();

  if (fetchError || !ban) {
    return { success: false, error: 'Ban não encontrado', code: 404 };
  }

  const { error } = await supabase
    .from('compliance_bans')
    .update({ is_active: false })
    .eq('id', banId);

  if (error) {
    return { success: false, error: 'Falha ao revogar ban', code: 500 };
  }

  // Desbloqueia o perfil se não houver outros bans ativos
  if (ban.profile_id) {
    const { count } = await supabase
      .from('compliance_bans')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', ban.profile_id)
      .eq('is_active', true);

    if ((count ?? 0) === 0) {
      await supabase
        .from('profiles')
        .update({ is_blocked: false })
        .eq('id', ban.profile_id);
    }
  }

  return { success: true, data: { revoked: true } };
}
