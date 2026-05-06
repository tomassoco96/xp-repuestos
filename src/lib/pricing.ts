/**
 * Cálculo de totales server-side autoritativo.
 *
 * REGLA CRÍTICA: el cliente solo manda { slug, qty }. NUNCA confiamos en un
 * precio que venga del cliente. Los precios se leen de products.json — la
 * fuente de verdad — y los totales se recalculan acá.
 */

import { products, type Producto } from './products';
import type { CartItemInput } from './schemas';

export type ResolvedItem = {
  product: Producto;
  qty: number;
  unitPrice: number;
  subtotal: number;
};

export type ResolvedCart = {
  items: ResolvedItem[];
  subtotal: number;
  shipping: number;
  total: number;
  currency: 'ARS';
};

export function resolveCart(input: CartItemInput[]): {
  cart: ResolvedCart | null;
  errors: string[];
} {
  const errors: string[] = [];
  const items: ResolvedItem[] = [];

  // Deduplicar por slug — si el cliente manda el mismo producto dos veces,
  // sumamos cantidades en lugar de duplicar líneas.
  const dedup = new Map<string, number>();
  for (const it of input) {
    dedup.set(it.slug, (dedup.get(it.slug) ?? 0) + it.qty);
  }

  for (const [slug, qty] of dedup) {
    const product = products.find((p) => p.slug === slug);
    if (!product) {
      errors.push(`Producto no existe: ${slug}`);
      continue;
    }
    if (!product.stock) {
      errors.push(`Sin stock: ${product.nombre}`);
      continue;
    }
    if (qty > 50) {
      errors.push(`Cantidad excesiva (${qty}): ${product.nombre}`);
      continue;
    }
    if (!Number.isFinite(product.precio) || product.precio <= 0) {
      errors.push(`Precio inválido en catálogo: ${slug}`);
      continue;
    }

    items.push({
      product,
      qty,
      unitPrice: product.precio,
      subtotal: product.precio * qty,
    });
  }

  if (items.length === 0) {
    return { cart: null, errors: errors.length ? errors : ['Carrito vacío'] };
  }

  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
  const shipping = subtotal >= 80_000 ? 0 : 0; // calc real se hace post-MP por ahora
  const total = subtotal + shipping;

  return {
    cart: { items, subtotal, shipping, total, currency: 'ARS' },
    errors,
  };
}
