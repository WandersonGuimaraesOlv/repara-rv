import { defineConfig } from 'vitest/config'
import path from 'node:path'

const dirname = import.meta.dirname

// Sem isso, o alias `@/` (usado em praticamente todo o código de app/lib/modules,
// mapeado em tsconfig.json como "@/*": ["./*"]) não resolve sob o Vitest — qualquer
// teste que importe (direta ou indiretamente) um arquivo com `@/algo` falha com
// "Cannot find package '@/algo'", mesmo que o próprio arquivo de teste use só
// imports relativos. Achado ao tentar testar modules/notifications/*, que importa
// @/lib/supabase/server internamente.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, '.'),
    },
  },
  test: {
    // e2e/ são specs do Playwright (npm run test:e2e), não do Vitest — sem
    // isso o Vitest tenta importar e2e/golden-path.spec.ts também, e falha
    // (usa a API do @playwright/test, não a do vitest).
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
