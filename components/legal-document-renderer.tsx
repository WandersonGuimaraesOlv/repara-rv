import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { Logo } from '@/components/logo'
import { LEGAL_ICON_MAP } from '@/lib/legal-icons'
import { renderLegalMarkdown } from '@/lib/legal-markdown'

interface LegalDocument {
  slug: string
  title: string
  version: string
  effective_date: string
  updated_at: string
}

interface LegalClause {
  id: string
  order_index: number
  section_id: string
  title: string
  icon_key: string | null
  body_markdown: string
}

interface LegalDocumentRendererProps {
  document: LegalDocument | null
  clauses: LegalClause[]
  /** Rótulo curto exibido no badge do cabeçalho (ex: "Termos de Uso e Condições Gerais") */
  eyebrow: string
  /** Rodapé: outros documentos legais a linkar, além de "Página Inicial" */
  relatedLinks: { href: string; label: string }[]
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function LegalDocumentRenderer({ document, clauses, eyebrow, relatedLinks }: LegalDocumentRendererProps) {
  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Documento indisponível no momento. Tente novamente em instantes.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <header
        className="backdrop-blur-md sticky top-0 z-30"
        style={{ background: 'rgba(20, 38, 34, 0.85)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
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

      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14 lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        <aside className="hidden lg:block">
          <div
            className="sticky top-24 rounded-2xl p-4 space-y-1"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-subtle)' }}>
              Sumário
            </p>
            {clauses.map((c, i) => (
              <a
                key={c.id}
                href={`#${c.section_id}`}
                className="flex items-center gap-2 text-[11px] transition-colors py-0.5 hover:opacity-80"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <span className="w-4 text-right text-[10px]" style={{ color: 'var(--color-text-subtle)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {c.title}
              </a>
            ))}
          </div>
        </aside>

        <main className="space-y-8 min-w-0">
          <div className="space-y-3 border-b pb-6" style={{ borderColor: 'var(--color-border)' }}>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'var(--color-primary-soft)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}
            >
              <FileText size={14} />
              {eyebrow}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--color-text)' }}>
              {document.title}
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Última atualização: {formatDate(document.effective_date)} · Versão {document.version} · Rio Verde — Goiás, Brasil
            </p>
          </div>

          {clauses.map((clause, i) => {
            const IconComponent = clause.icon_key ? LEGAL_ICON_MAP[clause.icon_key] : null
            return (
              <section key={clause.id} id={clause.section_id} className="legal-card space-y-3 scroll-mt-24">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  {IconComponent && <IconComponent size={16} className="shrink-0" style={{ color: 'var(--color-primary)' }} />}
                  <span className="legal-step-badge">{i + 1}</span>
                  {clause.title}
                </h2>
                <div
                  className="legal-clause-body"
                  dangerouslySetInnerHTML={{ __html: renderLegalMarkdown(clause.body_markdown) }}
                />
              </section>
            )
          })}

          <div
            className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
            style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-subtle)' }}
          >
            <div>Repara RV Tecnologia e Intermediação Ltda • Rio Verde - GO</div>
            <div className="flex items-center gap-4">
              {relatedLinks.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-white underline transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
