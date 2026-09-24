// =============================================================================
// lib/navigation-links.ts
// Link do botão "Waze" / "Google Maps" da tela do chamado do técnico — abrindo
// o APP instalado, não o site (pedido do dono, 24/09/2026). Antes era um link
// comum com target="_blank": no app instalado (PWA) isso abre uma aba de
// navegador em vez do Waze/Maps. Sempre com as coordenadas exatas do chamado.
//
// - Android: intent:// com o pacote do app. O sistema abre o app instalado;
//   sem o app, o próprio Chrome vai pro browser_fallback_url (o site).
// - iPhone: o esquema do app (waze:// / comgooglemaps://). Sem o app nada
//   acontece — quem chama tenta o site depois de 1,5 s se a página continuar
//   visível (fallback).
// - Computador: o site, em outra aba.
// =============================================================================

import { buildGoogleMapsUrl, buildWazeUrl } from '@/lib/utils'

export type NavApp = 'waze' | 'google'
export type NavPlatform = 'android' | 'ios' | 'other'

const ANDROID_PACKAGE: Record<NavApp, string> = {
  waze: 'com.waze',
  google: 'com.google.android.apps.maps',
}

export function detectNavPlatform(userAgent: string, maxTouchPoints = 0): NavPlatform {
  if (/android/i.test(userAgent)) return 'android'
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  // iPad com iPadOS se apresenta como Mac, mas tem tela de toque
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios'
  return 'other'
}

export interface NavigationLink {
  href: string
  // Pra onde ir se o app não abrir (só iPhone; no Android o Chrome resolve)
  fallback: string | null
}

export function navigationLink(app: NavApp, dest: { lat: number; lng: number }, platform: NavPlatform): NavigationLink {
  const web = app === 'google' ? buildGoogleMapsUrl(dest.lat, dest.lng) : buildWazeUrl(dest.lat, dest.lng)
  const coords = `${dest.lat},${dest.lng}`

  if (platform === 'android') {
    const target = web.replace(/^https:\/\//, '')
    return {
      href: `intent://${target}#Intent;scheme=https;package=${ANDROID_PACKAGE[app]};S.browser_fallback_url=${encodeURIComponent(web)};end`,
      fallback: null,
    }
  }

  if (platform === 'ios') {
    return {
      href: app === 'google'
        ? `comgooglemaps://?daddr=${coords}&directionsmode=driving`
        : `waze://?ll=${coords}&navigate=yes`,
      fallback: web,
    }
  }

  return { href: web, fallback: null }
}
