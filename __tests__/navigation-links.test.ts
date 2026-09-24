import { describe, it, expect } from 'vitest'
import { detectNavPlatform, navigationLink } from '../lib/navigation-links'

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36'
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1'
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Safari/605.1.15'
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'
const dest = { lat: -17.7943, lng: -50.9264 }

describe('detectNavPlatform', () => {
  it('reconhece Android, iPhone, iPad (que se apresenta como Mac) e computador', () => {
    expect(detectNavPlatform(ANDROID_UA)).toBe('android')
    expect(detectNavPlatform(IPHONE_UA)).toBe('ios')
    expect(detectNavPlatform(IPAD_UA, 5)).toBe('ios')
    expect(detectNavPlatform(IPAD_UA, 0)).toBe('other')
    expect(detectNavPlatform(DESKTOP_UA)).toBe('other')
  })
})

describe('navigationLink — abre o app instalado, com as coordenadas exatas', () => {
  it('Android + Waze: intent com o pacote do Waze e o site como plano B', () => {
    const { href, fallback } = navigationLink('waze', dest, 'android')
    expect(href).toBe(
      `intent://waze.com/ul?ll=-17.7943,-50.9264&navigate=yes#Intent;scheme=https;package=com.waze;S.browser_fallback_url=${encodeURIComponent('https://waze.com/ul?ll=-17.7943,-50.9264&navigate=yes')};end`
    )
    expect(fallback).toBeNull()
  })

  it('Android + Google Maps: intent com o pacote do Maps, já navegando de carro', () => {
    const { href } = navigationLink('google', dest, 'android')
    expect(href.startsWith('intent://www.google.com/maps/dir/?api=1&destination=-17.7943,-50.9264&travelmode=driving&dir_action=navigate#Intent;')).toBe(true)
    expect(href).toContain('scheme=https;package=com.google.android.apps.maps;')
    expect(href).toContain('S.browser_fallback_url=https%3A%2F%2Fwww.google.com%2Fmaps%2Fdir%2F')
    expect(href.endsWith(';end')).toBe(true)
  })

  it('iPhone: esquema do app, com o site como plano B', () => {
    expect(navigationLink('waze', dest, 'ios')).toEqual({
      href: 'waze://?ll=-17.7943,-50.9264&navigate=yes',
      fallback: 'https://waze.com/ul?ll=-17.7943,-50.9264&navigate=yes',
    })
    const google = navigationLink('google', dest, 'ios')
    expect(google.href).toBe('comgooglemaps://?daddr=-17.7943,-50.9264&directionsmode=driving')
    expect(google.fallback).toContain('dir_action=navigate')
  })

  it('computador: o site direto', () => {
    expect(navigationLink('waze', dest, 'other')).toEqual({ href: 'https://waze.com/ul?ll=-17.7943,-50.9264&navigate=yes', fallback: null })
  })
})
