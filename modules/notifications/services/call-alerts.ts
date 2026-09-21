// =============================================================================
// modules/notifications/services/call-alerts.ts
// Alerta push de "novo chamado" pros prestadores. Antes disto NADA avisava um
// prestador com o app fechado: o único caminho (notify-queue) só mandava um
// webhook de WhatsApp que não está configurado em lugar nenhum.
//
// LGPD: o texto do push mostra só serviço, bairro e ganho líquido — a mesma
// informação do radar pré-aceite. Nunca endereço completo nem dados do cliente.
// =============================================================================

import { createServiceClient } from '@/lib/supabase/server';
import { notifyProviderBatch, type NotifyResult } from './unified-dispatcher';
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
      .select('neighborhood, provider_cut, service:quick_services(name)')
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
