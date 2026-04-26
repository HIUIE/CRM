/**
 * Frontend Privacy Masking Utility
 */

export function maskContact(str: string | undefined | null): string {
  if (!str) return '—';
  
  // Mask Email
  if (str.includes('@')) {
    const [name, domain] = str.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
  }
  
  // Mask Phone (Assuming digits)
  const digits = str.replace(/\D/g, '');
  if (digits.length >= 7) {
    return str.replace(/(\d{3})\d{4}(\d{2,})/, '$1****$2');
  }
  
  // Generic Mask
  if (str.length > 4) {
    return str.slice(0, 2) + '***' + str.slice(-2);
  }
  
  return '***';
}
