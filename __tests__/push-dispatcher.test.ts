import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendWebPush } from '../modules/notifications/services/push-dispatcher'
import { decryptWebPush, createTestSubscription } from './helpers/webpush-decrypt'

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Chaves VAPID no formato REAL de produção (escalar bruto de 32 bytes + ponto de 65 bytes)
async function generateTestVapidEnv() {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
  return {
    VAPID_PUBLIC_KEY: base64UrlEncode(raw),
    VAPID_PRIVATE_KEY: jwk.d as string,
    VAPID_SUBJECT: 'mailto:contato@repararv.com',
  }
}

const payload = { title: 'Novo chamado', body: 'Um cliente precisa de você', url: '/painel' }

describe('sendWebPush (modules/notifications/services/push-dispatcher)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envia o corpo CRIPTOGRAFADO (RFC 8291) e o navegador consegue decifrar a mensagem original', async () => {
    const env = await generateTestVapidEnv()
    const { subscription, uaPrivate, uaPublic, authSecret } = createTestSubscription()
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendWebPush(subscription, payload, env)

    expect(result).toEqual({ success: true, shouldRemove: false })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [calledUrl, calledInit] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe(subscription.endpoint)
    expect(calledInit.headers['Authorization']).toMatch(/^vapid t=.+,k=.+$/)
    expect(calledInit.headers['Content-Encoding']).toBe('aes128gcm')
    expect(calledInit.headers['Content-Type']).toBe('application/octet-stream')
    expect(calledInit.headers['TTL']).toBe('120')
    expect(calledInit.headers['Urgency']).toBe('high')

    // O corpo NÃO pode ser o JSON em claro (era exatamente o bug): tem que ser binário e decifrável
    const body = calledInit.body as Uint8Array
    expect(Buffer.from(body).includes(Buffer.from('Novo chamado'))).toBe(false)
    const decrypted = decryptWebPush(body, uaPrivate, uaPublic, authSecret)
    expect(JSON.parse(decrypted.toString('utf-8'))).toEqual(payload)
  })

  it('não tenta enviar nada quando a assinatura tem chaves malformadas (retorna falha suave)', async () => {
    const env = await generateTestVapidEnv()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await sendWebPush(
      { endpoint: 'https://fcm.googleapis.com/wp/x', p256dh: 'fake-p256dh', auth: 'fake-auth' },
      payload,
      env
    )

    expect(result).toEqual({ success: false, shouldRemove: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([410, 404])(
    'marca shouldRemove:true quando o endpoint responde %i (subscrição expirada/removida no navegador)',
    async (status) => {
      const env = await generateTestVapidEnv()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })))

      const result = await sendWebPush(createTestSubscription().subscription, payload, env)

      expect(result).toEqual({ success: false, shouldRemove: true })
    }
  )

  it('retorna success:false, shouldRemove:false para outros erros HTTP (ex: 500 temporário do gateway push)', async () => {
    const env = await generateTestVapidEnv()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    const result = await sendWebPush(createTestSubscription().subscription, payload, env)

    expect(result).toEqual({ success: false, shouldRemove: false })
  })

  it('não deixa uma falha de rede (fetch rejeitado) explodir para o chamador — captura e retorna failure suave', async () => {
    const env = await generateTestVapidEnv()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await sendWebPush(createTestSubscription().subscription, payload, env)

    expect(result).toEqual({ success: false, shouldRemove: false })
  })
})
