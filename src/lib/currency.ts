export function getCurrency(): string {
  try {
    const v = (globalThis as any)?.process?.env?.APP_CURRENCY;
    if (typeof v === 'string' && v.trim()) return v.trim().toUpperCase();
  } catch {}
  return 'NIO';
}

export function getLocale(): string {
  try {
    const v = (globalThis as any)?.process?.env?.APP_LOCALE;
    if (typeof v === 'string' && v.trim()) return v.trim();
  } catch {}
  return 'es-NI';
}

// Centralized formatters
export function formatCurrency(value: number, currencyCode?: string): string {
  const currency = (currencyCode || getCurrency()) as string;
  const locale = getLocale();
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value) || 0);
  } catch {
    // Fallback simple formatting
    const n = Number(value) || 0;
    return `${currency} ${n.toLocaleString(locale)}`;
  }
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const locale = getLocale();
  try {
    return new Intl.NumberFormat(locale, options).format(Number(value) || 0);
  } catch {
    return (Number(value) || 0).toLocaleString();
  }
}
