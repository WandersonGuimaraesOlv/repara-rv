// =============================================================================
// e2e/login-numero-sem-cadastro.spec.ts
// Achado de 21/09/2026 (teste do push no celular): errar um dígito do celular
// no login criava uma conta em branco sem avisar. Agora número desconhecido
// pede confirmação e NÃO cria nada até a pessoa confirmar.
//
// Este spec nunca clica em "Criar conta nova": só confere o aviso, a tela do
// número digitado, o "Corrigir o número" e que nenhum usuário de Auth foi
// criado no banco. (A criação com confirmação é coberta em
// __tests__/auth-pin-route.test.ts, sem deixar dado em produção.)
// =============================================================================

import { test, expect } from '@playwright/test'
import { admin } from './helpers/test-users'

// Número fictício com DDD 62, no formato que nunca é atribuído a linha real de
// teste dos outros specs (6299… e 6298…): 6297 + 7 dígitos.
const phone = `6297${String(Date.now()).slice(-7)}`
const email = `${phone}@repararv.com`

async function authUserExists(): Promise<boolean> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  return Boolean(data?.users.some((u) => u.email === email))
}

test.describe('Login com número sem cadastro', () => {
  test('pede confirmação, permite corrigir e não cria a conta sozinho', async ({ page }) => {
    expect(await authUserExists(), 'o número de teste não pode existir antes').toBe(false)

    await page.goto('/login')
    await page.fill('#input-phone', phone)
    await page.fill('#input-pin', '2580')
    await page.click('#btn-login-pin')

    const aviso = page.locator('#new-account-confirm')
    await expect(aviso).toBeVisible({ timeout: 15_000 })
    await expect(aviso).toContainText('Esse número ainda não tem cadastro')
    // mostra o número formatado, pra pessoa conferir o que digitou
    await expect(aviso).toContainText(`(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`)

    // continua na tela de login, sem criar conta nem ir pro onboarding
    await expect(page).toHaveURL(/\/login/)
    expect(await authUserExists(), 'nenhuma conta pode ser criada antes de confirmar').toBe(false)

    // "Corrigir o número" fecha o aviso e devolve o foco ao campo do celular
    await page.click('#btn-fix-phone')
    await expect(aviso).toBeHidden()
    await expect(page.locator('#input-phone')).toBeFocused()
    await expect(page.locator('#btn-login-pin')).toBeVisible()

    expect(await authUserExists(), 'nada foi criado depois de corrigir').toBe(false)
  })
})
