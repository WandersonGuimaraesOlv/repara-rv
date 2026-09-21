// =============================================================================
// modules/notifications/services/notification-env.ts
// Monta o NotificationEnv a partir das variáveis de ambiente do Worker — um só
// lugar pra /api/push/send (cron/fila) e /api/push/test (botão do painel).
// =============================================================================

import type { NotificationEnv } from './unified-dispatcher';

export function buildNotificationEnv(env: NodeJS.ProcessEnv = process.env): NotificationEnv {
  return {
    VAPID_PUBLIC_KEY:              env.VAPID_PUBLIC_KEY              ?? '',
    VAPID_PRIVATE_KEY:             env.VAPID_PRIVATE_KEY             ?? '',
    VAPID_SUBJECT:                 env.VAPID_SUBJECT                 ?? 'mailto:contato@repararv.com',
    FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
  };
}
