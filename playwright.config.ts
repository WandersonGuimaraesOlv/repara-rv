import { defineConfig, devices } from '@playwright/test'

// Carrega .env.local (variáveis públicas) e .dev.vars (segredos, como a
// Service Role) no processo do Playwright — os specs falam direto com o
// Supabase pra criar/limpar dados de teste (ver e2e/helpers/test-users.ts).
// E2E_TARGET=staging: carrega .env.staging.local ANTES (loadEnvFile não
// sobrescreve variável já definida). Sem try/catch: arquivo ausente tem que
// falhar, nunca cair em produção sem avisar.
if (process.env.E2E_TARGET === 'staging') {
  process.loadEnvFile('.env.staging.local')
}

for (const file of ['.env.local', '.dev.vars']) {
  try {
    process.loadEnvFile(file)
  } catch {
    // arquivo ausente — segue com o que já estiver no ambiente (ex: CI)
  }
}

if (process.env.E2E_TARGET === 'staging' && process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('lvjahufllclmkqcbbrcu')) {
  throw new Error('E2E_TARGET=staging mas NEXT_PUBLIC_SUPABASE_URL aponta pra produção — abortando.')
}

// Camada 6 do plano de validação: E2E ponta a ponta contra o app real
// (npm run dev), não contra mocks. Não sobe o próprio servidor automaticamente
// (webServer) de propósito — os specs precisam de variáveis de ambiente reais
// (Supabase, Mercado Pago) já carregadas no processo que roda `next dev`, e
// isso é mais previsível deixando o desenvolvedor subir o servidor à parte
// (`npm run dev`) antes de rodar os testes.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // specs de corrida/estado compartilhado — mais seguro em série
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: process.env.TEST_APP_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
