/**
 * Cart client-side runtime. Único entrypoint del carrito.
 *
 * - Usa localStorage directamente (sin lib externa).
 * - Event delegation global → funciona aunque elementos se monten después.
 * - Re-init en `astro:page-load` para View Transitions.
 *
 * Markup esperado (data attributes):
 *   [data-xp-cart-toggle]            → abre el drawer
 *   [data-xp-cart-close]             → cierra el drawer
 *   [data-xp-add-to-cart="<slug>"]   → agrega 1 al carrito y abre drawer
 *   [data-xp-cart-qty="+|-"][data-xp-slug="<slug>"]  → ajusta qty
 *   [data-xp-cart-remove="<slug>"]   → quita item
 *
 *   #xp-cart-count       → badge con totalQty (texto)
 *   #xp-cart-drawer      → contenedor del drawer
 *   #xp-cart-overlay     → overlay
 *   #xp-cart-items       → <ul> donde render items
 *   #xp-cart-empty       → mensaje "carrito vacío" (oculta cuando hay items)
 *   #xp-cart-footer      → footer del drawer (oculta cuando vacío)
 *   #xp-cart-subtotal    → texto del subtotal
 *   [data-xp-cart-page] → contenedor principal de /carrito (similar al drawer)
 *   [data-xp-checkout]  → contenedor de /checkout (similar)
 */

import productsData from '@/data/products.json';

type Producto = {
  slug: string;
  nombre: string;
  precio: number;
  imagen: string;
  marca: string;
  stock: boolean;
};

type StoredItem = { slug: string; qty: number };

const PRODUCTS = productsData as Producto[];
const STORAGE_KEY = 'xp-cart-v1';

// ---------- Estado ----------

function readCart(): StoredItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i) => i && typeof i.slug === 'string' && typeof i.qty === 'number',
    );
  } catch {
    return [];
  }
}

function writeCart(items: StoredItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
  // Notificar a otras instancias (otras pestañas + listeners locales).
  document.dispatchEvent(
    new CustomEvent('xp:cart:change', { detail: items }),
  );
}

function getCart(): StoredItem[] {
  return readCart();
}

function totalQty(items: StoredItem[]): number {
  return items.reduce((acc, i) => acc + i.qty, 0);
}

function addItem(slug: string, qty = 1): void {
  const current = readCart();
  const existing = current.find((i) => i.slug === slug);
  if (existing) {
    existing.qty = Math.min(50, existing.qty + qty);
  } else {
    current.push({ slug, qty: Math.min(50, qty) });
  }
  writeCart(current);
}

function updateQty(slug: string, qty: number): void {
  const current = readCart();
  if (qty <= 0) {
    writeCart(current.filter((i) => i.slug !== slug));
    return;
  }
  const safe = Math.min(50, Math.max(1, Math.floor(qty)));
  writeCart(current.map((i) => (i.slug === slug ? { ...i, qty: safe } : i)));
}

function removeItem(slug: string): void {
  writeCart(readCart().filter((i) => i.slug !== slug));
}

function clearCart(): void {
  writeCart([]);
}

// ---------- Helpers ----------

function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findProduct(slug: string): Producto | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

// ---------- Render ----------

function renderBadge(items: StoredItem[]): void {
  const badges = document.querySelectorAll<HTMLElement>('[data-xp-cart-count]');
  const count = totalQty(items);
  badges.forEach((badge) => {
    badge.textContent = String(count);
    badge.toggleAttribute('hidden', count === 0);
    if (count === 0) badge.classList.add('hidden');
    else badge.classList.remove('hidden');
  });
}

