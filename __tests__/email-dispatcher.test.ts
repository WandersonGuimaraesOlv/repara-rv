import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendEmail, FROM_ADDRESS } from '../modules/notifications/services/email-dispatcher'

const payload = { to: 'cliente@example.com', subject: '123456 — Código', html: '<p>oi</p>' }

describe('sendEmail (modules/notifications/services/email-dispatcher)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('remetente é do domínio verificado repararv.com, nunca o sandbox do Resend', () => {
    // onboarding@resend.dev só entrega pro dono da conta: com ele o código de
    // redefinição de PIN nunca chegava a usuários reais.
    expect(FROM_ADDRESS).toContain('@repararv.com')
    expect(FROM_ADDRESS).not.toContain('resend.dev')
  })

  it('não tenta enviar nada e devolve erro quando RESEND_API_KEY não está configurada', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await sendEmail(payload, undefined)

    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia pro Resend com chave, remetente, destinatário, assunto e corpo corretos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail(payload, 're_test_key')

    expect(result).toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer re_test_key')
    expect(JSON.parse(init.body)).toEqual({
      from: FROM_ADDRESS,
      to: 'cliente@example.com',
      subject: '123456 — Código',
      html: '<p>oi</p>',
    })
  })

  it('devolve success=false (sem lançar) quando o Resend recusa o envio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'domain not verified' }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await sendEmail(payload, 're_test_key')

    expect(result).toEqual({ success: false, error: 'Resend retornou 403' })
  })

  it('devolve success=false (sem lançar) quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await sendEmail(payload, 're_test_key')

    expect(result).toEqual({ success: false, error: 'network down' })
  })
})
