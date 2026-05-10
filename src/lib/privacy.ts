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

export function maskAiSensitiveText(text: string): string {
  if (!text) return '';

  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[邮箱已脱敏]')
    .replace(/(?:\+?\d[\d\s-]{6,}\d)/g, '[号码已脱敏]')
    .replace(/\b\d{16,19}\b/g, '[长数字已脱敏]');
}

export function hasAiSensitiveText(text: string): boolean {
  return Boolean(text) && maskAiSensitiveText(text) !== text;
}
