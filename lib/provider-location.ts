import type { SupabaseClient } from '@supabase/supabase-js'

// Fim do trajeto de um chamado (atendimento iniciado com o PIN, ou chamado
// cancelado): se o técnico está offline, a última posição dele é apagada —
// a política de privacidade promete não guardar localização de técnico
// offline, e durante o trajeto app/chamado grava a posição mesmo com ele
// offline (ex.: assumiu chamado da fila pelo link sem ficar online). Online,
// a posição continua valendo pro radar de chamados.
export async function clearOfflineProviderLocation(supabaseAdmin: SupabaseClient, providerId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('provider_status')
    .update({ current_location: null })
    .eq('provider_id', providerId)
    .eq('is_online', false)
  if (error) {
    console.error('[provider-location] Erro ao apagar a última posição do técnico offline:', error)
  }
}
