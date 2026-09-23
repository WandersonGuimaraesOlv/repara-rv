import type { SupabaseClient } from '@supabase/supabase-js'

// O outro lado de um chamado — o técnico pro cliente (app/acompanhar), o
// cliente pro técnico (app/chamado). Achado A5 (23/09/2026): antes cada um
// lia o perfil inteiro do outro (e de qualquer pessoa: CPF, telefone,
// e-mail). call_party_profiles() (migration 20260924_restrict_profile_reads)
// devolve só nome, foto e selo, e só depois do aceite.
export interface CallPartyCard {
  party: 'client' | 'provider'
  id: string
  full_name: string | null
  avatar_url: string | null
  background_check_status: string | null
}

export async function fetchCallParty(
  supabase: SupabaseClient,
  callId: string,
  party: CallPartyCard['party']
): Promise<CallPartyCard | null> {
  const { data, error } = await supabase.rpc('call_party_profiles', { p_call_id: callId })
  if (error || !Array.isArray(data)) return null
  return (data as CallPartyCard[]).find(p => p.party === party) ?? null
}
