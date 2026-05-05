# Audit del sitio actual — xprepuestos.com.ar

**Fecha:** 2026-05-05
**Stack detectado:** WordPress + WooCommerce + theme demo (probablemente Botiga / Shopstar o similar).
**Acceso al admin:** NO disponible.

## Findings críticos

### 1. Contenido placeholder visible en producción

**Página "Nuestra Historia"** — texto literal del demo del theme:
> "Fundada en 2005 por un pequeño grupo de visionarios, **Innovación XP Repuestos** nació con la misión de transformar el panorama tecnológico..."
> "2010 - Recibimos el premio a la 'Startup Más Innovadora'..."
> "2018 - Abrimos nuestras primeras oficinas en dos países europeos..."

→ Todo inventado. XP Repuestos vende repuestos de moto en CABA, no es startup tech ni tiene oficinas en Europa.

**Página de Contacto** mezcla datos reales y placeholders:
- ✅ Real: `+54 987-6543` (WhatsApp), `hola@xprepuestos.com.ar`, Montenegro 1627 CABA, @xp.repuestos
- ❌ Placeholder: `+541123456789`, `info@xprepuestos.com`

**Hero del home:**
> "¡Envío GRATIS en todos los pedidos superiores a $50! ✨"

→ "$50" suena a USD demo. En Argentina debería ser un valor en pesos argentinos coherente.

### 2. Categorización rota

Categorías visibles en navegación: 110 / 250 / 300 / Bujías / Cubiertas.
Productos reales totales: 1000 (según sitemap).

**Problema:**
- "Cubiertas (0)" pero al filtrar muestra cascos.
- "Bujías (0)".
- "110 (1)" pero al entrar muestra cascos + kits pistón mezclados.

→ Los productos están cargados sin categoría. Las categorías del menú son labels vacías.

### 3. Sitemap inflado con productos basura

El `sitemap.xml` tiene 1000 URLs. Inspección sample reveló mezcla de:
- Productos reales de moto (cascos Vertigo, kits pistón Honda CG / Yamaha YBR / Gilera Smash)
- Productos demo del theme: ropa, electrónica de consumo, mascotas, herramientas de construcción.

→ Los 1000 productos del sitemap **no son todos del nicho**. Probablemente quedaron de la importación demo del theme.

### 4. Diseño genérico

- Layout estándar de WP/WooCommerce.
- Paleta blanca + negra + rosa/magenta sin coherencia con el nicho moto.
- Sin elementos que diferencien de cualquier ecommerce genérico.
- No hay foto del local físico ni del equipo.
- No hay sello de confianza para un rubro donde el cliente compra a ciegas.

### 5. SEO técnico

- Meta tags presentes pero genéricos.
- Sitemap inflado dañará crawl budget (Google indexa basura).
- Sin schema markup detectable.
- Sin Open Graph customizado.

### 6. Datos del cliente que sí tienen valor

- Catálogo real de **~55 productos únicos** identificables como repuestos/accesorios de moto.
- Marcas que vende: Vertigo (cascos), Honda (CG, Wave, Twister, XR), Yamaha (YBR, Factor), Gilera (Smash), Zanella (RX, ZB), Motomel, Keller, Mondial, Suzuki (AX).
- Rango de precios scrapeado: $1.618 (tornillería) → $116.885 (tableros premium).
- Programa mayorista declarado (con criterios de elegibilidad y volumen).

## Inventario de páginas

| URL | Contenido real | Acción en rediseño |
|-----|---------------|--------------------|
| `/` (home) | Hero genérico + grid productos demo | Rediseño completo, hero potente, categorías visuales |
| `/tienda/` | Grid de productos paginado | Rediseño con filtros reales por categoría|
| `/categoria-producto/{x}/` | Filtros vacíos | Categorías nuevas: Cascos, Motor, Eléctrico, Rodante |
| `/producto/{slug}/` | Ficha estándar Woo | Ficha mejorada con CTA WhatsApp por producto |
| `/mayorista/` | Texto bueno | Mantener contenido, mejorar diseño |
| `/contacto/` | Datos mezclados | Reescribir con datos verificados |
| `/nuestra-historia/` | Texto demo inventado | Reescribir genérico/honesto |
| `/faqs/` | Vacía | Redactar 8 FAQs típicas del rubro |
| `/politicas-de-envio/` | Vacía | Redactar política base + `{{REVISAR}}` |
| `/politicas-de-devolucion/` | Vacía | Redactar política base + `{{REVISAR}}` |
| `/terminos-y-condiciones/` | Vacía | Redactar T&C base + `{{REVISAR}}` |

## Patrón de marcas visibles en productos

Marcas y modelos que aparecen en nombres de productos (útil para SEO y filtros):
- **Honda:** CG Titan, CG 125/150, Wave, NF 100, CB1 125, CB 125 F Twister, XR 250 Tornado
- **Yamaha:** YBR 125, Factor, RX 150
- **Gilera:** Smash 110
- **Zanella:** RX 150, ZB 110, Sapucai
- **Motomel:** Bit, Blitz, CG 150 S2
- **Keller:** Crono Classic 110, Bit
- **Mondial:** LD 110, RD, BK
- **Suzuki:** AX 100/115
- **Beta:** BS, BK
- **Guerrero:** Trip, Trip Blitz
- **Vertigo:** V32 Vanguard, V10 Fluid (cascos)

→ Estos modelos definen los **filtros por modelo** que vamos a agregar en la web nueva.

## Recomendaciones para la nueva web

1. ✅ Reescribir 100% del contenido editorial (home hero, historia, mayorista, FAQs).
2. ✅ Re-categorizar productos por su nombre (no confiar en taxonomy actual).
3. ✅ Agregar filtros por modelo de moto (alto valor para el comprador).
4. ✅ CTA WhatsApp directo desde cada producto (con mensaje pre-cargado).
5. ✅ Sello de confianza visible (ubicación física, años, IG real).
6. ✅ Schema markup Product + LocalBusiness.
7. ⚠️ Limitar a productos verificables del nicho — no replicar los 1000 del sitemap.
8. ⚠️ Cuando Tomas consiga acceso al hosting, evaluar migración real a TiendaNube con catálogo completo.
</content>
</invoke>