export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export async function apiFetch<T>(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const isJsonBody = init.body && !(init.body instanceof FormData);

  if (isJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let data: JsonValue = null;

  if (contentType.includes('application/json')) {
    data = (await response.json()) as JsonValue;
  } else {
    data = await response.text();
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('app:unauthorized'));
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data && typeof data.error === 'string'
        ? data.error
        : '请求失败';
    throw new ApiError(response.status, message);
  }

  return data as T;
}

export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后重试') {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
