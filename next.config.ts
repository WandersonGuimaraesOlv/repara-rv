import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Silence the turbopack warning (next-pwa uses webpack internally in dev)
  turbopack: {},
  // Disable PWA plugin in this config - service worker is handled manually
}

export default nextConfig
