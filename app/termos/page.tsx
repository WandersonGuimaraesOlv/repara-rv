import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LegalDocumentRenderer } from '@/components/legal-document-renderer'

export const metadata: Metadata = {
  title: 'Termos de Uso e Condições Gerais — Repara RV',
  description: 'Termos de Uso e Condições Gerais de Navegação da Plataforma Repara RV. Leia antes de se cadastrar e utilizar a plataforma em Rio Verde (GO).',
}

export const revalidate = 300

export default async function TermosPage() {
  const supabase = await createClient()
  const [{ data: document }, { data: clauses }] = await Promise.all([
    supabase.from('legal_documents').select('*').eq('slug', 'termos').maybeSingle(),
    supabase.from('legal_clauses').select('*').eq('document_slug', 'termos').order('order_index', { ascending: true }),
  ])

  return (
    <LegalDocumentRenderer
      document={document}
      clauses={clauses ?? []}
      eyebrow="Termos de Uso e Condições Gerais"
      relatedLinks={[{ href: '/privacidade', label: 'Política de Privacidade' }, { href: '/', label: 'Página Inicial' }]}
    />
  )
}
