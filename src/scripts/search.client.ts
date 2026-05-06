/**
 * Búsqueda client-side sobre el catálogo. Atajo Ctrl/Cmd+K + lupa del header.
 *
 * Algoritmo: scoring con keyword matching ponderado:
 *  - match en nombre = 10 pts
 *  - match en marca = 6 pts
 *  - match en modelo = 8 pts (más específico que marca)
 *  - match en categoría = 4 pts
 *  - boost si el término matchea exact word
 *  - normalize unicode + lowercase para que "Honda" matchee "honda"
 *  - todas las palabras del query deben matchear (AND)
 */

import productsData from '@/data/products.json';

type Producto = {
  slug: string;
  nombre: string;
  categoria: string;
  precio: number;
  imagen: string;
  marca: string;
  modelos: string[];
};

const PRODUCTS = productsData as Producto[];
const MAX_RESULTS = 12;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Indexed = {
  product: Producto;
  haystack: string;
  nombre: string;
  marca: string;
  categoria: string;
  modelos: string;
};

const INDEX: Indexed[] = PRODUCTS.map((p) => {
  const nombre = normalize(p.nombre);
  const marca = normalize(p.marca);
  const categoria = normalize(p.categoria);
  const modelos = normalize((p.modelos || []).join(' '));
  return {
    product: p,
    haystack: `${nombre} ${marca} ${categoria} ${modelos}`,
    nombre,
    marca,
    categoria,
    modelos,
  };
});

function score(item: Indexed, terms: string[]): number {
  // Cada término debe matchear (AND). Sumamos puntaje por dónde matchea cada uno.
  let total = 0;
  for (const term of terms) {
    if (!item.haystack.includes(term)) return 0;
    let s = 0;
    if (item.nombre.includes(term)) s += 10;
    if (item.marca.includes(term)) s += 6;
    if (item.modelos.includes(term)) s += 8;
    if (item.categoria.includes(term)) s += 4;
    // Boost si match exacto de palabra (no substring).
    const wordRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (wordRegex.test(item.nombre)) s += 5;
    if (wordRegex.test(item.modelos)) s += 4;
    total += s;
  }
  // Boost por tener imagen.
  if (item.product.imagen && item.product.imagen.trim() !== '') total += 1;
  return total;
}

