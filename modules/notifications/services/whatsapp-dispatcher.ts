// =============================================================================
// modules/notifications/services/whatsapp-dispatcher.ts
// Montagem de links wa.me higienizados para despacho emergencial de chamados.
// Usado pelo /admin/dashboard quando chamados ficam na fila > 5 minutos.
// =============================================================================

export interface WhatsAppDispatchOptions {
  phone:    string; // Número do prestador (DDI + DDD + número)
  callId:   string;
  service:  string;
  neighborhood: string;
  providerCut:  number;
}

const APP_URL = 'https://repararv.com';

// Monta link wa.me com mensagem pré-formatada e link de aceite rápido
export function buildWhatsAppDispatchLink(options: WhatsAppDispatchOptions): string {
  // Limpa o número: remove tudo que não seja dígito
  const cleanPhone = options.phone.replace(/\D/g, '');

  // Garante DDI 55 (Brasil) prefixado
  const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  // Link de aceite direto no painel do prestador
  const claimUrl = `${APP_URL}/painel?claim=${options.callId}`;

  const message = [
    `🔧 *Chamado disponível no Repara RV!*`,
    ``,
    `📍 Bairro: ${options.neighborhood}`,
    `🛠️ Serviço: ${options.service}`,
    `💰 Seu repasse: R$ ${options.providerCut.toFixed(2)}`,
    ``,
    `👆 Aceitar agora:`,
    claimUrl,
  ].join('\n');

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// Monta link wa.me para comunicação administrativa com prestador
export function buildWhatsAppAdminLink(
  phone:   string,
  message: string
): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const prefixed   = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${prefixed}?text=${encodeURIComponent(message)}`;
}
