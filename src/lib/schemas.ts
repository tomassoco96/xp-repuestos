/**
 * Schemas Zod para validar inputs en endpoints.
 * Todo lo que viene del cliente pasa por uno de estos schemas antes de tocar
 * lógica server. Si Zod falla → 400.
 */

import { z } from 'zod';

// Item del carrito tal como lo manda el cliente (¡SIN precio!).
// Server recalcula precio desde products.json autoritativo.
export const CartItemInputSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'slug debe ser kebab-case'),
  qty: z.number().int().positive().max(50),
});

export const BuyerSchema = z.object({
  nombre: z.string().min(2).max(80),
  apellido: z.string().min(2).max(80),
  email: z.string().email().max(120),
  telefono: z
    .string()
    .min(8)
    .max(20)
    .regex(/^[0-9+ \-()]+$/, 'teléfono inválido'),
  dni: z
    .string()
    .min(7)
    .max(11)
    .regex(/^[0-9.]+$/, 'DNI inválido')
    .optional()
    .or(z.literal('')),
  direccion: z.string().min(3).max(120),
  ciudad: z.string().min(2).max(80),
  provincia: z.string().min(2).max(80),
  codigoPostal: z
    .string()
    .min(4)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, 'código postal inválido'),
  notas: z.string().max(500).optional().or(z.literal('')),
});

export const CreatePreferenceSchema = z.object({
  items: z.array(CartItemInputSchema).min(1).max(50),
  buyer: BuyerSchema,
  // Aceptación obligatoria de T&C (defense in depth — el cliente ya lo valida).
  acepto_terminos: z.literal(true).optional(),
  // Honeypot anti-bot: si viene con valor el server rechaza con 400 (defense in depth).
  hp_website: z.string().max(0).optional().or(z.literal('')),
});

export type CartItemInput = z.infer<typeof CartItemInputSchema>;
export type Buyer = z.infer<typeof BuyerSchema>;
export type CreatePreferenceBody = z.infer<typeof CreatePreferenceSchema>;
