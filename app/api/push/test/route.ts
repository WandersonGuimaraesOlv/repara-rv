// =============================================================================
// app/api/push/test/route.ts
// Botão "Testar notificação" do painel: manda UMA notificação de teste pros
// aparelhos inscritos do PRÓPRIO usuário logado (nunca pra outro id) — é como o
// prestador confirma, no aparelho dele, que os avisos de chamado vão chegar.
// =============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyProvider, buildNotificationEnv } from '@/modules/notifications';

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const result = await notifyProvider(
    user.id,
    {
      title: '✅ Notificações ativas',
      body:  'Se você está vendo isto, os avisos de novos chamados vão chegar neste aparelho.',
      url:   '/painel',
    },
    buildNotificationEnv()
  );

  // sent=0 e removed=0 significa que não há aparelho inscrito (ou o envio falhou)
  return NextResponse.json({ success: result.sent > 0, result }, { status: 200 });
}
