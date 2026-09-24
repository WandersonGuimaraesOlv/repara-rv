// =============================================================================
// public/sw.js — Service Worker Web Push para Repara RV PWA
// Executado nativamente pelo navegador, sem dependências externas.
// Compatível com Chrome Android e Safari iOS (PWA standalone).
// =============================================================================

'use strict';

// ─── Handler de evento Push ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Fallback para texto simples
    payload = { title: '🚨 Novo Chamado!', body: event.data.text() };
  }

  const title = payload.title ?? '🚨 Novo Chamado em Rio Verde!';
  const options = {
    body:    payload.body    ?? 'Serviço disponível próximo ao seu local.',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    vibrate: [100, 50, 100, 50, 200],
    data: {
      url:    payload.url    ?? '/painel',
      callId: payload.callId ?? null,
    },
    actions: [
      { action: 'open',  title: '👁️ Ver Chamado' },
      { action: 'close', title: 'Ignorar'         },
    ],
    // Agrupa notificações do mesmo chamado (evita spam de duplicatas)
    tag:      payload.callId ? `call-${payload.callId}` : 'repara-rv-notification',
    renotify: true,
    requireInteraction: true, // Mantém visível até o prestador interagir
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Handler de clique na notificação ───────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Ação "Ignorar" — apenas fecha
  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url ?? '/painel';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Foca a aba que já está na tela do aviso (/painel pros chamados,
        // /admin/dashboard pro SOS). Antes procurava sempre /painel — o SOS
        // abria o painel do técnico em vez do da equipe.
        const targetPath = new URL(targetUrl, self.location.origin).pathname;
        for (const client of windowClients) {
          if (new URL(client.url).pathname === targetPath && 'focus' in client) {
            return client.focus();
          }
        }
        // Abre nova aba se nenhuma estiver aberta
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── Ciclo de vida: instala e ativa imediatamente ───────────────────────────
self.addEventListener('install', (event) => {
  // Força ativação imediata sem aguardar abas antigas fecharem
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Assume controle de todas as abas abertas imediatamente
  event.waitUntil(self.clients.claim());
});
