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

export function getCategoryBySlug(slug: string): Categoria | undefined {
  return categories.find((c) => c.slug === slug);
}

export function getProductsByCategory(slug: string): Producto[] {
  return products.filter((p) => p.categoria === slug);
}

export function getFeaturedProducts(limit = 8): Producto[] {
  return products.filter((p) => p.destacado).slice(0, limit);
}

export function getProductBySlug(slug: string): Producto | undefined {
  return products.find((p) => p.slug === slug);
}

export function getRelatedProducts(slug: string, limit = 4): Producto[] {
  const product = getProductBySlug(slug);
  if (!product) return [];
  return products
    .filter((p) => p.slug !== slug && p.categoria === product.categoria)
    .slice(0, limit);
}

export function getCategoryCount(slug: string): number {
  return products.filter((p) => p.categoria === slug).length;
}

export function getAllBrands(): string[] {
  const set = new Set<string>();
  products.forEach((p) => set.add(p.marca));
  return Array.from(set).sort();
}
