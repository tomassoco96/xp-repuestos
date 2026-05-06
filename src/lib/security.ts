/**
 * Helpers de seguridad — usados por todos los endpoints API.
 *
 * Reglas mínimas que cumplimos en cada endpoint:
 *  - Rate limit por IP (in-memory, suficiente para Vercel serverless).
 *  - Origin check para evitar CSRF de otros dominios.
 *  - HMAC validation para webhooks de MP.
 *  - Idempotencia in-memory para no procesar el mismo payment dos veces.
 */

import crypto from 'node:crypto';

// ---------- Rate limit (in-memory, por IP) ----------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  ip: string,
  options: { max?: number; windowMs?: number } = {},
): { ok: boolean; retryAfter: number } {
  const max = options.max ?? 10;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();

  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (bucket.count >= max) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

// ---------- Origin check ----------

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Lista de hosts aceptados:
  //  - PUBLIC_SITE_URL (si está configurada).
  //  - Host del propio request (cuando viene a través del proxy de Vercel).
  //  - Host del header `host` (suele coincidir con el alias público).
  //  - x-forwarded-host (cuando el adapter rewrite la URL al pathname interno).
  const allowed = new Set<string>();
  try {
    const env = import.meta.env.PUBLIC_SITE_URL;
    if (env) allowed.add(new URL(env).host);
  } catch {}
  try {
    allowed.add(new URL(request.url).host);
  } catch {}
  const hostHeader = request.headers.get('host');
  if (hostHeader) allowed.add(hostHeader);
  const xfHost = request.headers.get('x-forwarded-host');
  if (xfHost) allowed.add(xfHost);

  if (allowed.size === 0) return false;

  try {
    if (origin) {
      const originHost = new URL(origin).host;
      if (allowed.has(originHost)) return true;
    }
    if (referer) {
      const refererHost = new URL(referer).host;
      if (allowed.has(refererHost)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------- Idempotencia (in-memory LRU básico) ----------
// Vercel serverless es efímero, así que esto solo deduplica reintentos rápidos
// dentro de la misma instancia warm. Para deduplicar across cold starts se
// requiere DB; para webhooks de MP la deduplicación adicional la hacemos
// re-consultando el payment en MP API (idempotencia natural).

const seenPayments = new Set<string>();
const seenMaxSize = 1000;

export function markPaymentSeen(paymentId: string): boolean {
  if (seenPayments.has(paymentId)) return false; // ya visto
  if (seenPayments.size >= seenMaxSize) {
    const first = seenPayments.values().next().value;
    if (first) seenPayments.delete(first);
  }
  seenPayments.add(paymentId);
  return true;
}

// ---------- HMAC validation MP webhook ----------
//
// MP firma el webhook con HMAC-SHA256.
// Headers que envía:
//   x-signature: ts=1234567890,v1=abc123...
//   x-request-id: 12345
//
// Cómo se calcula la firma:
//   manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
//   hmac = HMAC_SHA256(MP_WEBHOOK_SECRET, manifest).toString('hex')
//
// Referencia: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#firma-secreta

export function verifyMpWebhook(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
  toleranceSec?: number;
}): { valid: boolean; reason?: string } {
  const { xSignature, xRequestId, dataId, secret, toleranceSec = 600 } = params;
  if (!xSignature || !xRequestId || !secret) {
    return { valid: false, reason: 'missing-headers' };
  }

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k?.trim() ?? '', v?.trim() ?? ''] as const;
    }),
  );

  const ts = parts.ts;
  const expected = parts.v1;
  if (!ts || !expected) return { valid: false, reason: 'malformed-signature' };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { valid: false, reason: 'invalid-ts' };

  // Replay attack protection: el timestamp no puede ser muy viejo.
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Math.floor(tsNum / 1000));
  if (ageSec > toleranceSec) return { valid: false, reason: 'stale' };

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Comparación constant-time.
  if (computed.length !== expected.length) {
    return { valid: false, reason: 'mismatch' };
  }
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'mismatch' };
  }

  return { valid: true };
}

// ---------- Generación segura de external_reference ----------

export function generateExternalReference(): string {
  // 16 bytes random + timestamp para que sea ordenable.
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(8).toString('hex');
  return `xp-${ts}-${rand}`;
}

// ---------- Sanitization helpers ----------

export function safeString(value: unknown, max = 200): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}
