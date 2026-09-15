import Link from 'next/link'
import { MessageSquare, MapPin } from 'lucide-react'
import { Logo } from '@/components/logo'

interface SiteFooterProps {
  /** Called when user clicks a category link inside the footer */
  onCategorySelect?: (category: string) => void
}

const SERVICE_CATEGORIES = [
  { id: 'Elétrica', label: 'Eletricistas' },
  { id: 'Hidráulica', label: 'Encanadores & Desentupimento' },
  { id: 'Montagem', label: 'Montagem de Móveis' },
  { id: 'Chaveiro', label: 'Chaveiro' },
  { id: 'Instalação', label: 'Instalação de Equipamentos' },
]

export function SiteFooter({ onCategorySelect }: SiteFooterProps) {
  return (
    <footer
      id="site-footer"
      style={{ background: 'var(--color-surface-deep)', borderTop: '1px solid var(--color-border)' }}
    >
      <div className="content-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Coluna 1 — Marca */}
          <div className="space-y-4 lg:col-span-1">
            <Link href="/" className="inline-block transition-opacity hover:opacity-85">
              <Logo variant="full" width={168} height={42} />
            </Link>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              A plataforma sob demanda de serviços residenciais de Rio Verde (GO). Eletricistas, encanadores e montadores verificados com preço fixo e transparência.
            </p>
            <div
              className="pt-3 text-xs space-y-1"
              style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-subtle)' }}
            >
              <p className="font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                Repara RV Tecnologia e Intermediação Ltda
              </p>
              <p>CNAE 7490-1/04 • Sede em Rio Verde - GO</p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Link
                  href="/termos"
                  className="hover:underline transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Termos de Uso
                </Link>
                <span>•</span>
                <Link
                  href="/privacidade"
                  className="hover:underline transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Privacidade (LGPD)
                </Link>
                <span>•</span>
                <Link
                  href="/contrato"
                  className="hover:underline transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Contrato Técnico
                </Link>
              </div>
              <p className="pt-0.5">© {new Date().getFullYear()} Repara RV • Todos os direitos reservados.</p>
            </div>
          </div>

          {/* Coluna 2 — Categorias */}
          <div>
            <h5
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: 'var(--color-text)' }}
            >
              Categorias de Serviços
            </h5>
            <ul className="space-y-2.5 text-sm">
              {SERVICE_CATEGORIES.map(cat => (
                <li key={cat.id}>
                  {onCategorySelect ? (
                    <button
                      type="button"
                      onClick={() => onCategorySelect(cat.id)}
                      className="hover:underline transition-colors cursor-pointer text-left"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {cat.label}
                    </button>
                  ) : (
                    <Link
                      href={`/#servicos`}
                      className="hover:underline transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {cat.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 3 — Bairros */}
          <div>
            <h5
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: 'var(--color-text)' }}
            >
              Bairros em Rio Verde — GO
            </h5>
            <div className="flex items-start gap-2">
              <MapPin size={14} style={{ color: 'var(--color-primary)', marginTop: 2 }} className="shrink-0" />
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Setor Central, Morada do Sol, Universitário, Bairro Popular, Promissão, Gameleira, Vila Maria, Eldorado, Residencial Buriti, Interlagos e toda a região urbana de Rio Verde (GO).
              </p>
            </div>
          </div>

          {/* Coluna 4 — Suporte */}
          <div>
            <h5
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: 'var(--color-text)' }}
            >
              Atendimento & Ajuda
            </h5>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Dúvidas ou precisa de suporte para o seu chamado?
            </p>
            <a
              href="https://wa.me/5564999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20no%20Repara%20RV"
              target="_blank"
              rel="noopener noreferrer"
              id="btn-footer-whatsapp"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: 'var(--color-primary)', boxShadow: 'var(--shadow-primary)' }}
            >
              <MessageSquare size={16} />
              <span>WhatsApp de Suporte</span>
            </a>
            <p className="mt-4 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
              Atendimento humano de segunda a sábado, das 7h às 20h.
            </p>
          </div>

        </div>
      </div>
    </footer>
  )
}
