'use client'

import { useState } from 'react'
import { Download, X, Link2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { usePwaInstall } from '@/components/pwa-install-provider'

interface PwaInstallButtonProps {
  fullWidth?: boolean
  label?: string
  // 'button': pílula independente (ex: tela de login). 'menuitem': linha
  // simples pra encaixar dentro de um menu/dropdown já existente (ex: menu
  // de conta na home), reaproveitando o estilo dos outros itens do menu.
  variant?: 'button' | 'menuitem'
  // Chamado quando o modal fecha (instalado, guia iOS ou dispensado) — nunca
  // ao abrir. Achado em teste (16/09/2026): quando o botão vive dentro de um
  // menu/dropdown condicionalmente montado (`{isProfileMenuOpen && (...)}`),
  // fechar esse menu já na abertura desmonta este componente e destrói o
  // `showModal` que acabou de ser setado, no mesmo batch do React — o modal
  // nunca chega a pintar. Fechar só no close evita isso.
  onClose?: () => void
}

// Botão persistente de instalação — diferente do banner automático
// (components/pwa-install-banner.tsx, que aparece sozinho e some por 5 dias
// se dispensado), este fica sempre disponível pra quem quiser instalar
// quando quiser, sem depender do timing do banner. Mesmo padrão visto no
// app de referência que o dono do projeto trouxe (botão fixo "Instalar o
// aplicativo" na tela de login, abrindo um modal explicativo antes do
// prompt nativo).
export function PwaInstallButton({ fullWidth = false, label = 'Instalar o aplicativo', variant = 'button', onClose }: PwaInstallButtonProps) {
  const { canInstall, isIos, isStandalone, promptInstall } = usePwaInstall()
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)

  if (isStandalone) return null

  const closeModal = () => {
    setShowModal(false)
    onClose?.()
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  const handleInstallNow = async () => {
    const outcome = await promptInstall()
    if (outcome === 'accepted' || outcome === 'ios-guide') {
      closeModal()
    }
    // 'dismissed' e 'unavailable' deixam o modal aberto — mostra a
    // instrução manual (desktop) já visível abaixo.
  }

  const handleOpen = () => {
    setShowModal(true)
  }

  return (
    <>
      {variant === 'menuitem' ? (
        <button
          type="button"
          id="btn-open-pwa-install"
          onClick={handleOpen}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors text-left cursor-pointer"
          style={{ color: 'var(--color-text-muted)' }}
          role="menuitem"
        >
          <Download size={15} style={{ color: 'var(--color-text-subtle)' }} />
          <span>{label}</span>
        </button>
      ) : (
        <button
          type="button"
          id="btn-open-pwa-install"
          onClick={handleOpen}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-xs font-bold transition-all ${fullWidth ? 'w-full' : ''}`}
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        >
          <Download size={14} />
          <span>{label}</span>
        </button>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(7, 16, 15, 0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-slide-up text-left"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-black" style={{ color: 'var(--color-text)' }}>
                Instale o Repara RV
              </h3>
              <button type="button" onClick={closeModal} style={{ color: 'var(--color-text-subtle)' }}>
                <X size={18} />
              </button>
            </div>

            <p className="text-xs mb-5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Fica na tela inicial do seu celular, abre em 1 toque e você recebe avisos dos seus chamados na hora.
            </p>

            {!canInstall && !isIos && (
              <div
                className="text-[11px] leading-relaxed mb-4 p-3 rounded-xl"
                style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                No computador, a instalação fica na barra de endereço do navegador: clique no ícone de instalar
                (⊕) à direita do endereço, ou abra o menu (⋮) e escolha <strong>&ldquo;Instalar Repara RV&rdquo;</strong>.
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-semibold transition-all"
                style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                {copied ? <Check size={14} /> : <Link2 size={14} />}
                <span>{copied ? 'Link copiado!' : 'Copiar o link do app'}</span>
              </button>

              {(canInstall || isIos) && (
                <button
                  type="button"
                  id="btn-confirm-pwa-install"
                  onClick={handleInstallNow}
                  className="btn-primary w-full py-3 text-xs"
                >
                  <Download size={14} />
                  <span>Instalar agora</span>
                </button>
              )}

              <button
                type="button"
                onClick={closeModal}
                className="w-full py-2 text-xs font-semibold text-center"
                style={{ color: 'var(--color-text-subtle)' }}
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
