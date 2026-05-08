import type { ComponentType } from 'react';

const LAZY_RELOAD_KEY = 'smarttrade:lazy-reload-once';

function isLazyLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /dynamically imported module/i.test(message)
  );
}

export function lazyRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return async () => {
    try {
      const module = await factory();
      window.sessionStorage.removeItem(LAZY_RELOAD_KEY);
      return module;
    } catch (error) {
      if (isLazyLoadError(error) && window.sessionStorage.getItem(LAZY_RELOAD_KEY) !== '1') {
        window.sessionStorage.setItem(LAZY_RELOAD_KEY, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => undefined);
      }
      throw error;
    }
  };
}
