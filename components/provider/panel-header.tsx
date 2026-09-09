'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Radio } from 'lucide-react'

interface PanelHeaderProps {
  isOnline: boolean
}

export function PanelHeader({ isOnline }: PanelHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 2) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <header className="w-full flex items-center justify-between px-3 py-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-md rounded-2xl mb-5 shadow-sm">
      {/* Botão de Retorno Seguro */}
      <button
        type="button"
        onClick={handleBack}
        aria-label="Voltar para a página inicial"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs font-semibold active:scale-95"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Início</span>
      </button>

      {/* Identificação Central */}
      <div className="flex items-center gap-2">
        <Link href="/" className="font-extrabold text-base text-slate-900 tracking-tight hover:opacity-90 transition-opacity">
          Repara<span className="text-orange-500">RV</span>
        </Link>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
          Painel Prestador
        </span>
      </div>

      {/* Status da Conexão */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
          isOnline
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
            : 'bg-slate-100 text-slate-500 border border-slate-200'
        }`}
      >
        <Radio className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </div>
    </header>
  )
}
