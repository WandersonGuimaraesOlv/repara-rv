// =============================================================================
// e2e/location-choice.spec.ts
// Quando o GPS do celular fica longe do endereço digitado (> 500 m, ver
// LOCATION_CONFLICT_KM em lib/geocoding.ts), o cliente escolhe pra onde o
// técnico vai — e o chamado é criado com a coordenada escolhida (é ela que o
// Maps/Waze do prestador usa).
//
// Cada execução faz 4 chamadas a /api/calls/create (2 por cenário); o
// proxy.ts limita essa rota a 5 por 10 min por IP — rodar duas vezes seguidas
// dá 429. Os chamados criados ficam permanentes (service_audit_logs); rode
// contra o staging: E2E_TARGET=staging npx playwright test e2e/location-choice.spec.ts
// =============================================================================

import { test, expect, chromium, type Browser } from '@playwright/test'
import { createTestClient, getActiveServiceId, cleanupTestData, admin } from './helpers/test-users'

const RUN_ID = Date.now().toString(36)
// ~7 km ao sul do centro de Rio Verde, ainda na área de atendimento
const GPS_LONGE = { latitude: -17.855, longitude: -50.9192 }

// A API do Supabase devolve a coluna geometry como GeoJSON: coordinates = [lng, lat].
function pointFromGeoJson(point: { coordinates: [number, number] }): { lat: number; lng: number } {
  return { lng: point.coordinates[0], lat: point.coordinates[1] }
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

test.describe('GPS longe do endereço digitado — o cliente escolhe', () => {
  let browser: Browser
  let clientUser: Awaited<ReturnType<typeof createTestClient>>
  let serviceId: string
  const callIds: string[] = []

  test.beforeAll(async () => {
    browser = await chromium.launch()
    clientUser = await createTestClient(RUN_ID)
    serviceId = await getActiveServiceId()
  })

  test.afterAll(async () => {
    await browser.close()
    await cleanupTestData([clientUser.id], callIds)
  })

  async function pedirServico(escolha: 'gps' | 'address') {
    const context = await browser.newContext({ geolocation: GPS_LONGE, permissions: ['geolocation'] })
    const page = await context.newPage()
    await page.goto('/login')
    await page.fill('#input-phone', clientUser.phone)
    await page.fill('#input-pin', clientUser.pin)
    await page.click('#btn-login-pin')
    await page.waitForURL('/', { timeout: 15_000 })

    await page.goto(`/chamar/${serviceId}`)
    await page.fill('#input-address-rua', 'Rua dos Testes E2E')
    await page.fill('#input-address-numero', '123')
    await page.fill('#input-address-referencia', 'Próximo ao ponto de teste automatizado')
    await page.check('#checkbox-confirm-parts')
    await page.click('#btn-request-service', { force: true })

    await expect(page.locator('#location-choice-title')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/de onde seu celular está agora/)).toBeVisible()

    await page.click(escolha === 'gps' ? '#btn-location-gps' : '#btn-location-address')
    await page.waitForURL(/\/acompanhar\//, { timeout: 20_000 })
    const callId = page.url().split('/acompanhar/')[1]?.split(/[/?#]/)[0]
    expect(callId).toBeTruthy()
    callIds.push(callId!)

    const { data } = await admin.from('service_calls').select('client_location').eq('id', callId!).single()
    await context.close()
    return pointFromGeoJson(data!.client_location as { coordinates: [number, number] })
  }

  test('escolhendo "onde estou agora", o chamado vai pro GPS', async () => {
    const ponto = await pedirServico('gps')
    expect(distanceKm(ponto, { lat: GPS_LONGE.latitude, lng: GPS_LONGE.longitude })).toBeLessThan(0.05)
  })

  test('escolhendo "endereço digitado", o chamado vai pro endereço', async () => {
    const ponto = await pedirServico('address')
    expect(distanceKm(ponto, { lat: GPS_LONGE.latitude, lng: GPS_LONGE.longitude })).toBeGreaterThan(0.5)
  })
})
