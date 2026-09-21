// =============================================================================
// modules/notifications/services/stale-queue-alert.ts
// Regras puras do alerta de fila estagnada (chamado 'queued' sem prestador):
// quais chamados acabaram de cruzar o limiar nesta rodada do cron e o texto do
// e-mail enviado ao time. Sem I/O — quem envia é a rota do radar.
// =============================================================================

export const STALE_THRESHOLD_SECONDS = 5 * 60;
// O cron roda a cada 60s. A janela tem o tamanho de 1 tick: cada chamado cai
// numa única rodada, então o alerta sai uma vez só em vez de a cada minuto
// enquanto o chamado continua parado.
export const CRON_TICK_SECONDS = 60;

export interface StaleCallSummary {
  id:              string;
  neighborhood:    string | null;
  provider_cut:    number;
  created_at:      string;
  minutes_waiting: number;
}

export function waitingSeconds(createdAt: string, nowMs: number): number {
  return Math.floor((nowMs - new Date(createdAt).getTime()) / 1000);
}

// Chamados que cruzaram os 5 minutos DURANTE o último tick do cron.
export function selectJustCrossed<T extends { created_at: string }>(calls: T[], nowMs: number): T[] {
  return calls.filter((call) => {
    const seconds = waitingSeconds(call.created_at, nowMs);
    return seconds >= STALE_THRESHOLD_SECONDS && seconds < STALE_THRESHOLD_SECONDS + CRON_TICK_SECONDS;
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function buildStaleQueueEmail(
  calls: StaleCallSummary[],
  appUrl: string,
): { subject: string; html: string } {
  const minutes = STALE_THRESHOLD_SECONDS / 60;
  const subject = calls.length === 1
    ? '⏱️ Repara RV: 1 chamado parado na fila'
    : `⏱️ Repara RV: ${calls.length} chamados parados na fila`;

  const rows = calls
    .map((c) => {
      const bairro = escapeHtml(c.neighborhood ?? 'Bairro não informado');
      return `<li>${bairro} — ganho líquido ${formatBRL(c.provider_cut)} — ${c.minutes_waiting} min parado</li>`;
    })
    .join('');

  const html = [
    `<p><strong>${calls.length === 1 ? '1 chamado está' : `${calls.length} chamados estão`} na fila há mais de ${minutes} minutos sem prestador.</strong></p>`,
    `<ul>${rows}</ul>`,
    `<p>Abra o painel para acionar um prestador manualmente: <a href="${escapeHtml(appUrl)}/admin/dashboard">${escapeHtml(appUrl)}/admin/dashboard</a></p>`,
  ].join('');

  return { subject, html };
}
