// =============================================================================
// lib/scheduled-radar.ts
// Monta a requisição que o Cron Trigger (custom-worker.ts) faz, a cada minuto,
// contra a própria rota do radar de fila estagnada. Separado do Worker pra
// poder ser testado sem o bundle do OpenNext.
// =============================================================================

export interface RadarCronEnv {
  CRON_SECRET_TOKEN?:   string;
  NEXT_PUBLIC_APP_URL?: string;
}

const DEFAULT_ORIGIN = 'https://repararv.com';

// Devolve null quando o segredo não está configurado: sem ele a rota responderia
// 401 mesmo, então é melhor o cron avisar no log do que fazer a chamada à toa.
export function buildRadarRequest(env: RadarCronEnv): Request | null {
  const token = env.CRON_SECRET_TOKEN;
  if (!token) return null;

  const configured = env.NEXT_PUBLIC_APP_URL;
  const origin = configured && configured.startsWith('https://') ? configured : DEFAULT_ORIGIN;

  return new Request(new URL('/api/cron/stale-calls-radar', origin), {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
