// =============================================================================
// modules/notifications/services/warranty-alert.ts
// Aviso quando o cliente aciona a garantia de 7 dias pelo app
// (app/api/calls/warranty). A equipe recebe e-mail (OPS_ALERT_EMAIL, via
// Resend) + push nos admins pra combinar o retorno; o técnico recebe push com
// o motivo. Mesmo padrão de completion-alert.ts. O push da equipe não leva o
// texto do cliente (aparece na tela bloqueada) — só o e-mail leva.
// =============================================================================

import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from './email-dispatcher';
import { notifyProvider, notifyProviderBatch } from './unified-dispatcher';
import { buildNotificationEnv } from './notification-env';
import { escapeHtml } from './stale-queue-alert';

export interface WarrantyAlertInput {
  callId:      string;
  providerId:  string | null;
  serviceName: string;
  description: string;
  appUrl:      string;
}

const PUSH_TEXT_MAX = 120;

export function buildWarrantyEmail({ callId, serviceName, description, appUrl }: WarrantyAlertInput): { subject: string; html: string } {
  const shortId = callId.slice(0, 8).toUpperCase();
  const html = [
    `<p><strong>O cliente acionou a garantia de 7 dias do chamado #${shortId}.</strong> Combine o retorno do técnico (ou de um reserva), sem custo para o cliente se a falha for da mão de obra.</p>`,
    `<p>Serviço: ${escapeHtml(serviceName)}</p>`,
    `<p>O que o cliente escreveu:<br><em>${escapeHtml(description).replace(/\n/g, '<br>')}</em></p>`,
    `<p>O repasse deste chamado fica suspenso até a garantia ser resolvida. Resolva ou recuse no painel: <a href="${escapeHtml(appUrl)}/admin/dashboard">${escapeHtml(appUrl)}/admin/dashboard</a></p>`,
  ].join('');
  return { subject: `Garantia acionada — chamado #${shortId} — Repara RV`, html };
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// Nunca lança: a garantia já foi registrada; o aviso não pode desfazê-la.
export async function alertAboutWarrantyClaim(input: WarrantyAlertInput): Promise<{ email: boolean; providerPush: number; adminPush: number }> {
  const result = { email: false, providerPush: 0, adminPush: 0 };
  const env = buildNotificationEnv();
  const shortId = input.callId.slice(0, 8).toUpperCase();

  if (input.providerId) {
    try {
      const push = await notifyProvider(
        input.providerId,
        {
          title:  'O cliente acionou a garantia',
          body:   `Chamado #${shortId}: ${truncate(input.description, PUSH_TEXT_MAX)} A equipe vai combinar o retorno com você.`,
          url:    `/chamado/${input.callId}`,
          callId: input.callId,
        },
        env
      );
      result.providerPush = push.sent;
    } catch (error) {
      console.error('[warranty-alert] Falha ao avisar o técnico:', error);
    }
  }

  const opsEmail = process.env.OPS_ALERT_EMAIL?.trim();
  if (opsEmail) {
    const { subject, html } = buildWarrantyEmail(input);
    const sent = await sendEmail({ to: opsEmail, subject, html }, process.env.RESEND_API_KEY).catch(() => null);
    result.email = Boolean(sent?.success);
    if (!result.email) console.error('[warranty-alert] Falha ao enviar e-mail:', sent?.error);
  } else {
    console.error('[warranty-alert] OPS_ALERT_EMAIL não configurado — garantia sem e-mail pra equipe');
  }

  try {
    const supabase = await createServiceClient();
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_blocked', false);
    const adminIds = (admins ?? []).map((a) => a.id);
    if (adminIds.length > 0) {
      const push = await notifyProviderBatch(
        adminIds,
        {
          title: 'Garantia acionada',
          body:  `Chamado #${shortId}: o cliente acionou a garantia. Veja o e-mail e o painel.`,
          url:   '/admin/dashboard',
        },
        env
      );
      result.adminPush = push.sent;
    }
  } catch (error) {
    console.error('[warranty-alert] Falha ao avisar os admins:', error);
  }

  return result;
}
