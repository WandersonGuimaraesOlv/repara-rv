import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return phone
}

export function buildGoogleMapsUrl(lat?: number | null, lng?: number | null, address?: string): string {
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  }
  const query = address ? `${address}, Rio Verde - GO` : 'Rio Verde, GO'
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
}

export function buildWazeUrl(lat?: number | null, lng?: number | null, address?: string): string {
  if (lat && lng) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
  }
  const query = address ? `${address}, Rio Verde, GO` : 'Rio Verde, GO'
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    searching: 'Buscando prestador...',
    accepted: 'Prestador a caminho',
    on_the_way: 'Prestador a caminho',
    in_progress: 'Serviço em andamento',
    completed: 'Concluído',
    cancelled: 'Chamado cancelado',
    cancelled_by_client: 'Cancelado pelo cliente',
    cancelled_by_provider: 'Cancelado pelo prestador',
    no_providers_available: 'Nenhum prestador disponível',
  }
  return labels[status] ?? status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    searching: 'text-amber-400',
    accepted: 'text-blue-400',
    on_the_way: 'text-blue-400',
    in_progress: 'text-indigo-400',
    completed: 'text-emerald-400',
    cancelled: 'text-red-400',
    cancelled_by_client: 'text-red-400',
    cancelled_by_provider: 'text-red-400',
    no_providers_available: 'text-red-400',
  }
  return colors[status] ?? 'text-slate-400'
}

export function isEmergencySosActive(status: string): boolean {
  return ['accepted', 'on_the_way', 'in_progress'].includes(status)
}

export interface FormatEmergencyParams {
  callerName: string
  callerRole: 'client' | 'provider' | 'admin'
  callerPhone: string
  otherPartyName?: string | null
  otherPartyRole?: 'client' | 'provider' | 'admin'
  otherPartyPhone?: string | null
  serviceName: string
  address: string
  latitude?: number | null
  longitude?: number | null
  callId: string
  timestamp?: Date | string
}

export function formatEmergencyMessage(params: FormatEmergencyParams): string {
  const dateObj = params.timestamp ? new Date(params.timestamp) : new Date()
  const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const roleLabel = params.callerRole === 'client' ? 'Cliente' : 'Prestador'
  const otherRoleLabel = params.callerRole === 'client' ? 'Prestador no local' : 'Cliente no local'

  const mapsUrl = params.latitude !== null && params.latitude !== undefined && params.longitude !== null && params.longitude !== undefined
    ? `https://maps.google.com/?q=${params.latitude},${params.longitude}`
    : `https://maps.google.com/?q=${encodeURIComponent(params.address + ', Rio Verde - GO')}`

  return [
    '🚨 ALERTA SOS ACIONADO NO REPARA RV',
    `Quem acionou: ${roleLabel} ${params.callerName} (${formatPhone(params.callerPhone)})`,
    `${otherRoleLabel}: ${params.otherPartyName || 'Não informado'} (${params.otherPartyPhone ? formatPhone(params.otherPartyPhone) : 'Não informado'})`,
    `Serviço: ${params.serviceName}`,
    `Endereço: ${params.address}`,
    `Localização: ${mapsUrl}`,
    `Horário: ${timeStr}`,
    `Chamado: #${params.callId.slice(0, 8).toUpperCase()}`,
  ].join('\n')
}

