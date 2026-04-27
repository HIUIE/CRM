import type { ApiErrorPayload } from '../types/api';

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
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
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
  const response = await fetch(url, { method: 'POST', body: formData, credentials: 'include' });
  if (!response.ok) {
    let msg = '上传失败';
    try { const res = await response.json(); msg = res.error || res.message || msg; } catch (e) { /* ignore */ }
    throw new ApiError(response.status, msg);
  }
  return response.json() as Promise<T>;
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
