// =============================================================================
// modules/notifications/services/push-dispatcher.ts
// Disparo de notificações Web Push VAPID para subscritores do PWA.
// Usa fetch() nativo — zero módulos Node.js — compatível com Cloudflare Workers.
// =============================================================================

import { generateVAPIDHeaders } from './webcrypto-vapid';

export interface WebPushSubscription {
  endpoint: string;
  p256dh:   string;
  auth:     string;
}

export interface PushPayload {
  title:   string;
  body:    string;
  url:     string;
  callId?: string;
}

export interface VAPIDEnv {
  VAPID_PUBLIC_KEY:  string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT:     string;
}

export interface PushResult {
  success:      boolean;
  shouldRemove: boolean; // true = endpoint expirado, remover do banco
}

// Envia uma notificação Web Push para um único endpoint VAPID
export async function sendWebPush(
  subscription: WebPushSubscription,
  payload:      PushPayload,
  env:          VAPIDEnv
): Promise<PushResult> {
  try {
    const headers = await generateVAPIDHeaders(subscription.endpoint, {
      publicKey:  env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject:    env.VAPID_SUBJECT,
    });

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'TTL':          '120',         // Mensagem válida por 2 minutos
        'Content-Type': 'application/json',
        'Urgency':      'high',        // Entrega imediata mesmo com bateria baixa
      },
      body: JSON.stringify(payload),
    });

    // 410 Gone / 404 Not Found = endpoint desinstalado pelo cliente
    if (response.status === 410 || response.status === 404) {
      return { success: false, shouldRemove: true };
    }

    return { success: response.ok, shouldRemove: false };
  } catch (error) {
    console.error('[push-dispatcher] sendWebPush error:', error);
    return { success: false, shouldRemove: false };
  }
}
