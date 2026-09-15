// =============================================================================
// lib/validations/br-documents.ts
// Validação de documentos e credenciais brasileiras usadas no cadastro
// (CPF/CNPJ do prestador, chave Pix, força do PIN de acesso). Pura, sem I/O —
// usada tanto no formulário de cadastro (feedback imediato) quanto na rota
// /api/auth/register (defesa de borda), evitando duplicar a lógica.
// =============================================================================

export function isValidCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '')
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i)
  let checkDigit1 = 11 - (sum % 11)
  if (checkDigit1 >= 10) checkDigit1 = 0
  if (checkDigit1 !== parseInt(cpf[9], 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i)
  let checkDigit2 = 11 - (sum % 11)
  if (checkDigit2 >= 10) checkDigit2 = 0
  if (checkDigit2 !== parseInt(cpf[10], 10)) return false

  return true
}

export function isValidCNPJ(raw: string): boolean {
  const cnpj = raw.replace(/\D/g, '')
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const calcCheckDigit = (length: number): number => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < length; i++) sum += parseInt(cnpj[i], 10) * weights[i]
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  if (calcCheckDigit(12) !== parseInt(cnpj[12], 10)) return false
  if (calcCheckDigit(13) !== parseInt(cnpj[13], 10)) return false

  return true
}

// O prestador MEI pode informar CPF (11 dígitos) ou CNPJ (14 dígitos) — o
// tamanho após limpar a máscara já diz qual dos dois validar.
export function isValidCpfOrCnpj(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return isValidCPF(digits)
  if (digits.length === 14) return isValidCNPJ(digits)
  return false
}

export type PixKeyType = 'cpf' | 'phone' | 'email' | 'random'

// Cada tipo de chave Pix tem um formato bem definido pelo Banco Central —
// aceitar qualquer texto aqui significa descobrir só na hora do repasse (já
// com o serviço concluído) que a chave nunca vai receber o Pix.
export function isValidPixKey(rawKey: string, type: PixKeyType): boolean {
  const key = rawKey.trim()
  if (!key) return false

  switch (type) {
    case 'cpf':
      return isValidCPF(key)
    case 'phone':
      return /^\d{10,11}$/.test(key.replace(/\D/g, ''))
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)
    case 'random':
      // Chave aleatória do Pix é sempre um UUID v4.
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
    default:
      return false
  }
}

// PIN fraco: todos os dígitos iguais (0000, 1111...) ou sequência estritamente
// crescente/decrescente (1234, 4321, 123456...). Não impede TODO PIN
// previsível (isso exigiria uma lista de PINs vazados), mas barra os padrões
// mais óbvios que qualquer um tentaria primeiro.
export function isWeakPin(pin: string): boolean {
  if (!/^\d{4,8}$/.test(pin)) return true

  if (/^(\d)\1+$/.test(pin)) return true

  const digits = pin.split('').map(Number)
  let ascending = true
  let descending = true
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) ascending = false
    if (digits[i] !== digits[i - 1] - 1) descending = false
  }

  return ascending || descending
}
