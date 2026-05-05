export function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildWhatsAppLink(
  phone: string,
  message: string,
): string {
  const clean = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function buildProductWhatsAppMessage(productName: string): string {
  return `Hola! Vengo de la web. Quería consultar por: ${productName}`;
}
