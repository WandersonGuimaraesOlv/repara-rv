// =============================================================================
// e2e/golden-path.spec.ts
// Camada 6, item i1 do plano de validação: cliente pede → prestador recebe
// alerta → aceita → chega → conclui, em dois contextos de navegador
// simultâneos (Playwright), contra o app rodando de verdade (npm run dev).
//
// Login por telefone+PIN roda de verdade contra o Supabase real (não é
// pulado) — só a criação das CONTAS em si usa a Service Role Key
// (e2e/helpers/test-users.ts), pra não depender da UI de cadastro só pra
// chegar ao estado "tenho uma conta".
//
// Achado importante de sessões anteriores desta auditoria: contas de teste
// marcadas is_online=true no provider_status competem de verdade pelo
// casamento automático (find_nearest_provider) contra clientes reais — este
// spec limpa os dados que consegue no final, mas qualquer chamado que chegue
// a ser aceito fica permanente (service_audit_logs é append-only) com
// provider_status.is_online preso em true. Rode `npm run monitor:synthetic`
// ou audite manualmente de vez em quando pra garantir que não sobra
// prestador de teste "online" pra sempre.
//
// NOTA OPERACIONAL (achado ao estabilizar este spec): proxy.ts limita
// /api/auth* a 3 req/min por IP. Este teste faz 2 logins por execução
// (cliente + prestador) — rodar `npm run test:e2e` várias vezes seguidas em
// menos de 1 minuto no mesmo IP (dev local ou CI) esgota o limite e a rota
// de login responde 429, fazendo o teste falhar por timeout de navegação
// (não é flakiness do teste nem bug do app — é o rate limiter funcionando).
// Rodando isolado, ou com >60s de intervalo entre execuções, passa de forma
// estável.
//
// PARA DEIXAR O RUN AUTOMATIZÁVEL (CI/staging), NÃO aprova a conclusão pelo
// cliente (#btn-approve-completion): a aprovação abre o Pix do cliente, que
// chama /api/pix/create e a API de verdade do Mercado Pago. Rodar isso
// repetidamente criaria cobranças reais no gateway de pagamento. O teste vai
// até a conferência: o prestador digita o PIN de chegada que aparece na tela
// do cliente (o PIN mora em call_arrival_pins, que o prestador não lê),
// conclui, o cliente aponta um problema, o prestador conclui de novo. Pra
// validar "aprovar → Pix" de ponta a ponta, rode TEST_INCLUDE_PIX=1 npx
// playwright test — aí o cliente aprova de verdade.
// =============================================================================

import { test, expect, chromium, type Browser, type BrowserContext } from '@playwright/test'
import {
  createTestClient,
  createTestProvider,
  getActiveServiceId,
  cleanupTestData,
  admin,
} from './helpers/test-users'

const RUN_ID = Date.now().toString(36)

