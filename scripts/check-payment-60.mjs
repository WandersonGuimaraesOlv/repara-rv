import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envContent = ['../.env.local', '../.dev.vars'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf-8')).join('\n')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '')
  }
}

async function checkPayment60() {
  const paymentId = '178579094064'
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` }
  })
  const data = await res.json()
  console.log('ID:', data.id)
  console.log('Status:', data.status)
  console.log('Transaction amount:', data.transaction_amount)
  console.log('Net received amount:', data.transaction_details?.net_received_amount)
  console.log('Total paid amount:', data.transaction_details?.total_paid_amount)
  console.log('Application fee:', data.application_fee)
  console.log('Fee details:', data.fee_details)
  console.log('Collector ID:', data.collector_id)
  console.log('Payer:', data.payer?.first_name, data.payer?.email)
}

checkPayment60().catch(console.error)