function renderDrawer(items: StoredItem[]): void {
  const list = document.getElementById('xp-cart-items');
  const empty = document.getElementById('xp-cart-empty');
  const footer = document.getElementById('xp-cart-footer');
  const subtotalEl = document.getElementById('xp-cart-subtotal');
  if (!list || !empty || !footer || !subtotalEl) return;

  if (items.length === 0) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
    footer.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.classList.remove('hidden');
  footer.classList.remove('hidden');

  let subtotal = 0;
  list.innerHTML = items
    .map((it) => {
      const p = findProduct(it.slug);
      if (!p) return '';
      const sub = p.precio * it.qty;
      subtotal += sub;
      return `
        <li class="flex gap-3 border-b border-[color:var(--color-line)] pb-4">
          <div class="size-20 shrink-0 product-img">
            <img src="${escapeHtml(p.imagen)}" alt="" class="size-full object-contain p-1.5" loading="lazy" />
          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-1">
            <p class="text-[10px] uppercase tracking-widest text-[color:var(--color-rust)] font-bold">${escapeHtml(p.marca)}</p>
            <p class="font-display uppercase font-extrabold text-sm leading-tight line-clamp-2">${escapeHtml(p.nombre)}</p>
            <div class="mt-auto flex items-center justify-between gap-2">
              <div class="inline-flex items-center border border-[color:var(--color-line)] rounded">
                <button type="button" data-xp-cart-qty="-" data-xp-slug="${escapeHtml(p.slug)}" class="size-7 inline-flex items-center justify-center hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]" aria-label="Restar uno">−</button>
                <span class="min-w-[28px] text-center text-sm tabular font-bold">${it.qty}</span>
                <button type="button" data-xp-cart-qty="+" data-xp-slug="${escapeHtml(p.slug)}" class="size-7 inline-flex items-center justify-center hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]" aria-label="Sumar uno">+</button>
              </div>
              <p class="font-display font-black tabular text-base">${formatPrice(sub)}</p>
            </div>
            <button type="button" data-xp-cart-remove="${escapeHtml(p.slug)}" class="text-xs text-[color:var(--color-steel)] hover:text-[color:var(--color-rust)] underline underline-offset-2 self-start">Quitar</button>
          </div>
        </li>
      `;
    })
    .join('');

  subtotalEl.textContent = formatPrice(subtotal);
}

function renderCartPage(items: StoredItem[]): void {
  const empty = document.querySelector<HTMLElement>('[data-xp-cart-page-empty]');
  const content = document.querySelector<HTMLElement>('[data-xp-cart-page-content]');
  const list = document.querySelector<HTMLUListElement>('[data-xp-cart-page-items]');
  const subtotalEl = document.querySelector<HTMLElement>('[data-xp-cart-page-subtotal]');
  if (!empty || !content || !list || !subtotalEl) return;

  if (items.length === 0) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  content.classList.remove('hidden');

  let subtotal = 0;
  list.innerHTML = items
    .map((it) => {
      const p = findProduct(it.slug);
      if (!p) return '';
      const sub = p.precio * it.qty;
      subtotal += sub;
      return `
        <li class="flex gap-4 border border-[color:var(--color-line)] bg-[color:var(--color-bone)] p-4">
          <a href="/producto/${escapeHtml(p.slug)}" class="size-28 shrink-0 product-img">
            <img src="${escapeHtml(p.imagen)}" alt="" class="size-full object-contain p-2" loading="lazy" />
          </a>
          <div class="flex-1 min-w-0 flex flex-col gap-2">
            <p class="text-[10px] uppercase tracking-widest text-[color:var(--color-rust)] font-bold">${escapeHtml(p.marca)}</p>
            <a href="/producto/${escapeHtml(p.slug)}" class="font-display uppercase font-extrabold text-base leading-tight hover:text-[color:var(--color-rust)] transition">${escapeHtml(p.nombre)}</a>
            <div class="mt-auto flex items-center justify-between gap-2 flex-wrap">
              <div class="inline-flex items-center border border-[color:var(--color-line)] rounded">
                <button type="button" data-xp-cart-qty="-" data-xp-slug="${escapeHtml(p.slug)}" class="size-8 inline-flex items-center justify-center hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]" aria-label="Restar uno">−</button>
                <span class="min-w-[32px] text-center text-sm tabular font-bold">${it.qty}</span>
                <button type="button" data-xp-cart-qty="+" data-xp-slug="${escapeHtml(p.slug)}" class="size-8 inline-flex items-center justify-center hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]" aria-label="Sumar uno">+</button>
              </div>
              <p class="font-display font-black tabular text-lg">${formatPrice(sub)}</p>
              <button type="button" data-xp-cart-remove="${escapeHtml(p.slug)}" class="text-xs text-[color:var(--color-steel)] hover:text-[color:var(--color-rust)] underline underline-offset-2">Quitar</button>
            </div>
          </div>
        </li>
      `;
    })
    .join('');

  subtotalEl.textContent = formatPrice(subtotal);
}

