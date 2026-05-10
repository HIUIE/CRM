const RUNTIME_RECOVERY_KEY = 'smarttrade:runtime-recovery-once';

function isRecoverableRuntimeError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || '');
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Cannot read properties of null \(reading 'use[A-Z][A-Za-z]*'\)/i.test(message) ||
    /Cannot read properties of null \(reading 'useContext'\)/i.test(message)
  );
}

function recoverOnce(reason: unknown) {
  if (!isRecoverableRuntimeError(reason)) return;
  const key = `${RUNTIME_RECOVERY_KEY}:${window.location.pathname}`;
  if (window.sessionStorage.getItem(key) === '1') return;
  window.sessionStorage.setItem(key, '1');
  const url = new URL(window.location.href);
  url.searchParams.set('_recover', String(Date.now()));
  window.location.replace(url.toString());
}

export function installRuntimeRecovery() {
  window.addEventListener('error', (event) => recoverOnce(event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => recoverOnce(event.reason));
}
