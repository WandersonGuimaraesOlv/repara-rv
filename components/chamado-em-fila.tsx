'use client'

import React from 'react'
import { formatPhone } from '@/lib/utils'

export interface ChamadoEmFilaProps {
  order: {
    service_name: string
    address: string
    price: number
    client_phone?: string
  }
  onCancel: () => void
  cancelling?: boolean
}

export function ChamadoEmFila({ order, onCancel, cancelling }: ChamadoEmFilaProps) {
  const formattedPhone = order.client_phone ? formatPhone(order.client_phone) : null

  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center animate-slide-up w-full">
      {/* Radar Pulsante */}
      <div className="relative flex items-center justify-center w-20 h-20 mb-6">
        <span className="absolute inline-flex w-full h-full bg-amber-400 rounded-full opacity-30 animate-ping"></span>
        <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-full shadow-lg shadow-amber-500/20">
          <svg
            className="w-8 h-8 text-white animate-spin"
            style={{ animationDuration: '3.5s' }}
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

      <h2 className="text-xl font-black text-slate-900 tracking-tight">
        Seu chamado está na fila prioritária!
      </h2>
      <p className="mt-2 text-sm text-slate-600 max-w-xs leading-relaxed">
        No momento nossos técnicos estão em deslocamento ou finalizando atendimentos em Rio Verde.
      </p>

      {/* Caixa de aviso WhatsApp */}
      <div className="w-full max-w-xs p-3.5 mt-5 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-left flex items-start gap-3 shadow-sm">
        <span className="text-xl shrink-0 mt-0.5">📲</span>
        <div className="text-xs text-emerald-900">
          <p className="font-bold text-emerald-900">Aviso via WhatsApp garantido</p>
          <p className="mt-0.5 text-emerald-700 leading-snug">
            Assim que um profissional aceitar, enviaremos os dados do técnico {formattedPhone ? <>para <strong>{formattedPhone}</strong></> : 'para seu WhatsApp'}.
          </p>
        </div>
      </div>

      {/* Resumo do Pedido */}
      <div className="w-full max-w-xs p-4 mt-4 bg-white border border-slate-200/80 shadow-sm rounded-2xl text-left">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Serviço em espera</span>
            <p className="font-bold text-slate-900 text-sm truncate mt-0.5">{order.service_name}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">📍 {order.address}</p>
          </div>
          <span className="text-sm font-black text-orange-600 shrink-0">
            R$ {order.price?.toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      {/* Ações */}
      <div className="w-full max-w-xs mt-6 space-y-2.5">
        <button
          type="button"
          onClick={() => {
            window.location.href = '/'
          }}
          className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 rounded-2xl shadow-md shadow-orange-500/20 active:scale-95 transition cursor-pointer"
        >
          Deixar na fila e voltar ao início
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-red-500 active:scale-95 transition disabled:opacity-50 cursor-pointer"
        >
          {cancelling ? 'Cancelando chamado...' : 'Desistir e cancelar chamado'}
        </button>
      </div>
    </div>
  )
}
