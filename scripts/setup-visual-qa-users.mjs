#!/usr/bin/env node
// Cria cliente + prestador de teste reais (marcados [QA VISUAL]) pra validar
// visualmente o redesign verde-energia nas telas autenticadas via browser real.
// node --env-file=.env.local scripts/setup-visual-qa-users.mjs

import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PIN = '1234'
const runId = `QA VISUAL ${Date.now()}`

function makePhone(prefix) {
  return `${prefix}${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 10)}`
}

async function createClientUser() {
  const phone = makePhone('6299')
  const email = `${phone}@repararv.com`
  const { data, error } = await admin.auth.admin.createUser({ email, password: `pin_${PIN}`, email_confirm: true })
  if (error) throw error
  await admin.from('profiles').insert({
    id: data.user.id, role: 'client', full_name: `[${runId}] Cliente`, phone, cpf_or_cnpj: '', terms_accepted_at: new Date().toISOString(),
  })
  return { id: data.user.id, phone, pin: PIN }
}

async function createProviderUser() {
  const phone = makePhone('6298')
  const email = `${phone}@repararv.com`
  const { data, error } = await admin.auth.admin.createUser({ email, password: `pin_${PIN}`, email_confirm: true })
  if (error) throw error
  await admin.from('profiles').insert({
    id: data.user.id, role: 'provider', full_name: `[${runId}] Prestador`, phone, cpf_or_cnpj: '',
    terms_accepted_at: new Date().toISOString(), self_declaration_signed: true, pix_key: phone, pix_key_type: 'phone',
  })
  await admin.from('provider_status').insert({
    provider_id: data.user.id, is_online: true, recipient_gateway_id: `[${runId}] gw`, current_location: 'POINT(-50.9264 -17.7943)',
  })
  return { id: data.user.id, phone, pin: PIN }
}

const client = await createClientUser()
const provider = await createProviderUser()
const { data: svc } = await admin.from('quick_services').select('id, name').eq('is_active', true).limit(1).single()

console.log(JSON.stringify({ client, provider, service: svc }, null, 2))
