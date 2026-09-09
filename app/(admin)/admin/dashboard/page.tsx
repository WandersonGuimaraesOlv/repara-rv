import Link from 'next/link'
import { BarChart3, Wrench, ArrowRight } from 'lucide-react'

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
          <BarChart3 className="text-orange-500" size={26} />
          Painel de Métricas & Auditoria
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitoramento operacional em tempo real de chamados, auditoria universal e segurança em Rio Verde.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 bg-orange-500/10 text-orange-400 rounded-2xl flex items-center justify-center mx-auto border border-orange-500/20">
          <BarChart3 size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">Módulo em Integração (Etapa 5)</h2>
        <p className="text-sm text-slate-400">
          O Dashboard de Analytics e Auditoria de Cancelamentos está previsto para a Etapa 5 do plano faseado, onde conectará as métricas da tabela de auditoria universal e do radar de emergência SOS.
        </p>
        <div className="pt-2">
          <Link
            href="/admin/servicos"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <Wrench size={14} />
            Gerenciar Catálogo de Serviços
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
