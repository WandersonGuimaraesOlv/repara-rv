'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

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
        <span className="absolute inline-flex w-full h-full bg-amber-400 rounded-full opacity-25 animate-ping duration-1000" />
        <div className="relative flex items-center justify-center w-20 h-20 bg-amber-500 rounded-full shadow-lg shadow-amber-500/20 text-white">
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

      <span className="px-3 py-1 text-xs font-bold text-amber-800 bg-amber-100 rounded-full mb-3">
        Fila Prioritária Ativa
      </span>

      <h2 className="text-2xl font-black text-gray-900 tracking-tight">
        Seu chamado está na fila prioritária!
      </h2>
      
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">
        Nossos técnicos de Rio Verde estão finalizando atendimentos ou em trânsito. O pedido já foi enviado diretamente ao radar deles.
      </p>

      {/* Caixa de Confirmação WhatsApp */}
      <div className="w-full p-4 mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-left flex items-start gap-3 shadow-sm">
        <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700 text-lg shrink-0">
          📲
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-900">Aviso garantido no WhatsApp</p>
          <p className="text-xs text-emerald-700 mt-0.5 leading-snug">
            Assim que um técnico aceitar, avisaremos no número{' '}
            <strong className="underline">{call.client_phone || 'cadastrado'}</strong>. Pode fechar o app se preferir.
          </p>
        </div>
      </div>

      {/* Resumo do Pedido */}
      <div className="w-full p-4 mt-4 bg-white border border-gray-100 shadow-sm rounded-2xl text-left">
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Serviço solicitado</span>
            <p className="font-bold text-gray-900 text-base truncate mt-0.5">{call.service_name}</p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 line-clamp-2">
              <span>📍</span> {call.address}
            </p>
          </div>
          <span className="text-lg font-black text-orange-600 shrink-0">
            R$ {call.price?.toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="w-full mt-6 space-y-3">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full py-3.5 text-sm font-bold text-white bg-orange-600 rounded-xl shadow-md hover:bg-orange-700 active:scale-95 transition cursor-pointer"
        >
          Acompanhar em segundo plano
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 text-xs font-medium text-gray-400 hover:text-red-600 transition cursor-pointer"
        >
          Desistir e cancelar chamado
        </button>
      </div>
    </div>
  );
}
