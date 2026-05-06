# Seguridad — XP Repuestos ecommerce

Este documento describe las defensas implementadas en la pasarela de pago, dónde están en el código, y el checklist obligatorio antes de poner credenciales productivas de Mercado Pago.

## Modelo de amenazas — qué intentamos prevenir

| Amenaza | Defensa |
|---|---|
| Cliente edita el precio en el cliente para pagar menos | **Recálculo server-side** en [pricing.ts](src/lib/pricing.ts) — el cliente solo manda `{slug, qty}`, los precios se leen siempre de `products.json` |
| Cliente envía un slug que no existe / sin stock | Validación en `resolveCart()` |
| Atacante hace miles de requests para crear preferencias | Rate limit por IP (10 req/min) en [security.ts](src/lib/security.ts) |
| CSRF desde un dominio externo | `Origin` / `Referer` check en cada endpoint |
| Inyecciones / payloads malformados | Validación Zod en [schemas.ts](src/lib/schemas.ts) |
| Atacante fakea un webhook "pago aprobado" | **HMAC-SHA256** validation con `MP_WEBHOOK_SECRET` ([security.ts → verifyMpWebhook](src/lib/security.ts)) |
| Replay del webhook de MP | Tolerancia de 600s en el timestamp + idempotencia in-memory |
| Webhook duplicado (MP reintenta) | Set in-memory `seenPayments` + reconsulta en MP API (idempotencia natural) |
| Atacante intenta exponer el Access Token | **No prefijado con `PUBLIC_`** — Astro nunca lo bundlea al cliente |
| XSS en datos del comprador renderizados | Astro auto-escapa templates; outputs en HTML pasan por `escape()` en [emails.ts](src/lib/emails.ts) |
| Logs con datos sensibles (token, tarjetas) | Logueamos solo `id`, `ref`, `total`, `status` — nunca tokens ni datos de tarjeta |
| Ataques al endpoint webhook desde origen no-MP | Rechazo si la firma HMAC no valida |
| `external_reference` adivinable / fácil de iterar | UUID aleatorio (`crypto.randomBytes(8)` + timestamp base36) |

## Variables de entorno críticas

Todo en [.env.example](.env.example). Resumen:

| Variable | Pública | Crítica | Dónde se configura |
|---|---|---|---|
| `MP_ACCESS_TOKEN` | ❌ NUNCA | 🔴 Sí | Vercel → Settings → Env Vars (server-only) |
| `MP_WEBHOOK_SECRET` | ❌ NUNCA | 🔴 Sí | Vercel → Settings → Env Vars (server-only). Idem en MP panel. |
| `RESEND_API_KEY` | ❌ NUNCA | 🟡 Media | Vercel → Settings → Env Vars |
| `PUBLIC_MP_PUBLIC_KEY` | ✅ | 🟢 No | Solo si en futuro se usa Bricks/Checkout API en cliente |
| `PUBLIC_SITE_URL` | ✅ | 🟢 No | URL canónica del sitio |
| `EMAIL_FROM` | ❌ NUNCA exponer | 🟢 No | Email "from" para Resend |
| `ADMIN_NOTIFY_EMAIL` | ❌ NUNCA exponer | 🟢 No | Donde llegan avisos de pedido |

**Regla de oro**: cualquier variable que no empieza con `PUBLIC_` JAMÁS llega al bundle del navegador. Astro lo garantiza por configuración.

## Flujo de pago paso a paso

1. **Cliente** carga productos al carrito (localStorage). Solo guarda `[{slug, qty}]`.
2. **Cliente** completa formulario de checkout y envía `POST /api/checkout/create-preference` con `{ items, buyer }`.
3. **Server** ([create-preference.ts](src/pages/api/checkout/create-preference.ts)):
   - Rate limit por IP.
   - Origin check.
   - Zod validation.
   - **Resuelve el carrito server-side** desde `products.json` autoritativo.
   - Genera `external_reference` aleatorio.
   - Llama a MP API con `MP_ACCESS_TOKEN` server-only.
   - Devuelve solo `{ initPoint, preferenceId, externalReference }` — NUNCA el access token ni datos sensibles del server.
4. **Cliente** redirect a `init_point` de MP.
5. **MP** procesa el cobro.
6. **MP** envía webhook async a `POST /api/checkout/mp-webhook`.
7. **Server** ([mp-webhook.ts](src/pages/api/checkout/mp-webhook.ts)):
   - Valida HMAC `x-signature`.
   - Idempotencia.
   - **Re-consulta el payment a MP API** (no confía en el body del webhook — nadie puede falsear esto sin acceso al Access Token).
   - Si `status = approved`, dispara emails.
