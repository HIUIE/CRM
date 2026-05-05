import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock document.cookie
Object.defineProperty(global.document, 'cookie', {
  writable: true,
  value: '',
});

// Mock URL.createObjectURL and URL.revokeObjectURL
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:test'),
  revokeObjectURL: vi.fn(),
});

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = '';
  });

  it('attaches CSRF token for state-changing requests', async () => {
    document.cookie = 'csrf_token=my-test-csrf-token; path=/';
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ success: true }),
    });

    const { apiFetch } = await import('../api');
    await apiFetch('/api/test', { method: 'POST', body: JSON.stringify({}) });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get('X-CSRF-Token')).toBe('my-test-csrf-token');
  });

  it('does NOT attach CSRF token for GET requests', async () => {
    document.cookie = 'csrf_token=my-test-csrf-token; path=/';
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ data: 'ok' }),
    });

    const { apiFetch } = await import('../api');
    await apiFetch('/api/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers?.get?.('X-CSRF-Token') ?? undefined).toBeUndefined();
  });

  it('includes credentials: include', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ success: true }),
    });

    const { apiFetch } = await import('../api');
    await apiFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('throws ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      ok: false,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ error: { code: 'BAD_REQUEST', message: 'Something went wrong' } }),
    });

    const { apiFetch, ApiError } = await import('../api');
    await expect(apiFetch('/api/test')).rejects.toThrow(ApiError);
    await expect(apiFetch('/api/test')).rejects.toThrow('Something went wrong');
  });

  it('dispatches unauthorized event on 401', async () => {
    const dispatchSpy = vi.fn();
    window.addEventListener('app:unauthorized', dispatchSpy);

    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    const { apiFetch } = await import('../api');
    await expect(apiFetch('/api/protected')).rejects.toThrow();

    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('uses POST method and sends JSON body', async () => {
    document.cookie = 'csrf_token=csrf123; path=/';
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      json: () => Promise.resolve({ id: 1 }),
    });

    const { apiFetch } = await import('../api');
    const body = { name: 'Test' };
    await apiFetch('/api/create', { method: 'POST', body: JSON.stringify(body) });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/create');
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify(body));
    expect(options.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('getErrorMessage', () => {
  it('returns ApiError.message for ApiError instances', async () => {
    const { getErrorMessage, ApiError } = await import('../api');
    const err = new ApiError(403, 'Forbidden');
    expect(getErrorMessage(err)).toBe('Forbidden');
  });

  it('returns Error.message for standard errors', async () => {
    const { getErrorMessage } = await import('../api');
    expect(getErrorMessage(new Error('network error'))).toBe('network error');
  });

  it('returns fallback for unknown error types', async () => {
    const { getErrorMessage } = await import('../api');
    expect(getErrorMessage(null)).toBe('操作失败，请稍后重试');
    expect(getErrorMessage(undefined)).toBe('操作失败，请稍后重试');
    expect(getErrorMessage('string error')).toBe('操作失败，请稍后重试');
  });
});
