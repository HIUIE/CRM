export function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function readNumber(value: unknown) {
  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : NaN;
}

export function isOneOf<T extends readonly string[]>(value: string, options: T): value is T[number] {
  return options.includes(value as T[number]);
}

export function readOptionalDate(value: unknown) {
  const text = readString(value);
  if (!text) {
    return '';
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '__invalid__';
}

export function readAttachmentIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function monthFromDateInput(value: string) {
  return /^\d{4}-\d{2}$/.test(value) ? value : '';
}

export function normalizeOrderStatus(status: string) {
  if (status === 'confirmed') {
    return 'production';
  }
  if (status === 'shipped') {
    return 'shipping';
  }
  return status;
}