function renderCheckout(items: StoredItem[]): void {
  const empty = document.querySelector<HTMLElement>('[data-xp-checkout-empty]');
  const form = document.querySelector<HTMLFormElement>('[data-xp-checkout-form]');
  const itemsEl = document.querySelector<HTMLElement>('[data-xp-checkout-items]');
  const subtotalEl = document.querySelector<HTMLElement>('[data-xp-checkout-subtotal]');
  const totalEl = document.querySelector<HTMLElement>('[data-xp-checkout-total]');
  if (!empty || !form || !itemsEl || !subtotalEl || !totalEl) return;

  if (items.length === 0) {
    empty.classList.remove('hidden');
    form.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  form.classList.remove('hidden');

  let subtotal = 0;
  itemsEl.innerHTML = items
    .map((it) => {
      const p = findProduct(it.slug);
      if (!p) return '';
      const sub = p.precio * it.qty;
      subtotal += sub;
      return `
        <li class="flex gap-3 text-sm">
          <div class="size-12 shrink-0 product-img">
            <img src="${escapeHtml(p.imagen)}" alt="" class="size-full object-contain p-1" loading="lazy" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-display uppercase font-bold text-xs leading-tight line-clamp-2">${escapeHtml(p.nombre)}</p>
            <p class="text-xs text-[color:var(--color-steel)] mt-0.5">x${it.qty}</p>
          </div>
          <p class="font-display font-black tabular text-sm">${formatPrice(sub)}</p>
        </li>
      `;
    })
    .join('');

  subtotalEl.textContent = formatPrice(subtotal);
  totalEl.textContent = formatPrice(subtotal);
}

// ---------- Drawer open/close ----------

function openDrawer(): void {
  const drawer = document.getElementById('xp-cart-drawer');
  const overlay = document.getElementById('xp-cart-overlay');
  if (!drawer) return;
  drawer.classList.add('is-open');
  overlay?.classList.add('is-open');
  document.body.classList.add('xp-no-scroll');
  drawer.setAttribute('aria-hidden', 'false');
  drawer.focus();
}

function closeDrawer(): void {
  const drawer = document.getElementById('xp-cart-drawer');
  const overlay = document.getElementById('xp-cart-overlay');
  if (!drawer) return;
  drawer.classList.remove('is-open');
  overlay?.classList.remove('is-open');
  document.body.classList.remove('xp-no-scroll');
  drawer.setAttribute('aria-hidden', 'true');
}

// ---------- Event delegation global ----------

function bindGlobalListeners(): void {
  if ((window as any).__xpCartBound) return;
  (window as any).__xpCartBound = true;

  // Click delegation
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target || !target.closest) return;

    // Toggle drawer
    if (target.closest('[data-xp-cart-toggle]')) {
      e.preventDefault();
      openDrawer();
      return;
    }

    // Close drawer
    if (target.closest('[data-xp-cart-close]')) {
      e.preventDefault();
      closeDrawer();
      return;
    }

    // Add to cart
    const addBtn = target.closest<HTMLElement>('[data-xp-add-to-cart]');
    if (addBtn) {
      e.preventDefault();
      const slug = addBtn.getAttribute('data-xp-add-to-cart');
      if (slug) {
        addItem(slug, 1);
        openDrawer();
      }
      return;
    }

    // Qty +/-
    const qtyBtn = target.closest<HTMLElement>('[data-xp-cart-qty]');
    if (qtyBtn) {
      e.preventDefault();
      const dir = qtyBtn.getAttribute('data-xp-cart-qty');
      const slug = qtyBtn.getAttribute('data-xp-slug') ?? '';
      const current = readCart().find((i) => i.slug === slug);
      if (!current) return;
      updateQty(slug, dir === '+' ? current.qty + 1 : current.qty - 1);
      return;
    }

    // Remove
    const removeBtn = target.closest<HTMLElement>('[data-xp-cart-remove]');
    if (removeBtn) {
      e.preventDefault();
      const slug = removeBtn.getAttribute('data-xp-cart-remove');
      if (slug) removeItem(slug);
      return;
    }
  });

  // Cerrar drawer con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Sync entre pestañas
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) renderAll();
  });

  // Reactivo a cambios locales
  document.addEventListener('xp:cart:change', () => renderAll());

  // Submit del formulario de checkout
  document.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement | null;
    if (!form || !form.matches('[data-xp-checkout-form]')) return;
    e.preventDefault();
    handleCheckoutSubmit(form);
  });
}

