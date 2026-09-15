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
    await page.fill('#input-cpf-cnpj', '00000000000')

    // Tenta enviar SEM marcar o checkbox — o form deve recusar (toast de erro)
    // e continuar na mesma tela, sem criar o profile.
    await page.click('#btn-complete-onboarding', { force: true })
    await page.waitForTimeout(1000)
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
