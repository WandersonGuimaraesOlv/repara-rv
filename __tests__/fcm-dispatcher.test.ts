import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendFCM } from '../modules/notifications/services/fcm-dispatcher'

function toPem(base64: string): string {
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`
}

// Gera uma service account Firebase FICTÍCIA, mas com uma chave RSA de verdade
// (gerada por Web Crypto), pra exercitar de verdade o fluxo real de assinatura
// JWT + importKey do fcm-dispatcher — só a rede (fetch) é mockada.
async function generateFakeServiceAccountJson(): Promise<string> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)))

  return JSON.stringify({
    client_email: 'firebase-adminsdk@repara-rv-test.iam.gserviceaccount.com',
    private_key: toPem(base64),
    project_id: 'repara-rv-test',
  })
}

const payload = { title: 'Novo chamado', body: 'Um cliente precisa de você', url: '/painel', callId: 'call-123' }

describe('sendFCM (modules/notifications/services/fcm-dispatcher)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('não tenta enviar nada e não lança quando FIREBASE_SERVICE_ACCOUNT_JSON não está configurado', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendFCM('some-token', payload, { FIREBASE_SERVICE_ACCOUNT_JSON: '' })

    expect(result).toEqual({ success: false, shouldRemove: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('troca o JWT assinado por um access token OAuth2 de verdade (via fetch mockado) e envia a notificação', async () => {
    const serviceAccountJson = await generateFakeServiceAccountJson()

    const fetchMock = vi.fn()
      // 1ª chamada: troca do JWT por access token OAuth2
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'fake-access-token' }), { status: 200 })
      )
      // 2ª chamada: envio de fato pra FCM HTTP v1
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: 'projects/x/messages/1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendFCM('device-token-abc', payload, { FIREBASE_SERVICE_ACCOUNT_JSON: serviceAccountJson })

    expect(result).toEqual({ success: true, shouldRemove: false })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Confirma que o JWT realmente foi montado e enviado no grant_type correto
    const [oauthUrl, oauthInit] = fetchMock.mock.calls[0]
    expect(oauthUrl).toBe('https://oauth2.googleapis.com/token')
    const oauthBody = oauthInit.body as URLSearchParams
    expect(oauthBody.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    expect(typeof oauthBody.get('assertion')).toBe('string')
    expect(oauthBody.get('assertion')!.split('.')).toHaveLength(3) // JWT válido: header.payload.signature

    // Confirma que a 2ª chamada usa o access token retornado e o project_id certo
    const [sendUrl, sendInit] = fetchMock.mock.calls[1]
    expect(sendUrl).toBe('https://fcm.googleapis.com/v1/projects/repara-rv-test/messages:send')
    expect(sendInit.headers['Authorization']).toBe('Bearer fake-access-token')
    const sentMessage = JSON.parse(sendInit.body)
    expect(sentMessage.message.token).toBe('device-token-abc')
    expect(sentMessage.message.notification.title).toBe(payload.title)
    expect(sentMessage.message.data.callId).toBe('call-123')
  })

  it('marca shouldRemove:true quando o FCM responde 404 (token de dispositivo inválido/desinstalado)', async () => {
    const serviceAccountJson = await generateFakeServiceAccountJson()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 }))
        .mockResolvedValueOnce(new Response('not found', { status: 404 }))
    )

    const result = await sendFCM('stale-token', payload, { FIREBASE_SERVICE_ACCOUNT_JSON: serviceAccountJson })

    expect(result).toEqual({ success: false, shouldRemove: true })
  })

  it('retorna failure suave (não lança) quando a troca de token OAuth2 falha', async () => {
    const serviceAccountJson = await generateFakeServiceAccountJson()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('unauthorized', { status: 401 })))

    const result = await sendFCM('any-token', payload, { FIREBASE_SERVICE_ACCOUNT_JSON: serviceAccountJson })

    expect(result).toEqual({ success: false, shouldRemove: false })
  })

  it('retorna failure suave quando o JSON da service account está corrompido/malformado', async () => {
    const result = await sendFCM('any-token', payload, { FIREBASE_SERVICE_ACCOUNT_JSON: '{ invalido' })

    expect(result).toEqual({ success: false, shouldRemove: false })
  })
})
