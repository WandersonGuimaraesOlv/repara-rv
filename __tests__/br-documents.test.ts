import { describe, it, expect } from 'vitest'
import { isValidCPF, isValidCNPJ, isValidCpfOrCnpj, isValidPixKey, isWeakPin } from '@/lib/validations/br-documents'

describe('isValidCPF', () => {
  it('aceita um CPF com dígitos verificadores corretos', () => {
    expect(isValidCPF('111.444.777-35')).toBe(true)
  })

  it('rejeita dígitos verificadores errados', () => {
    expect(isValidCPF('111.444.777-36')).toBe(false)
  })

  it('rejeita todos os dígitos iguais', () => {
    expect(isValidCPF('111.111.111-11')).toBe(false)
  })

  it('rejeita tamanho errado', () => {
    expect(isValidCPF('123456')).toBe(false)
  })
})

describe('isValidCNPJ', () => {
  it('aceita um CNPJ com dígitos verificadores corretos', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true)
  })

  it('rejeita dígitos verificadores errados', () => {
    expect(isValidCNPJ('11.222.333/0001-82')).toBe(false)
  })

  it('rejeita todos os dígitos iguais', () => {
    expect(isValidCNPJ('11.111.111/1111-11')).toBe(false)
  })
})

describe('isValidCpfOrCnpj', () => {
  it('valida como CPF quando tem 11 dígitos', () => {
    expect(isValidCpfOrCnpj('11144477735')).toBe(true)
  })

  it('valida como CNPJ quando tem 14 dígitos', () => {
    expect(isValidCpfOrCnpj('11222333000181')).toBe(true)
  })

  it('rejeita tamanho que não é nem CPF nem CNPJ', () => {
    expect(isValidCpfOrCnpj('123')).toBe(false)
  })
})

describe('isValidPixKey', () => {
  it('valida chave tipo cpf com CPF real', () => {
    expect(isValidPixKey('11144477735', 'cpf')).toBe(true)
    expect(isValidPixKey('12345678900', 'cpf')).toBe(false)
  })

  it('valida chave tipo phone com 10 ou 11 dígitos', () => {
    expect(isValidPixKey('64981155550', 'phone')).toBe(true)
    expect(isValidPixKey('123', 'phone')).toBe(false)
  })

  it('valida chave tipo email com formato de e-mail', () => {
    expect(isValidPixKey('joao@example.com', 'email')).toBe(true)
    expect(isValidPixKey('nao-e-email', 'email')).toBe(false)
  })

  it('valida chave tipo random como UUID', () => {
    expect(isValidPixKey('123e4567-e89b-12d3-a456-426614174000', 'random')).toBe(true)
    expect(isValidPixKey('chave-qualquer', 'random')).toBe(false)
  })

  it('rejeita chave vazia', () => {
    expect(isValidPixKey('   ', 'email')).toBe(false)
  })
})

describe('isWeakPin', () => {
  it('rejeita todos os dígitos iguais', () => {
    expect(isWeakPin('0000')).toBe(true)
    expect(isWeakPin('1111')).toBe(true)
  })

  it('rejeita sequência crescente', () => {
    expect(isWeakPin('1234')).toBe(true)
    expect(isWeakPin('123456')).toBe(true)
  })

  it('rejeita sequência decrescente', () => {
    expect(isWeakPin('4321')).toBe(true)
    expect(isWeakPin('654321')).toBe(true)
  })

  it('aceita um PIN não sequencial', () => {
    expect(isWeakPin('8472')).toBe(false)
  })

  it('rejeita formato inválido (não numérico ou tamanho errado)', () => {
    expect(isWeakPin('abcd')).toBe(true)
    expect(isWeakPin('12')).toBe(true)
  })
})
