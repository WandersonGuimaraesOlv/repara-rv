import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Wrench, FileCheck, AlertTriangle, CheckCircle2, Shield, CreditCard, Scale, Clock } from 'lucide-react'
import { Logo } from '@/components/logo'

export const metadata: Metadata = {
  title: 'Contrato de Parceria para Técnicos — Repara RV',
  description: 'Contrato de Parceria, Credenciamento e Condições de Operação para Técnicos Autônomos e MEI da Plataforma Repara RV em Rio Verde (GO).',
}

export default function ContratoPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
            <FileCheck size={14} />
            Contrato para Técnicos Parceiros
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Contrato de Parceria, Credenciamento e Condições de Operação — Técnico Parceiro Repara RV
          </h1>
          <p className="text-xs text-slate-400">
            Instrumento digital vinculante · Versão 1.0 · Rio Verde — Goiás · 13 de Setembro de 2026
          </p>
          <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl text-green-200 text-xs flex items-start gap-3">
            <CheckCircle2 size={16} className="shrink-0 text-green-400 mt-0.5" />
            <span>
              Este instrumento é aceito digitalmente pelo Técnico Parceiro no ato do cadastro, mediante marcação do checkbox de
              Autodeclaração de Aptidão e Idoneidade. O aceite eletrônico possui plena validade jurídica nos termos da
              Lei nº 14.063/2020 (Assinaturas Eletrônicas) e do Marco Civil da Internet (Lei nº 12.965/2014).
            </span>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">

          {/* Identificação das Partes */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center shrink-0">1</span>
              Identificação das Partes Contratantes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-800/60 rounded-xl p-4 space-y-1">
                <p className="font-bold text-white text-sm mb-2">CONTRATANTE — Plataforma</p>
                <p><strong>Razão Social:</strong> Repara RV Tecnologia e Intermediação Ltda</p>
                <p><strong>CNAE:</strong> 7490-1/04</p>
                <p><strong>Sede:</strong> Rio Verde, Goiás, Brasil</p>
                <p><strong>E-mail:</strong> contato@repararv.com</p>
                <p className="text-slate-400 mt-2">Doravante denominada <em>"Plataforma"</em></p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-4 space-y-1">
                <p className="font-bold text-white text-sm mb-2">CONTRATADO — Técnico Parceiro</p>
                <p><strong>Identificação:</strong> Pessoa física ou jurídica (MEI) cujos dados foram fornecidos no cadastro</p>
                <p><strong>Vínculo:</strong> Profissional autônomo ou Microempreendedor Individual</p>
                <p className="text-slate-400 mt-2">Doravante denominado <em>"Técnico Parceiro"</em></p>
              </div>
            </div>
          </section>

          {/* Natureza Jurídica */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Scale size={15} className="text-green-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center shrink-0">2</span>
              Da Natureza Jurídica da Relação (Autonomia e Ausência de Vínculo)
            </h2>
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle size={16} className="shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong>CLÁUSULA ESSENCIAL:</strong> Este instrumento é um <strong>contrato de parceria de intermediação tecnológica</strong>,
                e não um contrato de emprego, contrato de trabalho, contrato de prestação de serviços subordinada ou qualquer
                outra modalidade que implique vínculo empregatício. As partes declaram expressamente compreender e concordar
                com tal natureza.
              </div>
            </div>
            <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
              <li>O Técnico Parceiro é profissional autônomo ou MEI com plena liberdade de gestão de seu tempo e agenda.</li>
              <li>Não há horário mínimo de disponibilidade, metas de atendimentos, punições por recusa de chamados ou qualquer forma de controle de jornada.</li>
              <li>A Plataforma <strong>não aplica advertências, suspensões ou penalidades automáticas</strong> por chamados recusados, expirados ou por períodos de inatividade.</li>
              <li>O Técnico Parceiro é integralmente responsável pelo recolhimento de seus próprios tributos, contribuições previdenciárias e demais obrigações fiscais decorrentes de sua atividade autônoma.</li>
              <li>O Técnico Parceiro possui liberdade para utilizar outras plataformas, aplicativos ou meios de captação de clientes simultaneamente.</li>
            </ul>
          </section>

          {/* Objeto */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Wrench size={15} className="text-green-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center shrink-0">3</span>
              Do Objeto: Acesso ao Radar e Recebimento de Chamados
            </h2>
            <p>
              A Plataforma concede ao Técnico Parceiro acesso ao sistema geoespacial de roteamento de chamados técnicos
              (Radar Repara RV), por meio do qual o profissional receberá notificações de ordens de serviço de Clientes
              situados em seu raio de atuação em Rio Verde (GO), podendo aceitar ou recusar cada chamado individualmente.
            </p>
            <p>
              O Técnico Parceiro recebe chamados nas categorias técnicas de sua especialidade declarada no cadastro,
              conforme o catálogo de serviços vigente na Plataforma: <strong>Elétrica Residencial, Hidráulica, Montagem e Fixação,
              Chaveiro Residencial</strong> e <strong>Instalação de Eletrodomésticos</strong>.
            </p>
          </section>

          {/* Remuneração */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard size={15} className="text-green-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center shrink-0">4</span>
              Da Remuneração, Split de Pix e Taxa de Intermediação
            </h2>
            <p>
              Por cada chamado concluído e pago pelo Cliente via Pix na Plataforma, o Técnico Parceiro receberá em sua
              conta vinculada à chave Pix cadastrada o <strong>valor líquido da mão de obra</strong> (preço fixo tabelado do serviço
              deduzida a Taxa de Intermediação da Plataforma).
            </p>
            <div className="bg-slate-800/60 rounded-xl p-4 text-xs">
              <p className="font-bold text-white mb-2">Fórmula de repasse:</p>
              <p className="font-mono text-green-400 text-sm">Repasse ao Técnico = Preço Tabelado − Taxa de Intermediação</p>
              <p className="text-slate-400 mt-2">Exemplo: Serviço de R$ 80,00 → Técnico recebe R$ 68,00 (Taxa: R$ 12,00)</p>
            </div>
            <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
              <li>O repasse é processado automaticamente via Split de Pagamento Pix no momento da confirmação do pagamento pelo Cliente.</li>
              <li><strong>Não há cobrança antecipada</strong>, mensalidade, taxa de adesão ou taxa de renovação de cadastro para o Técnico Parceiro.</li>
              <li>A Taxa de Intermediação incide <strong>exclusivamente sobre chamados efetivamente concluídos e pagos</strong>.</li>
              <li>O Técnico Parceiro declara ciência de que a Taxa de Intermediação pode variar entre chamados conforme o catálogo vigente, variando entre R$ 12,00 e R$ 25,00 por chamado.</li>
              <li>O Técnico Parceiro é responsável por declarar os rendimentos recebidos via Pix perante a Receita Federal e demais órgãos tributários competentes.</li>
            </ul>
          </section>

          {/* Prazo de Repasse */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock size={15} className="text-green-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center shrink-0">5</span>
              Do Prazo de Repasse e da Segurança Financeira
            </h2>
            <p>
              O repasse do valor líquido ao Técnico Parceiro ocorrerá em até <strong>48 (quarenta e oito) horas</strong> após a confirmação
              do pagamento pelo Cliente e a conclusão formal do chamado sem ressalvas ou contestações abertas.
            </p>
            <p>
              Em casos de disputa, contestação de qualidade ou acionamento de garantia pelo Cliente dentro do prazo de 7 dias,
              o repasse poderá ser suspenso temporariamente até a resolução da ocorrência pela equipe de mediação da Plataforma.
              O Técnico Parceiro será comunicado imediatamente e terá prazo de <strong>5 (cinco) dias úteis</strong> para apresentar
              sua versão dos fatos e documentação de suporte.
            </p>
          </section>

          {/* Obrigações do Técnico */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center shrink-0">6</span>
              Das Obrigações do Técnico Parceiro
            </h2>
            <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4">
              <li>Manter dados cadastrais (nome, CPF/CNPJ, celular, chave Pix) sempre atualizados na Plataforma, sob pena de não receber repasses.</li>
              <li>Possuir e portar ferramental técnico adequado e em boas condições para a execução dos serviços do catálogo em que está credenciado.</li>
              <li>Comparecer ao endereço do Cliente dentro do prazo estimado após o aceite do chamado; em caso de impossibilidade, cancelar com justificativa dentro da Plataforma antes de atingir o endereço.</li>
              <li>Executar os serviços com qualidade técnica compatível com as normas ABNT aplicáveis e zelar pela segurança do imóvel e dos moradores.</li>
              <li>Não negociar pagamento em espécie, transferência direta ou qualquer outra modalidade fora do sistema Pix da Plataforma.</li>
              <li>Não captar o Cliente para atendimentos futuros fora da Plataforma durante o período de atividade como Técnico Parceiro credenciado.</li>
              <li>Assumir integralmente a responsabilidade civil por danos causados ao imóvel ou a terceiros decorrentes de imperícia, negligência ou imprudência na execução.</li>
              <li>Manter sigilo sobre dados pessoais dos Clientes (endereço, telefone), utilizando-os exclusivamente para a execução do chamado em curso.</li>
            </ul>
          </section>

          {/* Autocertificação */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield size={15} className="text-green-400 shrink-0" />
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center shrink-0">7</span>
              Da Autocertificação de Aptidão e Idoneidade
            </h2>
            <p>
              No ato do cadastro, o Técnico Parceiro assina digitalmente a seguinte declaração, que integra este contrato:
            </p>
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 text-xs text-green-200 italic">
              <CheckCircle2 size={14} className="inline mr-2 text-green-400" />
              <em>
                "Declaro, sob as penas da lei, ser profissional autônomo tecnicamente capacitado para a execução dos serviços
                técnicos residenciais disponíveis no catálogo da Plataforma Repara RV para os quais me credencio; assumir
                integralmente a responsabilidade civil pelos serviços por mim executados; estar ciente de que a Repara RV atua
                exclusivamente como intermediadora tecnológica, sem qualquer vínculo empregatício, de subordinação ou
                solidariedade trabalhista de qualquer natureza; e que todas as informações cadastrais por mim fornecidas são
                verdadeiras, sob pena de cancelamento imediato do credenciamento e responsabilização por eventuais danos
                causados à Plataforma, Clientes ou terceiros."
              </em>
            </div>
            <p className="text-xs text-slate-400">
              Esta autocertificação substitui, para fins de ingresso ágil na Plataforma, a exigência prévia de envio de
              comprovante de residência, sem prejuízo do direito da Plataforma de solicitar tal documento em caso de
              incidente ou reclamação fundamentada.
            </p>
          </section>

          {/* Descredenciamento */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center shrink-0">8</span>
              Do Descredenciamento e Encerramento da Parceria
            </h2>
            <p>O descredenciamento do Técnico Parceiro pode ocorrer:</p>
            <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
              <li><strong className="text-white">A pedido do Técnico:</strong> A qualquer momento, sem necessidade de justificativa, mediante solicitação formal pelo canal de suporte.</li>
              <li><strong className="text-white">Pela Plataforma — com aviso prévio de 7 dias:</strong> Por encerramento de operações na área de cobertura, descontinuação de categorias de serviço ou mudanças contratuais não aceitas pelo Técnico.</li>
              <li><strong className="text-white">Pela Plataforma — imediato, sem aviso prévio:</strong> Violação grave das obrigações previstas neste contrato ou nos Termos de Uso (fraude, condutas ilegais, pagamentos fora da Plataforma, danos graves a Clientes, fornecimento de dados falsos na Autocertificação).</li>
            </ul>
            <p className="text-xs text-slate-400">
              O descredenciamento não afeta o direito ao recebimento de valores já devidos por chamados concluídos antes
              da data do encerramento, salvo em casos de descredenciamento por fraude comprovada.
            </p>
          </section>

          {/* Vigência e Foro */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center shrink-0">9</span>
              Vigência, Lei Aplicável e Foro
            </h2>
            <p>
              Este contrato entra em vigor na data do aceite eletrônico pelo Técnico Parceiro no ato do cadastro e tem
              prazo indeterminado, podendo ser encerrado conforme previsto na cláusula anterior.
            </p>
            <p>
              É regido pelas leis da República Federativa do Brasil. Para dirimir quaisquer controvérsias decorrentes
              desta relação contratual, fica eleito o <strong>Foro da Comarca de Rio Verde, Estado de Goiás</strong>,
              com renúncia expressa a qualquer outro foro, por mais privilegiado que seja.
            </p>
            <div className="bg-slate-800/60 rounded-xl p-4 text-xs text-slate-400 space-y-1">
              <p><strong className="text-slate-300">Repara RV Tecnologia e Intermediação Ltda</strong></p>
              <p>CNAE: 7490-1/04 • Sede: Rio Verde — Goiás — Brasil</p>
              <p>E-mail: <strong className="text-white">contato@repararv.com</strong></p>
              <p>Versão 1.0 — 13 de Setembro de 2026</p>
            </div>
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
            <Link href="/privacidade" className="hover:text-white underline transition-colors">
              Privacidade
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