export function searchProducts(query: string): Producto[] {
  const q = normalize(query);
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored = INDEX.map((item) => ({ item, score: score(item, terms) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  return scored.map((s) => s.item.product);
}

// ---------- UI runtime ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function getEls() {
  return {
    overlay: document.getElementById('xp-search-overlay'),
    modal: document.getElementById('xp-search-modal'),
    input: document.getElementById('xp-search-input') as HTMLInputElement | null,
    results: document.getElementById('xp-search-results'),
    list: document.querySelector<HTMLUListElement>('[data-xp-search-list]'),
    empty: document.querySelector<HTMLElement>('[data-xp-search-empty]'),
    noResults: document.querySelector<HTMLElement>('[data-xp-search-noresults]'),
    count: document.querySelector<HTMLElement>('[data-xp-search-count]'),
  };
}

function openSearch() {
  const { overlay, modal, input } = getEls();
  if (!modal || !overlay || !input) return;
  overlay.classList.add('is-open');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('xp-search-no-scroll');
  setTimeout(() => input.focus(), 50);
}

function closeSearch() {
  const { overlay, modal, input } = getEls();
  if (!modal || !overlay) return;
  overlay.classList.remove('is-open');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('xp-search-no-scroll');
  if (input) input.value = '';
  renderResults('');
}

function renderResults(query: string) {
  const { list, empty, noResults, count } = getEls();
  if (!list || !empty || !noResults || !count) return;

  if (!query.trim()) {
    list.classList.add('hidden');
    list.innerHTML = '';
    empty.classList.remove('hidden');
    noResults.classList.add('hidden');
    count.textContent = '';
    return;
  }

  const results = searchProducts(query);

  if (results.length === 0) {
    list.classList.add('hidden');
    empty.classList.add('hidden');
    noResults.classList.remove('hidden');
    count.textContent = '';
    return;
  }

  empty.classList.add('hidden');
  noResults.classList.add('hidden');
  list.classList.remove('hidden');

  list.innerHTML = results
    .map((p, i) => {
      const hasImg = p.imagen && p.imagen.trim() !== '';
      const img = hasImg
        ? `<img class="xp-search-result-img" src="${escapeHtml(p.imagen)}" alt="" loading="lazy" />`
        : `<span class="xp-search-result-img-fallback" aria-hidden="true">XP</span>`;
      return `
        <li>
          <a href="/producto/${escapeHtml(p.slug)}" class="xp-search-result" data-xp-search-result-index="${i}">
            ${img}
            <div style="flex:1;min-width:0;">
              <p style="font-family:var(--font-display);font-weight:800;font-size:0.875rem;text-transform:uppercase;line-height:1.2;color:var(--color-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHtml(p.nombre)}
              </p>
              <p style="font-size:0.75rem;color:var(--color-steel);margin-top:2px;">
                ${escapeHtml(p.marca)} · ${escapeHtml(p.categoria)}
              </p>
            </div>
            <p style="font-family:var(--font-display);font-weight:900;font-variant-numeric:tabular-nums;color:var(--color-ink);flex-shrink:0;">
              ${formatPrice(p.precio)}
            </p>
          </a>
        </li>
      `;
    })
    .join('');

  count.textContent = `${results.length} resultado${results.length === 1 ? '' : 's'}`;
}

let activeIdx = -1;

function navigate(dir: 1 | -1) {
  const items = document.querySelectorAll<HTMLAnchorElement>('[data-xp-search-result-index]');
  if (items.length === 0) return;
  activeIdx = (activeIdx + dir + items.length) % items.length;
  items.forEach((it, i) => {
    if (i === activeIdx) {
      it.classList.add('is-active');
      it.scrollIntoView({ block: 'nearest' });
    } else {
      it.classList.remove('is-active');
    }
  });
}

function openActive() {
  const items = document.querySelectorAll<HTMLAnchorElement>('[data-xp-search-result-index]');
  if (activeIdx >= 0 && activeIdx < items.length) {
    items[activeIdx]!.click();
  } else if (items.length > 0) {
    items[0]!.click();
  }
}

function bindGlobal() {
  if ((window as any).__xpSearchBound) return;
  (window as any).__xpSearchBound = true;

  // Toggle search desde botón header.
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target || !target.closest) return;
    if (target.closest('[data-xp-search-toggle]')) {
      e.preventDefault();
      openSearch();
    }
    if (target.closest('[data-xp-search-close]')) {
      e.preventDefault();
      closeSearch();
    }
    const sug = target.closest<HTMLElement>('[data-xp-search-suggest]');
    if (sug) {
      e.preventDefault();
      const term = sug.getAttribute('data-xp-search-suggest') ?? '';
      const { input } = getEls();
      if (input) {
        input.value = term;
        renderResults(term);
        input.focus();
      }
    }
  });

  // Atajo Ctrl/Cmd+K
  document.addEventListener('keydown', (e) => {
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const { modal } = getEls();
      if (modal?.classList.contains('is-open')) closeSearch();
      else openSearch();
    }
    if (e.key === 'Escape') {
      const { modal } = getEls();
      if (modal?.classList.contains('is-open')) closeSearch();
    }
    // Navegación con flechas dentro del modal abierto.
    const { modal } = getEls();
    if (modal?.classList.contains('is-open')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigate(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigate(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        openActive();
      }
    }
  });

  // Input con debounce mínimo.
  document.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (target?.id === 'xp-search-input') {
      activeIdx = -1;
      renderResults(target.value);
    }
  });
}

function init() {
  bindGlobal();
  renderResults('');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
document.addEventListener('astro:page-load', () => {
  // Re-render results en cada nav (por si el modal queda abierto).
  const { input } = getEls();
  if (input) renderResults(input.value);
});

// API pública.
(window as any).xpSearch = { open: openSearch, close: closeSearch, search: searchProducts };