// ---------- Render initial ----------

function renderAll(): void {
  const items = getCart();
  renderBadge(items);
  renderDrawer(items);
  renderCartPage(items);
  renderCheckout(items);
}

// ---------- Checkout submission ----------

async function handleCheckoutSubmit(form: HTMLFormElement): Promise<void> {
  const errorEl = form.querySelector<HTMLElement>('[data-xp-checkout-error]');
  const submitBtn = form.querySelector<HTMLButtonElement>('[type="submit"]');
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  const data = new FormData(form);

  // Honeypot anti-bot: si el campo invisible viene con valor, abortamos sin
  // siquiera llamar al endpoint. El usuario humano nunca lo llena.
  const honeypot = String(data.get('hp_website') ?? '');
  if (honeypot.trim() !== '') {
    // Devolvemos un OK fake para no dar pistas al bot.
    if (errorEl) {
      errorEl.textContent = 'Procesando...';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  // Aceptación de términos.
  if (!data.get('acepto_terminos')) {
    if (errorEl) {
      errorEl.textContent = 'Tenés que aceptar los términos y condiciones para continuar.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const buyer = {
    nombre: String(data.get('nombre') ?? ''),
    apellido: String(data.get('apellido') ?? ''),
    email: String(data.get('email') ?? ''),
    telefono: String(data.get('telefono') ?? ''),
    dni: String(data.get('dni') ?? ''),
    direccion: String(data.get('direccion') ?? ''),
    ciudad: String(data.get('ciudad') ?? ''),
    provincia: String(data.get('provincia') ?? ''),
    codigoPostal: String(data.get('codigoPostal') ?? ''),
    notas: String(data.get('notas') ?? ''),
  };

  const items = getCart();
  if (items.length === 0) {
    if (errorEl) {
      errorEl.textContent = 'Tu carrito está vacío.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Procesando...';
  }

  try {
    const res = await fetch('/api/checkout/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        buyer,
        acepto_terminos: true,
        hp_website: '',
      }),
    });

    let json: any = {};
    try {
      json = await res.json();
    } catch {}

    if (res.status === 503 && json.demo) {
      // Modo demo: MP no configurado todavía. Mostramos preview.
      if (errorEl) {
        errorEl.innerHTML =
          'Modo <strong>demo</strong>: la pasarela de pago todavía no está conectada con Mercado Pago. Cuando se carguen las credenciales, este botón redirige a MP automáticamente. <a href="/pago/success" class="underline">Ver página de éxito (preview)</a>.';
        errorEl.classList.remove('hidden');
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Pagar con Mercado Pago';
      }
      return;
    }

    if (!res.ok || !json.initPoint) {
      throw new Error(json.error ?? 'No se pudo iniciar el pago.');
    }

    window.location.href = json.initPoint;
  } catch (err) {
    if (errorEl) {
      errorEl.textContent =
        err instanceof Error ? err.message : 'Error inesperado.';
      errorEl.classList.remove('hidden');
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Pagar con Mercado Pago';
    }
  }
}

// ---------- Init ----------

function init(): void {
  bindGlobalListeners();
  renderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// View Transitions: re-render en cada navegación.
document.addEventListener('astro:page-load', () => {
  renderAll();
});

// API pública
(window as any).xpCart = {
  get: getCart,
  totalQty: () => totalQty(getCart()),
  add: addItem,
  update: updateQty,
  remove: removeItem,
  clear: clearCart,
  open: openDrawer,
  close: closeDrawer,
};
