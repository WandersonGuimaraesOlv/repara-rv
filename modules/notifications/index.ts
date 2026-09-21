// =============================================================================
// modules/notifications/index.ts — Contrato público do domínio de notificações
// REGRA DE ISOLAMENTO: Outros módulos importam EXCLUSIVAMENTE deste arquivo.
// =============================================================================

// Dispatcher unificado (ponto de entrada principal — PWA + Flutter)
export { notifyProvider, notifyProviderBatch } from './services/unified-dispatcher';
export type { NotifyResult, NotificationEnv } from './services/unified-dispatcher';

export { buildNotificationEnv } from './services/notification-env';
export { pushCallAlert } from './services/call-alerts';
export type { CallAlertOptions } from './services/call-alerts';

// WhatsApp (despacho emergencial via /admin/dashboard)
export {
  buildWhatsAppDispatchLink,
  buildWhatsAppAdminLink,
} from './services/whatsapp-dispatcher';
export type { WhatsAppDispatchOptions } from './services/whatsapp-dispatcher';

// Push VAPID — exposto para a rota /api/push/send
export { sendWebPush }        from './services/push-dispatcher';
export type { PushPayload, WebPushSubscription, VAPIDEnv } from './services/push-dispatcher';

// FCM — exposto para uso interno no dispatcher e testes unitários
export { sendFCM }            from './services/fcm-dispatcher';
export type { FCMEnv }        from './services/fcm-dispatcher';
