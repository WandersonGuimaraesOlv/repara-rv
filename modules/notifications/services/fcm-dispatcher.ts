// =============================================================================
// modules/notifications/services/fcm-dispatcher.ts
// Disparo de notificações FCM (Firebase Cloud Messaging) para apps Flutter.
// Usa FCM HTTP v1 API via fetch() nativo — zero dependências Node.js.
// Requer: FIREBASE_SERVICE_ACCOUNT_JSON nas variáveis de ambiente.
// =============================================================================

export interface FCMPayload {
  title:   string;
  body:    string;
  url:     string;
  callId?: string;
}

export interface FCMEnv {
  FIREBASE_SERVICE_ACCOUNT_JSON: string; // JSON serializado da service account
}

export interface FCMResult {
  success:      boolean;
  shouldRemove: boolean; // true = token inválido/expirado, remover do banco
}

// Obtém access token OAuth2 para a FCM HTTP v1 API usando Web Crypto
async function getFCMAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key:  string;
    project_id:   string;
  };

  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Importa chave privada RSA da service account
  const pemBody    = serviceAccount.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const keyBuffer  = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0)).buffer;

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${signingInput}.${signature}`;

  // Troca o JWT pelo access token OAuth2
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`FCM OAuth2 falhou: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json() as { access_token: string };
  return tokenData.access_token;
}

// Envia notificação FCM para um único token Flutter (Android ou iOS)
export async function sendFCM(
  fcmToken: string,
  payload:  FCMPayload,
  env:      FCMEnv
): Promise<FCMResult> {
  // FCM não está configurado — não bloqueante, apenas loga e retorna
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.warn('[fcm-dispatcher] FIREBASE_SERVICE_ACCOUNT_JSON não configurado — skip FCM');
    return { success: false, shouldRemove: false };
  }

  try {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as {
      project_id: string;
    };

    const accessToken = await getFCMAccessToken(env.FIREBASE_SERVICE_ACCOUNT_JSON);

    const fcmMessage = {
      message: {
        token: fcmToken,
        notification: {
          title: payload.title,
          body:  payload.body,
        },
        data: {
          url:    payload.url,
          callId: payload.callId ?? '',
        },
        android: {
          priority: 'high',
          notification: { sound: 'default', channel_id: 'chamados' },
        },
        apns: {
          payload: {
            aps: {
              alert: { title: payload.title, body: payload.body },
              sound: 'default',
              badge: 1,
            },
          },
        },
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmMessage),
      }
    );

    if (response.status === 404) {
      // Token não encontrado — dispositivo desinstalou o app
      return { success: false, shouldRemove: true };
    }

    if (!response.ok) {
      const body = await response.text();
      console.error('[fcm-dispatcher] FCM HTTP error:', response.status, body);
      return { success: false, shouldRemove: false };
    }

    return { success: true, shouldRemove: false };
  } catch (error) {
    console.error('[fcm-dispatcher] sendFCM error:', error);
    return { success: false, shouldRemove: false };
  }
}
