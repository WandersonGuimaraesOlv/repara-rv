import { describe, it, expect } from 'vitest'
import {
  updateUserRoleSchema,
  updateBackgroundCheckSchema,
  toggleUserBlockedSchema,
} from '../lib/validations/admin-users'

const validId = '11111111-1111-4111-8111-111111111111'

describe('updateUserRoleSchema (lib/validations/admin-users)', () => {
  it.each(['client', 'provider', 'admin'] as const)('aceita role válida: %s', (role) => {
    expect(updateUserRoleSchema.safeParse({ userId: validId, role }).success).toBe(true)
  })

  it('rejeita role fora do enum (ex: typo ou valor de outro sistema)', () => {
    const result = updateUserRoleSchema.safeParse({ userId: validId, role: 'moderator' })
    expect(result.success).toBe(false)
  })

  it('rejeita userId que não é UUID', () => {
    const result = updateUserRoleSchema.safeParse({ userId: 'abc', role: 'admin' })
    expect(result.success).toBe(false)
  })

  it('rejeita payload sem role', () => {
    const result = updateUserRoleSchema.safeParse({ userId: validId })
    expect(result.success).toBe(false)
  })
})

describe('updateBackgroundCheckSchema (lib/validations/admin-users)', () => {
  it.each(['pending', 'approved', 'rejected'] as const)('aceita status válido: %s', (status) => {
    expect(updateBackgroundCheckSchema.safeParse({ userId: validId, status }).success).toBe(true)
  })

  it('rejeita status fora do enum (ex: "approve" sem o "d" final)', () => {
    const result = updateBackgroundCheckSchema.safeParse({ userId: validId, status: 'approve' })
    expect(result.success).toBe(false)
  })

  it('rejeita status vazio', () => {
    const result = updateBackgroundCheckSchema.safeParse({ userId: validId, status: '' })
    expect(result.success).toBe(false)
  })
})

describe('toggleUserBlockedSchema (lib/validations/admin-users)', () => {
  it('aceita isBlocked true/false', () => {
    expect(toggleUserBlockedSchema.safeParse({ userId: validId, isBlocked: true }).success).toBe(true)
    expect(toggleUserBlockedSchema.safeParse({ userId: validId, isBlocked: false }).success).toBe(true)
  })

  it('rejeita isBlocked como string "true" em vez de booleano — evita bug clássico de forms HTML', () => {
    const result = toggleUserBlockedSchema.safeParse({ userId: validId, isBlocked: 'true' })
    expect(result.success).toBe(false)
  })

  it('rejeita isBlocked ausente', () => {
    const result = toggleUserBlockedSchema.safeParse({ userId: validId })
    expect(result.success).toBe(false)
  })
})
