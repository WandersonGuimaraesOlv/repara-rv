// =============================================================================
// workers/queue-consumer.ts
// Consumidor de fila Cloudflare Queues para processamento assíncrono.
// Desacopla envios de notificações do ciclo de vida da requisição HTTP.
//
// Para ativar: configurar binding "dispatch-call-queue" no painel Cloudflare.
// Não usar módulos nativos do Node.js (fs, net, crypto legado).
// =============================================================================

// Tipos do runtime Cloudflare Workers Queue (não disponíveis no tsconfig padrão)
/* eslint-disable @typescript-eslint/no-explicit-any */
declare interface Message<T = any> {
  readonly body:     T;
  readonly id:       string;
  readonly timestamp: Date;
  readonly attempts: number;
  ack():   void;
  retry(options?: { delaySeconds?: number }): void;
}
declare interface MessageBatch<T = any> {
  readonly queue:    string;
  readonly messages: Message<T>[];
  ackAll():   void;
  retryAll(options?: { delaySeconds?: number }): void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Env {
  INTERNAL_API_URL:              string;
  CRON_SECRET_TOKEN:             string;
  VAPID_PUBLIC_KEY:              string;
  VAPID_PRIVATE_KEY:             string;
  VAPID_SUBJECT:                 string;
  FIREBASE_SERVICE_ACCOUNT_JSON: string;
}

type QueueMessageType = 'CALL_CREATED' | 'DEACTIVATE_EXPIRED_BANS';

interface QueueMessage {
  type:    QueueMessageType;
  payload: Record<string, unknown>;
}

// ─── Handler CALL_CREATED: busca prestadores e dispara push ─────────────────
async function handleCallDispatch(
  callId: string,
  env:    Env
): Promise<void> {
  const response = await fetch(
    `${env.INTERNAL_API_URL}/api/push/send`,
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${env.CRON_SECRET_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Nota: em produção, buscar provider_ids do Supabase via find_nearest_provider
        // Aqui delegamos para a rota que já tem a lógica de busca geoespacial
        callId,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`handleCallDispatch falhou: ${response.status} ${text}`);
  }
}

// ─── Handler DEACTIVATE_EXPIRED_BANS ────────────────────────────────────────
async function handleDeactivateExpiredBans(env: Env): Promise<void> {
  // Chama a RPC de limpeza de bans expirados
  const response = await fetch(
    `${env.INTERNAL_API_URL}/api/cron/deactivate-bans`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${env.CRON_SECRET_TOKEN}` },
    }
  );

  if (!response.ok) {
    throw new Error(`deactivate-bans falhou: ${response.status}`);
  }
}

// ─── Função auxiliar de log de falhas para auditoria ─────────────────────
async function logFailedJob(
  type:    string,
  payload: Record<string, unknown>,
  error:   unknown,
  env:     Env
): Promise<void> {
  // Em produção: inserir em tabela `failed_jobs` no Supabase via REST
  console.error('[queue-consumer] Job falhou após 3 tentativas:', {
    type,
    payload,
    error: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
  });

  // Notifica admins via INTERNAL_API_URL (não crítico, best-effort)
  try {
    await fetch(`${env.INTERNAL_API_URL}/api/admin/alert-failed-job`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${env.CRON_SECRET_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, payload }),
    });
  } catch {
    // Silencioso — falha de log não deve travar o processamento principal
  }
}

// ─── Exportação do Worker ────────────────────────────────────────────────────
const queueConsumerWorker = {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { type, payload } = message.body;

      try {
        switch (type) {
          case 'CALL_CREATED':
            await handleCallDispatch(String(payload.callId ?? ''), env);
            break;

          case 'DEACTIVATE_EXPIRED_BANS':
            await handleDeactivateExpiredBans(env);
            break;

          default:
            console.warn('[queue-consumer] Tipo de mensagem desconhecido:', type);
        }

        message.ack();
      } catch (err) {
        if (message.attempts < 3) {
          // Retry exponencial: 10s, 20s, 30s
          message.retry({ delaySeconds: 10 * message.attempts });
        } else {
          // 3 tentativas falharam: Dead-Letter logging e ack para não travar a fila
          await logFailedJob(type, payload, err, env);
          message.ack();
        }
      }
    }
  },
};

export default queueConsumerWorker;
