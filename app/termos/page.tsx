import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
import { Logo } from '@/components/logo'

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos e Condições de Uso da Plataforma Repara RV em Rio Verde (GO).',
}

export default function TermosPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <FileText size={14} />
            Termos e Condições Gerais
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Termos de Uso da Plataforma Repara RV
          </h1>
          <p className="text-xs text-slate-400">
            Última atualização: 11 de Setembro de 2026 • Cidade de Rio Verde - Goiás
          </p>
        </div>

        {/* Artigos */}
        <div className="prose prose-invert max-w-none space-y-6 text-sm text-slate-300 leading-relaxed">
          
          {/* Seção 1 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">1</span>
              Objeto e Natureza dos Serviços (Intermediação Tecnológica)
            </h2>
            <p>
              A <strong>Repara RV</strong> é uma plataforma digital sob demanda operada para intermediação tecnológica entre <strong>Moradores/Clientes</strong> que necessitam de reparos residenciais e <strong>Profissionais Autônomos Credenciados (Prestadores)</strong> na cidade de Rio Verde (GO).
            </p>
            <p>
              A Repara RV <strong>não presta diretamente serviços de engenharia, eletricidade, encanamento ou montagem</strong>, atuando exclusivamente como provedora da ferramenta de aproximação, cálculo de rota, precificação transparente e facilitação de pagamento via split de Pix. Os prestadores credenciados são profissionais autônomos ou microempreendedores individuais (MEI), sem qualquer vínculo de subordinação ou emprego.
            </p>
          </section>

          {/* Seção 2 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">2</span>
              Regra de Escopo: Fornecimento de Materiais e Peças
            </h2>
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong>Atenção morador:</strong> O preço tabelado contratado na plataforma refere-se <strong>estritamente à mão de obra técnica especializada</strong>.
              </div>
            </div>
            <p>
              <strong>O que está incluso:</strong> Ferramental técnico de execução, diagnóstico no local, testes operacionais de funcionamento, vedações simples (fita veda-rosca) e pequenos conectores básicos de engate.
            </p>
            <p>
              <strong>O que NÃO está incluso:</strong> O produto novo principal a ser instalado ou substituído (ex: chuveiro, torneira, reparo de caixa acoplada, cuba, luminária, cabo flexível ou disjuntor novo), bem como quebra de paredes, alvenaria ou readequação estrutural de fiação. O cliente deve ter o aparelho em mãos antes da chegada do profissional.
            </p>
          </section>

          {/* Seção 3 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">3</span>
              Preço Fixo, Split de Pagamento e Taxa de Intermediação
            </h2>
            <p>
              Todos os valores exibidos no catálogo são <strong>fixos e pré-fixados</strong>, eliminando orçamentos abusivos. O pagamento é realizado digitalmente via <strong>Pix</strong> diretamente pela plataforma.
            </p>
            <p>
              O processamento do pagamento utiliza tecnologia oficial de <strong>Split de Pagamento (Mercado Pago)</strong>: no momento da liquidação do Pix pelo morador, o valor líquido da mão de obra é repassado instantaneamente à subconta do prestador e a taxa de serviço (R$ 12,00 a R$ 25,00 a depender do chamado) é retida pela plataforma para custeio operacional, infraestrutura de nuvem e segurança.
            </p>
          </section>

          {/* Seção 4 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">4</span>
              Garantia do Serviço de 7 Dias
            </h2>
            <p>
              Todos os reparos concluídos e quitados na plataforma possuem <strong>Garantia de 7 (sete) dias corridos</strong> sobre a mão de obra executada. Caso o reparo venha a apresentar vazamento, falha de aperto ou desregulagem não causada por mau uso ou defeito de fábrica do aparelho do morador, a Repara RV providenciará o retorno do profissional ou o envio de um técnico reserva sem qualquer custo adicional para o cliente.
            </p>
          </section>

          {/* Seção 5 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">5</span>
              Cancelamento e No-Show (Ausência no Local)
            </h2>
            <p>
              O morador pode cancelar o chamado sem custos enquanto o status estiver em <em>Fila Prioritária (queued)</em> ou <em>Buscando Profissional (searching)</em>. Caso o prestador já tenha aceito e se deslocado até o endereço em Rio Verde, o cancelamento sem justificativa ou a ausência do cliente por mais de 10 minutos após a chegada do técnico poderá ensejar taxa de deslocamento de R$ 25,00 para ressarcimento de combustível e tempo do profissional.
            </p>
          </section>

          {/* Seção 6 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">6</span>
              Segurança e Checagem de Antecedentes
            </h2>
            <p>
              Para a tranquilidade dos moradores e famílias de Rio Verde, todo prestador autônomo é submetido à verificação documental, conferência de chave Pix/CPF e apresentação de Certidão Negativa de Antecedentes Criminais antes de ser homologado com o selo de <em>Segurança Verificada</em>.
            </p>
          </section>

          {/* Seção 7 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">7</span>
              Foro de Eleição
            </h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil e pelo Código de Defesa do Consumidor (Lei 8.078/90) no que couber. Fica eleito o Foro da Comarca de <strong>Rio Verde, Estado de Goiás</strong>, para dirimir quaisquer dúvidas decorrentes do presente termo.
            </p>
          </section>

        </div>

        {/* Rodapé Interno */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Repara RV Tecnologia e Intermediação Ltda • Rio Verde - GO
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacidade" className="hover:text-white underline transition-colors">
              Política de Privacidade
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
