// =============================================================================
// modules/notifications/services/completion-alert.ts
// Aviso quando o cliente, na conferência antes do Pix, aponta um problema no
// serviço (app/api/calls/review-completion — pedido do dono em 24/09/2026).
// O técnico recebe push com o motivo, pra corrigir ainda no local; a equipe
// recebe e-mail (OPS_ALERT_EMAIL, via Resend) + push nos admins, pra
// acompanhar ou intervir (aprovar pelo cliente ou cancelar no painel).
// Mesmos canais do SOS (sos-alert.ts). O push da equipe aparece na tela
// bloqueada, então não leva o texto do cliente — só o e-mail leva.
// =============================================================================

import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from './email-dispatcher';
import { notifyProvider, notifyProviderBatch } from './unified-dispatcher';
import { buildNotificationEnv } from './notification-env';
import { escapeHtml } from './stale-queue-alert';

export interface CompletionIssueInput {
  callId:      string;
  providerId:  string;
  serviceName: string;
  reason:      string;
  // Contando esta: 1 = primeira vez que o cliente aponta problema
  issueCount:  number;
  appUrl:      string;
}

const PUSH_REASON_MAX = 120;

export function buildCompletionIssueEmail({ callId, serviceName, reason, issueCount, appUrl }: CompletionIssueInput): { subject: string; html: string } {
  const shortId = callId.slice(0, 8).toUpperCase();
  const repeat = issueCount > 1 ? ` (${issueCount}ª vez neste chamado)` : '';
  const html = [
    `<p><strong>O cliente apontou um problema no serviço do chamado #${shortId}${repeat}.</strong> O chamado voltou para o técnico corrigir; o Pix só aparece depois que o cliente aprovar.</p>`,
    `<p>Serviço: ${escapeHtml(serviceName)}</p>`,
    `<p>O que o cliente escreveu:<br><em>${escapeHtml(reason).replace(/\n/g, '<br>')}</em></p>`,
    `<p>Se houver impasse, no painel dá pra aprovar pelo cliente ou cancelar o chamado: <a href="${escapeHtml(appUrl)}/admin/dashboard">${escapeHtml(appUrl)}/admin/dashboard</a></p>`,
  ].join('');
  return { subject: `Problema apontado na conferência — chamado #${shortId} — Repara RV`, html };
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// Nunca lança: a decisão do cliente já foi gravada; o aviso não pode desfazê-la.
export async function alertAboutCompletionIssue(input: CompletionIssueInput): Promise<{ email: boolean; providerPush: number; adminPush: number }> {
  const result = { email: false, providerPush: 0, adminPush: 0 };
  const env = buildNotificationEnv();
  const shortId = input.callId.slice(0, 8).toUpperCase();

  try {
    const push = await notifyProvider(
      input.providerId,
      {
        title:  'O cliente apontou um problema',
        body:   `${truncate(input.reason, PUSH_REASON_MAX)} — corrija e toque em Concluir de novo.`,
        url:    `/chamado/${input.callId}`,
        callId: input.callId,
      },
      env
    );
    result.providerPush = push.sent;
  } catch (error) {
    console.error('[completion-alert] Falha ao avisar o técnico:', error);
  }

  const opsEmail = process.env.OPS_ALERT_EMAIL?.trim();
  if (opsEmail) {
    const { subject, html } = buildCompletionIssueEmail(input);
    const sent = await sendEmail({ to: opsEmail, subject, html }, process.env.RESEND_API_KEY).catch(() => null);
    result.email = Boolean(sent?.success);
    if (!result.email) console.error('[completion-alert] Falha ao enviar e-mail:', sent?.error);
  } else {
    console.error('[completion-alert] OPS_ALERT_EMAIL não configurado — problema na conferência sem e-mail pra equipe');
  }

  try {
    const supabase = await createServiceClient();
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_blocked', false);
    const adminIds = (admins ?? []).map((a) => a.id);
    if (adminIds.length > 0) {
      const push = await notifyProviderBatch(
        adminIds,
        {
          title: 'Cliente apontou problema no serviço',
          body:  `Chamado #${shortId}: o cliente não aprovou a conclusão. Veja o e-mail e o painel.`,
          url:   '/admin/dashboard',
        },
        env
      );
      result.adminPush = push.sent;
    }
  } catch (error) {
    console.error('[completion-alert] Falha ao avisar os admins:', error);
  }

  return result;
}
