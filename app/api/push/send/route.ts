// =============================================================================
// app/api/push/send/route.ts
// Rota interna para disparar notificações push para prestadores online.
// Autenticada por CRON_SECRET_TOKEN — nunca exposta ao cliente.
// Chamada pelo workers/cron-monitor.ts ou pelo queue-consumer.ts.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { notifyProviderBatch } from '@/modules/notifications';
import type { NotificationEnv } from '@/modules/notifications';

const sendPushSchema = z.object({
  providerIds: z.array(z.string().uuid()).min(1, 'Pelo menos um provider_id é necessário'),
  payload: z.object({
    title:   z.string().min(1),
    body:    z.string().min(1),
    url:     z.string().url(),
    callId:  z.string().uuid().optional(),
  }),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Autenticação por token secreto — rota interna apenas
  const authHeader = req.headers.get('Authorization');
  const cronToken  = process.env.CRON_SECRET_TOKEN;

  if (!cronToken || authHeader !== `Bearer ${cronToken}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const parsed = sendPushSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido', issues: parsed.error.format() },
      { status: 422 }
    );
  }

  const env: NotificationEnv = {
    VAPID_PUBLIC_KEY:              process.env.VAPID_PUBLIC_KEY              ?? '',
    VAPID_PRIVATE_KEY:             process.env.VAPID_PRIVATE_KEY             ?? '',
    VAPID_SUBJECT:                 process.env.VAPID_SUBJECT                 ?? 'mailto:contato@repararv.com',
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
  };

  const result = await notifyProviderBatch(
    parsed.data.providerIds,
    parsed.data.payload,
    env
  );

  return NextResponse.json({ success: true, result }, { status: 200 });
}
