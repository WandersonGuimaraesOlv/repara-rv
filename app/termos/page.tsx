import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, FileText, AlertTriangle, CheckCircle2, Shield, Wrench, CreditCard, Clock, Star, Scale } from 'lucide-react'
import { Logo } from '@/components/logo'

export const metadata: Metadata = {
  title: 'Termos de Uso e Condições Gerais — Repara RV',
  description: 'Termos de Uso e Condições Gerais de Navegação da Plataforma Repara RV. Leia antes de se cadastrar e utilizar a plataforma em Rio Verde (GO).',
}

const sections = [
  { id: 'abertura', label: 'Abertura e Identificação' },
  { id: 'definicoes', label: 'Definições' },
  { id: 'objeto', label: 'Objeto e Natureza' },
  { id: 'cadastro', label: 'Cadastro e Aceite' },
  { id: 'materiais', label: 'Materiais e Peças' },
  { id: 'contratacao', label: 'Fluxo de Contratação' },
  { id: 'pagamentos', label: 'Pagamentos e Repasse' },
  { id: 'cancelamento', label: 'Cancelamento e No-Show' },
  { id: 'garantia', label: 'Garantia de 7 Dias' },
  { id: 'obrigacoes-cliente', label: 'Obrigações do Cliente' },
  { id: 'obrigacoes-prestador', label: 'Obrigações do Prestador' },
  { id: 'vedacoes', label: 'Vedações e Condutas Proibidas' },
  { id: 'responsabilidade', label: 'Limitação de Responsabilidade' },
  { id: 'avaliacao', label: 'Avaliação Pós-Serviço' },
  { id: 'seguranca', label: 'Segurança e Emergência' },
  { id: 'lgpd', label: 'Privacidade e LGPD' },
  { id: 'vigencia', label: 'Vigência e Rescisão' },
  { id: 'foro', label: 'Disposições Finais e Foro' },
]

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
            <span>Voltar ao Início</span>
          </Link>
          <Logo variant="full" width={140} height={35} inverted />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14 lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">

        {/* Sumário Lateral (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-1">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Sumário</p>
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-orange-400 transition-colors py-0.5"
              >
                <span className="w-4 text-right text-slate-600 text-[10px]">{String(i + 1).padStart(2, '0')}</span>
                {s.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <main className="space-y-8 min-w-0">
          {/* Cabeçalho do Documento */}
          <div className="space-y-3 border-b border-slate-800 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <FileText size={14} />
              Termos de Uso e Condições Gerais
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Termos de Uso e Condições Gerais de Navegação da Plataforma Repara RV
            </h1>
            <p className="text-xs text-slate-400">
              Última atualização: 13 de Setembro de 2026 · Versão 1.0 · Rio Verde — Goiás, Brasil
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle size={16} className="shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong>LEIA COM ATENÇÃO:</strong> O cadastro e a utilização da Plataforma Repara RV implicam a leitura integral,
                compreensão e aceitação expressa de todas as cláusulas deste instrumento. Caso não concorde com qualquer disposição,
                não realize o cadastro.
              </span>
            </div>
          </div>

          {/* ── Cláusula 1 ── */}
          <section id="abertura" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">1</span>
              Da Abertura e da Identificação da Plataforma
            </h2>
            <p>
              Este instrumento eletrônico constitui os <strong>Termos de Uso e Condições Gerais</strong> aplicáveis ao acesso,
              à navegação e à utilização contínua da plataforma digital <strong>Repara RV</strong>. O presente documento tem por finalidade
              primordial estabelecer as bases jurídicas, as obrigações mútuas e as diretrizes operacionais que regem a interação
              entre a tecnologia fornecida e todos os indivíduos que nela ingressam.
            </p>
            <p>
              A Repara RV é desenvolvida, mantida e operada pela empresa <strong>Repara RV Tecnologia e Intermediação Ltda</strong>,
              pessoa jurídica de direito privado, com sede e foro na cidade de <strong>Rio Verde, Estado de Goiás, Brasil</strong>,
              inscrita sob CNAE principal <strong>7490-1/04</strong> (Atividades de intermediação e agenciamento de serviços e negócios em geral)
              e CNAE secundário <strong>6311-9/00</strong> (Tratamento de dados, provedores de serviços de aplicação e hospedagem na internet).
            </p>
            <p>
              Para fins deste instrumento, a Repara RV será doravante denominada simplesmente <em>"Plataforma"</em>.
              Dúvidas, solicitações e comunicações formais devem ser encaminhadas ao canal oficial de atendimento:
              <strong className="text-white"> contato@repararv.com</strong>.
            </p>
          </section>

          {/* ── Cláusula 2 ── */}
          <section id="definicoes" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">2</span>
              Das Definições
            </h2>
            <p>Para interpretação uniforme deste instrumento, adotam-se as seguintes definições:</p>
            <ul className="space-y-2 text-xs text-slate-300">
              <li><strong className="text-white">Plataforma:</strong> Aplicativo digital e ambiente web da Repara RV, disponível como Progressive Web App (PWA), desenvolvido em tecnologia Next.js hospedada em infraestrutura Cloudflare.</li>
              <li><strong className="text-white">Cliente / Morador:</strong> Pessoa física que, após devidamente cadastrada, utiliza a Plataforma para contratar serviços técnicos residenciais de reparo.</li>
              <li><strong className="text-white">Prestador / Técnico Parceiro:</strong> Profissional autônomo ou Microempreendedor Individual (MEI) credenciado na Plataforma que executa os serviços técnicos residenciais contratados pelo Cliente.</li>
              <li><strong className="text-white">Chamado / Ordem de Serviço:</strong> Requisição formal de serviço técnico aberta pelo Cliente na Plataforma, com endereço, localização geográfica e serviço selecionado do catálogo tabelado.</li>
              <li><strong className="text-white">Radar Geoespacial:</strong> Motor de busca por geolocalização (PostGIS/KNN) que identifica automaticamente o Técnico online mais próximo do endereço do Cliente em Rio Verde.</li>
              <li><strong className="text-white">Preço Fixo Tabelado:</strong> Valor em reais, pré-definido no catálogo da Plataforma para cada tipo de serviço, correspondente estritamente à mão de obra técnica especializada.</li>
              <li><strong className="text-white">Taxa de Intermediação:</strong> Valor retido pela Plataforma por chamado concluído para custeio operacional, infraestrutura e segurança, conforme informado no catálogo.</li>
              <li><strong className="text-white">Split de Pagamento:</strong> Tecnologia de divisão automática do pagamento Pix, via gateway parceiro (Mercado Pago / Efí Bank), que repassa instantaneamente o valor líquido da mão de obra ao Prestador e retém a Taxa de Intermediação na conta da Plataforma.</li>
              <li><strong className="text-white">Autocertificação / Autodeclaração:</strong> Declaração digital vinculante prestada pelo Técnico Parceiro no ato do cadastro, sob as penas da lei, certificando aptidão técnica e idoneidade.</li>
            </ul>
          </section>

          {/* ── Cláusula 3 ── */}
          <section id="objeto" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Wrench size={16} className="text-orange-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">3</span>
              Do Objeto e da Natureza dos Serviços (Intermediação Tecnológica)
            </h2>
            <p>
              A Plataforma tem por objeto exclusivo a <strong>intermediação tecnológica</strong> entre Clientes e Técnicos Parceiros para a
              execução de serviços técnicos residenciais de reparo, manutenção e instalação, nas categorias disponíveis no catálogo:
              <strong> Elétrica Residencial, Hidráulica, Montagem e Fixação, Chaveiro Residencial</strong> e <strong>Instalação de Eletrodomésticos</strong>.
            </p>
            <p>
              A Repara RV <strong>não presta diretamente nenhum serviço técnico</strong>, não é empregadora dos Técnicos Parceiros e não possui
              vínculo de subordinação trabalhista com qualquer profissional credenciado. A Plataforma atua exclusivamente como
              provedora da ferramenta digital de aproximação, geolocalização, precificação transparente e facilitação de pagamento.
            </p>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-200">
              <strong>Serviços cobertos pelo catálogo atual:</strong> Elétrica (chuveiro, tomada, interruptor, lâmpada, ventilador de teto, painel LED, disjuntor),
              Hidráulica (torneira, sifão, desentupimento, caixa acoplada, vedação de box, válvula de descarga, vaso sanitário),
              Montagem (suporte de TV, fixação, móvel pequeno, varal, dobradiças),
              Chaveiro (abertura de porta, troca de fechadura) e
              Instalação (máquina de lavar, gás/mangueira).
            </div>
          </section>

          {/* ── Cláusula 4 ── */}
          <section id="cadastro" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">4</span>
              Do Cadastro, Aceite Eletrônico e Autodeclaração
            </h2>
            <p>
              O acesso às funcionalidades da Plataforma é condicionado ao cadastro prévio do usuário, mediante fornecimento de
              nome completo, número de celular com DDD e PIN de segurança pessoal. O cadastro implica aceitação integral
              destes Termos por meio de <strong>aceite eletrônico (modelo clickwrap)</strong>, com registro de data, hora e versão do documento.
            </p>
            <p>
              Para cadastro de <strong>Clientes</strong>: fornecimento de nome, celular e PIN. Para cadastro de <strong>Técnicos Parceiros</strong>:
              adicionalmente, CPF ou CNPJ MEI, chave Pix para recebimentos e assinatura da Autocertificação vinculante abaixo:
            </p>
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-xs text-slate-300 italic">
              <CheckCircle2 size={14} className="inline mr-2 text-orange-400" />
              <em>
                "Declaro, sob as penas da lei, ser profissional autônomo capacitado para a execução dos serviços técnicos
                residenciais disponíveis no catálogo da Plataforma, assumir integralmente a responsabilidade civil pelos
                serviços executados e estar ciente de que a Repara RV atua exclusivamente como intermediadora tecnológica,
                sem vínculo empregatício ou subordinação de qualquer natureza."
              </em>
            </div>
            <p>
              O cadastro é pessoal e intransferível. O usuário é o único responsável pela guarda do PIN de acesso e por
              todas as ações realizadas em sua conta. Em caso de suspeita de uso não autorizado, o usuário deve comunicar
              imediatamente a Plataforma pelo canal de atendimento oficial.
            </p>
            <p>
              A Plataforma adota o modelo de <strong>Cadastro Pessoa Física (CPF)</strong>, dispensando a exigência prévia de MEI ou abertura
              de empresa para o início das atividades do Técnico Parceiro. O Split de Pix é liquidado diretamente na conta
              bancária vinculada ao CPF ou CNPJ informado.
            </p>
          </section>

          {/* ── Cláusula 5 ── */}
          <section id="materiais" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">5</span>
              Da Delimitação do Escopo: Materiais, Peças e Equipamentos
            </h2>
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong>ATENÇÃO MORADOR — LEIA ANTES DE SOLICITAR:</strong> O preço tabelado contratado na Plataforma refere-se
                <strong> estritamente à mão de obra técnica especializada</strong>. Materiais, peças e aparelhos novos
                <strong> NÃO estão inclusos</strong> e devem ser providenciados pelo Cliente com antecedência.
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-green-400 mb-2">✅ O que está incluso no preço tabelado:</p>
              <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                <li>Ferramental técnico completo necessário para a execução do serviço</li>
                <li>Diagnóstico técnico no local e testes operacionais de funcionamento</li>
                <li>Pequenos insumos de finalização: fita veda-rosca (teflon), conectores elétricos de engate e buchas padrão</li>
                <li>Limpeza básica do local de trabalho e descarte do material substituído</li>
                <li>Verificação de segurança e entrega do serviço com teste de validação</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-red-400 mb-2">❌ O que NÃO está incluso (responsabilidade do Cliente):</p>
              <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                <li>O aparelho, produto ou peça nova principal a ser instalada (ex: chuveiro, torneira, resistência, luminárias, ventilador, fechadura, vaso sanitário, máquina de lavar)</li>
                <li>Componentes elétricos de reposição: disjuntores novos, cabo flexível, tomadas e interruptores novos</li>
                <li>Componentes hidráulicos de reposição: flexíveis, caixas acopladas completas, boias, registros novos</li>
                <li>Obras civis: quebra de paredes, alvenaria, readequação estrutural de fiação ou encanamento interno</li>
                <li>Remoção de entulho de obra, pintura de paredes ou reforma de acabamento</li>
                <li>Serviços de responsabilidade da construtora, seguradora ou condomínio</li>
              </ul>
            </div>
            <p className="text-xs text-slate-400">
              O Cliente deve assegurar que o produto/peça nova a ser instalada esteja disponível e em embalagem original antes da chegada do Técnico.
              O Técnico Parceiro reserva-se o direito de recusar a execução caso os materiais necessários não estejam disponíveis no local,
              sem que isso gere qualquer ônus ou penalidade ao profissional.
            </p>
          </section>

          {/* ── Cláusula 6 ── */}
          <section id="contratacao" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">6</span>
              Do Fluxo de Contratação e do Ciclo do Chamado
            </h2>
            <p>A contratação de serviços na Plataforma segue o seguinte fluxo tecnológico:</p>
            <ol className="space-y-2 text-xs text-slate-300 list-decimal pl-4">
              <li><strong>Seleção do Serviço:</strong> O Cliente seleciona o serviço desejado no catálogo tabelado e confirma o preço fixo correspondente.</li>
              <li><strong>Confirmação de Endereço e Localização:</strong> O Cliente informa o endereço completo e permite a captura de coordenadas geográficas para o cálculo de rota preciso.</li>
              <li><strong>Ciência sobre Materiais:</strong> O Cliente confirma, mediante checkbox obrigatório, que tem plena ciência de que o preço tabelado refere-se exclusivamente à mão de obra e que materiais/peças novas devem ser providenciados por sua conta.</li>
              <li><strong>Busca Geoespacial:</strong> O Radar da Plataforma identifica e notifica automaticamente o Técnico online mais próximo via alerta sonoro, vibração e notificação push.</li>
              <li><strong>Janela de Aceite:</strong> O Técnico tem até <strong>45 segundos</strong> para aceitar o chamado. Caso não aceite dentro do prazo, o chamado é automaticamente repassado ao próximo profissional disponível no radar.</li>
              <li><strong>Deslocamento e Execução:</strong> Após o aceite, o endereço completo é liberado ao Técnico. O Cliente acompanha o status do chamado em tempo real na tela de rastreamento.</li>
              <li><strong>Pagamento via Pix:</strong> Ao concluir o serviço, o Técnico aciona a finalização na Plataforma. O Cliente realiza o pagamento via QR Code Pix dinâmico gerado pela Plataforma. O repasse automático ao Técnico ocorre após a confirmação do pagamento.</li>
            </ol>
            <p className="text-xs text-slate-400">
              Antes do aceite do Técnico (status <em>searching</em>), o Técnico visualiza apenas o bairro e a distância aproximada do chamado,
              sem acesso ao endereço completo ou às coordenadas exatas do imóvel, em conformidade com a LGPD.
            </p>
          </section>

          {/* ── Cláusula 7 ── */}
          <section id="pagamentos" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard size={16} className="text-orange-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">7</span>
              Dos Pagamentos, Split de Pix e Taxa de Intermediação
            </h2>
            <p>
              Todos os valores exibidos no catálogo são <strong>fixos, pré-fixados e publicamente disponíveis</strong> antes da contratação,
              eliminando orçamentos abusivos ou cobrança de visita técnica. O pagamento é realizado <strong>exclusivamente via Pix</strong>,
              por meio de QR Code dinâmico gerado pela Plataforma ao final do serviço.
            </p>
            <p>
              <strong>Fica expressamente proibido</strong> qualquer pagamento em dinheiro, transferência bancária direta, cartão próprio
              do Técnico ou qualquer outra modalidade que não seja o Pix via Plataforma. O descumprimento desta regra por qualquer
              das partes configura violação destes Termos e sujeita o infrator ao descredenciamento imediato.
            </p>
            <p>
              O processamento utiliza tecnologia de <strong>Split de Pagamento</strong>: no momento da liquidação do Pix, o valor líquido
              da mão de obra é repassado automaticamente à conta vinculada à chave Pix cadastrada pelo Técnico Parceiro.
              A <strong>Taxa de Intermediação</strong> (entre R$ 12,00 e R$ 25,00 por chamado, conforme catálogo) é retida pela Plataforma
              para custeio de infraestrutura tecnológica de nuvem, segurança de dados, suporte operacional e desenvolvimento contínuo.
            </p>
            <p>
              Não há qualquer cobrança antecipada ao Técnico Parceiro para ingresso ou permanência na Plataforma.
              A retenção da Taxa de Intermediação ocorre <strong>exclusivamente</strong> no ato de cada chamado concluído e pago.
            </p>
          </section>

          {/* ── Cláusula 8 ── */}
          <section id="cancelamento" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-orange-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">8</span>
              Do Cancelamento e do No-Show (Ausência no Local)
            </h2>
            <div className="space-y-3 text-xs text-slate-300">
              <p><strong className="text-white">Cancelamento sem custo:</strong> O Cliente pode cancelar o chamado sem qualquer ônus enquanto o status estiver em <em>Buscando Profissional (searching)</em>, antes de qualquer Técnico aceitar o chamado.</p>
              <p><strong className="text-white">Cancelamento após aceite (taxa de deslocamento):</strong> Uma vez que o Técnico Parceiro tenha aceito o chamado e iniciado o deslocamento, o cancelamento injustificado pelo Cliente ou a ausência do morador no endereço por mais de <strong>10 (dez) minutos</strong> após a chegada confirmada do Técnico poderá ensejar a cobrança de <strong>taxa de deslocamento de até R$ 25,00 (vinte e cinco reais)</strong>, destinada a ressarcir o profissional pelo combustível e tempo despendido.</p>
              <p><strong className="text-white">Cancelamento pelo Técnico:</strong> O Técnico Parceiro pode cancelar o chamado mediante justificativa estruturada dentro da Plataforma (cliente ausente, endereço incorreto, problema técnico insuperável ou outra). Cancelamentos reiterados sem justificativa plausível serão analisados pela equipe de operações e podem resultar em inativação temporária do cadastro, sempre com direito à análise e contraditório.</p>
              <p><strong className="text-white">Serviço não executável:</strong> Caso o Técnico chegue ao local e constate que a execução do serviço é impossível por razão não informada pelo Cliente (ex: falta do aparelho novo, defeito de fábrica não solucionável in loco, risco estrutural), o serviço poderá ser recusado sem cobrança do preço tabelado, mas a taxa de deslocamento poderá ser aplicada conforme previsto acima.</p>
            </div>
          </section>

          {/* ── Cláusula 9 ── */}
          <section id="garantia" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield size={16} className="text-orange-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">9</span>
              Da Garantia do Serviço de 7 Dias
            </h2>
            <p>
              Todos os reparos concluídos e devidamente quitados na Plataforma possuem <strong>Garantia de 7 (sete) dias corridos</strong> sobre a
              mão de obra executada, contados da data de conclusão registrada na Plataforma.
            </p>
            <p>
              Caso o reparo venha a apresentar falha, vazamento, mau funcionamento ou desregulagem decorrente diretamente da
              execução técnica — e não causada por mau uso do morador, alteração posterior de terceiros, defeito de fábrica do
              aparelho fornecido pelo Cliente ou desgaste natural —, a Repara RV providenciará o retorno do mesmo profissional
              ou o envio de um Técnico Parceiro reserva, <strong>sem qualquer custo adicional para o Cliente</strong>.
            </p>
            <p className="text-xs text-slate-400">
              O acionamento da garantia deve ser feito pelo canal de suporte da Plataforma (WhatsApp ou e-mail) dentro do prazo estabelecido,
              com breve descrição do problema e o número do chamado original. Problemas reportados após 7 dias corridos da conclusão
              não serão cobertos pela garantia da mão de obra e poderão ser orçados como novo chamado.
            </p>
          </section>

          {/* ── Cláusula 10 ── */}
          <section id="obrigacoes-cliente" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">10</span>
              Das Obrigações e Responsabilidades do Cliente
            </h2>
            <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4">
              <li>Fornecer informações cadastrais verdadeiras, completas e atualizadas, sob pena de cancelamento do cadastro.</li>
              <li>Garantir que o aparelho, produto ou peça nova a ser instalada esteja disponível, na embalagem original e em perfeito estado, antes da chegada do Técnico.</li>
              <li>Estar presente no imóvel ou garantir a presença de um adulto responsável durante toda a execução do serviço.</li>
              <li>Proporcionar ao Técnico acesso seguro, iluminado e sem impedimentos ao local de execução do serviço.</li>
              <li>Retirar previamente do ambiente objetos de alto valor, documentos, joias e dinheiro em espécie que não sejam pertinentes ao serviço.</li>
              <li>Efetuar o pagamento exclusivamente via Pix pelo QR Code gerado pela Plataforma ao final do serviço, abstendo-se de qualquer negociação de preço ou forma de pagamento diretamente com o Técnico.</li>
              <li>Tratar o Técnico Parceiro com respeito e urbanidade durante toda a prestação do serviço.</li>
              <li>Não solicitar serviços fora do escopo do chamado aberto sem gerar um novo chamado na Plataforma.</li>
            </ul>
          </section>

          {/* ── Cláusula 11 ── */}
          <section id="obrigacoes-prestador" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">11</span>
              Das Obrigações e Responsabilidades do Técnico Parceiro
            </h2>
            <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4">
              <li>Manter seus dados cadastrais (CPF/CNPJ, chave Pix e telefone) sempre atualizados na Plataforma.</li>
              <li>Portar ferramental técnico completo e adequado para a execução dos serviços do catálogo em que está credenciado.</li>
              <li>Apresentar-se ao endereço do Cliente dentro do prazo estimado informado na Plataforma após o aceite do chamado.</li>
              <li>Executar o serviço com qualidade técnica, zelando pela segurança do imóvel e dos moradores, respeitando as normas técnicas aplicáveis (ABNT).</li>
              <li>Tratar o Cliente e os moradores com respeito, educação e profissionalismo.</li>
              <li>Recusar-se a executar serviços que representem risco à integridade física, risco elétrico grave ou que estejam claramente fora do escopo do chamado, comunicando à Plataforma.</li>
              <li>Não negociar pagamento em modalidade diversa do Pix via Plataforma, sob pena de descredenciamento imediato.</li>
              <li>Assumir integralmente a responsabilidade civil por eventuais danos causados ao imóvel ou a terceiros em decorrência de imperícia, negligência ou imprudência na execução do serviço.</li>
              <li>Manter atualizado seu status de disponibilidade (online/offline) no painel da Plataforma.</li>
            </ul>
          </section>

          {/* ── Cláusula 12 ── */}
          <section id="vedacoes" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">12</span>
              Das Vedações e Condutas Proibidas
            </h2>
            <p>É expressamente proibido a qualquer usuário da Plataforma:</p>
            <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
              <li>Criar cadastros falsos, utilizar dados de terceiros ou fornecer informações fraudulentas.</li>
              <li>Burlar o sistema de geolocalização ou manipular coordenadas GPS de forma fraudulenta.</li>
              <li>Combinar diretamente com a outra parte (Técnico ou Cliente) pagamentos fora da Plataforma com o intuito de contornar a Taxa de Intermediação.</li>
              <li>Solicitar, realizar ou aceitar qualquer serviço que não esteja catalogado na Plataforma sem abertura de novo chamado formal.</li>
              <li>Assediar, ameaçar, discriminar ou ofender a outra parte de qualquer forma durante ou após a prestação do serviço.</li>
              <li>Tentar acessar, modificar ou interromper os sistemas tecnológicos da Plataforma de forma não autorizada.</li>
              <li>Realizar avaliações falsas, comprar avaliações ou praticar qualquer conduta que manipule o sistema de reputação da Plataforma.</li>
              <li>Utilizar a Plataforma para fins ilegais ou em desconformidade com a legislação brasileira vigente.</li>
            </ul>
            <p className="text-xs text-slate-400">
              A verificação de qualquer conduta proibida ensejará o bloqueio imediato do cadastro, sem prejuízo das medidas legais cabíveis.
            </p>
          </section>

          {/* ── Cláusula 13 ── */}
          <section id="responsabilidade" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">13</span>
              Da Limitação de Responsabilidade da Plataforma
            </h2>
            <p>
              A Repara RV é uma <strong>plataforma de intermediação tecnológica</strong> e, como tal, não é parte na relação de prestação de serviços
              entre o Cliente e o Técnico Parceiro. A Plataforma não se responsabiliza por:
            </p>
            <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
              <li>Danos causados ao imóvel ou a bens do Cliente decorrentes de imperícia, negligência ou imprudência do Técnico Parceiro na execução do serviço.</li>
              <li>Qualidade técnica final do serviço executado pelo Técnico Parceiro, responsabilidade essa que é integralmente do profissional credenciado.</li>
              <li>Disponibilidade de Técnicos em determinados horários, bairros ou para determinados serviços, especialmente em situações de alta demanda simultânea.</li>
              <li>Danos ou interrupções de serviço decorrentes de força maior, falhas de infraestrutura de terceiros (Cloudflare, Supabase, operadoras de telecomunicação) ou ataques cibernéticos.</li>
              <li>Consequências do fornecimento de dados cadastrais incorretos ou fraudulentos pelo usuário.</li>
              <li>Defeito de fábrica ou mau funcionamento do aparelho/produto fornecido pelo Cliente para instalação.</li>
            </ul>
            <p className="text-xs text-slate-400">
              A responsabilidade máxima da Plataforma, quando reconhecida, fica limitada ao valor da Taxa de Intermediação
              cobrada no chamado objeto da reclamação.
            </p>
          </section>

          {/* ── Cláusula 14 ── */}
          <section id="avaliacao" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Star size={16} className="text-orange-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">14</span>
              Da Avaliação Pós-Serviço e Sistema de Reputação
            </h2>
            <p>
              Ao término de cada chamado concluído, tanto o Cliente quanto o Técnico Parceiro são convidados a submeter
              uma avaliação da experiência. As avaliações são anônimas para a outra parte e compõem o índice de reputação
              exibido na Plataforma.
            </p>
            <p>
              A Plataforma <strong>não aplica penalidades automáticas, bloqueios ou rebaixamento de reputação</strong> por chamados recusados,
              expirados por timeout ou por períodos de inatividade do Técnico Parceiro, respeitando a autonomia do profissional
              autônomo e o modelo de trabalho independente.
            </p>
            <p className="text-xs text-slate-400">
              Avaliações que contenham linguagem ofensiva, discriminatória ou que sejam evidentemente falsas poderão ser removidas
              pela equipe de moderação da Plataforma, mediante análise caso a caso.
            </p>
          </section>

          {/* ── Cláusula 15 ── */}
          <section id="seguranca" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield size={16} className="text-orange-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">15</span>
              Da Segurança, Verificação de Prestadores e Botão SOS
            </h2>
            <p>
              Todo Técnico Parceiro é submetido a verificação cadastral com conferência de titularidade da chave Pix/CPF
              e assinatura da Autodeclaração de Aptidão e Idoneidade. O profissional homologado recebe o selo de
              <em> "Segurança Verificada"</em> exibido ao Cliente durante o chamado.
            </p>
            <p>
              Durante chamados nos status <em>aceito, a caminho</em> e <em>em execução</em>, a Plataforma exibe a ambas as partes
              um <strong>Botão SOS de Emergência</strong>. O acionamento registra as coordenadas em tempo real no sistema,
              notifica a equipe de suporte e oferece acesso direto à ligação para o <strong>serviço de emergência 190 (Polícia Militar)</strong>.
            </p>
            <p className="text-xs text-slate-400">
              O Botão SOS cumpre o dever de vigilância e cuidado do CDC e reduz a barreira de segurança para clientes
              (especialmente mulheres, idosos e PCDs) e para os próprios Técnicos Parceiros.
            </p>
          </section>

          {/* ── Cláusula 16 ── */}
          <section id="lgpd" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">16</span>
              Da Privacidade, Proteção de Dados e LGPD
            </h2>
            <p>
              O tratamento de dados pessoais realizado pela Plataforma é regido integralmente pela
              <strong> Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018 — LGPD)</strong>.
              As bases legais utilizadas são: execução de contrato (art. 7º, V), legítimo interesse (art. 7º, IX)
              e cumprimento de obrigações legais (art. 7º, II).
            </p>
            <p>
              O endereço completo e as coordenadas geográficas exatas do Cliente são tratados como dados sensíveis de localização
              e <strong>nunca são compartilhados com o Técnico antes do aceite formal do chamado</strong>, em estrita conformidade com o
              princípio da minimização de dados da LGPD.
            </p>
            <p>
              O usuário pode solicitar confirmação de tratamento, retificação ou exclusão definitiva de seus dados pelo e-mail
              <strong className="text-white"> privacidade@repararv.com</strong>. Mais detalhes em nossa{' '}
              <Link href="/privacidade" className="text-orange-400 hover:text-orange-300 underline">Política de Privacidade e Proteção de Dados</Link>.
            </p>
          </section>

          {/* ── Cláusula 17 ── */}
          <section id="vigencia" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">17</span>
              Da Vigência, Alterações e Rescisão
            </h2>
            <p>
              Estes Termos entram em vigor na data de sua publicação e permanecem válidos por prazo indeterminado.
              A Plataforma reserva-se o direito de alterar, atualizar ou substituir quaisquer disposições deste instrumento,
              comprometendo-se a notificar os usuários ativos com antecedência mínima de <strong>7 (sete) dias</strong> antes da entrada
              em vigor de alterações substanciais, por meio de notificação dentro do aplicativo ou por mensagem ao celular cadastrado.
            </p>
            <p>
              Qualquer usuário pode solicitar o encerramento de seu cadastro a qualquer momento, sem necessidade de
              justificativa, por meio do canal de suporte da Plataforma. O encerramento não afeta os direitos e obrigações
              decorrentes de chamados já concluídos ou em andamento à época da solicitação.
            </p>
            <p>
              A Plataforma pode suspender ou cancelar o cadastro de qualquer usuário que viole estes Termos, com notificação
              prévia quando possível. Em casos de condutas graves, a suspensão pode ser imediata.
            </p>
          </section>

          {/* ── Cláusula 18 ── */}
          <section id="foro" className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3 scroll-mt-24">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Scale size={16} className="text-orange-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">18</span>
              Das Disposições Finais, Lei Aplicável e Foro de Eleição
            </h2>
            <p>
              Estes Termos são regidos exclusivamente pelas leis da <strong>República Federativa do Brasil</strong>, em especial pelo
              <strong> Código Civil (Lei nº 10.406/2002)</strong>, pelo <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong>,
              pelo <strong>Código de Defesa do Consumidor (Lei nº 8.078/1990)</strong> no que couber às relações com Clientes finais,
              e pela <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</strong>.
            </p>
            <p>
              Para dirimir quaisquer controvérsias decorrentes deste instrumento, fica eleito o <strong>Foro da Comarca de Rio Verde,
              Estado de Goiás</strong>, com renúncia expressa de qualquer outro, por mais privilegiado que seja. Para relações de
              consumo com Clientes finais, prevalece o foro do domicílio do consumidor, conforme o art. 101, I do CDC.
            </p>
            <p>
              A tolerância da Plataforma com qualquer descumprimento destes Termos não implicará novação ou renúncia de
              direitos, podendo sempre exercer seus direitos dentro dos prazos legais.
            </p>
            <div className="bg-slate-800/60 rounded-xl p-4 text-xs text-slate-400">
              <p><strong className="text-slate-300">Repara RV Tecnologia e Intermediação Ltda</strong></p>
              <p>CNAE: 7490-1/04 • Sede: Rio Verde — Goiás — Brasil</p>
              <p>E-mail oficial: <strong className="text-white">contato@repararv.com</strong></p>
              <p>DPO / Privacidade: <strong className="text-white">privacidade@repararv.com</strong></p>
              <p>Versão 1.0 — Publicado em 13 de Setembro de 2026</p>
            </div>
          </section>

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
    </div>
  )
}
