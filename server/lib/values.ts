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

/**
 * Parse pagination query parameters with sensible defaults.
 * Returns { page, pageSize, offset } for SQL queries.
 * Max pageSize capped at 500 to prevent excessive data retrieval.
 */
export function readPagination(query: Record<string, unknown>) {
  const page = Math.max(1, Math.floor(readNumber(query.page) || 1));
  const rawSize = Math.floor(readNumber(query.pageSize) || 200);
  const pageSize = Math.min(Math.max(1, rawSize), 500);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function buildLimitOffset(pagination: { pageSize: number; offset: number }) {
  return ` LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
}
