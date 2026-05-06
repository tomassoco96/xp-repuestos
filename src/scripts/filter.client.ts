/**
 * Filtros client-side sobre cards de producto.
 *
 * Las cards renderean con data-attributes:
 *   data-xp-product-card
 *   data-xp-precio="9530"
 *   data-xp-marca="Honda"
 *   data-xp-modelos="Honda CG 150|Honda Titan 150"
 *   data-xp-stock="true"
 *   data-xp-image="true"
 *
 * Los filtros leen el sidebar y ocultan/muestran cards con data-xp-hidden.
 */

type Filters = {
  priceMin: number | null;
  priceMax: number | null;
  marcas: Set<string>;
  modelos: Set<string>;
  onlyStock: boolean;
  onlyWithImage: boolean;
};

function readFilters(): Filters {
  const priceMinEl = document.querySelector<HTMLInputElement>('[data-xp-filter-price="min"]');
  const priceMaxEl = document.querySelector<HTMLInputElement>('[data-xp-filter-price="max"]');
  const stockEl = document.querySelector<HTMLInputElement>('[data-xp-filter-stock]');
  const imgEl = document.querySelector<HTMLInputElement>('[data-xp-filter-img]');

  const marcas = new Set<string>();
  document.querySelectorAll<HTMLInputElement>('[data-xp-filter-marca]:checked').forEach((c) => marcas.add(c.value));
  const modelos = new Set<string>();
  document.querySelectorAll<HTMLInputElement>('[data-xp-filter-modelo]:checked').forEach((c) => modelos.add(c.value));

  return {
    priceMin: priceMinEl?.value ? Number(priceMinEl.value) : null,
    priceMax: priceMaxEl?.value ? Number(priceMaxEl.value) : null,
    marcas,
    modelos,
    onlyStock: Boolean(stockEl?.checked),
    onlyWithImage: Boolean(imgEl?.checked),
  };
}

function matches(card: HTMLElement, f: Filters): boolean {
  const precio = Number(card.getAttribute('data-xp-precio') ?? '0');
  const marca = card.getAttribute('data-xp-marca') ?? '';
  const modelos = (card.getAttribute('data-xp-modelos') ?? '').split('|').filter(Boolean);
  const stock = card.getAttribute('data-xp-stock') === 'true';
  const hasImg = card.getAttribute('data-xp-image') === 'true';

  if (f.priceMin != null && precio < f.priceMin) return false;
  if (f.priceMax != null && precio > f.priceMax) return false;
  if (f.onlyStock && !stock) return false;
  if (f.onlyWithImage && !hasImg) return false;
  if (f.marcas.size > 0 && !f.marcas.has(marca)) return false;
  if (f.modelos.size > 0 && !modelos.some((m) => f.modelos.has(m))) return false;
  return true;
}

function applyFilters() {
  const f = readFilters();
  const cards = document.querySelectorAll<HTMLElement>('[data-xp-product-card]');
  let visible = 0;
  cards.forEach((card) => {
    if (matches(card, f)) {
      card.setAttribute('data-xp-hidden', 'false');
      visible++;
    } else {
      card.setAttribute('data-xp-hidden', 'true');
    }
  });

  // Update count badges.
  document.querySelectorAll('[data-xp-filter-count], [data-xp-filter-count-btn]').forEach((el) => {
    el.textContent = String(visible);
  });

  // Mostrar empty state si no hay productos.
  const empty = document.querySelector<HTMLElement>('[data-xp-filter-empty]');
  if (empty) {
    empty.classList.toggle('hidden', visible > 0);
  }
}

function clearFilters() {
  document.querySelectorAll<HTMLInputElement>('[data-xp-filter-price="min"], [data-xp-filter-price="max"]').forEach((el) => {
    el.value = '';
  });
  document.querySelectorAll<HTMLInputElement>(
    '[data-xp-filter-stock], [data-xp-filter-img], [data-xp-filter-marca], [data-xp-filter-modelo]',
  ).forEach((el) => {
    el.checked = false;
  });
  applyFilters();
}

function togglePanelMobile(open?: boolean) {
  const panel = document.querySelector<HTMLElement>('[data-xp-filter-panel]');
  const toggle = document.querySelector<HTMLElement>('[data-xp-filter-toggle]');
  if (!panel) return;
  const isOpen = open ?? !panel.classList.contains('is-open');
  panel.classList.toggle('is-open', isOpen);
  document.body.classList.toggle('xp-filter-no-scroll', isOpen);
  toggle?.setAttribute('aria-expanded', String(isOpen));
}

function bindGlobal() {
  if ((window as any).__xpFilterBound) return;
  (window as any).__xpFilterBound = true;

  document.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    if (
      target.matches('[data-xp-filter-marca]') ||
      target.matches('[data-xp-filter-modelo]') ||
      target.matches('[data-xp-filter-stock]') ||
      target.matches('[data-xp-filter-img]')
    ) {
      applyFilters();
    }
  });

  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    if (target.matches('[data-xp-filter-price="min"], [data-xp-filter-price="max"]')) {
      applyFilters();
    }
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target || !target.closest) return;
    if (target.closest('[data-xp-filter-clear]')) {
      e.preventDefault();
      clearFilters();
    }
    if (target.closest('[data-xp-filter-toggle]')) {
      e.preventDefault();
      togglePanelMobile();
    }
    if (target.closest('[data-xp-filter-close]')) {
      e.preventDefault();
      togglePanelMobile(false);
    }
  });
}

function init() {
  bindGlobal();
  applyFilters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
document.addEventListener('astro:page-load', init);
