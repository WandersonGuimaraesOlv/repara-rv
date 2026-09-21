// =============================================================================
// custom-worker.ts — entrada do Worker de produção (wrangler.jsonc → "main").
// Reexporta o Worker gerado pelo OpenNext (.open-next/worker.js, criado por
// `opennextjs-cloudflare build`) e acrescenta o Cron Trigger que chama, a cada
// minuto, o radar de chamados parados na fila (/api/cron/stale-calls-radar).
//
// Fica fora do tsconfig (o arquivo gerado não existe antes do build, então o
// tsc não teria como resolver o import). A lógica que dá pra testar mora em
// lib/scheduled-radar.ts.
// =============================================================================

import worker from './.open-next/worker.js';
import { buildRadarRequest, type RadarCronEnv } from './lib/scheduled-radar';

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

const customWorker = {
  fetch(request: Request, env: RadarCronEnv, ctx: WorkerContext) {
    return worker.fetch(request, env, ctx);
  },

  async scheduled(_controller: unknown, env: RadarCronEnv, ctx: WorkerContext): Promise<void> {
    const request = buildRadarRequest(env);
    if (!request) {
      console.error('[cron] CRON_SECRET_TOKEN não configurado — radar de fila não executado.');
      return;
    }

    // Passa pela mesma cadeia do site (proxy.ts + rota), sem sair pela internet.
    ctx.waitUntil(
      (async () => {
        try {
          const response = await worker.fetch(request, env, ctx);
          if (!response.ok) {
            console.error(`[cron] Radar de fila respondeu ${response.status}.`);
          }
        } catch (error) {
          console.error('[cron] Falha ao executar o radar de fila:', error instanceof Error ? error.message : String(error));
        }
      })()
    );
  },
};

export default customWorker;
