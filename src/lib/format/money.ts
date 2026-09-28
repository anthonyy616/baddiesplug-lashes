/**
 * Single shared money formatters. All kobo amounts (server-persisted values)
 * render through these — never client-calculated totals.
 */
export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(kobo) / 100);
}

/** Compact variant (no forced decimals) for catalog cards and headers. */
export function formatNairaCompact(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(Number(kobo) / 100);
}
