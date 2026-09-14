import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendWebPush } from '../modules/notifications/services/push-dispatcher'

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateTestVapidEnv() {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  return {
    VAPID_PUBLIC_KEY: base64UrlEncode(new Uint8Array(spki)),
    VAPID_PRIVATE_KEY: base64UrlEncode(new Uint8Array(pkcs8)),
    VAPID_SUBJECT: 'mailto:contato@repararv.com',
  }
}

const subscription = {
  endpoint: 'https://fcm.googleapis.com/wp/test-endpoint',
  p256dh: 'fake-p256dh',
  auth: 'fake-auth',
}

const payload = { title: 'Novo chamado', body: 'Um cliente precisa de você', url: '/painel' }

describe('sendWebPush (modules/notifications/services/push-dispatcher)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retorna success:true, shouldRemove:false quando o endpoint aceita a notificação (2xx)', async () => {
    const env = await generateTestVapidEnv()
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendWebPush(subscription, payload, env)

    expect(result).toEqual({ success: true, shouldRemove: false })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [calledUrl, calledInit] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe(subscription.endpoint)
    expect(calledInit.headers['Authorization']).toMatch(/^vapid t=.+,k=.+$/)
    expect(calledInit.headers['TTL']).toBe('120')
    expect(calledInit.headers['Urgency']).toBe('high')
  })

  it.each([410, 404])(
    'marca shouldRemove:true quando o endpoint responde %i (subscrição expirada/removida no navegador)',
    async (status) => {
      const env = await generateTestVapidEnv()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })))

      const result = await sendWebPush(subscription, payload, env)

      expect(result).toEqual({ success: false, shouldRemove: true })
    }
  )

  it('retorna success:false, shouldRemove:false para outros erros HTTP (ex: 500 temporário do gateway push)', async () => {
    const env = await generateTestVapidEnv()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    const result = await sendWebPush(subscription, payload, env)

    expect(result).toEqual({ success: false, shouldRemove: false })
  })

  it('não deixa uma falha de rede (fetch rejeitado) explodir para o chamador — captura e retorna failure suave', async () => {
    const env = await generateTestVapidEnv()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await sendWebPush(subscription, payload, env)

    expect(result).toEqual({ success: false, shouldRemove: false })
  })
})
