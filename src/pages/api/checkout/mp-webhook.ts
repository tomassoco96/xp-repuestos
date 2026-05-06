/**
 * POST /api/checkout/mp-webhook
 *
 * Webhook que recibe Mercado Pago cuando hay un evento de pago.
 *
 * Garantías de seguridad:
 *  - Verifica HMAC `x-signature` con el secret configurado en MP.
 *  - Rechaza timestamps viejos (anti-replay, tolerancia 600s).
 *  - Idempotencia por payment.id (no procesar dos veces).
 *  - Re-consulta el payment a la API de MP usando el id, NO confía en payload.
 *  - Solo procesa eventos `type=payment` (ignora merchant_order, etc.).
 *  - Devuelve 200 incluso ante eventos ignorados (para que MP no reintente).
 *  - Devuelve 200 incluso ante errores de email (el cobro ya pasó).
 */

import type { APIRoute } from 'astro';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { verifyMpWebhook, markPaymentSeen, redactSecrets } from '@/lib/security';
import { sendOrderEmails, sendPaymentFailedEmail } from '@/lib/emails';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const accessToken = import.meta.env.MP_ACCESS_TOKEN;
  const webhookSecret = import.meta.env.MP_WEBHOOK_SECRET;

  if (!accessToken || !webhookSecret) {
    console.error('mp_webhook: env no configurado');
    return new Response('misconfigured', { status: 503 });
  }

  // Parse body. MP a veces manda query params en la URL — chequeamos ambos.
  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const url = new URL(request.url);
  const queryType = url.searchParams.get('type');
  const queryDataId = url.searchParams.get('data.id');

  const eventType = String(payload.type ?? payload.topic ?? queryType ?? '');
  const data = (payload.data ?? {}) as { id?: string };
  const dataId = String(data.id ?? queryDataId ?? payload.resource ?? '');

  // Solo procesamos pagos. Los merchant_order y otros se aceptan silenciosamente.
  if (eventType !== 'payment') {
    return new Response('ignored', { status: 200 });
  }
  if (!dataId) {
    return new Response('missing data.id', { status: 400 });
  }

  // Validar firma HMAC.
  const verification = verifyMpWebhook({
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    dataId,
    secret: webhookSecret,
  });

  if (!verification.valid) {
    console.warn('mp_webhook_invalid_signature', { reason: verification.reason });
    return new Response('invalid signature', { status: 401 });
  }

  // Idempotencia: si ya procesamos este payment.id en esta instancia, salir.
  if (!markPaymentSeen(dataId)) {
    return new Response('duplicate', { status: 200 });
  }

  // Re-consultar payment a la API de MP — NUNCA confiar en el payload del webhook.
  try {
    const client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 8000 },
    });
    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: dataId });

    if (!payment) {
      return new Response('payment not found', { status: 404 });
    }

    const status = payment.status;
    const externalRef = payment.external_reference;

    console.log(
      JSON.stringify({
        type: 'payment_received',
        payment_id: payment.id,
        status,
        ref: externalRef,
        amount: payment.transaction_amount,
      }),
    );

    if (status === 'approved') {
      // Email a comprador y a admin. Si falla, no rompemos el webhook.
      try {
        await sendOrderEmails(payment);
      } catch (mailErr) {
        console.error('emails_threw', {
          err: redactSecrets(mailErr instanceof Error ? mailErr.message : mailErr),
        });
      }
    } else if (status === 'rejected' || status === 'cancelled') {
      // Avisar al cliente que el pago no se acreditó (SR MEDIUM-2).
      // Especialmente útil si pagó con Rapipago y no llegó a tiempo.
      try {
        await sendPaymentFailedEmail(payment);
      } catch (mailErr) {
        console.error('failed_email_threw', {
          err: redactSecrets(mailErr instanceof Error ? mailErr.message : mailErr),
        });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    // Si la consulta a MP falla, devolvemos 500 para que MP reintente.
    console.error('mp_webhook_lookup_failed', {
      payment_id: dataId,
      err: redactSecrets(err instanceof Error ? err.message : err),
    });
    return new Response('error', { status: 500 });
  }
};

// MP puede enviar GET de prueba al guardar la URL en el panel — devolvemos
// 200 sin body para no exponer información (SR LOW-2).
export const GET: APIRoute = async () => {
  return new Response(null, { status: 200 });
};