8. **Cliente** vuelve de MP a `/pago/{success|pending|failure}` (back URLs).

## Checklist obligatorio antes del go-live

Antes de poner credenciales productivas y promover a `main` con dominio real, **todos** estos items deben estar ✅:

- [ ] `.env.local` está en `.gitignore` y nunca fue commiteado (`git log -- .env.local` debe estar vacío).
- [ ] No hay ninguna variable sensible con prefijo `PUBLIC_` (revisar [.env.example](.env.example)).
- [ ] `MP_ACCESS_TOKEN` cargado en Vercel **solo** como Production env (no Preview, no Development).
- [ ] `MP_WEBHOOK_SECRET` cargado en Vercel y **el mismo string** está configurado en el panel de MP → Notificaciones webhooks.
- [ ] Webhook URL `https://xprepuestos.com.ar/api/checkout/mp-webhook` registrada en panel MP.
- [ ] Probado un pago real con tarjeta de **test** de MP (`5031 7557 3453 0604`, CVV cualquiera, vencimiento futuro). El pedido llegó al email admin.
- [ ] Probado un pago **rechazado** de MP (tarjeta especial OTHE para forzar reject) — vuelve a `/pago/failure`.
- [ ] Probado un pago **pendiente** (Rapipago test) — vuelve a `/pago/pending`.
- [ ] Verificado que en el log de Vercel no aparece `MP_ACCESS_TOKEN` ni partes del mismo.
- [ ] Headers de seguridad activos en producción: HSTS, X-Frame-Options DENY, Permissions-Policy (revisar [vercel.json](vercel.json)).
- [ ] CSP futuro a evaluar (no implementado por defecto para evitar romper analytics).
- [ ] `RESEND_API_KEY` con dominio verificado en Resend (no usar `onboarding@resend.dev` para producción).
- [ ] Vercel project → Settings → Functions → Region: South America (gru1) si querés latencia mínima en Argentina.

## Items que requieren atención futura

Estos se podrían mejorar pero no son bloqueantes para go-live:

- **DB de pedidos persistente**. Hoy los pedidos quedan solo en email + logs de Vercel (efímeros 30 días en Hobby). Para historial, agregar Cloudflare D1 / Turso / Vercel KV. No bloquea — todos los datos importantes están en MP también.
- **Panel admin para ver pedidos**. Hoy los ves por email. Si crece el volumen, sumar `/admin` con auth básica (bcrypt + cookie HMAC) y listado.
- **Reconciliación**. Cron diario que compare pedidos en MP con los nuestros para detectar pagos sin notificación. Útil cuando crezca.
- **Captcha** en checkout si hay spam. Hoy no hay — confiamos en el rate limit y la validación de email/teléfono.
- **CSP Content Security Policy**. No incluida por defecto. Agregar cuando se valide que no rompe nada (analytics, MP iframes, fonts).
- **Test E2E automatizado** del flujo de checkout con MP sandbox. Para detectar regresiones después de cambios.

## Reglas de oro al editar este código

1. **Nunca recibir el `precio` desde el cliente.** Si lo hacés, alguien va a editarlo. Lee siempre de `products.json`.
2. **Nunca confiar en el body del webhook MP.** Re-consultar payment en MP API con el `id`.
3. **Nunca loguear el Access Token, ni partes, ni headers que lo lleven.** Vercel logs son persistentes.
4. **Nunca commitear `.env.local`.** Si pasa, rotar TODOS los tokens inmediatamente (regenerar Access Token MP, regenerar webhook secret, regenerar Resend key).
5. **Nunca poner `MP_ACCESS_TOKEN` con prefijo `PUBLIC_`.** Astro lo expondría al bundle del cliente.
6. **Si dudás, hacelo server-side.** El cliente es zona enemiga.

## En caso de incidente

Si sospechás que un Access Token fue expuesto:
1. **Rotá inmediatamente** en el panel de MP → Tus credenciales → Generar nuevas.
2. Actualizá `MP_ACCESS_TOKEN` en Vercel → Redeploy.
3. Revisá MP → Actividad de los últimos 30 días por movimientos extraños.
4. Si hubo cobros fraudulentos, abrí caso con MP soporte adjuntando los IDs.
5. Lo mismo con `RESEND_API_KEY` (free tier no debería ser blanco crítico, pero rotar igual).
