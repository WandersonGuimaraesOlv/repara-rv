'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone } from 'lucide-react';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. Verifica se já está rodando como PWA instalado (standalone)
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // 2. Verifica se o usuário já dispensou nos últimos 5 dias
    const dismissedUntil = localStorage.getItem('repara_pwa_dismissed_until');
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      return;
    }

    // 3. Detecta iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // 4. Captura evento nativo em Android / Chrome / Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Se for iOS no Safari, exibe após 2 segundos de navegação
    if (isIosDevice) {
      const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
      if (isSafari) {
        const timer = setTimeout(() => setIsVisible(true), 2500);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIosGuide(false);
    // Guarda recusa por 5 dias
    localStorage.setItem('repara_pwa_dismissed_until', String(Date.now() + 5 * 24 * 60 * 60 * 1000));
  };

  if (!isVisible) return null;

  return (
    <aside aria-label="Instalação do Aplicativo" className="fixed bottom-16 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm z-40 animate-slide-up">
      <div
        className="backdrop-blur-md p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-left"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
          >
            <Smartphone size={20} />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-tight flex items-center gap-1" style={{ color: 'var(--color-text)' }}>
              <span>Instalar Repara RV</span>
              <span
                className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded"
                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-accent)' }}
              >
                App Leve
              </span>
            </h4>
            <p className="text-[11px] leading-snug mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Acesso em 1 toque sem ocupar memória do celular.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
          >
            <Download size={13} />
            <span>Instalar</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-full transition cursor-pointer hover:opacity-80"
            style={{ color: 'var(--color-text-subtle)' }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Modal Guia para iPhone (iOS Safari) */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in text-left" style={{ background: 'rgba(7, 16, 15, 0.85)', backdropFilter: 'blur(8px)' }}>
          <div
            className="rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-slide-up"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
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
                <div
                  className="p-1.5 rounded-lg shrink-0"
                  style={{ background: 'var(--color-primary-soft)', color: 'var(--color-accent)' }}
                >
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
                <div
                  className="p-1.5 rounded-lg shrink-0"
                  style={{ background: 'var(--color-primary-soft)', color: 'var(--color-success)' }}
                >
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
    </aside>
  );
}
