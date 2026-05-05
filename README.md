# XP Repuestos — Sitio web

Catálogo + landing del comercio **XP Repuestos** (repuestos y accesorios para motos en CABA).

## Stack

- **Astro 5** (output estático)
- **Tailwind CSS v4** (vía `@tailwindcss/vite`)
- **TypeScript**
- Hosting: **Vercel**
- Repo: **GitHub** (`main` = producción)

## Comandos

```powershell
npm install
npm run dev       # http://localhost:4321
npm run build     # genera /dist
npm run preview   # sirve /dist localmente
```

## Estructura

```
src/
├── components/     Componentes Astro (Header, Footer, ProductCard, etc.)
├── data/           Productos, categorías, datos del sitio (JSON)
├── layouts/        Layout base con SEO + fonts + header/footer
├── pages/          Rutas (home, tienda, /producto/[slug], /tienda/[cat], etc.)
└── styles/         CSS global con tokens Tailwind v4
```

## Edición de productos

Todos los productos se editan en [src/data/products.json](src/data/products.json).

Cada producto:

```json
{
  "slug": "kit-piston-rx150",
  "nombre": "Kit Pistón RX 150",
  "categoria": "motor",
  "precio": 10025,
  "imagen": "https://...",
  "marca": "Zanella",
  "modelos": ["RX 150"],
  "stock": true,
  "destacado": true
}
```

Categorías disponibles (ver `src/data/categories.json`): `cascos`, `motor`, `electrico`, `rodante`, `tornilleria`.

## Datos de contacto

Editar [src/data/site.json](src/data/site.json) — un único punto de cambio para WhatsApp, email, dirección, redes, horarios.

## Notas para Tomas

- `+54 987-6543` (WhatsApp) y `hola@xprepuestos.com.ar` se usaron como datos reales — **verificar y corregir si hace falta**.
- `info@xprepuestos.com` y `+541123456789` del sitio actual son placeholders del theme demo y **no se usan**.
- Las pagina políticas (envíos, devoluciones, T&C) están redactadas con texto base estándar de ecommerce argentino y marcadas con `{{REVISAR}}` donde hace falta tu confirmación.
- Cuando consigas acceso al hosting actual, el catálogo y la copy están listos para migrar a TiendaNube/Shopify.
</content>
</invoke>