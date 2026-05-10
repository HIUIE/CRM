import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const ERROR_RELOAD_KEY = 'smarttrade:error-boundary-reload-once';

function getErrorMessage(error: Error) {
  return error.message || String(error);
}

function isRecoverableRuntimeMismatch(error: Error) {
  const message = getErrorMessage(error);
  return (
    /Cannot read properties of null \(reading 'use[A-Z][A-Za-z]*'\)/i.test(message) ||
    /Cannot read properties of null \(reading 'useContext'\)/i.test(message)
  );
}

function isRecoverableAssetError(error: Error) {
  const message = getErrorMessage(error);
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

function getReloadKey(error: Error) {
  const normalizedMessage = getErrorMessage(error).replace(/\s+/g, ' ').slice(0, 120);
  return `${ERROR_RELOAD_KEY}:${window.location.pathname}:${normalizedMessage}`;
}

function recoverFromRuntimeError(error: Error) {
  const reloadKey = getReloadKey(error);
  if (window.sessionStorage.getItem(reloadKey) === '1') return false;
  window.sessionStorage.setItem(reloadKey, '1');
  const url = new URL(window.location.href);
  url.searchParams.set('_recover', String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

export default class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
    if ((isRecoverableAssetError(error) || isRecoverableRuntimeMismatch(error))) {
      recoverFromRuntimeError(error);
    }
  }

  // Explicit field declarations for useDefineForClassFields: false compatibility
  declare state: State;
  declare props: Props;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950 p-8">
          <div className="max-w-lg text-center space-y-4">
            <div className="text-4xl font-bold text-primary-navy dark:text-white">页面出现异常</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              组件渲染时发生错误。系统已尝试自动恢复，如仍停留在此页，请手动刷新。
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-surface dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-4 overflow-auto max-h-40 text-error">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
