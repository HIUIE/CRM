import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950 p-8">
          <div className="max-w-lg text-center space-y-4">
            <div className="text-4xl font-bold text-primary-navy dark:text-white">页面出现异常</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              组件渲染时发生错误，请刷新页面重试。
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg p-4 overflow-auto max-h-40 text-error">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-primary-navy dark:bg-tertiary-sage text-white dark:text-navy-950 rounded-lg text-sm font-bold hover:opacity-90 transition-all"
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
