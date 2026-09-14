// =============================================================================
// app/api/push/register-token/route.ts
// Registra tokens FCM de apps Flutter (Android / iOS) na tabela device_tokens.
// Chamado pelo app Flutter após obter o token via firebase_messaging package.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const registerTokenSchema = z.object({
  token:    z.string().min(10, 'Token FCM inválido'),
  platform: z.enum(['android', 'ios']).refine(
    (v) => v === 'android' || v === 'ios',
    { message: 'Platform deve ser "android" ou "ios"' }
  ),
});

// POST: Registra ou atualiza token FCM do dispositivo Flutter
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
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const parsed = registerTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', issues: parsed.error.format() },
      { status: 422 }
    );
  }

  const { token, platform } = parsed.data;

  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        user_id:    user.id,
        token,
        platform,
        is_active:  true,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );

  if (error) {
    console.error('[push/register-token] upsert error:', error.message);
    return NextResponse.json({ error: 'Falha ao registrar token' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

// DELETE: Desregistra token ao fazer logout no app Flutter
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
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const parsed = z.object({ token: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 422 });
  }

  await supabase
    .from('device_tokens')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('token', parsed.data.token);

  return NextResponse.json({ success: true }, { status: 200 });
}
