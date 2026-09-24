'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Chamado em que o técnico ainda está: a caminho, no local, esperando a
// conferência do cliente ou o pagamento (ele só vai embora depois do
// pagamento — lib/completion-review.ts). Pro /painel mostrar o atalho de volta
// se ele saiu da tela do chamado. Pagamento pendente só conta na 1ª hora depois
// da aprovação — mesma janela de find_nearest_provider
// (migration 20260924_client_approves_completion.sql).
const ONGOING_STATUSES = ['accepted', 'on_the_way', 'in_progress', 'awaiting_approval']
const PAYMENT_WAIT_MS = 60 * 60 * 1000
const CHECK_EVERY_MS = 15_000

export interface OngoingProviderCall {
  id: string
  status: string
  payment_status: string | null
}

export function useOngoingProviderCall(providerId: string | null): OngoingProviderCall | null {
  const [ongoing, setOngoing] = useState<OngoingProviderCall | null>(null)

  useEffect(() => {
    if (!providerId) return
    const supabase = createClient()
    let stopped = false

    const check = async () => {
      const since = new Date(Date.now() - PAYMENT_WAIT_MS).toISOString()
      const { data } = await supabase
        .from('service_calls')
        .select('id, status, payment_status')
        .eq('provider_id', providerId)
        .or(`status.in.(${ONGOING_STATUSES.join(',')}),and(status.eq.completed,payment_status.eq.pending,completed_at.gt."${since}")`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!stopped) setOngoing(data ?? null)
    }

    check()
    const interval = setInterval(check, CHECK_EVERY_MS)
    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [providerId])

  return ongoing
}