test.describe('Ciclo completo do chamado — cliente pede, prestador aceita e atende', () => {
  let browser: Browser
  let clientCtx: BrowserContext
  let providerCtx: BrowserContext
  let clientUser: Awaited<ReturnType<typeof createTestClient>>
  let providerUser: Awaited<ReturnType<typeof createTestProvider>>
  let serviceId: string
  let callId: string | null = null

  test.beforeAll(async () => {
    browser = await chromium.launch()
    clientCtx = await browser.newContext()
    providerCtx = await browser.newContext()

    clientUser = await createTestClient(RUN_ID)
    providerUser = await createTestProvider(RUN_ID)
    serviceId = await getActiveServiceId()
  })

  test.afterAll(async () => {
    await clientCtx.close()
    await providerCtx.close()
    await browser.close()

    const { auditBlocked } = await cleanupTestData(
      [clientUser.id, providerUser.id],
      callId ? [callId] : []
    )
    if (auditBlocked) {
      // O chamado aceito fica permanente (service_audit_logs é append-only) e
      // com ele o prestador de teste. Sem isto ele ficaria is_online=true pra
      // sempre e entraria no casamento automático de clientes reais.
      await admin.from('provider_status').update({ is_online: false }).eq('provider_id', providerUser.id)
      console.log(`[e2e] Dados de teste ficaram permanentes (service_audit_logs append-only): call=${callId} — prestador de teste colocado offline`)
    }
  })

  test('cliente solicita, prestador recebe o alerta e aceita', async () => {
    // ── 1. Cliente faz login de verdade (telefone + PIN) ──────────────────
    const clientPage = await clientCtx.newPage()
    await clientPage.goto('/login')
    await clientPage.fill('#input-phone', clientUser.phone)
    await clientPage.fill('#input-pin', clientUser.pin)
    await clientPage.click('#btn-login-pin')
    await clientPage.waitForURL('/', { timeout: 15_000 })

    // ── 2. Cliente solicita o serviço ──────────────────────────────────────
    await clientPage.goto(`/chamar/${serviceId}`)
    await clientPage.fill('#input-address-rua', 'Rua dos Testes E2E')
    await clientPage.fill('#input-address-numero', '123')
    await clientPage.fill('#input-address-referencia', 'Próximo ao ponto de teste automatizado')
    await clientPage.check('#checkbox-confirm-parts')

    await expect(clientPage.locator('#btn-request-service')).toBeEnabled()
    // force:true — o botão tem uma animação CSS contínua (animate-bounce-cta)
    // que nunca "estabiliza" pra checagem de actionability padrão do Playwright.
    await clientPage.click('#btn-request-service', { force: true })

    await clientPage.waitForURL(/\/acompanhar\//, { timeout: 20_000 })
    callId = clientPage.url().split('/acompanhar/')[1]?.split(/[/?#]/)[0] ?? null
    expect(callId, 'callId deveria estar presente na URL de acompanhamento').toBeTruthy()

    // Confirma no banco que o casamento automático pegou o prestador de teste
    // (não um prestador real ou outro de teste que porventura esteja online)
    const { data: callRow } = await admin
      .from('service_calls')
      .select('status, provider_id')
      .eq('id', callId!)
      .single()
    expect(callRow?.status).toBe('searching')
    expect(callRow?.provider_id).toBe(providerUser.id)

    // ── 3. Prestador faz login e recebe o alerta do chamado ────────────────
    const providerPage = await providerCtx.newPage()
    await providerPage.goto('/login')
    await providerPage.fill('#input-phone', providerUser.phone)
    await providerPage.fill('#input-pin', providerUser.pin)
    await providerPage.click('#btn-login-pin')
    await providerPage.waitForURL('/painel', { timeout: 15_000 })

    // O alerta chega via polling de 3s (ver app/painel/page.tsx) — dar
    // margem suficiente pro ciclo de polling pegar o chamado recém-criado.
    await expect(providerPage.locator('#call-alert-modal')).toBeVisible({ timeout: 10_000 })

    // ── 4. Prestador aceita ─────────────────────────────────────────────────
    await providerPage.click('#btn-accept-call')
    await providerPage.waitForURL(new RegExp(`/chamado/${callId}`), { timeout: 15_000 })

    // app/chamado/[callId]/page.tsx promove accepted -> on_the_way num useEffect
    // assíncrono ao carregar a tela — dá uma folga pra essa escrita terminar
    // em vez de checar o banco no instante exato da navegação.
    await expect(async () => {
      const { data } = await admin.from('service_calls').select('status').eq('id', callId!).single()
      expect(data?.status).toBe('on_the_way')
    }).toPass({ timeout: 5_000 })

    // ── 5. Iniciar atendimento com o PIN que aparece na tela do CLIENTE ─────
    // (o PIN fica em call_arrival_pins, que o prestador não lê — igual na
    // vida real, ele digita o que o cliente mostra). Não toca no Mercado Pago.
    await expect(providerPage.locator('#btn-open-start-service')).toBeEnabled()
    const pinOnClientScreen = clientPage.locator('#arrival-pin-code')
    await expect(pinOnClientScreen).toHaveText(/^\d{4}$/, { timeout: 10_000 })
    const arrivalPin = (await pinOnClientScreen.innerText()).trim()

    await providerPage.click('#btn-open-start-service')
    await providerPage.fill('#input-arrival-pin', arrivalPin)
    await providerPage.click('#btn-confirm-start-service')

    await expect(async () => {
      const { data } = await admin.from('service_calls').select('status').eq('id', callId!).single()
      expect(data?.status).toBe('in_progress')
    }).toPass({ timeout: 5_000 })

    // ── Conferência do cliente antes do Pix (24/09/2026) ────────────────────
    const statusIs = async (status: string) => {
      await expect(async () => {
        const { data } = await admin.from('service_calls').select('status').eq('id', callId!).single()
        expect(data?.status).toBe(status)
      }).toPass({ timeout: 10_000 })
    }

    await expect(providerPage.locator('#btn-complete-service')).toBeEnabled()
    await providerPage.click('#btn-complete-service')
    await statusIs('awaiting_approval')
    await expect(providerPage.locator('#waiting-client-approval')).toBeVisible()

    // Cliente aponta um problema → volta pro prestador, que vê o motivo
    await expect(clientPage.locator('#completion-review')).toBeVisible({ timeout: 10_000 })
    await clientPage.click('#btn-report-completion-issue')
    await clientPage.fill('#input-completion-issue', '[E2E] o chuveiro continua pingando')
    await clientPage.click('#btn-send-completion-issue')
    await statusIs('in_progress')
    await expect(providerPage.locator('#completion-issue-banner')).toContainText('continua pingando', { timeout: 10_000 })

    // Prestador corrige e conclui de novo
    await providerPage.click('#btn-complete-service')
    await statusIs('awaiting_approval')
    await expect(clientPage.locator('#btn-approve-completion')).toBeVisible({ timeout: 10_000 })

    if (process.env.TEST_INCLUDE_PIX === '1') {
      // ⚠️ A aprovação abre o Pix do cliente, que chama a API de verdade do
      // Mercado Pago (ver comentário no topo do arquivo) — só roda quando
      // explicitamente pedido.
      await clientPage.click('#btn-approve-completion')
      await statusIs('completed')
      await expect(providerPage.locator('#waiting-client-payment')).toBeVisible({ timeout: 10_000 })

      const { data: completed } = await admin
        .from('service_calls')
        .select('status, payment_status')
        .eq('id', callId!)
        .single()
      expect(completed?.status).toBe('completed')
      expect(completed?.payment_status).toBe('pending')
    }
  })
})
