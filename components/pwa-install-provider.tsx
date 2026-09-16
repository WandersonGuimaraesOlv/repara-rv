'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { Share, PlusSquare, Smartphone, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaInstallContextValue {
  // Prompt nativo do Android/Chrome já capturado e pronto pra usar
  canInstall: boolean
  isIos: boolean
  isStandalone: boolean
  // Dispara o prompt nativo (Android) ou o guia manual (iOS)
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'ios-guide' | 'unavailable'>
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

// Achado (16/09/2026): a captura do evento beforeinstallprompt (só dispara
// UMA VEZ por carregamento de página, e o prompt capturado só pode ser usado
// uma vez) morava inteira dentro de components/pwa-install-banner.tsx — não
// tinha jeito de outro componente (ex: um botão fixo "Instalar Aplicativo",
// sempre disponível, independente do banner automático já ter sido
// dispensado) acionar a mesma instalação. Centralizado aqui como Provider —
// única fonte de verdade do estado do prompt nativo, consumido tanto pelo
// banner automático quanto por qualquer botão manual.
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)

    const userAgent = window.navigator.userAgent.toLowerCase()
    setIsIos(/iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream)

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'ios-guide' | 'unavailable'> => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return outcome
    }
    if (isIos) {
      setShowIosGuide(true)
      return 'ios-guide'
    }
    return 'unavailable'
  }, [deferredPrompt, isIos])

  return (
    <PwaInstallContext.Provider
      value={{ canInstall: !!deferredPrompt, isIos, isStandalone, promptInstall }}
    >
      {children}

      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in text-left"
          style={{ background: 'rgba(7, 16, 15, 0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-slide-up"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Smartphone size={18} style={{ color: 'var(--color-primary)' }} />
                Como instalar no iPhone
              </h3>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1 rounded-full transition hover:opacity-80"
                style={{ color: 'var(--color-text-subtle)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              O Safari do iPhone adiciona o app direto à sua tela de início em apenas 2 toques:
            </p>

            <ol className="space-y-3 text-xs mb-6">
              <li
                className="flex items-start gap-2.5 p-2.5 rounded-xl"
                style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
              >
                <div className="p-1.5 rounded-lg shrink-0" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-accent)' }}>
                  <Share size={15} />
                </div>
                <div>
                  <strong style={{ color: 'var(--color-text)' }}>1. Toque em Compartilhar</strong>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                    Localizado na barra inferior do Safari (ícone do quadrado com seta para cima).
                  </p>
                </div>
              </li>

              <li
                className="flex items-start gap-2.5 p-2.5 rounded-xl"
                style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
              >
                <div className="p-1.5 rounded-lg shrink-0" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-success)' }}>
                  <PlusSquare size={15} />
                </div>
                <div>
                  <strong style={{ color: 'var(--color-text)' }}>2. Selecione &ldquo;Adicionar à Tela de Início&rdquo;</strong>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-subtle)' }}>
                    Role um pouco para baixo na lista e confirme no topo direito.
                  </p>
                </div>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="btn-primary w-full py-3 text-xs"
            >
              Entendi, vou adicionar
            </button>
          </div>
        </div>
      )}
    </PwaInstallContext.Provider>
  )
}

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext)
  if (!ctx) {
    throw new Error('usePwaInstall precisa ser usado dentro de <PwaInstallProvider>')
  }
  return ctx
}
