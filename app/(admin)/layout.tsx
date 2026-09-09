import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminHeader } from './admin-header'

export const metadata = {
  title: 'Painel Administrativo | Repara RV',
  description: 'Controle operacional e gestão de catálogo e auditoria do Repara RV.',
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/admin/servicos')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  // Se não for admin, bloqueia e redireciona para a home
  if (!profile || profile.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <AdminHeader userName={profile.full_name} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
