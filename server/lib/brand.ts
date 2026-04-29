function stripControlChars(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

export function normalizeBrandText(value: string, fallback: string, maxLength = 120) {
  const normalized = stripControlChars(String(value || '')).slice(0, maxLength);
  return normalized || fallback;
}

export function sanitizeBrandAssetUrl(value: string, fallback = '') {
  const normalized = stripControlChars(String(value || ''));
  if (!normalized) {
    return fallback;
  }
  if (/[<>"'`]/.test(normalized)) {
    return fallback;
  }
  if (/^(javascript|data):/i.test(normalized)) {
    return fallback;
  }
  if (normalized.startsWith('/')) {
    return normalized;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return fallback;
}

export function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
