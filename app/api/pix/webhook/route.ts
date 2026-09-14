import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { PixWebhookPayload } from '@/lib/types'

/**
 * Webhook do Mercado Pago para confirmação de pagamento Pix.
 *
 * Para configurar:
 * 1. No painel do Mercado Pago, adicione a URL de notificação:
 *    https://seu-dominio.com/api/pix/webhook
 * 2. Configure MERCADOPAGO_WEBHOOK_SECRET no .env.local E no painel
 *    (Suas integrações → aplicação → Webhooks → Configurar notificação)
 *    — os dois lados precisam ter o MESMO valor.
 *
 * Referência: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * Validação de assinatura (achado em 14/09/2026: nunca tinha sido implementada, apesar da
 * variável já estar prevista no .env desde sempre): o Mercado Pago assina cada notificação
 * com HMAC-SHA256 no cabeçalho `x-signature` (formato "ts=<timestamp>,v1=<hash hex>"),
 * calculado sobre o manifesto "id:[data.id];request-id:[x-request-id];ts:[ts];" (campo
 * inteiro removido se o valor não vier). Usa exclusivamente a Web Crypto API nativa
 * (crypto.subtle), igual ao resto do projeto (ver modules/notifications/services/
 * webcrypto-vapid.ts) — zero dependência do módulo `crypto` do Node, compatível com
 * Cloudflare Workers.
 *
 * Rollout gradual e seguro: se MERCADOPAGO_WEBHOOK_SECRET ainda não estiver configurado,
 * o webhook continua funcionando exatamente como antes (não bloqueia confirmação de
 * pagamento de verdade por engano), mas grita em alto e bom som no log. Assim que o
 * segredo estiver configurado, toda notificação sem assinatura válida é rejeitada (401).
 */

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.trim()
  if (clean.length === 0 || clean.length % 2 !== 0) return null
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(clean.substring(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    bytes[i] = byte
  }
  return bytes
}

interface SignatureCheck {
  ok: boolean
  reason: string
  secretConfigured: boolean
}

async function verifyMercadoPagoSignature(request: NextRequest, dataId: string | null): Promise<SignatureCheck> {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    return { ok: false, reason: 'MERCADOPAGO_WEBHOOK_SECRET não configurado', secretConfigured: false }
  }

  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')
  if (!xSignature) {
    return { ok: false, reason: 'cabeçalho x-signature ausente', secretConfigured: true }
  }

  const signatureParts: Record<string, string> = {}
  for (const part of xSignature.split(',')) {
    const [key, ...rest] = part.trim().split('=')
    if (key && rest.length > 0) signatureParts[key.trim()] = rest.join('=').trim()
  }
  const ts = signatureParts['ts']
  const v1 = signatureParts['v1']
  if (!ts || !v1) {
    return { ok: false, reason: 'x-signature malformado (faltando ts ou v1)', secretConfigured: true }
  }

  const signatureBytes = hexToBytes(v1)
  if (!signatureBytes) {
    return { ok: false, reason: 'v1 não é hexadecimal válido', secretConfigured: true }
  }

  // Manifesto oficial: campo inteiro removido (não só vazio) quando o valor não existe.
  const manifestParts: string[] = []
  if (dataId) manifestParts.push(`id:${dataId}`)
  if (xRequestId) manifestParts.push(`request-id:${xRequestId}`)
  manifestParts.push(`ts:${ts}`)
  const manifest = manifestParts.join(';') + ';'

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes.buffer as ArrayBuffer,
    new TextEncoder().encode(manifest).buffer as ArrayBuffer
  )

  return valid
    ? { ok: true, reason: '', secretConfigured: true }
    : { ok: false, reason: 'assinatura não confere', secretConfigured: true }
}

export async function POST(request: NextRequest) {
  try {
    const dataIdFromQuery = request.nextUrl.searchParams.get('data.id')
    const body: PixWebhookPayload = await request.json()
    const dataId = dataIdFromQuery || (body.data?.id ? String(body.data.id) : null)

    const signatureCheck = await verifyMercadoPagoSignature(request, dataId)
    if (!signatureCheck.ok) {
      if (signatureCheck.secretConfigured) {
        console.error('[Webhook Pix] Assinatura inválida — notificação rejeitada:', signatureCheck.reason)
        return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
      }
      // Segredo ainda não configurado dos dois lados: não bloqueia a confirmação de
      // pagamento de verdade por engano, mas avisa alto que está sem proteção nenhuma.
      console.error('[Webhook Pix] ⚠️ RODANDO SEM VALIDAÇÃO DE ASSINATURA — configure MERCADOPAGO_WEBHOOK_SECRET no .env.local e no painel do Mercado Pago. Motivo:', signatureCheck.reason)
    }

    // Ignora eventos que não são de pagamento
    if (body.action !== 'payment.updated' && body.action !== 'payment.created') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID missing' }, { status: 400 })
    }

    // Busca status do pagamento no Mercado Pago
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      console.error('[Webhook] MERCADOPAGO_ACCESS_TOKEN não configurado')
      return NextResponse.json({ received: true })
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const payment = await mpResponse.json()

    if (payment.status !== 'approved') {
      // Pagamento ainda não aprovado — aguarda próximo webhook
      return NextResponse.json({ received: true })
    }

    // Atualiza o chamado correspondente (por pix_payment_id ou external_reference do Cartão)
    const supabase = await createServiceClient()

    let callIdToUpdate: string | null = null

    // 1. Tenta buscar por pix_payment_id
    const { data: callByPix } = await supabase
      .from('service_calls')
      .select('id')
      .eq('pix_payment_id', String(paymentId))
      .maybeSingle()

    if (callByPix?.id) {
      callIdToUpdate = callByPix.id
    } else if (payment.external_reference) {
      // 2. Tenta buscar por external_reference (Cartão de Crédito/Débito via Checkout Pro)
      const { data: callByRef } = await supabase
        .from('service_calls')
        .select('id')
        .eq('id', payment.external_reference)
        .maybeSingle()

      if (callByRef?.id) {
        callIdToUpdate = callByRef.id
      }
    }

    if (!callIdToUpdate) {
      console.warn('[Webhook] Chamado não encontrado para payment_id:', paymentId, 'external_reference:', payment.external_reference)
      return NextResponse.json({ received: true })
    }

    await supabase
      .from('service_calls')
      .update({
        payment_status: 'paid',
        pix_payment_id: String(paymentId),
        completed_at: new Date().toISOString(),
      })
      .eq('id', callIdToUpdate)

    console.log(`[Webhook] Pagamento confirmado com sucesso para chamado ${callIdToUpdate}`)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[API] /api/pix/webhook:', error)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
