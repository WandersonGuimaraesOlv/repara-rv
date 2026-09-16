import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { PwaInstallProvider } from '@/components/pwa-install-provider'

export const viewport: Viewport = {
  themeColor: '#0d1716',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    default: 'Repara RV — Serviços Residenciais em Rio Verde',
    template: '%s | Repara RV',
  },
  description:
    'Deu problema em casa? O Repara RV resolve. Eletricistas, encanadores e montadores com preço fixo e atendimento imediato em Rio Verde (GO).',
  keywords: ['serviços residenciais', 'Rio Verde', 'eletricista', 'encanador', 'reparo', 'manutenção'],
  authors: [{ name: 'Repara RV' }],
  creator: 'Repara RV',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: 'Repara RV',
    title: 'Repara RV — Serviços Residenciais em Rio Verde',
    description: 'Deu problema em casa? O Repara RV resolve.',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Repara RV',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="shortcut icon" href="/icons/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* Achado em produção (15/09/2026): o script "sem-flash" que o next-themes
            injeta via Function.prototype.toString() sai do bundle do OpenNext
            Cloudflare com uma chamada __name(...) órfã (artefato do keepNames do
            esbuild ao processar o pacote) — lança ReferenceError no navegador e o
            script original nunca chega a aplicar a classe de tema antes da
            hidratação. Não existe flag no next-themes pra desativar essa injeção
            (só nonce/scriptProps), então replicamos a mesma lógica aqui como script
            literal (nunca passa pela serialização de função que quebra) — evita o
            flash de tema errado independente do script do next-themes falhar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(){try{var t=localStorage.getItem('theme')||'dark';var d=document.documentElement;d.classList.remove('light','dark');d.classList.add(t);if(t==='light'||t==='dark')d.style.colorScheme=t}catch(e){}}()`,
          }}
        />
      </head>
      <body style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <PwaInstallProvider>
            {children}
          </PwaInstallProvider>
          <Toaster
            position="top-center"
            richColors
            toastOptions={{
              style: {
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                fontFamily: 'Inter, sans-serif',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
