/**
 * POST /api/checkout/create-preference
 *
 * Crea una preference de Mercado Pago a partir de un carrito enviado por
 * el cliente. Devuelve `init_point` para redirect.
 *
 * Garantías de seguridad:
 *  - Rate limit por IP (10 req/min).
 *  - Origin / Referer check (anti-CSRF cross-domain).
 *  - Validación Zod de body.
 *  - Recálculo de total server-side (NUNCA confiamos en precios del cliente).
 *  - Stock check.
 *  - external_reference random no adivinable.
 *  - Access Token solo server-side, nunca devuelto al cliente.
 */

import type { APIRoute } from 'astro';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { CreatePreferenceSchema } from '@/lib/schemas';
import { resolveCart } from '@/lib/pricing';
import {
  rateLimit,
  getClientIp,
  isSameOrigin,
  generateExternalReference,
  safeString,
  redactSecrets,
} from '@/lib/security';

export const prerender = false;

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export const POST: APIRoute = async ({ request }) => {
  // 1. Rate limit per IP. 5/min es suficiente para usuarios reales y reduce
  //    abuse desde una sola IP (security review SR MEDIUM-1).
  const ip = getClientIp(request);
  const limit = rateLimit(ip, { max: 5, windowMs: 60_000 });
  if (!limit.ok) {
    return json({ error: 'Demasiados intentos. Probá en un minuto.' }, 429, {
      'Retry-After': String(limit.retryAfter),
    });
  }

  // 2. Origin / Referer check.
  if (!isSameOrigin(request)) {
    return json({ error: 'Origen no autorizado.' }, 403);
  }

  // 3. Parse JSON.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  // 4. Validar con Zod.
  const parsed = CreatePreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: 'Datos del formulario inválidos.', details: parsed.error.flatten() },
      400,
    );
  }

  // 5. Recalcular total server-side desde products.json autoritativo.
  //    NUNCA confiamos en los precios que vengan del cliente.
  const { cart, errors } = resolveCart(parsed.data.items);
  if (!cart) {
    return json({ error: errors.join('. ') || 'Carrito inválido.' }, 400);
  }

  // 6. Validar configuración server.
  const accessToken = import.meta.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    // Modo demo: el resto de la pasarela está armado pero no hay credenciales
    // todavía. Devolvemos una respuesta clara para que el frontend muestre un
    // mensaje útil en lugar de un error rojo.
    console.warn('create-preference: MP_ACCESS_TOKEN no configurado — modo demo');
    return json(
      {
        demo: true,
        error:
          'La pasarela todavía está en modo demo. Cuando se carguen las credenciales de Mercado Pago en Vercel, este endpoint redirige al cliente al checkout real.',
        cartPreview: {
          items: cart.items.map((it) => ({
            slug: it.product.slug,
            nombre: it.product.nombre,
            qty: it.qty,
            unitPrice: it.unitPrice,
            subtotal: it.subtotal,
          })),
          total: cart.total,
        },
      },
      503,
    );
  }

  // 7. Crear preference en MP.
  const externalRef = generateExternalReference();
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;

  try {
    const client = new MercadoPagoConfig({
      accessToken,
      options: {
        timeout: 8000,
        idempotencyKey: externalRef,
      },
    });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: cart.items.map((it) => ({
          id: it.product.slug,
          title: it.product.nombre.slice(0, 256),
          quantity: it.qty,
          unit_price: it.unitPrice,
          currency_id: 'ARS',
          picture_url: it.product.imagen,
        })),
        payer: {
          name: parsed.data.buyer.nombre.slice(0, 80),
          surname: parsed.data.buyer.apellido.slice(0, 80),
          email: parsed.data.buyer.email,
          phone: { number: parsed.data.buyer.telefono.slice(0, 20) },
          address: {
            street_name: parsed.data.buyer.direccion.slice(0, 120),
            zip_code: parsed.data.buyer.codigoPostal,
          },
        },
        external_reference: externalRef,
        statement_descriptor: 'XP Repuestos',
        back_urls: {
          success: `${siteUrl}/pago/success?ref=${encodeURIComponent(externalRef)}`,
          pending: `${siteUrl}/pago/pending?ref=${encodeURIComponent(externalRef)}`,
          failure: `${siteUrl}/pago/failure?ref=${encodeURIComponent(externalRef)}`,
        },
        auto_return: 'approved',
        notification_url: `${siteUrl}/api/checkout/mp-webhook`,
        binary_mode: false,
        metadata: {
          buyer_dni: safeString(parsed.data.buyer.dni, 11),
          buyer_city: safeString(parsed.data.buyer.ciudad, 80),
          buyer_province: safeString(parsed.data.buyer.provincia, 80),
          buyer_address: safeString(parsed.data.buyer.direccion, 120),
          buyer_notes: safeString(parsed.data.buyer.notas, 500),
          subtotal: cart.subtotal,
          total: cart.total,
          source: 'xp-web-checkout',
        },
      },
    });

    if (!result.init_point || !result.id) {
      throw new Error('MP no devolvió init_point');
    }

    // Log estructurado SIN secretos — útil para debugging en Vercel.
    console.log(
      JSON.stringify({
        type: 'preference_created',
        ref: externalRef,
        pref_id: result.id,
        total: cart.total,
        item_count: cart.items.length,
      }),
    );

    return json({
      preferenceId: result.id,
      initPoint: result.init_point,
      externalReference: externalRef,
    });
  } catch (err) {
    // No exponer detalles del error al cliente. Redactar tokens del log.
    console.error('preference_create_failed', {
      ref: externalRef,
      err: redactSecrets(err instanceof Error ? err.message : err),
    });
    return json(
      { error: 'No pudimos iniciar el pago. Intentá de nuevo en un momento.' },
      502,
    );
  }
};
