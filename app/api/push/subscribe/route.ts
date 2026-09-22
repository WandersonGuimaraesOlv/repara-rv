// =============================================================================
// app/api/push/subscribe/route.ts
// Registra/remove subscrições Web Push VAPID do PWA.
// Usado pelo service worker registration no cliente.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const subscribeSchema = z.object({
  endpoint: z.string().url('Endpoint inválido'),
  p256dh:   z.string().min(1, 'p256dh obrigatório'),
  auth:     z.string().min(1, 'auth obrigatório'),
  deviceType: z.string().optional(),
});

// POST: Registra subscrição Web Push (upsert por endpoint único)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', issues: parsed.error.format() },
      { status: 422 }
    );
  }

  const { endpoint, p256dh, auth, deviceType } = parsed.data;

  // O usuário já foi autenticado acima. As escritas usam a Service Role porque a
  // RLS deixa cada um mexer só nas próprias linhas, e um aparelho que antes
  // estava inscrito por OUTRA conta (celular compartilhado, ou a conta antiga
  // foi trocada) precisa passar a pertencer a quem está logado agora — senão o
  // upsert por endpoint falha e os avisos da conta anterior continuam chegando
  // nesse aparelho. O endpoint é uma URL secreta do próprio aparelho.
  const admin = await createServiceClient();

  const { error } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        user_id:     user.id,
        endpoint,
        p256dh,
        auth,
        device_type: deviceType ?? null,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('[push/subscribe] upsert error:', error.message);
    return NextResponse.json({ error: 'Falha ao registrar subscrição' }, { status: 500 });
  }

  // Também registra em device_tokens para o unified-dispatcher. Sem essa linha
  // o dispatcher nunca enxerga o aparelho — então uma falha aqui NÃO pode virar
  // "ativado" na tela do usuário.
  // Outros usuários que tinham este mesmo aparelho deixam de receber nele.
  await admin
    .from('device_tokens')
    .update({ is_active: false })
    .eq('token', endpoint)
    .neq('user_id', user.id);

  const { error: tokenError } = await admin
    .from('device_tokens')
    .upsert(
      { user_id: user.id, token: endpoint, platform: 'web', is_active: true },
      { onConflict: 'user_id,token' }
    );

  if (tokenError) {
    console.error('[push/subscribe] device_tokens upsert error:', tokenError.message);
    return NextResponse.json({ error: 'Falha ao registrar subscrição' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

// DELETE: Remove subscrição por endpoint (chamado quando usuário revoga permissão)
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const parsed = z.object({ endpoint: z.string().url() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Endpoint inválido' }, { status: 422 });
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', parsed.data.endpoint);

  await supabase
    .from('device_tokens')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('token', parsed.data.endpoint);

  return NextResponse.json({ success: true }, { status: 200 });
}
