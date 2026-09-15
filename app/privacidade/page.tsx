import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Lock, Eye, Database, Fingerprint, Globe, Mail, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Logo } from '@/components/logo'

export const metadata: Metadata = {
  title: 'Política de Privacidade e Proteção de Dados (LGPD) — Repara RV',
  description: 'Política de Privacidade, Proteção de Dados Pessoais e conformidade LGPD da Plataforma Repara RV em Rio Verde (GO). Saiba como seus dados são coletados, tratados e protegidos.',
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Header */}
      <header
        className="backdrop-blur-md sticky top-0 z-30"
        style={{
          background: 'rgba(20, 38, 34, 0.85)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft size={16} />
            <span>Voltar ao Início</span>
          </Link>
          <Logo variant="full" width={140} height={35} inverted />
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        <div className="space-y-3 border-b pb-6" style={{ borderColor: 'var(--color-border)' }}>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: 'var(--color-primary-soft)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-border)',
            }}
          >
            <ShieldCheck size={14} />
            Privacidade e Proteção de Dados — LGPD
          </div>
          <h1 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--color-text)' }}>
            Política de Privacidade e Proteção de Dados Pessoais
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) · Versão 1.0 · Rio Verde — Goiás
          </p>
          <div
            className="p-4 rounded-xl text-xs flex items-start gap-3"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            <ShieldCheck size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
            <span>
              A Repara RV respeita sua privacidade. Esta política explica de forma transparente e acessível como coletamos,
              usamos, armazenamos e protegemos seus dados pessoais. Recomendamos a leitura integral antes de utilizar a Plataforma.
            </span>
          </div>
        </div>

        {/* Artigos */}
        <div className="prose prose-invert max-w-none space-y-6 text-sm text-slate-300 leading-relaxed">

          {/* Seção 1 */}
          <section className="legal-card space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="legal-step-badge">1</span>
              Identificação do Controlador e do Encarregado (DPO)
            </h2>
            <p>
              O <strong>Controlador de Dados</strong> responsável pelo tratamento dos seus dados pessoais é a
              <strong> Repara RV Tecnologia e Intermediação Ltda</strong>, pessoa jurídica de direito privado, com sede na cidade
              de <strong>Rio Verde, Estado de Goiás, Brasil</strong>.
            </p>
            <p>
              O <strong>Encarregado de Proteção de Dados (DPO)</strong> pode ser contatado pelo e-mail:
              <strong className="text-white"> privacidade@repararv.com</strong>.
              Todas as solicitações relacionadas a direitos dos titulares, dúvidas sobre o tratamento de dados ou reclamações
              devem ser encaminhadas exclusivamente a este canal.
            </p>
          </section>

          {/* Seção 2 */}
          <section className="legal-card space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Database size={15} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="legal-step-badge">2</span>
              Dados Pessoais Coletados e Categorias
            </h2>
            <p>Para a operacionalização segura e eficiente dos chamados, coletamos as seguintes categorias de dados:</p>
            <div className="space-y-3">
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs font-bold text-white mb-2">👤 Para Clientes / Moradores:</p>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  <li>Nome completo</li>
                  <li>Número de celular com DDD (utilizado como identificador principal e para notificações WhatsApp)</li>
                  <li>Endereço residencial completo e coordenadas geográficas (somente durante a abertura de chamado)</li>
                  <li>Histórico de chamados e ordens de serviço na Plataforma</li>
                  <li>Dados de aceite de termos: data, hora e versão do documento aceito</li>
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs font-bold text-white mb-2">🔧 Para Técnicos Parceiros / Prestadores:</p>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  <li>Nome completo, celular com DDD e CPF ou CNPJ MEI</li>
                  <li>Chave Pix e tipo de chave (para processamento automático de repasses)</li>
                  <li>Autodeclaração de aptidão e idoneidade (assinada digitalmente no cadastro)</li>
                  <li>Localização geográfica em tempo real (capturada exclusivamente enquanto o prestador está online e ativo no radar)</li>
                  <li>Histórico de chamados, avaliações recebidas e dados de desempenho operacional</li>
                  <li>Dados de aceite de termos: data, hora e versão do documento aceito</li>
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-3">
                <p className="text-xs font-bold text-white mb-2">💳 Dados de Pagamento:</p>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  <li>A Repara RV <strong>não armazena dados de cartão de crédito ou débito</strong> em seus sistemas.</li>
                  <li>Todas as transações são processadas pelo protocolo Pix do Banco Central do Brasil, via gateway seguro (Mercado Pago / Efí Bank).</li>
                  <li>Armazenamos apenas o ID da transação Pix e o status de pagamento para registro e auditoria dos chamados.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Seção 3 */}
          <section className="legal-card space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Eye size={15} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="legal-step-badge">3</span>
              Finalidade e Base Legal do Tratamento de Dados
            </h2>
            <p>Seus dados são tratados nas seguintes finalidades, com as respectivas bases legais da LGPD:</p>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={13} className="text-green-400 mt-0.5 shrink-0" />
                <span><strong className="text-white">Execução do contrato (art. 7º, V):</strong> Conexão entre Cliente e o Técnico mais próximo disponível no radar geoespacial; processamento do pagamento via Pix; notificação sobre chegada e status do chamado; emissão de comprovante digital.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={13} className="text-green-400 mt-0.5 shrink-0" />
                <span><strong className="text-white">Legítimo interesse (art. 7º, IX):</strong> Prevenção a fraudes; validação de identidade do Técnico via conferência de CPF e chave Pix; moderação de avaliações e condutas; melhoria contínua dos algoritmos de roteamento geoespacial.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={13} className="text-green-400 mt-0.5 shrink-0" />
                <span><strong className="text-white">Cumprimento de obrigação legal (art. 7º, II):</strong> Manutenção de registros de transações financeiras para fins fiscais, contábeis e de conformidade regulatória.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={13} className="text-green-400 mt-0.5 shrink-0" />
                <span><strong className="text-white">Consentimento (art. 7º, I):</strong> Envio de comunicações de marketing, ofertas e novidades do serviço (exclusivamente quando o usuário optar por receber tais comunicações).</span>
              </div>
            </div>
          </section>

          {/* Seção 4 — Localização */}
          <section className="legal-card space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Globe size={15} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="legal-step-badge">4</span>
              Tratamento Especial: Dados de Localização Geográfica
            </h2>
            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle size={14} className="shrink-0 text-amber-400 mt-0.5" />
              <span>Dados de localização são dados sensíveis e merecem proteção reforçada. Veja abaixo nossa política específica.</span>
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <p><strong className="text-white">Dados do Cliente (endereço e coordenadas):</strong> O endereço completo e as coordenadas GPS exatas do Cliente são coletados exclusivamente no momento da abertura do chamado. Antes do aceite do Técnico (status <em>searching</em>), o Técnico visualiza apenas o <strong>bairro</strong> e a <strong>distância aproximada</strong>. O endereço completo é liberado ao Técnico somente após o aceite formal, e exclusivamente para o Técnico designado para aquele chamado.</p>
              <p><strong className="text-white">Dados do Técnico (localização em tempo real):</strong> A localização geográfica do Técnico Parceiro é capturada e atualizada no banco de dados <strong>somente enquanto o Técnico ativa o status "Online" no painel</strong>. Ao acionar "Offline", a atualização de localização cessa imediatamente. Nenhum dado de localização é retido após o encerramento do status offline.</p>
            </div>
          </section>

          {/* Seção 5 */}
          <section className="legal-card space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="legal-step-badge">5</span>
              Compartilhamento e Transferência de Dados
            </h2>
            <p>
              A Repara RV <strong>não vende, não aluga e jamais comercializa dados pessoais</strong> a terceiros,
              corretoras de dados, plataformas de publicidade ou anunciantes.
            </p>
            <p>Os dados são compartilhados estritamente com:</p>
            <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
              <li><strong className="text-white">Técnico Parceiro designado:</strong> Nome do Cliente e endereço de execução, somente após o aceite do chamado e exclusivamente para fins de deslocamento e execução do serviço.</li>
              <li><strong className="text-white">Parceiros de infraestrutura essencial:</strong> Supabase (banco de dados e autenticação, EUA — coberto pelo Data Processing Agreement), Cloudflare (hospedagem e CDN, EUA — coberto pelo DPA) e Mercado Pago / Efí Bank (processamento de pagamentos Pix, Brasil).</li>
              <li><strong className="text-white">Autoridades públicas:</strong> Mediante requisição legal devidamente fundamentada, em conformidade com a legislação brasileira vigente.</li>
            </ul>
            <p className="text-xs text-slate-400">
              As transferências internacionais de dados (para servidores Supabase/Cloudflare nos EUA) são realizadas com
              garantias adequadas de proteção, em conformidade com o art. 33 da LGPD.
            </p>
          </section>

          {/* Seção 6 */}
          <section className="legal-card space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="legal-step-badge">6</span>
              Prazo de Retenção dos Dados
            </h2>
            <p>Os dados pessoais são retidos pelos seguintes prazos:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 pr-4 text-slate-400 font-bold">Categoria de Dado</th>
                    <th className="text-left py-2 text-slate-400 font-bold">Prazo de Retenção</th>
                  </tr>
                </thead>
                <tbody className="space-y-1">
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2 pr-4">Dados de cadastro (nome, celular, CPF)</td>
                    <td className="py-2">Enquanto a conta estiver ativa + 5 anos após encerramento</td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2 pr-4">Histórico de chamados e transações</td>
                    <td className="py-2">5 anos (obrigação fiscal e legal)</td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2 pr-4">Registros de aceite de termos (audit trail)</td>
                    <td className="py-2">5 anos</td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2 pr-4">Localização em tempo real do Técnico</td>
                    <td className="py-2">Não retida após o status offline</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Dados de Emergência (alertas SOS)</td>
                    <td className="py-2">2 anos</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Seção 7 */}
          <section className="legal-card space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Fingerprint size={15} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="legal-step-badge">7</span>
              Direitos do Titular (LGPD) — Como Exercer
            </h2>
            <p>Nos termos dos artigos 17 a 22 da LGPD, você tem os seguintes direitos em relação aos seus dados pessoais:</p>
            <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
              <li><strong className="text-white">Confirmação e Acesso:</strong> Saber se tratamos seus dados e ter acesso à cópia dos dados que possuímos sobre você.</li>
              <li><strong className="text-white">Retificação:</strong> Solicitar a correção de dados incompletos, inexatos ou desatualizados.</li>
              <li><strong className="text-white">Anonimização, Bloqueio ou Eliminação:</strong> Solicitar que dados desnecessários, excessivos ou tratados em desconformidade com a LGPD sejam anonimizados, bloqueados ou eliminados.</li>
              <li><strong className="text-white">Portabilidade:</strong> Receber seus dados em formato estruturado e interoperável, quando aplicável.</li>
              <li><strong className="text-white">Revogação do Consentimento:</strong> Retirar o consentimento para tratamentos baseados nessa base legal, a qualquer momento.</li>
              <li><strong className="text-white">Oposição:</strong> Opor-se a tratamentos realizados com base em legítimo interesse que causem dano desproporcional.</li>
              <li><strong className="text-white">Exclusão Total da Conta:</strong> Solicitar a exclusão definitiva de todos os seus dados e cadastro da Plataforma.</li>
            </ul>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-200">
              <Mail size={12} className="inline mr-1" />
              Para exercer qualquer dos direitos acima, envie solicitação para <strong className="text-white">privacidade@repararv.com</strong>{' '}
              com assunto "Direitos LGPD" e informações de identificação. Respondemos em até <strong>15 dias úteis</strong>.
            </div>
          </section>

          {/* Seção 8 */}
          <section className="legal-card space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock size={15} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="legal-step-badge">8</span>
              Segurança da Informação e Medidas Técnicas
            </h2>
            <p>A Repara RV adota um conjunto robusto de medidas técnicas e administrativas para proteger seus dados:</p>
            <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
              <li><strong className="text-white">Criptografia em trânsito:</strong> Toda comunicação entre o aplicativo/navegador e nossos servidores utiliza TLS 1.3 / HTTPS.</li>
              <li><strong className="text-white">Row Level Security (RLS):</strong> Políticas de acesso linha a linha no banco de dados PostgreSQL (Supabase), garantindo que cada usuário acesse apenas seus próprios dados.</li>
              <li><strong className="text-white">Isolamento de dados sensíveis:</strong> Endereço completo e coordenadas do Cliente não são incluídos em respostas de API direcionadas ao radar de Técnicos antes do aceite.</li>
              <li><strong className="text-white">Autenticação por PIN:</strong> Acesso ao aplicativo protegido por PIN pessoal criado pelo usuário, sem armazenamento de senhas em texto puro.</li>
              <li><strong className="text-white">Infraestrutura Cloudflare:</strong> Proteção DDoS, firewall de aplicação web (WAF) e rede global de alta disponibilidade.</li>
              <li><strong className="text-white">Acesso restrito interno:</strong> Apenas membros autorizados da equipe têm acesso a dados de produção, mediante autenticação multifator.</li>
            </ul>
          </section>

          {/* Seção 9 */}
          <section className="legal-card space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="legal-step-badge">9</span>
              Cookies e Dados de Navegação
            </h2>
            <p>
              A Repara RV opera como Progressive Web App (PWA) e utiliza <strong>cookies de sessão</strong> estritamente necessários para
              manter o usuário autenticado entre as telas e funcionalidades do aplicativo. Não utilizamos cookies de rastreamento
              de terceiros, pixels de publicidade comportamental ou ferramentas de analytics intrusivas.
            </p>
            <p className="text-xs text-slate-400">
              O bloqueio de cookies pode impedir o correto funcionamento do aplicativo, especialmente o mantenimento da sessão ativa.
            </p>
          </section>

          {/* Seção 10 */}
          <section className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0">10</span>
              Atualização desta Política e Canal de Contato
            </h2>
            <p>
              Esta Política pode ser atualizada periodicamente para refletir mudanças nas nossas práticas ou na legislação aplicável.
              Notificaremos os usuários ativos sobre alterações substanciais com antecedência mínima de <strong>7 (sete) dias</strong>,
              por mensagem na Plataforma ou pelo celular cadastrado. A data de vigência desta versão é indicada no cabeçalho do documento.
            </p>
            <div className="bg-slate-800/60 rounded-xl p-4 text-xs text-slate-400 space-y-1">
              <p><strong className="text-slate-300">Repara RV Tecnologia e Intermediação Ltda</strong></p>
              <p>CNAE: 7490-1/04 • Sede: Rio Verde — Goiás — Brasil</p>
              <p>DPO / Privacidade: <strong className="text-white">privacidade@repararv.com</strong></p>
              <p>Atendimento geral: <strong className="text-white">contato@repararv.com</strong></p>
              <p>Versão 1.0 — Publicada em 13 de Setembro de 2026</p>
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
            <Link href="/" className="hover:text-white underline transition-colors">
              Página Inicial
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
