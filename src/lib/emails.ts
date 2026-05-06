/**
 * Envío de emails transaccionales con Resend.
 *
 * Si las env vars no están configuradas, las funciones devuelven sin enviar
 * y solo loguean — el webhook NO debe fallar por un mail no enviado.
 */

import { Resend } from 'resend';
import { formatPrice } from './format';

type MpItem = {
  id?: string;
  title?: string;
  quantity?: number;
  unit_price?: number;
  picture_url?: string;
};

type MpPayment = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  external_reference?: string;
  date_approved?: string;
  payer?: { email?: string; first_name?: string; last_name?: string };
  additional_info?: { items?: MpItem[] };
  metadata?: Record<string, unknown>;
};

function escape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildItemsHtml(items: MpItem[]): string {
  return items
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            <strong>${escape(i.title)}</strong><br/>
            <span style="color:#666;font-size:12px;">x ${escape(i.quantity)}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums;">
            ${escape(formatPrice((i.unit_price ?? 0) * (i.quantity ?? 0)))}
          </td>
        </tr>`,
    )
    .join('');
}

export async function sendOrderEmails(payment: MpPayment): Promise<void> {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const from = import.meta.env.EMAIL_FROM;
  const adminTo = import.meta.env.ADMIN_NOTIFY_EMAIL;

  if (!apiKey || !from) {
    console.log('emails_skipped: RESEND_API_KEY o EMAIL_FROM no configurados');
    return;
  }

  const resend = new Resend(apiKey);
  const items = payment.additional_info?.items ?? [];
  const itemsHtml = buildItemsHtml(items);
  const total = payment.transaction_amount ?? 0;
  const refStr = escape(payment.external_reference);
  const customerEmail = payment.payer?.email;
  const customerName = `${payment.payer?.first_name ?? ''} ${payment.payer?.last_name ?? ''}`.trim() || 'cliente';

  const customerHtml = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1D1D1B;">
      <div style="border-bottom:3px solid #E20613;padding-bottom:16px;margin-bottom:24px;">
        <h1 style="margin:0;font-size:24px;text-transform:uppercase;letter-spacing:-0.01em;">¡Recibimos tu pago!</h1>
      </div>
      <p>Hola ${escape(customerName)}, gracias por tu compra en <strong>XP Repuestos</strong>.</p>
      <p>Tu pago se acreditó correctamente. En las próximas horas vamos a despachar el pedido y te mandamos el código de seguimiento.</p>

      <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:0.18em;color:#E20613;margin-top:32px;">Tu pedido</h2>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        ${itemsHtml}
        <tr>
          <td style="padding:12px 0;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;">Total pagado</td>
          <td style="padding:12px 0;text-align:right;font-weight:900;font-size:18px;">${escape(formatPrice(total))}</td>
        </tr>
      </table>

      <p style="margin-top:24px;font-size:12px;color:#666;">Referencia interna: ${refStr}<br/>ID de pago: ${escape(payment.id)}</p>

      <p style="margin-top:32px;">Si tenés alguna duda, respondé este mail o escribinos por WhatsApp al <a href="https://wa.me/5491123929823">+54 9 11 2392-9823</a>.</p>
      <p>—<br/>El equipo de XP Repuestos</p>
    </div>
  `;

  const adminHtml = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;color:#E20613;">Nuevo pedido aprobado</h1>
      <p><strong>ID:</strong> ${escape(payment.id)}<br/>
         <strong>Ref:</strong> ${refStr}<br/>
         <strong>Total:</strong> ${escape(formatPrice(total))}<br/>
         <strong>Cliente:</strong> ${escape(customerName)} (${escape(customerEmail)})</p>

      <h2 style="font-size:14px;margin-top:24px;">Items</h2>
      <table style="width:100%;border-collapse:collapse;">${itemsHtml}</table>

      <h2 style="font-size:14px;margin-top:24px;">Datos del comprador</h2>
      <pre style="font-family:ui-monospace,monospace;font-size:12px;background:#f5f5f5;padding:12px;border-radius:4px;overflow:auto;">${escape(JSON.stringify(payment.metadata ?? {}, null, 2))}</pre>
    </div>
  `;

  // No abortamos si un mail falla — logueamos y seguimos.
  if (customerEmail) {
    try {
      await resend.emails.send({
        from,
        to: customerEmail,
        subject: 'Tu pedido en XP Repuestos · Pago confirmado',
        html: customerHtml,
      });
    } catch (err) {
      console.error('email_customer_failed', { err: String(err) });
    }
  }

  if (adminTo) {
    try {
      await resend.emails.send({
        from,
        to: adminTo,
        subject: `Nuevo pedido #${payment.id ?? '?'} · ${formatPrice(total)}`,
        html: adminHtml,
      });
    } catch (err) {
      console.error('email_admin_failed', { err: String(err) });
    }
  }
}

/**
 * Email al cliente cuando el pago se rechaza o cancela.
 * Útil sobre todo cuando paga con Rapipago/PagoFácil y no acredita la boleta.
 */
export async function sendPaymentFailedEmail(payment: MpPayment): Promise<void> {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const from = import.meta.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.log('emails_skipped: RESEND_API_KEY o EMAIL_FROM no configurados');
    return;
  }

  const customerEmail = payment.payer?.email;
  if (!customerEmail) return;

  const resend = new Resend(apiKey);
  const customerName = `${payment.payer?.first_name ?? ''} ${payment.payer?.last_name ?? ''}`.trim() || 'cliente';
  const refStr = escape(payment.external_reference);
  const statusLabel = payment.status === 'cancelled' ? 'cancelado' : 'rechazado';

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1D1D1B;">
      <div style="border-bottom:3px solid #E20613;padding-bottom:16px;margin-bottom:24px;">
        <h1 style="margin:0;font-size:24px;text-transform:uppercase;letter-spacing:-0.01em;">Tu pago no se completó</h1>
      </div>
      <p>Hola ${escape(customerName)}, te escribimos para avisarte que el pago de tu pedido en <strong>XP Repuestos</strong> figura como <strong>${escape(statusLabel)}</strong> y no llegó a acreditarse.</p>
      <p>Si te equivocaste o quedó vencida una boleta de pago, podés volver a la web y reintentar la compra. Tu carrito sigue armado en el navegador (si no lo borraste).</p>
      <p style="margin-top:32px;">
        <a href="https://xp-repuestos.vercel.app/checkout" style="background:#E20613;color:white;padding:12px 24px;text-decoration:none;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;font-size:14px;display:inline-block;">Reintentar compra</a>
      </p>
      <p style="margin-top:32px;">¿Necesitás ayuda? Escribinos por WhatsApp al <a href="https://wa.me/5491123929823">+54 9 11 2392-9823</a>.</p>
      <p style="margin-top:24px;font-size:12px;color:#666;">Referencia: ${refStr}<br/>ID de pago: ${escape(payment.id)}</p>
      <p>—<br/>El equipo de XP Repuestos</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from,
      to: customerEmail,
      subject: `Tu pago en XP Repuestos no se completó`,
      html,
    });
  } catch (err) {
    console.error('email_failed_payment_failed', { err: String(err) });
  }
}
