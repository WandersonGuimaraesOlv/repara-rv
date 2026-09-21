'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Smartphone } from 'lucide-react';

interface ChamadoEmFilaProps {
  call: {
    id: string;
    service_name: string;
    address: string;
    price: number;
    client_phone?: string;
  };
  onCancel: () => void;
}

export function ChamadoEmFila({ call, onCancel }: ChamadoEmFilaProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-8 text-center max-w-md mx-auto animate-slide-up w-full">
      {/* Radar pulsante */}
      <div className="relative flex items-center justify-center w-24 h-24 mb-6">
        <span
          className="absolute inline-flex w-full h-full rounded-full opacity-25 animate-ping duration-1000"
          style={{ background: 'var(--color-primary)' }}
        />
        <div
          className="relative flex items-center justify-center w-20 h-20 rounded-full shadow-lg text-white"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
            boxShadow: '0 0 24px var(--color-primary-glow)',
          }}
        >
          <svg
            className="w-10 h-10 animate-spin"
            style={{ animationDuration: '4s' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>

      <span
        className="px-3 py-1 text-xs font-bold rounded-full mb-3"
        style={{
          background: 'var(--color-primary-soft)',
          color: 'var(--color-accent)',
          border: '1px solid var(--color-border)',
        }}
      >
        Fila Prioritária Ativa
      </span>

      <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
        Seu chamado está na fila prioritária!
      </h2>
      
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        Nossos técnicos de Rio Verde estão finalizando atendimentos ou em trânsito. O pedido já foi enviado diretamente ao radar deles.
      </p>

      {/* Aviso dentro do app: o cliente é avisado nesta tela (Realtime), não por WhatsApp */}
      <div
        className="w-full p-4 mt-6 rounded-2xl text-left flex items-start gap-3 shadow-sm"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="p-2 rounded-xl shrink-0"
          style={{ background: 'var(--color-primary-soft)', color: 'var(--color-accent)' }}
        >
          <Smartphone size={20} strokeWidth={2} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            Fique com esta tela aberta
          </p>
          <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            Assim que um técnico aceitar, o status muda aqui na hora e você já vê quem está a caminho. Se sair do app, volte em <strong className="underline" style={{ color: 'var(--color-accent)' }}>Meus Pedidos</strong> para acompanhar.
          </p>
        </div>
      </div>

      {/* Resumo do Pedido */}
      <div
        className="w-full p-4 mt-4 shadow-sm rounded-2xl text-left"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-subtle)' }}>
              Serviço solicitado
            </span>
            <p className="font-bold text-base truncate mt-0.5" style={{ color: 'var(--color-text)' }}>
              {call.service_name}
            </p>
            <p className="text-xs mt-1 flex items-center gap-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
              <MapPin size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" /> {call.address}
            </p>
          </div>
          <span className="text-lg font-black shrink-0" style={{ color: 'var(--color-accent)' }}>
            R$ {call.price?.toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="w-full mt-6 space-y-3">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="btn-primary w-full py-3.5 text-sm"
        >
          Acompanhar em segundo plano
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 text-xs font-medium transition cursor-pointer hover:opacity-80"
          style={{ color: 'var(--color-danger)' }}
        >
          Desistir e cancelar chamado
        </button>
      </div>
    </div>
  );
}
