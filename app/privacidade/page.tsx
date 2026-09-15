import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LegalDocumentRenderer } from '@/components/legal-document-renderer'

export const metadata: Metadata = {
  title: 'Política de Privacidade e Proteção de Dados (LGPD) — Repara RV',
  description: 'Política de Privacidade, Proteção de Dados Pessoais e conformidade LGPD da Plataforma Repara RV em Rio Verde (GO). Saiba como seus dados são coletados, tratados e protegidos.',
}

export const revalidate = 300

export default async function PrivacidadePage() {
  const supabase = await createClient()
  const [{ data: document }, { data: clauses }] = await Promise.all([
    supabase.from('legal_documents').select('*').eq('slug', 'privacidade').maybeSingle(),
    supabase.from('legal_clauses').select('*').eq('document_slug', 'privacidade').order('order_index', { ascending: true }),
  ])

  return (
    <LegalDocumentRenderer
      document={document}
      clauses={clauses ?? []}
      eyebrow="Privacidade e Proteção de Dados — LGPD"
      relatedLinks={[{ href: '/termos', label: 'Termos de Uso' }, { href: '/', label: 'Página Inicial' }]}
    />
  )
}
