import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase/server'
import { POST } from '../app/api/auth/pin/route'

const PHONE = '62981111111'
const EMAIL = `${PHONE}@repararv.com`

function makeAdmin(opts: {
  users?: { email: string }[]
  usersAfterFailure?: { email: string }[]
  createError?: { message: string } | null
}) {
  const listUsers = vi
    .fn()
    .mockResolvedValueOnce({ data: { users: opts.users ?? [] } })
    .mockResolvedValue({ data: { users: opts.usersAfterFailure ?? opts.users ?? [] } })
  const createUser = vi.fn(async () =>
    opts.createError
      ? { data: { user: null }, error: opts.createError }
      : { data: { user: { id: 'novo-id' } }, error: null },
  )
  return { admin: { auth: { admin: { listUsers, createUser } } }, listUsers, createUser }
}

const post = (body: unknown) =>
  POST(
    new Request('https://repararv.com/api/auth/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

describe('POST /api/auth/pin — número sem cadastro só vira conta com confirmação', () => {
  beforeEach(() => {
    vi.mocked(createServiceClient).mockReset()
  })

  it('conta existente: devolve as credenciais e não cria nada', async () => {
    const { admin, createUser } = makeAdmin({ users: [{ email: EMAIL }] })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const res = await post({ phone: '(62) 98111-1111', pin: '2580' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ isNew: false, email: EMAIL, password: 'pin_2580' })
    expect(createUser).not.toHaveBeenCalled()
  })

  it('número desconhecido sem confirmação: pede confirmação e NÃO cria a conta', async () => {
    const { admin, createUser } = makeAdmin({ users: [] })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const res = await post({ phone: '(62) 98111-1111', pin: '2580' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ needsConfirmation: true, phone: PHONE })
    expect(createUser).not.toHaveBeenCalled()
  })

  it('confirmNewAccount: false explícito também não cria', async () => {
    const { admin, createUser } = makeAdmin({ users: [] })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const res = await post({ phone: PHONE, pin: '2580', confirmNewAccount: false })

    expect((await res.json()).needsConfirmation).toBe(true)
    expect(createUser).not.toHaveBeenCalled()
  })

  it('número desconhecido com confirmNewAccount: true cria a conta', async () => {
    const { admin, createUser } = makeAdmin({ users: [] })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const res = await post({ phone: PHONE, pin: '2580', confirmNewAccount: true })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ isNew: true, email: EMAIL, password: 'pin_2580', userId: 'novo-id' })
    expect(createUser).toHaveBeenCalledTimes(1)
    expect(createUser).toHaveBeenCalledWith({
      email: EMAIL,
      password: 'pin_2580',
      email_confirm: true,
      user_metadata: { phone: PHONE },
    })
  })

  it('confirmar não afeta quem já tem conta (continua login normal)', async () => {
    const { admin, createUser } = makeAdmin({ users: [{ email: EMAIL }] })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const body = await (await post({ phone: PHONE, pin: '2580', confirmNewAccount: true })).json()

    expect(body.isNew).toBe(false)
    expect(createUser).not.toHaveBeenCalled()
  })

  it('corrida de criação: se outra requisição já criou, devolve login normal', async () => {
    const { admin } = makeAdmin({
      users: [],
      usersAfterFailure: [{ email: EMAIL }],
      createError: { message: 'Database error creating new user' },
    })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const body = await (await post({ phone: PHONE, pin: '2580', confirmNewAccount: true })).json()

    expect(body).toEqual({ isNew: false, email: EMAIL, password: 'pin_2580' })
  })

  it('falha de criação sem vencedor da corrida devolve 500', async () => {
    const { admin } = makeAdmin({ users: [], createError: { message: 'falhou' } })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const res = await post({ phone: PHONE, pin: '2580', confirmNewAccount: true })

    expect(res.status).toBe(500)
  })

  it('celular curto ou PIN curto continuam dando 400, sem consultar o banco', async () => {
    const { admin, listUsers } = makeAdmin({})
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    expect((await post({ phone: '629811', pin: '2580' })).status).toBe(400)
    expect((await post({ phone: PHONE, pin: '12' })).status).toBe(400)
    expect(listUsers).not.toHaveBeenCalled()
  })

  it('confirmNewAccount com tipo errado (string) é recusado', async () => {
    const { admin, createUser } = makeAdmin({ users: [] })
    vi.mocked(createServiceClient).mockResolvedValue(admin as never)

    const res = await post({ phone: PHONE, pin: '2580', confirmNewAccount: 'true' })

    expect(res.status).toBe(400)
    expect(createUser).not.toHaveBeenCalled()
  })
})
