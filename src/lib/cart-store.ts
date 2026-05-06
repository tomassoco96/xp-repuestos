/**
 * Carrito client-side con persistencia en localStorage.
 *
 * Solo usa nanostores (~700 bytes) + persistent (~400 bytes). Cero lib pesada.
 *
 * REGLA: el carrito guarda solo { slug, qty }. El precio NO se persiste —
 * se recalcula al render desde products.json y, en el server, al pagar.
 * Esto evita que cambie el precio en el catálogo y el cliente vea uno viejo.
 */

import { atom } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';

export type StoredCartItem = { slug: string; qty: number };

const STORAGE_KEY = 'xp-cart-v1';

export const $cart = persistentAtom<StoredCartItem[]>(STORAGE_KEY, [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

// UI state — drawer abierto / cerrado.
export const $cartOpen = atom<boolean>(false);

// Helpers
export function addToCart(slug: string, qty = 1): void {
  const current = $cart.get();
  const existing = current.find((i) => i.slug === slug);

  if (existing) {
    const next = current.map((i) =>
      i.slug === slug ? { ...i, qty: Math.min(50, i.qty + qty) } : i,
    );
    $cart.set(next);
  } else {
    $cart.set([...current, { slug, qty: Math.min(50, qty) }]);
  }
}

export function updateQty(slug: string, qty: number): void {
  if (qty <= 0) {
    removeFromCart(slug);
    return;
  }
  const safe = Math.min(50, Math.max(1, Math.floor(qty)));
  $cart.set($cart.get().map((i) => (i.slug === slug ? { ...i, qty: safe } : i)));
}

export function removeFromCart(slug: string): void {
  $cart.set($cart.get().filter((i) => i.slug !== slug));
}

export function clearCart(): void {
  $cart.set([]);
}

export function totalQty(items: StoredCartItem[]): number {
  return items.reduce((acc, i) => acc + i.qty, 0);
}

export function openCart(): void {
  $cartOpen.set(true);
}
export function closeCart(): void {
  $cartOpen.set(false);
}
