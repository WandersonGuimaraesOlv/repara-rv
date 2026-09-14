// =============================================================================
// workers/cron-monitor.ts
// Cron Trigger Cloudflare — executa a cada 60 segundos.
// Detecta chamados estagnados em fila > 5 min e registra métricas.
//
// Para ativar: adicionar em wrangler.jsonc:
// "triggers": { "crons": ["* * * * *"] }
// E configurar o binding CRON_SECRET_TOKEN e INTERNAL_API_URL.
// =============================================================================

// Tipos do runtime Cloudflare Workers (não disponíveis no tsconfig padrão)
/* eslint-disable @typescript-eslint/no-explicit-any */
declare interface ScheduledEvent { scheduledTime: number; cron: string }
declare interface ExecutionContext { waitUntil(promise: Promise<any>): void; passThroughOnException(): void }
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Env {
  INTERNAL_API_URL:  string;
  CRON_SECRET_TOKEN: string;
}

const cronMonitorWorker = {
  async scheduled(
    _event: ScheduledEvent,
    env:    Env,
    ctx:    ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const startTime = Date.now();

        try {
          const response = await fetch(
            `${env.INTERNAL_API_URL}/api/cron/stale-calls-radar`,
            {
              method:  'POST',
              headers: {
                Authorization:  `Bearer ${env.CRON_SECRET_TOKEN}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            const text = await response.text();
            console.error(
              `[cron-monitor] Radar de chamados retornou ${response.status}: ${text}`
            );
            return;
          }

          const result = await response.json() as {
            stale_count: number;
            calls:       Array<{ id: string; minutes_waiting: number; neighborhood: string | null }>;
          };

          const elapsed = Date.now() - startTime;

          if (result.stale_count > 0) {
            console.warn(
              `[cron-monitor] ⚠️ ${result.stale_count} chamado(s) estagnado(s) na fila.`,
              `Mais antigo: ${result.calls[0]?.minutes_waiting ?? 0} min em ${result.calls[0]?.neighborhood ?? '?'}.`,
              `Tempo de execução: ${elapsed}ms`
            );
          } else {
            console.log(
              `[cron-monitor] ✅ Fila saudável — nenhum chamado estagnado. (${elapsed}ms)`
            );
          }
        } catch (error) {
          console.error(
            '[cron-monitor] Erro ao executar radar de chamados:',
            error instanceof Error ? error.message : String(error)
          );
        }
      })()
    );
  },
};

export default cronMonitorWorker;
