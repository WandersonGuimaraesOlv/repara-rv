'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellRing, BellOff, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { usePwaInstall } from '@/components/pwa-install-provider'
import { PwaInstallButton } from '@/components/pwa-install-button'
import { urlBase64ToUint8Array, arrayBufferToBase64Url, detectPushDeviceType } from '@/lib/push-client'

// Inlinada no build (NEXT_PUBLIC_*) — é a mesma chave pública VAPID do servidor.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

type PushState = 'checking' | 'unsupported' | 'needs-install' | 'denied' | 'inactive' | 'active'

// O mesmo aparelho recebe o push da conta que ativou por último — no admin o
// aviso que importa é o do SOS (modules/notifications/services/sos-alert.ts).
const TEXTS = {
  provider: {
    installTitle: 'Receba avisos de chamados no celular',
    activeBody: 'Você recebe o aviso de novos chamados mesmo com o app fechado.',
    inactiveTitle: 'Receba avisos de novos chamados',
    inactiveBody: 'Ative as notificações pra ser avisado na hora, mesmo com o app fechado, quando aparecer um chamado perto de você.',
  },
  admin: {
    installTitle: 'Receba o aviso de SOS no celular',
    activeBody: 'Você recebe o aviso de SOS mesmo com o app fechado.',
    inactiveTitle: 'Receba o aviso de SOS no celular',
    inactiveBody: 'Ative neste celular pra ser avisado na hora, mesmo com o app fechado, quando um cliente ou técnico acionar o SOS.',
  },
} as const

