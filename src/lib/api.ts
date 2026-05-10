import type { ApiErrorPayload } from '../types/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 15_000;

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function apiFetch<T>(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const isStateChanging = init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase());
  if (isStateChanging) {
    const csrf = getCsrfToken();
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  const isJsonBody = init.body && !(init.body instanceof FormData);

  if (isJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetchWithRetry(input, {
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
    const payload = (typeof data === 'object' && data ? data : null) as ApiErrorPayload | null;
    const message =
      payload
        ? typeof payload.error === 'string'
          ? payload.error
          : typeof payload.error === 'object' && payload.error && typeof payload.error.message === 'string'
            ? payload.error.message
            : typeof payload.message === 'string'
              ? payload.message
              : '请求失败'
        : '请求失败';
    throw new ApiError(response.status, message);
  }

  return data as T;
}

export async function apiDownload(input: string, init: RequestInit = {}) {
  const csrf = getCsrfToken();
  const headers = new Headers(init.headers);
  if (csrf && (init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase()))) {
    headers.set('X-CSRF-Token', csrf);
  }
  const response = await fetchWithRetry(input, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('app:unauthorized'));
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    let message = '下载失败';

    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as ApiErrorPayload;
      message =
        typeof payload.error === 'string'
          ? payload.error
          : typeof payload.error === 'object' && payload.error && typeof payload.error.message === 'string'
            ? payload.error.message
            : typeof payload.message === 'string'
              ? payload.message
              : message;
    }

    throw new ApiError(response.status, message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const simpleMatch = disposition.match(/filename="([^"]+)"/i);
  const fileName = utf8Match ? decodeURIComponent(utf8Match[1]) : simpleMatch?.[1] || 'download';
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

export async function apiUploadSimple<T>(url: string, formData: FormData): Promise<T> {
  const csrf = getCsrfToken();
  const response = await fetch(url, {
    method: 'POST', body: formData, credentials: 'include',
    headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
  } as RequestInit);
  if (!response.ok) {
    let msg = '上传失败';
    try { const res = await response.json(); msg = res.error || res.message || msg; } catch (e) { /* ignore */ }
    throw new ApiError(response.status, msg);
  }
  return response.json() as Promise<T>;
}

async function fetchWithRetry(input: string, init: RequestInit, maxAttempts = 2) {
  const method = String(init.method || 'GET').toUpperCase();
  const retryableMethod = method === 'GET' || method === 'HEAD';
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const upstreamSignal = init.signal;
    const abortFromUpstream = () => controller.abort();
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      if (!retryableMethod || !RETRYABLE_STATUS.has(response.status) || attempt >= maxAttempts) {
        return response;
      }
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastError = error;
      if (!retryableMethod || attempt >= maxAttempts || upstreamSignal?.aborted) {
        throw error;
      }
    } finally {
      window.clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
    await new Promise(resolve => window.setTimeout(resolve, 450 * attempt));
  }

  throw lastError instanceof Error ? lastError : new ApiError(0, '网络连接错误');
}

export function apiUpload<T>(url: string, formData: FormData, onProgress?: (percent: number) => void): Promise<T> {
  if (!onProgress) {
    return apiUploadSimple(url, formData);
  }
  // XHR is used specifically for upload progress tracking (Fetch API lacks native upload progress)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.withCredentials = true;
    const csrf = getCsrfToken();
    if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText) as T); }
        catch { resolve(xhr.responseText as unknown as T); }
      } else {
        let msg = '上传失败';
        try { const res = JSON.parse(xhr.responseText); msg = res.error || res.message || msg; } catch { /* ignore */ }
        reject(new ApiError(xhr.status, msg));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, '网络连接错误'));
    xhr.send(formData);
  });
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
