/**
 * 校验密码强度
 * 要求：至少 8 位，包含大写字母、小写字母、数字和特殊字符。
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message: string } {
  if (!password || password.length < 8) {
    return { isValid: false, message: '密码长度需至少 8 位' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: '密码需包含至少一个大写字母' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: '密码需包含至少一个小写字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: '密码需包含至少一个数字' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { isValid: false, message: '密码需包含至少一个特殊字符（如 !@#$%^&*）' };
  }
  return { isValid: true, message: '' };
}

export function readString(value: unknown, maxLength = 10000) {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > maxLength ? s.slice(0, maxLength) : s;
}

export function readNumber(value: unknown) {
  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : NaN;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

export function buildLimitOffset(
  pagination: { pageSize: number; offset: number },
  params: unknown[],
) {
  params.push(pagination.pageSize, pagination.offset);
  return ` LIMIT ? OFFSET ?`;
}

/**
 * 计算两个字符串之间的编辑距离 (Levenshtein Distance)
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * 计算两个字符串的相似度 (0-1)
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const v1 = s1.trim().toLowerCase();
  const v2 = s2.trim().toLowerCase();
  if (v1 === v2) return 1;
  const maxLength = Math.max(v1.length, v2.length);
  if (maxLength === 0) return 1;
  const dist = levenshteinDistance(v1, v2);
  return 1 - dist / maxLength;
}
