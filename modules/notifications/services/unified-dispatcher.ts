// =============================================================================
// modules/notifications/services/unified-dispatcher.ts
// Orquestrador central de notificações push — único ponto de entrada.
// Detecta a plataforma de cada token (web/android/ios) e roteia para o
// dispatcher correto (VAPID para PWA, FCM para Flutter).
// 
// REGRA: Nenhum outro módulo chama push-dispatcher ou fcm-dispatcher
// diretamente. Todos chamam notifyProvider() deste arquivo via o contrato
// público do módulo (@/modules/notifications).
// =============================================================================

import { createServiceClient } from '@/lib/supabase/server';
import { sendWebPush,  type VAPIDEnv }  from './push-dispatcher';
import { sendFCM,      type FCMEnv }    from './fcm-dispatcher';
import type { PushPayload } from './push-dispatcher';

// Ambiente unificado — reúne todas as credenciais necessárias
export interface NotificationEnv extends VAPIDEnv, FCMEnv {}

export interface NotifyResult {
  sent:    number; // Tokens com envio bem-sucedido
  failed:  number;
  removed: number; // Tokens expirados removidos do banco
}

// Notifica TODOS os dispositivos registrados de um usuário
export async function notifyProvider(
  userId:  string,
  payload: PushPayload,
  env:     NotificationEnv
): Promise<NotifyResult> {
  // Service role de verdade: quem chama isto é o Worker de fila/cron (só com o
  // CRON_SECRET_TOKEN, sem sessão de usuário). Com createClient() a consulta
  // rodava como `anon` e a RLS de device_tokens/push_subscriptions (só o dono
  // ou service_role enxergam a linha) devolvia 0 tokens, sempre — nenhum push
  // saía, sem erro nenhum.
  const supabase = await createServiceClient();
  const result: NotifyResult = { sent: 0, failed: 0, removed: 0 };

  // Lê os tokens de qualquer usuário
  const { data: tokens, error } = await supabase
    .from('device_tokens')
    .select('id, token, platform')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('[unified-dispatcher] Erro ao buscar tokens:', error.message);
    return result;
  }

  if (!tokens || tokens.length === 0) return result;

  const tokensToRemove: string[] = [];

  // Processa cada token conforme a plataforma
  const dispatchPromises = tokens.map(async (row) => {
    let dispatchResult: { success: boolean; shouldRemove: boolean };

    switch (row.platform) {
      case 'web':
        // Web Push VAPID — requer endpoint + p256dh + auth
        // Para Web, o token armazenado é o endpoint; as chaves de encriptação
        // são armazenadas em push_subscriptions (tabela separada)
        // Busca subscrição completa pelo endpoint
        const { data: sub } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', userId)
          .eq('endpoint', row.token)
          .single();

        if (!sub) {
          dispatchResult = { success: false, shouldRemove: false };
        } else {
          dispatchResult = await sendWebPush(sub, payload, env);
        }
        break;

      case 'android':
      case 'ios':
        // FCM — token direto do Firebase
        dispatchResult = await sendFCM(row.token, payload, env);
        break;

      default:
        console.warn('[unified-dispatcher] Plataforma desconhecida:', row.platform);
        dispatchResult = { success: false, shouldRemove: false };
    }

    if (dispatchResult.shouldRemove) {
      tokensToRemove.push(row.id);
      result.removed++;
    } else if (dispatchResult.success) {
      result.sent++;
    } else {
      result.failed++;
    }
  });

  await Promise.allSettled(dispatchPromises);

  // Remove tokens expirados do banco (housekeeping)
  if (tokensToRemove.length > 0) {
    await supabase
      .from('device_tokens')
      .update({ is_active: false })
      .in('id', tokensToRemove);
  }

  return result;
}

// Notifica múltiplos prestadores em batch (ex: todos online em raio de 25km)
export async function notifyProviderBatch(
  userIds: string[],
  payload: PushPayload,
  env:     NotificationEnv
): Promise<NotifyResult> {
  const totals: NotifyResult = { sent: 0, failed: 0, removed: 0 };

  const results = await Promise.allSettled(
    userIds.map((uid) => notifyProvider(uid, payload, env))
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      totals.sent    += r.value.sent;
      totals.failed  += r.value.failed;
      totals.removed += r.value.removed;
    }
  }

  return totals;
}
