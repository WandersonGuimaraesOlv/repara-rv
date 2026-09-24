// =============================================================================
// modules/notifications/services/ops-alert.ts
// Alerta de erro por e-mail pra equipe (plano de maturação §17): Pix que não
// gera, confirmação de pagamento recusada ou que falha, erro 500 nas rotas de
// chamado. Vai pro OPS_ALERT_EMAIL (Resend), no máximo 1 e-mail por tipo de
// erro a cada 15 min (claim_ops_alert no banco — migration
// 20260924_payouts_warranty_ops_alerts.sql), pra um ataque ou uma queda não
// lotar a caixa.
//
// Nunca leva token, PIN, CPF, telefone nem endereço — só ambiente, rota,
// chamado, código do erro, horário, impacto e o que fazer.
// =============================================================================

import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from './email-dispatcher';
import { escapeHtml } from './stale-queue-alert';

const WINDOW_MINUTES = 15;
const STAGING_SUPABASE_REF = 'rahjxxalusylxdknuiqq';

export type OpsAlertKind =
  | 'pix_create_failed'
  | 'webhook_invalid_signature'
  | 'webhook_payment_lookup_failed'
  | 'webhook_call_not_found'
  | 'webhook_error'
  | 'route_error';

export interface OpsAlertInput {
  kind:       OpsAlertKind;
  route:      string;
  summary:    string;
  impact:     string;
  action:     string;
  callId?:    string | null;
  errorCode?: string | number | null;
}

export function environmentLabel(supabaseUrl: string | undefined): string {
  return (supabaseUrl ?? '').includes(STAGING_SUPABASE_REF) ? 'STAGING' : 'PRODUÇÃO';
}

export function buildOpsAlertEmail(input: OpsAlertInput, environment: string, at: Date): { subject: string; html: string } {
  const time = at.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' });
  const rows: [string, string][] = [
    ['Ambiente', environment],
    ['Etapa', input.route],
    ['Chamado', input.callId ? `#${input.callId.slice(0, 8).toUpperCase()}` : '—'],
    ['Código do erro', input.errorCode === null || input.errorCode === undefined ? '—' : String(input.errorCode)],
    ['Horário', `${time} (Rio Verde)`],
    ['Impacto', input.impact],
    ['O que fazer', input.action],
  ];
  const html = [
    `<p><strong>${escapeHtml(input.summary)}</strong></p>`,
    '<table cellpadding="4">',
    ...rows.map(([label, value]) => `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`),
    '</table>',
    `<p style="color:#666">Outros erros deste tipo nos próximos ${WINDOW_MINUTES} min não geram novo e-mail.</p>`,
  ].join('');
  const prefix = environment === 'STAGING' ? '[STAGING] ' : '';
  return { subject: `${prefix}⚠️ Erro no Repara RV — ${input.summary}`, html };
}

// Nunca lança: o alerta não pode derrubar a rota que falhou.
export async function alertOps(input: OpsAlertInput): Promise<boolean> {
  try {
    const opsEmail = process.env.OPS_ALERT_EMAIL?.trim();
    if (!opsEmail) return false;

    const supabase = await createServiceClient();
    const { data: claimed, error } = await supabase.rpc('claim_ops_alert', {
      p_key: `${input.kind}:${input.route}`,
      p_window_minutes: WINDOW_MINUTES,
    });
    if (error) {
      // Sem o limite no banco, não manda (um ataque ao webhook viraria spam)
      console.error('[ops-alert] Falha ao consultar o limite de envio:', error.message);
      return false;
    }
    if (!claimed) return false;

    const { subject, html } = buildOpsAlertEmail(input, environmentLabel(process.env.NEXT_PUBLIC_SUPABASE_URL), new Date());
    const sent = await sendEmail({ to: opsEmail, subject, html }, process.env.RESEND_API_KEY);
    if (!sent.success) console.error('[ops-alert] Falha ao enviar o alerta:', sent.error);
    return sent.success;
  } catch (error) {
    console.error('[ops-alert] Falha inesperada:', error);
    return false;
  }
}

// Erro 500 genérico numa rota de chamado
export function alertRouteError(route: string, callId?: string | null): Promise<boolean> {
  return alertOps({
    kind: 'route_error',
    route,
    callId,
    errorCode: 500,
    summary: `Erro interno em ${route}`,
    impact: 'Quem usou essa tela recebeu erro e pode não ter conseguido concluir a ação.',
    action: 'Veja os registros do Worker repara-rv no painel da Cloudflare (Observability) no horário acima.',
  });
}
