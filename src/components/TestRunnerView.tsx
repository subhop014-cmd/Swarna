import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { IndianLanguage } from '../types';
import { getUI } from '../i18n/uiTranslations';
import { runAllAutomatedTests, TestSuiteSummary } from '../tests/run-all-tests';

interface TestRunnerViewProps {
  activeLanguage: IndianLanguage;
}

export const TestRunnerView: React.FC<TestRunnerViewProps> = ({ activeLanguage }) => {
  const ui = getUI(activeLanguage);
  const [summary, setSummary] = useState<TestSuiteSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const executeTests = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/tests/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        const resLocal = runAllAutomatedTests();
        setSummary(resLocal);
      }
    } catch {
      const resLocal = runAllAutomatedTests();
      setSummary(resLocal);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    executeTests();
  }, []);

  return (
    <div className="space-y-5 text-slate-900 dark:text-slate-100">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight font-cinzel">
              {ui.testRunnerTitle}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {ui.bisHallmarkedErp}
          </p>
        </div>

        <button
          onClick={executeTests}
          disabled={isRunning}
          className="flex items-center space-x-1.5 px-4 py-2 bg-[#C9A24A] hover:bg-[#B38F3B] dark:hover:bg-[#E5C158] disabled:opacity-50 text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition cursor-pointer whitespace-nowrap shrink-0"
        >
          {isRunning ? (
            <RotateCcw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span>{isRunning ? '...' : ui.submit}</span>
        </button>
      </div>

      {/* Summary Scorecard */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-xs">
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Assertions</div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
              {summary.total} Tests
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4.5 shadow-xs">
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Passed Assertions</span>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
              {summary.passed} / {summary.total}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-xs">
            <div className="text-xs text-slate-500 dark:text-slate-400">Failed Assertions</div>
            <div className={`text-2xl font-bold font-mono mt-1 ${summary.failed > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {summary.failed}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-xs">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Execution Time</span>
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
              {summary.durationMs} ms
            </div>
          </div>
        </div>
      )}

      {/* Test List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Automated Assertion Log
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {summary?.timestamp ? new Date(summary.timestamp).toLocaleTimeString() : ''}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {summary?.results.map((r, idx) => (
            <div
              key={idx}
              className="p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition flex items-center justify-between text-xs"
            >
              <div className="flex items-center space-x-3">
                {r.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-[#9A7426] dark:text-[#E5C158] px-1.5 py-0.5 rounded font-mono font-medium border border-slate-200 dark:border-slate-800">
                      {r.suite}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{r.name}</span>
                  </div>
                  {r.message && <div className="text-rose-600 dark:text-rose-400 text-[11px] mt-0.5">{r.message}</div>}
                </div>
              </div>

              <div className="flex items-center space-x-3 font-mono">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{r.durationMs}ms</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    r.passed ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                  }`}
                >
                  {r.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
