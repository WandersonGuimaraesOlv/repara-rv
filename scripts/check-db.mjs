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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
  const { data: calls } = await supabase.from('service_calls').select('*').order('created_at', { ascending: false }).limit(5)
  console.log('Recent calls:', JSON.stringify(calls, null, 2))
  const { data: providers } = await supabase.from('provider_status').select('*')
  console.log('Provider status:', JSON.stringify(providers, null, 2))
  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5)
  console.log('Recent profiles:', JSON.stringify(profiles, null, 2))
}

test()
