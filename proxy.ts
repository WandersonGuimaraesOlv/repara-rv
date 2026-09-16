// =============================================================================
// proxy.ts — Middleware de Proxy OpenNext (Cloudflare Workers)
// Equivalente ao middleware.ts do Next.js padrão, porém para @opennextjs/cloudflare.
// Responsabilidades:
//   1. Rate Limiting por IP (criação de chamados, aceite, auth)
//   2. Proteção de rotas internas (cron/push/send)
//   3. Atualização de sessão Supabase SSR
// =============================================================================

import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest, NextResponse } from 'next/server';

// ─── Store de Rate Limiting (in-memory por instância do Worker) ─────────────
// Adequado para single-region. Para multi-region: migrar para Cloudflare KV.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now   = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Limpeza periódica (~1% das requisições para não impactar latência)
function maybeCleanup(): void {
  if (Math.random() > 0.01) return;
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  maybeCleanup();

  const ip   = request.headers.get('cf-connecting-ip')
             || request.headers.get('x-forwarded-for')
             || '127.0.0.1';
  const path = request.nextUrl.pathname;

  // ── Rate Limit: Criação de chamados (5 req / 10 min por IP) ───────────────
  if (path.startsWith('/api/calls/create')) {
    if (!checkRateLimit(`call_create:${ip}`, 5, 600)) {
      return NextResponse.json(
        { error: 'Muitas solicitações consecutivas. Aguarde alguns minutos.' },
        { status: 429, headers: { 'Retry-After': '600', 'X-RateLimit-Limit': '5' } }
      );
    }
  }

  // ── Rate Limit: Aceite de chamados (1 req / s por IP — anti-bot) ──────────
  if (path.startsWith('/api/calls/claim-queued')) {
    if (!checkRateLimit(`claim:${ip}`, 1, 1)) {
      return NextResponse.json(
        { error: 'Requisições muito frequentes. Aguarde 1 segundo.' },
        { status: 429, headers: { 'Retry-After': '1' } }
      );
    }
  }

  // ── Rate Limit: Confirmação de PIN de chegada (5 req / min por IP) ────────
  // Achado de auditoria (16/09/2026): sem isso, a verificação server-side do
  // PIN de 4 dígitos (10.000 combinações) podia ser testada às cegas sem
  // limite nenhum.
  if (path.startsWith('/api/calls/verify-arrival-pin')) {
    if (!checkRateLimit(`arrival-pin:${ip}`, 5, 60)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde 1 minuto.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  // ── Rate Limit: Autenticação / OTP (3 req / min por IP) ───────────────────
  if (path.startsWith('/api/auth') || path.includes('/auth/v1/otp')) {
    if (!checkRateLimit(`auth:${ip}`, 3, 60)) {
      return NextResponse.json(
        { error: 'Muitas tentativas de autenticação. Aguarde 1 minuto.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  // ── Rotas Internas: bloqueia acesso sem header de autorização ─────────────
  if (path.startsWith('/api/cron/') || path.startsWith('/api/push/send')) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Rota interna' }, { status: 403 });
    }
  }

  // Delega para o middleware de sessão Supabase SSR
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|js)$).*)',
  ],
};

