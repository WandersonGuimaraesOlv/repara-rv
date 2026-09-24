// =============================================================================
// modules/notifications/services/sos-alert.ts
// Aviso à equipe quando alguém aciona o SOS num chamado (app/api/emergency/
// notify). Item L1/M2 do plano de lançamento: até 24/09/2026 o SOS gravava no
// banco e abria o 190, mas não avisava ninguém (EMERGENCY_WEBHOOK_URL nunca
// foi configurado). Canal escolhido pelo dono em 24/09/2026: e-mail pro
// endereço de operação (OPS_ALERT_EMAIL, via Resend) + push no celular de
// todos os admins. O e-mail leva tudo (nomes, telefones, endereço, mapa); o
// push aparece na tela bloqueada, então só diz quem acionou e o chamado.
// =============================================================================

import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from './email-dispatcher';
import { notifyProviderBatch } from './unified-dispatcher';
import { buildNotificationEnv } from './notification-env';
import { escapeHtml } from './stale-queue-alert';

export interface SosAlertInput {
  callId:     string;
  callerRole: 'client' | 'provider';
  // Texto completo de lib/utils.ts::formatEmergencyMessage (uma linha por dado)
  message:    string;
  appUrl:     string;
}

export function buildSosEmail({ callId, callerRole, message, appUrl }: SosAlertInput): { subject: string; html: string } {
  const who = callerRole === 'client' ? 'Cliente' : 'Técnico';
  const shortId = callId.slice(0, 8).toUpperCase();
  const lines = message
    .split('\n')
    .map((line) => escapeHtml(line).replace(/(https:\/\/maps\.google\.com\/\?q=[^\s<]+)/, '<a href="$1">$1</a>'))
    .join('<br>');
  const html = [
    `<p><strong>${who} acionou o SOS no chamado #${shortId}.</strong> Ligue para a pessoa agora; se não atender, acione o 190.</p>`,
    `<p>${lines}</p>`,
    `<p>Painel: <a href="${escapeHtml(appUrl)}/admin/dashboard">${escapeHtml(appUrl)}/admin/dashboard</a></p>`,
  ].join('');
  return { subject: `🚨 SOS — ${who} no chamado #${shortId} — Repara RV`, html };
}

// Nunca lança: o SOS de quem está em perigo não pode falhar por causa do aviso.
export async function alertTeamAboutSos(input: SosAlertInput): Promise<{ email: boolean; pushSent: number }> {
  const result = { email: false, pushSent: 0 };

  const opsEmail = process.env.OPS_ALERT_EMAIL?.trim();
  if (opsEmail) {
    const { subject, html } = buildSosEmail(input);
    const sent = await sendEmail({ to: opsEmail, subject, html }, process.env.RESEND_API_KEY).catch(() => null);
    result.email = Boolean(sent?.success);
    if (!result.email) console.error('[sos-alert] Falha ao enviar e-mail de SOS:', sent?.error);
  } else {
    console.error('[sos-alert] OPS_ALERT_EMAIL não configurado — SOS sem e-mail pra equipe');
  }

  try {
    const supabase = await createServiceClient();
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_blocked', false);
    const adminIds = (admins ?? []).map((a) => a.id);
    if (adminIds.length > 0) {
      const who = input.callerRole === 'client' ? 'O cliente' : 'O técnico';
      const push = await notifyProviderBatch(
        adminIds,
        {
          title: '🚨 SOS acionado',
          body:  `${who} acionou o SOS no chamado #${input.callId.slice(0, 8).toUpperCase()}. Veja o e-mail e o painel.`,
          url:   '/admin/dashboard',
          callId: input.callId,
        },
        buildNotificationEnv()
      );
      result.pushSent = push.sent;
    }
  } catch (error) {
    console.error('[sos-alert] Falha ao enviar push de SOS:', error);
  }

  return result;
}
