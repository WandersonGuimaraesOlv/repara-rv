// =============================================================================
// modules/notifications/services/email-dispatcher.ts
// Disparo de e-mail transacional via API REST do Resend (fetch() nativo,
// zero dependências Node.js — mesmo padrão de fcm-dispatcher.ts).
// Requer: RESEND_API_KEY nas variáveis de ambiente.
// =============================================================================

export interface EmailPayload {
  to:      string;
  subject: string;
  html:    string;
}

export interface EmailResult {
  success: boolean;
  error?:  string;
}

// O remetente de teste do Resend (onboarding@resend.dev) só entrega pro e-mail
// do dono da conta — por isso o código de redefinição de PIN nunca chegava a
// usuários reais. O domínio repararv.com foi verificado no Resend em
// 21/09/2026 (DKIM + SPF, região sa-east-1).
export const FROM_ADDRESS = 'Repara RV <noreply@repararv.com>';

export async function sendEmail(payload: EmailPayload, apiKey: string | undefined): Promise<EmailResult> {
  if (!apiKey) {
    console.warn('[email-dispatcher] RESEND_API_KEY não configurado — skip envio de e-mail');
    return { success: false, error: 'RESEND_API_KEY não configurado' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[email-dispatcher] Resend HTTP error:', response.status, body);
      return { success: false, error: `Resend retornou ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error('[email-dispatcher] sendEmail error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
