import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  Building2,
  Check,
  CheckCircle,
  CreditCard,
  Database,
  History,
  Layers,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AuditLog, IndianLanguage, SubscriptionPlan, Tenant } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { getUI } from '../i18n/uiTranslations';
import { formatINR } from '../utils/goldMath';

interface AdminViewProps {
  tenants: Tenant[];
  currentTenant: Tenant | null;
  plans: SubscriptionPlan[];
  auditLogs: AuditLog[];
  activeLanguage: IndianLanguage;
  onUpgradePlan: (planId: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  tenants,
  currentTenant,
  plans,
  auditLogs,
  activeLanguage,
  onUpgradePlan,
}) => {
  const t = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;
  const ui = getUI(activeLanguage);
  const [activeSubTab, setActiveSubTab] = useState<'plans' | 'tenants' | 'audit'>('plans');

  return (
    <div className="space-y-5">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight font-cinzel">
              {ui.adminTitle}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {ui.adminSubtitle}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => setActiveSubTab('plans')}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              activeSubTab === 'plans'
                ? 'bg-slate-900 dark:bg-[#C9A24A] text-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            {t.platformAdmin}
          </button>
          <button
            onClick={() => setActiveSubTab('tenants')}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              activeSubTab === 'tenants'
                ? 'bg-slate-900 dark:bg-[#C9A24A] text-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            {ui.workshopProfile}
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
              activeSubTab === 'audit'
                ? 'bg-slate-900 dark:bg-[#C9A24A] text-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            {ui.tabAllTransactions}
          </button>
        </div>
      </div>

      {/* Subscriptions Grid */}
      {activeSubTab === 'plans' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isCurrent = currentTenant?.subscriptionPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`bg-white dark:bg-slate-900 rounded-xl p-5 border flex flex-col justify-between space-y-4 shadow-xs transition ${
                    isCurrent
                      ? 'border-amber-400 dark:border-amber-500/70 ring-2 ring-amber-400/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{plan.name}</h3>
                      {isCurrent && (
                        <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold px-2 py-0.5 rounded-full">
                          Current Plan
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5">
                      <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                        {plan.priceINRMonth === 0 ? 'Free' : formatINR(plan.priceINRMonth)}
                      </span>
                      {plan.priceINRMonth > 0 && <span className="text-xs text-slate-500 dark:text-slate-400"> / month</span>}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Max Users:</span>
                        <span className="font-bold font-mono tabular-nums text-slate-800 dark:text-slate-200">{plan.maxUsers}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Transactions / mo:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{plan.maxMonthlyTransactions.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider block">
                        Included Features:
                      </span>
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={isCurrent}
                    onClick={() => onUpgradePlan(plan.id)}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition shadow-xs ${
                      isCurrent
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
                        : 'bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950'
                    }`}
                  >
                    {isCurrent ? 'Active Subscription' : 'Upgrade Plan'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tenants Directory */}
      {activeSubTab === 'tenants' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-semibold">
              <tr>
                <th className="p-3">Tenant ID</th>
                <th className="p-3">Business Name & Model</th>
                <th className="p-3">City & State</th>
                <th className="p-3">GSTIN / Hallmarking</th>
                <th className="p-3">Subscription</th>
                <th className="p-3">Registered Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {tenants.map((ten) => (
                <tr key={ten.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">{ten.id}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{ten.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{ten.businessType}</div>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">
                    {ten.city}, {ten.state}
                  </td>
                  <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    <div>{ten.gstin || 'Unregistered'}</div>
                    <div className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold">{ten.hallmarkLicenseNo || 'BIS Pending'}</div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ten.subscriptionStatus === 'ACTIVE'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                      }`}
                    >
                      {ten.subscriptionStatus}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    {ten.createdAt?.split('T')[0] || '2026-01-01'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Trail */}
      {activeSubTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-semibold">
              <tr>
                <th className="p-3">Timestamp (UTC)</th>
                <th className="p-3">User & Role</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity Reference</th>
                <th className="p-3">IP / Session Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{log.userName}</td>
                  <td className="p-3 font-mono text-slate-900 dark:text-slate-100 font-medium">{log.action}</td>
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {log.entity} #{log.entityId}
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">
                    {log.details || 'System operation'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
