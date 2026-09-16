'use client';

import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/components/pwa-install-provider';

// Achado (16/09/2026): a captura do beforeinstallprompt e o guia de iOS
// foram movidos pra components/pwa-install-provider.tsx (fonte única de
// verdade, compartilhada com components/pwa-install-button.tsx — um botão
// persistente que não depende do timing deste banner nem do cooldown de
// dispensa abaixo). Este componente cuida só da parte que é dele mesmo: a
// aparição automática e o "não me mostre de novo por uns dias".
export function PwaInstallBanner() {
  const { canInstall, isIos, isStandalone, promptInstall } = usePwaInstall();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || isStandalone) return;

    const dismissedUntil = localStorage.getItem('repara_pwa_dismissed_until');
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) return;

    if (canInstall) {
      setIsVisible(true);
      return;
    }

    if (isIos) {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
      if (isSafari) {
        const timer = setTimeout(() => setIsVisible(true), 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [canInstall, isIos, isStandalone]);

  const handleInstallClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted' || outcome === 'ios-guide') {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
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
    </aside>
  );
}
