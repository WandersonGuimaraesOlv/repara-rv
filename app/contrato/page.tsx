import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LegalDocumentRenderer } from '@/components/legal-document-renderer'

export const metadata: Metadata = {
  title: 'Contrato de Parceria para Técnicos — Repara RV',
  description: 'Contrato de Parceria, Credenciamento e Condições de Operação para Técnicos Autônomos e MEI da Plataforma Repara RV em Rio Verde (GO).',
}

export const revalidate = 300

export default async function ContratoPage() {
  const supabase = await createClient()
  const [{ data: document }, { data: clauses }] = await Promise.all([
    supabase.from('legal_documents').select('*').eq('slug', 'contrato').maybeSingle(),
    supabase.from('legal_clauses').select('*').eq('document_slug', 'contrato').order('order_index', { ascending: true }),
  ])

  return (
    <LegalDocumentRenderer
      document={document}
      clauses={clauses ?? []}
      eyebrow="Contrato para Técnicos Parceiros"
      relatedLinks={[{ href: '/termos', label: 'Termos de Uso' }, { href: '/privacidade', label: 'Privacidade' }, { href: '/', label: 'Página Inicial' }]}
    />
  )
}
