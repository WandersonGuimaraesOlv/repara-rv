// =============================================================================
// modules/notifications/services/call-alerts.ts
// Alerta push de "novo chamado" pros prestadores — o único canal automático de
// aviso. Decisão do dono (21/09/2026): sem gateway de WhatsApp (risco de
// banimento dos números da plataforma); os alertas ficam dentro do app.
//
// LGPD: o texto do push mostra só serviço, bairro e ganho líquido — a mesma
// informação do radar pré-aceite. Nunca endereço completo nem dados do cliente.
// =============================================================================

import { createServiceClient } from '@/lib/supabase/server';
import { notifyProvider, notifyProviderBatch, type NotifyResult } from './unified-dispatcher';
import { buildNotificationEnv } from './notification-env';

export interface CallAlertOptions {
  callId: string;
  // Quem avisar. Sem isto: todos os prestadores aprovados e não bloqueados
  // (chamado na fila prioritária — qualquer um deles pode assumir).
  providerIds?: string[];
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// Nunca lança: falha de push não pode derrubar a criação/reatribuição do chamado.
export async function pushCallAlert({ callId, providerIds }: CallAlertOptions): Promise<NotifyResult | null> {
  try {
    const supabase = await createServiceClient();

    const { data: call, error: callError } = await supabase
      .from('service_calls')
      .select('client_id, neighborhood, provider_cut, service:quick_services(name)')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      console.warn('[call-alerts] chamado não encontrado pra montar o push:', callId, callError?.message);
      return null;
    }

    let targets = providerIds;
    if (!targets) {
      const { data: eligible, error: eligibleError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'provider')
        .eq('background_check_status', 'approved')
        .eq('is_blocked', false);

      if (eligibleError) {
        console.warn('[call-alerts] falha ao listar prestadores elegíveis:', eligibleError.message);
        return null;
      }
      targets = (eligible ?? []).map((p) => p.id);
    }

    // Quem abriu o chamado não pode atendê-lo (chk_client_ne_provider) — não
    // adianta avisar a própria conta.
    targets = targets.filter((id) => id !== call.client_id);

    if (targets.length === 0) return { sent: 0, failed: 0, removed: 0 };

    const serviceName  = (call.service as { name?: string } | null)?.name || 'Serviço residencial';
    const neighborhood = call.neighborhood || 'Rio Verde';

    return await notifyProviderBatch(
      targets,
      {
        title:  '⚡ Novo chamado perto de você',
        body:   `${serviceName} — ${neighborhood} · Ganhos líquidos ${formatBRL(Number(call.provider_cut || 0))}`,
        url:    '/painel',
        callId,
      },
      buildNotificationEnv()
    );
  } catch (error) {
    console.warn('[call-alerts] falha ao enviar push de novo chamado:', error);
    return null;
  }
}

// Técnico tirado do ar por não responder ofertas seguidas (lib/missed-offers.ts).
// Nunca lança, pelo mesmo motivo de pushCallAlert.
export async function pushAutoOfflineNotice(providerId: string): Promise<NotifyResult | null> {
  try {
    return await notifyProvider(
      providerId,
      {
        title: 'Você ficou offline',
        body:  'Você não respondeu 2 chamados seguidos. Abra o Repara RV e toque em Ficar Online para voltar a receber chamados.',
        url:   '/painel',
      },
      buildNotificationEnv()
    );
  } catch (error) {
    console.warn('[call-alerts] falha ao enviar push de offline automático:', error);
    return null;
  }
}
