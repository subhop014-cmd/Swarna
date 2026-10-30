import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : 'Unexpected application render error';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    console.error('SwarnaERP UI ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleResetAndReload = (): void => {
    try {
      localStorage.removeItem('swarna_erp_language');
      localStorage.removeItem('swarna_erp_printer_settings');
      localStorage.removeItem('swarna_erp_show_rupees');
    } catch {
      // Ignore storage access errors in restricted frames
    }
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Unable to display workspace
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                SwarnaERP encountered an unexpected display error. Reloading or resetting cached browser preferences restores the workspace without affecting server ledger records.
              </p>
            </div>

            {this.state.errorMessage && (
              <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-rose-700 dark:text-rose-400 break-words">
                {this.state.errorMessage}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-[#C9A24A] hover:bg-[#B38F3B] text-white dark:text-slate-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Reset Local Cache &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const container =
  document.getElementById('root') ||
  (() => {
    const el = document.createElement('div');
    el.id = 'root';
    document.body.appendChild(el);
    return el;
  })();

createRoot(container).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
