// =============================================================================
// e2e/onboarding.spec.ts
// Camada 6, item i2 do plano de validação: cobre o fluxo de onboarding.
//
// Achado real corrigido nesta sessão: o checkbox de aceite dos Termos de Uso
// em app/onboarding/page.tsx começava MARCADO por padrão (useState(true)),
// contrariando o AGENTS.md ("sempre iniciar desmarcado... Nunca pré-marcar")
// e o requisito de consentimento informado da LGPD — um usuário podia
// completar o cadastro sem nunca ter clicado no aceite. Este spec existe
// principalmente pra travar essa regressão específica: o checkbox tem que
// nascer desmarcado, e o formulário tem que recusar submeter sem ele.
// =============================================================================

import { test, expect, chromium, type Browser } from '@playwright/test'
import { admin, cleanupTestData } from './helpers/test-users'

const RUN_ID = Date.now().toString(36)

// CPF com dígitos verificadores válidos, gerado na hora (9 dígitos aleatórios +
// 2 dígitos calculados). O formulário valida o CPF antes de olhar o checkbox
// dos termos (app/onboarding/page.tsx), então com um CPF inválido tipo
// '00000000000' o submit era recusado pelo CPF e o teste nunca provava que o
// bloqueio vem dos termos — e o cadastro completo nunca chegava ao fim.
function generateValidCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  // evita sequências repetidas (ex: 111111111), que o validador rejeita
  if (base.every((d) => d === base[0])) base[8] = (base[8] + 1) % 10
  const digit = (nums: number[]) => {
    const factor = nums.length + 1
    const sum = nums.reduce((acc, n, i) => acc + n * (factor - i), 0)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  const d1 = digit(base)
  const d2 = digit([...base, d1])
  return [...base, d1, d2].join('')
}

test.describe('Onboarding — primeiro acesso completa o perfil', () => {
  let browser: Browser
  let userId: string
  let phone: string
  const pin = '1234'

  test.beforeAll(async () => {
    browser = await chromium.launch()

    // Cria só a conta de Auth (sem profile) — reproduz exatamente o estado de
    // um usuário que acabou de fazer o primeiro login por PIN (isNew: true)
    // e ainda não completou o cadastro, sem depender da UI de login pra
    // chegar nesse estado.
    phone = `6295${String(Date.now()).slice(-7)}`
    const email = `${phone}@repararv.com`
    const { data, error } = await admin.auth.admin.createUser({ email, password: `pin_${pin}`, email_confirm: true })
    if (error || !data.user) throw new Error(`Falha ao criar usuário de teste: ${error?.message}`)
    userId = data.user.id
  })

  test.afterAll(async () => {
    await browser.close()
    await cleanupTestData([userId])
  })

  test('checkbox de termos nasce desmarcado e bloqueia o envio até ser marcado', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/login')
    await page.fill('#input-phone', phone)
    await page.fill('#input-pin', pin)
    await page.click('#btn-login-pin')

    // Usuário sem profile ainda -> login redireciona pro onboarding
    await page.waitForURL('/onboarding', { timeout: 15_000 })

    // ── Achado corrigido: o checkbox tem que nascer DESMARCADO ──────────────
    await expect(page.locator('#checkbox-onboarding-terms')).not.toBeChecked()

    await page.click('#role-client')
    await page.fill('#input-full-name', '[E2E] Usuário Onboarding')
    await page.fill('#input-onboarding-phone', phone)
    await page.fill('#input-cpf-cnpj', generateValidCpf())

    // Tenta enviar SEM marcar o checkbox — o form deve recusar (toast de erro)
    // e continuar na mesma tela, sem criar o profile.
    await page.click('#btn-complete-onboarding', { force: true })
    // O motivo da recusa tem que ser os termos (o CPF já é válido nesta altura):
    // o checkbox é `required`, então o próprio navegador barra o envio antes de
    // o handler rodar (por isso não há toast) e o campo fica inválido.
    const termsMissing = await page.$eval('#checkbox-onboarding-terms', (el) => (el as HTMLInputElement).validity.valueMissing)
    expect(termsMissing, 'o checkbox de termos deveria estar bloqueando o envio').toBe(true)
    await expect(page).toHaveURL(/\/onboarding/)
    const { data: profileBeforeCheck } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
    expect(profileBeforeCheck, 'profile não deveria existir antes de aceitar os termos').toBeNull()

    // Agora marca o checkbox de verdade e confirma que o cadastro completa
    await page.check('#checkbox-onboarding-terms')
    await page.click('#btn-complete-onboarding', { force: true })

    await page.waitForURL('/', { timeout: 15_000 })

    const { data: profileAfter } = await admin
      .from('profiles')
      .select('role, full_name, terms_accepted_at')
      .eq('id', userId)
      .single()
    expect(profileAfter?.role).toBe('client')
    expect(profileAfter?.terms_accepted_at).toBeTruthy()

    await context.close()
  })
})
