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
