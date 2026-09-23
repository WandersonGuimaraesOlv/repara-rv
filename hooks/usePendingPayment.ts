'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { findPendingPayment, PENDING_PAYMENT_FILTER, type PendingKind } from '@/lib/pending-payments'

export interface PendingPayment {
  kind: PendingKind
  callId: string
  serviceName: string
  totalPrice: number
  providerCut: number
  completedAt: string | null
  pixQrCode: string | null
  pixCopyPaste: string | null
  checkoutUrl: string | null
  noShowFeePixQrCode: string | null
  noShowFeePixCopyPaste: string | null
}

interface PendingRow {
  id: string
  status: string
  payment_status: string | null
  no_show_fee_status: string | null
  created_at: string
  completed_at: string | null
  total_price: number
  provider_cut: number
  pix_qr_code: string | null
  pix_copy_paste: string | null
  cancel_note: string | null
  no_show_fee_pix_qr_code: string | null
  no_show_fee_pix_copy_paste: string | null
  service: { name?: string } | { name?: string }[] | null
}

// Pagamento que o cliente logado ainda deve (lib/pending-payments.ts). Lê só
// os próprios chamados (RLS "Cliente vê seus próprios chamados"). Sem login,
// ou sem dívida: pending = null.
export function usePendingPayment() {
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [checked, setChecked] = useState(false)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      setPending(null)
      setChecked(true)
      return
    }

    const { data } = await supabase
      .from('service_calls')
      .select('id, status, payment_status, no_show_fee_status, created_at, completed_at, total_price, provider_cut, pix_qr_code, pix_copy_paste, cancel_note, no_show_fee_pix_qr_code, no_show_fee_pix_copy_paste, service:quick_services(name)')
      .eq('client_id', userId)
      .or(PENDING_PAYMENT_FILTER)

    const found = findPendingPayment((data ?? []) as PendingRow[])
    if (!found) {
      setPending(null)
    } else {
      const { call, kind } = found
      const service = Array.isArray(call.service) ? call.service[0] : call.service
      setPending({
        kind,
        callId: call.id,
        serviceName: service?.name ?? 'Serviço',
        totalPrice: Number(call.total_price),
        providerCut: Number(call.provider_cut),
        completedAt: call.completed_at,
        pixQrCode: call.pix_qr_code,
        pixCopyPaste: call.pix_copy_paste,
        checkoutUrl: call.cancel_note,
        noShowFeePixQrCode: call.no_show_fee_pix_qr_code,
        noShowFeePixCopyPaste: call.no_show_fee_pix_copy_paste,
      })
    }
    setChecked(true)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { pending, checked, refresh }
}
