import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '')
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const SERVICES = [
  // Elétrica
  { name: 'Troca de Chuveiro / Resistência', category: 'Elétrica', fixed_price: 70.00, platform_fee: 12.00, icon: 'ShowerHead', is_active: true },
  { name: 'Troca de Tomada / Interruptor / Lâmpada', category: 'Elétrica', fixed_price: 50.00, platform_fee: 12.00, icon: 'Plug', is_active: true },
  { name: 'Instalação de Ventilador de Teto', category: 'Elétrica', fixed_price: 120.00, platform_fee: 12.00, icon: 'Fan', is_active: true },
  { name: 'Instalação de Plafon / Painel LED', category: 'Elétrica', fixed_price: 60.00, platform_fee: 12.00, icon: 'Lightbulb', is_active: true },

  // Hidráulica
  { name: 'Troca de Torneira / Sifão de Pia', category: 'Hidráulica', fixed_price: 60.00, platform_fee: 12.00, icon: 'Droplet', is_active: true },
  { name: 'Desentupimento de Ralo / Vaso Sanitário', category: 'Hidráulica', fixed_price: 100.00, platform_fee: 12.00, icon: 'Pipette', is_active: true },
  { name: 'Reparo de Caixa Acoplada', category: 'Hidráulica', fixed_price: 70.00, platform_fee: 12.00, icon: 'Wrench', is_active: true },
  { name: 'Vedação de Box / Pia com Silicone', category: 'Hidráulica', fixed_price: 60.00, platform_fee: 12.00, icon: 'ShieldCheck', is_active: true },

  // Montagem & Fixação
  { name: 'Fixação de Suporte de TV / Cortina / Quadro', category: 'Montagem', fixed_price: 70.00, platform_fee: 12.00, icon: 'Tv', is_active: true },
  { name: 'Montagem / Desmontagem Móvel Pequeno', category: 'Montagem', fixed_price: 90.00, platform_fee: 12.00, icon: 'Hammer', is_active: true },
  { name: 'Instalação de Varal de Teto / Parede', category: 'Montagem', fixed_price: 80.00, platform_fee: 12.00, icon: 'Shirt', is_active: true },
  { name: 'Regulagem de Dobradiças e Gavetas', category: 'Montagem', fixed_price: 60.00, platform_fee: 12.00, icon: 'Settings2', is_active: true },

  // Chaveiro & Segurança
  { name: 'Abertura de Porta (Bateu-Fechou)', category: 'Chaveiro', fixed_price: 100.00, platform_fee: 12.00, icon: 'Key', is_active: true },
  { name: 'Troca de Fechadura / Miolo de Porta', category: 'Chaveiro', fixed_price: 80.00, platform_fee: 12.00, icon: 'Lock', is_active: true },

  // Eletro & Cozinha
  { name: 'Instalação de Máquina de Lavar', category: 'Instalação', fixed_price: 70.00, platform_fee: 12.00, icon: 'WashingMachine', is_active: true },
  { name: 'Troca de Mangueira e Registro de Gás', category: 'Instalação', fixed_price: 50.00, platform_fee: 12.00, icon: 'Flame', is_active: true },
]

async function runSeed() {
  console.log('Seeding quick_services table in Supabase...')

  // Limpa registros anteriores
  const { error: deleteError } = await supabase
    .from('quick_services')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (deleteError) {
    console.warn('Delete warning:', deleteError.message)
  }

  // Insere os 16 novos serviços
  const { data, error: insertError } = await supabase
    .from('quick_services')
    .insert(SERVICES)
    .select()

  if (insertError) {
    console.error('Insert error:', insertError)
    process.exit(1)
  }

  console.log(`Success! Inserted ${data.length} services into quick_services.`)
  process.exit(0)
}

runSeed()
