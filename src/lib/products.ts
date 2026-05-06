import productsData from '@/data/products.json';
import categoriesData from '@/data/categories.json';

export type Categoria = {
  slug: string;
  nombre: string;
  descripcion: string;
  icono: string;
  destacado: boolean;
};

export type Producto = {
  slug: string;
  nombre: string;
  categoria: string;
  precio: number;
  imagen: string;
  marca: string;
  modelos: string[];
  stock: boolean;
  destacado: boolean;
  descripcion?: string;
  sourceUrl?: string;
};

export const products: Producto[] = productsData as Producto[];
export const categories: Categoria[] = categoriesData as Categoria[];

/**
 * Ordena productos: los que tienen imagen primero, los sin imagen al final.
 * Mantiene orden estable dentro de cada grupo.
 */
function sortByImage<T extends { imagen: string }>(arr: T[]): T[] {
  const withImg = arr.filter((p) => p.imagen && p.imagen.trim() !== '');
  const withoutImg = arr.filter((p) => !p.imagen || p.imagen.trim() === '');
  return [...withImg, ...withoutImg];
}

export function hasImage(p: Producto): boolean {
  return Boolean(p.imagen && p.imagen.trim() !== '');
}

export function getCategoryBySlug(slug: string): Categoria | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getProductsByCategory(slug: string): Producto[] {
  return sortByImage(products.filter((p) => p.categoria === slug));
}

export function getFeaturedProducts(limit = 8): Producto[] {
  // Solo destacados con imagen (los destacados sin imagen no van al home).
  return products.filter((p) => p.destacado && hasImage(p)).slice(0, limit);
}

export function getProductBySlug(slug: string): Producto | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(slug: string, limit = 4): Producto[] {
  const product = getProductBySlug(slug);
  if (!product) return [];
  return sortByImage(
    products.filter((p) => p.slug !== slug && p.categoria === product.categoria),
  ).slice(0, limit);
}

/**
 * Devuelve TODOS los productos ordenados (con imagen primero).
 * Útil para vistas tipo /tienda donde se listan todos.
 */
export function getAllProductsSorted(): Producto[] {
  return sortByImage(products);
}

export function getCategoryCount(slug: string): number {
  return products.filter((p) => p.categoria === slug).length;
}

export function getAllBrands(): string[] {
  const set = new Set<string>();
  products.forEach((p) => set.add(p.marca));
  return Array.from(set).sort();
}