// Cartão "Ativar notificações" do painel do prestador (e do admin, pro SOS).
// Registra o service worker (/sw.js), pede a permissão (só a partir de um
// clique — navegadores bloqueiam pedido automático), inscreve o aparelho no
// push e grava a assinatura no servidor. Enquanto não ativar, o prestador só
// vê o chamado com o painel aberto (radar e fila prioritária).
export function PushNotificationsCard({ audience = 'provider' }: { audience?: keyof typeof TEXTS }) {
  const texts = TEXTS[audience]
  const { isIos, isStandalone } = usePwaInstall()
  const [state, setState] = useState<PushState>('checking')
  const [busy, setBusy] = useState(false)

  // Grava (ou regrava) a assinatura do navegador para o usuário LOGADO. É idempotente:
  // se a linha já existe, só atualiza; se o aparelho estava com a assinatura de
  // outra conta, passa a ser desta.
  const registerOnServer = useCallback(async (subscription: PushSubscription): Promise<boolean> => {
    const p256dh = subscription.getKey('p256dh')
    const auth = subscription.getKey('auth')
    if (!p256dh || !auth) return false

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: arrayBufferToBase64Url(p256dh),
        auth: arrayBufferToBase64Url(auth),
        deviceType: detectPushDeviceType(navigator.userAgent),
      }),
    })
    return res.ok
  }, [])

  const detect = useCallback(async () => {
    // No iPhone o Web Push só existe com o app instalado na tela inicial (iOS 16.4+)
    if (isIos && !isStandalone) {
      setState('needs-install')
      return
    }
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window) ||
      !VAPID_PUBLIC_KEY
    ) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription || Notification.permission !== 'granted') {
        setState('inactive')
        return
      }
      // Achado de 22/09/2026 (teste no celular): o navegador guardava a assinatura
      // de uma conta anterior e o cartão mostrava "ativo" sem o servidor ter linha
      // nenhuma para o usuário logado — o "Testar" falhava com "não conseguimos
      // entregar". Agora só fica "ativo" depois de o servidor confirmar.
      const registered = await registerOnServer(subscription).catch(() => false)
      setState(registered ? 'active' : 'inactive')
    } catch {
      setState('inactive')
    }
  }, [isIos, isStandalone, registerOnServer])

  useEffect(() => {
    void detect()
  }, [detect])

  const enable = async () => {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'inactive')
        toast.error('Sem a permissão do navegador não dá pra enviar avisos.')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        })
      }

      const registered = await registerOnServer(subscription)
      if (!registered) {
        // Servidor não guardou: não deixa o aparelho "inscrito" só no navegador
        await subscription.unsubscribe().catch(() => {})
        throw new Error('servidor não guardou a assinatura')
      }

      setState('active')
      toast.success('Notificações ativadas neste aparelho!')
    } catch (error) {
      console.error('[push] falha ao ativar notificações:', error)
      toast.error('Não foi possível ativar as notificações neste aparelho.')
      void detect()
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {})
        await subscription.unsubscribe()
      }
      setState('inactive')
      toast.success('Notificações desativadas neste aparelho.')
    } catch (error) {
      console.error('[push] falha ao desativar notificações:', error)
      toast.error('Não foi possível desativar agora. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (res.status === 429) {
        toast.error('Muitos testes seguidos. Aguarde 1 minuto.')
      } else if (res.ok && json.success) {
        toast.success('Notificação de teste enviada — veja se apareceu no aparelho.')
      } else {
        toast.error('Não conseguimos entregar o teste. Desative e ative as notificações de novo.')
      }
    } catch {
      toast.error('Falha de conexão ao enviar o teste.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'checking' || state === 'unsupported') return null

  const cardStyle = {
    background: 'rgba(94, 211, 164, 0.06)',
    border: '1px solid rgba(94, 211, 164, 0.2)',
  }
  const cardClass = 'w-full max-w-md mx-auto mb-6 p-4 rounded-2xl flex items-start gap-3 animate-slide-up'

  if (state === 'needs-install') {
    return (
      <div className={cardClass} style={cardStyle} id="push-card-needs-install">
        <Bell size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
        <div className="text-xs leading-relaxed flex-1">
          <strong className="block font-bold text-sm mb-1" style={{ color: 'var(--color-text)' }}>
            {texts.installTitle}
          </strong>
          <span style={{ color: 'var(--color-text-muted)' }}>
            No iPhone, as notificações só funcionam com o app instalado na tela inicial. Instale, abra pelo ícone do Repara RV e ative aqui.
          </span>
          <div className="mt-3">
            <PwaInstallButton />
          </div>
        </div>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className={cardClass} style={cardStyle} id="push-card-denied">
        <BellOff size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
        <div className="text-xs leading-relaxed flex-1" style={{ color: 'var(--color-text-muted)' }}>
          <strong className="block font-bold text-sm mb-1" style={{ color: 'var(--color-text)' }}>
            Notificações bloqueadas neste navegador
          </strong>
          Pra receber os avisos, libere as notificações do Repara RV nas configurações do site (toque no cadeado ao lado do endereço) e volte aqui.
        </div>
      </div>
    )
  }

  if (state === 'active') {
    return (
      <div className={cardClass} style={cardStyle} id="push-card-active">
        <BellRing size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
        <div className="text-xs leading-relaxed flex-1">
          <strong className="block font-bold text-sm mb-1" style={{ color: 'var(--color-text)' }}>
            Notificações ativas neste aparelho
          </strong>
          <span style={{ color: 'var(--color-text-muted)' }}>
            {texts.activeBody}
          </span>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" id="btn-push-test" onClick={sendTest} disabled={busy} className="btn-secondary py-2 text-xs disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Testar
            </button>
            <button type="button" id="btn-push-disable" onClick={disable} disabled={busy} className="btn-secondary py-2 text-xs disabled:opacity-50">
              <BellOff size={13} /> Desativar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cardClass} style={cardStyle} id="push-card-inactive">
      <Bell size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
      <div className="text-xs leading-relaxed flex-1">
        <strong className="block font-bold text-sm mb-1" style={{ color: 'var(--color-text)' }}>
          {texts.inactiveTitle}
        </strong>
        <span style={{ color: 'var(--color-text-muted)' }}>
          {texts.inactiveBody}
        </span>
        <div className="mt-3">
          <button type="button" id="btn-push-enable" onClick={enable} disabled={busy} className="btn-primary py-2 text-xs disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Ativar notificações
          </button>
        </div>
      </div>
    </div>
  )
}
