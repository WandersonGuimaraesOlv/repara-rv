import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Lock, Eye, Database, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/logo'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Política de Privacidade e Proteção de Dados (LGPD) da Repara RV.',
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span>Voltar ao Início</span>
          </Link>
          <Logo variant="full" width={140} height={35} inverted />
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        <div className="space-y-3 border-b border-slate-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ShieldCheck size={14} />
            Privacidade e Segurança
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Política de Privacidade e Proteção de Dados (LGPD)
          </h1>
          <p className="text-xs text-slate-400">
            Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) • Rio Verde - Goiás
          </p>
        </div>

        {/* Artigos */}
        <div className="prose prose-invert max-w-none space-y-6 text-sm text-slate-300 leading-relaxed">
          
          {/* Seção 1 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">1</span>
              Compromisso com a sua Privacidade
            </h2>
            <p>
              A <strong>Repara RV Tecnologia e Intermediação Ltda</strong> preza pela transparência e pelo respeito à privacidade de todos os clientes e prestadores de serviços em Rio Verde. Esta política detalha como coletamos, tratamos e protegemos os seus dados pessoais em estrita conformidade com a Lei Geral de Proteção de Dados (Lei Federal 13.709/18).
            </p>
          </section>

          {/* Seção 2 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">2</span>
              Dados Pessoais Coletados
            </h2>
            <p>Para a operacionalização segura dos chamados, coletamos:</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
              <li><strong>Para Moradores/Clientes:</strong> Nome completo, número de telefone com WhatsApp, endereço do imóvel em Rio Verde e histórico de ordens de serviço.</li>
              <li><strong>Para Prestadores Parceiros:</strong> Nome completo, telefone WhatsApp, CPF/CNPJ, chave Pix, autodeclaração de aptidão e idoneidade, localização geográfica em tempo real durante atendimento e dados de contato.</li>
              <li><strong>Dados de Pagamento:</strong> O Repara RV <strong>não armazena dados de cartão de crédito</strong>. Todas as transações são efetuadas diretamente através do protocolo seguro de Pix do Banco Central e gateway Mercado Pago.</li>
            </ul>
          </section>

          {/* Seção 3 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">3</span>
              Finalidade do Tratamento dos Dados
            </h2>
            <p>Seus dados são utilizados estritamente para:</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
              <li>Conectar você ao técnico mais próximo disponível no seu bairro em Rio Verde.</li>
              <li>Permitir a comunicação de chegada do profissional via WhatsApp.</li>
              <li>Emissão do Comprovante Oficial de Manutenção para imobiliárias e proprietários.</li>
              <li>Prevenção a fraudes, validação de antecedentes e segurança dos moradores.</li>
              <li>Cumprimento de obrigações legais, fiscais e regulatórias.</li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">4</span>
              Compartilhamento Restrito de Informações
            </h2>
            <p>
              A Repara RV <strong>não vende e jamais comercializa dados pessoais</strong> para terceiros ou corretoras de dados. Os dados são compartilhados exclusivamente com o prestador designado para o seu chamado (nome e endereço de execução) e com os parceiros de infraestrutura essencial (Supabase, Cloudflare e Mercado Pago).
            </p>
          </section>

          {/* Seção 5 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">5</span>
              Direitos do Titular (LGPD) e Exclusão de Conta
            </h2>
            <p>
              Você possui total controle sobre seus dados. A qualquer momento, você pode solicitar a confirmação de tratamento, retificação de informações ou a <strong>exclusão definitiva de sua conta e dados cadastrais</strong> enviando uma mensagem para o nosso canal do Encarregado de Dados (DPO) através do e-mail: <strong className="text-white">privacidade@repararv.com</strong> ou diretamente pelo WhatsApp de Suporte.
            </p>
          </section>

          {/* Seção 6 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">6</span>
              Segurança da Informação e Criptografia
            </h2>
            <p>
              Todas as comunicações entre o seu navegador ou aplicativo e os nossos servidores utilizam criptografia de ponta a ponta (TLS 1.3 / HTTPS), com bancos de dados isolados protegidos por políticas restritivas de Row Level Security (RLS) no PostgreSQL.
            </p>
          </section>

        </div>

        {/* Rodapé Interno */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Repara RV Tecnologia e Intermediação Ltda • Rio Verde - GO
          </div>
          <div className="flex items-center gap-4">
            <Link href="/termos" className="hover:text-white underline transition-colors">
              Termos de Uso
            </Link>
            <Link href="/" className="hover:text-white underline transition-colors">
              Página Inicial
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
