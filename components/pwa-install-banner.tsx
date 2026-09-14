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
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shrink-0 shadow-md">
            <Smartphone size={20} />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-tight text-white flex items-center gap-1">
              <span>Instalar Repara RV</span>
              <span className="text-[9px] uppercase tracking-wider font-bold bg-orange-500/30 text-orange-300 px-1.5 py-0.2 rounded">
                App Leve
              </span>
            </h4>
            <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
              Acesso em 1 toque sem ocupar memória do celular.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1"
          >
            <Download size={13} />
            <span>Instalar</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Modal Guia para iPhone (iOS Safari) */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in text-left">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-slate-900 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black flex items-center gap-2">
                <Smartphone size={18} className="text-orange-600" />
                Como instalar no iPhone
              </h3>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              O Safari do iPhone adiciona o app direto à sua tela de início em apenas 2 toques:
            </p>

            <ol className="space-y-3 text-xs text-slate-700 mb-6">
              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="p-1.5 rounded-lg bg-orange-100 text-orange-700 shrink-0">
                  <Share size={15} />
                </div>
                <div>
                  <strong>1. Toque em Compartilhar</strong>
                  <p className="text-[11px] text-slate-500 mt-0.5">Localizado na barra inferior do Safari (ícone do quadrado com seta para cima).</p>
                </div>
              </li>

              <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                  <PlusSquare size={15} />
                </div>
                <div>
                  <strong>2. Selecione &ldquo;Adicionar à Tela de Início&rdquo;</strong>
                  <p className="text-[11px] text-slate-500 mt-0.5">Role um pouco para baixo na lista e confirme no topo direito.</p>
                </div>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Entendi, vou adicionar
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
