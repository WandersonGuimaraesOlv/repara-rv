// Sobe o `next dev` com os SEGREDOS do .dev.vars já no ambiente.
//
// Desde que os segredos saíram do .env.local (pra não irem embutidos no bundle do
// Worker no deploy), o Next em modo dev não os enxerga sozinho — as rotas de API
// recebiam SUPABASE_SERVICE_ROLE_KEY vazia ("supabaseKey is required"). Não dá pra
// usar `node --env-file=.dev.vars ... next dev`: o Next repassa as flags do Node pros
// processos filhos e o Node recusa `--env-file` em NODE_OPTIONS.
import { createRequire } from 'node:module'
import path from 'node:path'

process.loadEnvFile('.dev.vars')

const require = createRequire(import.meta.url)
const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next')

process.argv = [process.argv[0], nextBin, 'dev', ...process.argv.slice(2)]
require(nextBin)
