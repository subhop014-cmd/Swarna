import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, Hammer, Plus, Receipt, Users } from 'lucide-react';
import {
  Customer,
  GoldLedgerEntry,
  GoldRate,
  IndianLanguage,
  Invoice,
  JobCard,
  Tenant,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { POS_TRANSLATIONS } from '../i18n/posTranslations';
import { getUI } from '../i18n/uiTranslations';
import { getPaymentStrings } from '../i18n/paymentTranslations';
import { formatGrams, formatINR } from '../utils/goldMath';
import {
  computeCustomerGoldSummary,
  computeWastageSummary,
  getDashboardExtraUI,
  getLocalTodayDateStr,
  isInvoiceOnLocalDate,
} from '../utils/dashboardMetrics';
import { GoldPurityConverter } from './GoldPurityConverter';

interface DashboardViewProps {
  currentTenant: Tenant | null;
  stockSummary: any;
  ledgerEntries?: GoldLedgerEntry[];
  jobCards: JobCard[];
  invoices: Invoice[];
  customers?: Customer[];
  activeLanguage: IndianLanguage;
  goldRates: GoldRate[];
  onNavigate: (tab: any) => void;
  onOpenIssueModal: () => void;
  onOpenInvoiceModal: () => void;
  onOpenCustomerDepositModal: () => void;
  onOpenMeltingModal: () => void;
  showRupees?: boolean;
}

const INWARD_TYPES = new Set([
  'OPENING_BALANCE',
  'BULLION_PURCHASE',
  'CUSTOMER_OLD_GOLD',
  'CUSTOMER_DEPOSIT',
  'RETURN_FROM_KARIGAR',
  'RETURN_FROM_PARTY',
  'RECEIVE_FROM_MELTING',
  'FINISHED_JEWELLERY_RECEIPT',
  'SCRAP_RECOVERY',
]);

function formatReadableCode(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentTenant,
  stockSummary,
  ledgerEntries = [],
  jobCards,
  invoices = [],
  customers = [],
  activeLanguage,
  goldRates,
  onNavigate,
  onOpenIssueModal,
  showRupees = false,
}) => {
  const t = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;
  const posT = POS_TRANSLATIONS[activeLanguage] || POS_TRANSLATIONS.en;
  const ui = getUI(activeLanguage);
  const payT = getPaymentStrings(activeLanguage);
  const dUI = getDashboardExtraUI(activeLanguage);

  const [wastageFilter, setWastageFilter] = useState<'TODAY' | 'ALL'>('TODAY');
  const [customerFilter, setCustomerFilter] = useState<'ALL' | 'DUE' | 'CUSTODY'>('ALL');
  const wastageReportRef = useRef<HTMLDivElement | null>(null);

  const todayStr = getLocalTodayDateStr();

  // Live workshop balances
  const totalPhysical = stockSummary?.totalPhysicalGrams || 0;
  const totalFineGold = stockSummary?.totalFineGoldGrams || 0;
  const vaultGold =
    stockSummary?.mainVaultGrams ?? stockSummary?.accountBalances?.BUSINESS_OWNED?.netWeight ?? 0;
  const finishedJewellery = stockSummary?.accountBalances?.FINISHED_GOODS?.netWeight ?? 0;
  const karigarGold =
    stockSummary?.karigarHeldGrams ?? stockSummary?.accountBalances?.KARIGAR_HELD?.netWeight ?? 0;

  // Customer Gold (Receivable Due With Customers + Customer Custody Held)
  const customerGoldSummary = useMemo(
    () => computeCustomerGoldSummary(customers, stockSummary),
    [customers, stockSummary]
  );

  // Wastage Collected Today & All-Time Wastage Report
  const wastageSummary = useMemo(
    () => computeWastageSummary(invoices, todayStr),
    [invoices, todayStr]
  );

  const activeWastageStats =
    wastageFilter === 'TODAY' ? wastageSummary.today : wastageSummary.allTime;

  const filteredCustomerRows = useMemo(() => {
    if (customerFilter === 'DUE') return customerGoldSummary.dueCustomers;
    if (customerFilter === 'CUSTODY') return customerGoldSummary.custodyCustomers;
    return customerGoldSummary.activeGoldCustomers;
  }, [customerFilter, customerGoldSummary]);

  const validInvoices = useMemo(
    () => invoices.filter((inv) => inv && inv.status !== 'CANCELLED'),
    [invoices]
  );
  const todaySalesINR = useMemo(
    () =>
      validInvoices
        .filter((inv) => isInvoiceOnLocalDate(inv, todayStr))
        .reduce((sum, inv) => sum + (inv.grandTotalINR || 0), 0),
    [validInvoices, todayStr]
  );
  const totalSalesINR = useMemo(
    () => validInvoices.reduce((sum, inv) => sum + (inv.grandTotalINR || 0), 0),
    [validInvoices]
  );

  const activeJobs = jobCards.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const overdueJobs = activeJobs.filter((j) => j.dueDate && j.dueDate < todayStr);

  // Show standard purities plus any other purity with non-zero weight
  const basePurities = ['24K', '22K', '18K', '14K'];
  const purityBreakdown = (stockSummary?.purityBalances || [])
    .filter((pb: any) => basePurities.includes(pb.purity) || pb.netWeight > 0)
    .map((pb: any) => ({
      purity: pb.purity,
      fineness:
        pb.purity === '24K'
          ? '999.9'
          : pb.purity === '22K'
          ? '916.0'
          : pb.purity === '18K'
          ? '750.0'
          : pb.purity === '14K'
          ? '585.0'
          : '—',
      netWeight: pb.netWeight || 0,
      fineGold: pb.fineGoldWeight || 0,
    }));

  const displayPurities =
    purityBreakdown.length > 0
      ? purityBreakdown
      : basePurities.map((p) => ({
          purity: p,
          fineness: p === '24K' ? '999.9' : p === '22K' ? '916.0' : p === '18K' ? '750.0' : '585.0',
          netWeight: 0,
          fineGold: 0,
        }));

  const recentMovements = ledgerEntries.slice(0, 6);

  const handleFocusWastageToday = () => {
    setWastageFilter('TODAY');
    wastageReportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* 1. CLEAN PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {currentTenant?.name || 'Kanakdhara Gold Ornaments'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {ui.dashboardTitle}
            {currentTenant?.gstin ? (
              <span className="font-mono tabular-nums"> · GSTIN {currentTenant.gstin}</span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenIssueModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Hammer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{t.issueGold}</span>
          </button>
          <button
            onClick={() => onNavigate('posTransactions')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-[#E5C158] dark:text-slate-950 font-semibold rounded-lg text-xs transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{ui.quickPosAction}</span>
          </button>
        </div>
      </div>

      {/* 2. ESSENTIAL METRICS STRIP (Single-Elevation Hairline Grid) */}
      <div
        className={`bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden grid grid-cols-2 sm:grid-cols-3 ${
          showRupees ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
        } gap-px`}
      >
        {/* Metric 1: Total Fine Gold */}
        <button
          type="button"
          onClick={() => onNavigate('goldLedger')}
          className="p-4 text-left bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/80 transition cursor-pointer"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{ui.businessFineGold}</div>
          <div className="text-lg xl:text-xl font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158] mt-1">
            {formatGrams(totalFineGold, 3)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {ui.grossWt}: {formatGrams(totalPhysical, 3)}
          </div>
        </button>

        {/* Metric 2: Vault + Finished Stock */}
        <button
          type="button"
          onClick={() => onNavigate('reports')}
          className="p-4 text-left bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/80 transition cursor-pointer"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{posT.kpiVaultBalance}</div>
          <div className="text-lg xl:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {formatGrams(vaultGold + finishedJewellery, 3)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">
            {t.finishedJewellery}: {formatGrams(finishedJewellery, 3)}
          </div>
        </button>

        {/* Metric 3: Gold With Karigars */}
        <button
          type="button"
          onClick={() => onNavigate('karigars')}
          className="p-4 text-left bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/80 transition cursor-pointer"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{ui.goldWithKarigars}</div>
          <div className="text-lg xl:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {formatGrams(karigarGold, 3)}
          </div>
          <div className="text-[11px] font-mono tabular-nums mt-0.5 truncate">
            <span className="text-slate-500 dark:text-slate-400">
              {activeJobs.length} {ui.openJobs}
            </span>
            {overdueJobs.length > 0 && (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                {' '}
                · {overdueJobs.length} {ui.dueDate}
              </span>
            )}
          </div>
        </button>

        {/* Metric 4: Gold With Customers (Always Visible) */}
        <button
          type="button"
          onClick={() => onNavigate('customers')}
          className="p-4 text-left bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/80 transition cursor-pointer"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{dUI.goldWithCustomers}</div>
          <div
            className={`text-lg xl:text-xl font-bold font-mono tabular-nums mt-1 ${
              customerGoldSummary.goldWithCustomersDueGrams > 0
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {formatGrams(customerGoldSummary.goldWithCustomersDueGrams, 3)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            <span>
              {customerGoldSummary.dueCustomersCount} {dUI.dueShort}
            </span>
            <span> · </span>
            <span
              className={
                customerGoldSummary.customerCustodyGrams > 0
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                  : 'text-slate-400 dark:text-slate-500'
              }
            >
              {dUI.custodyShort}: {formatGrams(customerGoldSummary.customerCustodyGrams, 3)}
            </span>
          </div>
        </button>

        {/* Metric 5: Wastage Collected Today (Always Visible) */}
        <button
          type="button"
          onClick={handleFocusWastageToday}
          className={`p-4 text-left bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/80 transition cursor-pointer ${
            !showRupees ? 'col-span-2 sm:col-span-2 lg:col-span-1' : ''
          }`}
        >
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{dUI.wastageCollectedToday}</div>
          <div
            className={`text-lg xl:text-xl font-bold font-mono tabular-nums mt-1 ${
              wastageSummary.today.wastageGrams > 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {wastageSummary.today.wastageGrams > 0 ? '+' : ''}
            {formatGrams(wastageSummary.today.wastageGrams, 3)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {showRupees && wastageSummary.today.wastageValueINR > 0 ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                {formatINR(wastageSummary.today.wastageValueINR)}
              </span>
            ) : (
              <span className="text-[#9A7426] dark:text-[#E5C158]">
                24K: {formatGrams(wastageSummary.today.wastageFineGrams, 3)}
              </span>
            )}
            <span>
              {' '}
              · {wastageSummary.today.totalBillCount} {dUI.billsShort}
            </span>
          </div>
        </button>

        {/* Metric 6: Today's Sales (INR Mode) */}
        {showRupees && (
          <button
            type="button"
            onClick={() => onNavigate('invoices')}
            className="p-4 text-left bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/80 transition cursor-pointer"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{posT.kpiTodaySales}</div>
            <div className="text-lg xl:text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
              {formatINR(todaySalesINR)}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              {ui.all}: {formatINR(totalSalesINR)}
            </div>
          </button>
        )}
      </div>

      {/* 3. OPERATIONAL FOCUS ROW: WASTAGE COLLECTED TODAY & GOLD WITH CUSTOMERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left: Wastage Collected Today Report */}
        <div
          ref={wastageReportRef}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {wastageFilter === 'TODAY' ? dUI.wastageCollectedToday : dUI.wastageReport}
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                ·{' '}
                {wastageFilter === 'TODAY'
                  ? todayStr
                  : `${activeWastageStats.totalBillCount} ${dUI.billsShort}`}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setWastageFilter('TODAY')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                    wastageFilter === 'TODAY'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {dUI.todayTab}
                </button>
                <button
                  type="button"
                  onClick={() => setWastageFilter('ALL')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                    wastageFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {dUI.allBillsTab}
                </button>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{ui.quickReportsAction}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Flat Hairline Wastage Summary Row */}
          <div
            className={`grid ${
              showRupees ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
            } divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40`}
          >
            <div className="px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{dUI.wastageWt}</div>
              <div className="text-sm font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                {activeWastageStats.wastageGrams > 0 ? '+' : ''}
                {formatGrams(activeWastageStats.wastageGrams, 3)}
              </div>
            </div>
            <div className="px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{dUI.fineEqv24k}</div>
              <div className="text-sm font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158] mt-0.5">
                {formatGrams(activeWastageStats.wastageFineGrams, 3)}
              </div>
            </div>
            <div className="px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{dUI.avgWastage}</div>
              <div className="text-sm font-semibold font-mono tabular-nums text-slate-800 dark:text-slate-200 mt-0.5">
                {activeWastageStats.avgWastagePct.toFixed(2)}%
              </div>
            </div>
            {showRupees && (
              <div className="px-3.5 py-2.5 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{dUI.wastageInr}</div>
                <div className="text-sm font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {formatINR(activeWastageStats.wastageValueINR)}
                </div>
              </div>
            )}
          </div>

          {/* Wastage Bills Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-2.5 whitespace-nowrap">{ui.billNo}</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">{ui.customerName}</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">{ui.netWt}</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">{dUI.wastageWt}</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">{ui.fineWt}</th>
                  {showRupees && (
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">{dUI.wastageInr}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeWastageStats.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showRupees ? 6 : 5}
                      className="px-4 py-7 text-center text-slate-400 dark:text-slate-500"
                    >
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {wastageFilter === 'TODAY' ? dUI.noWastageToday : dUI.noWastageAll}
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('posTransactions')}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{dUI.createSalesBill}</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  activeWastageStats.rows.slice(0, 6).map((row) => (
                    <tr
                      key={row.invoiceId}
                      onClick={() => onNavigate('invoices')}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">
                          {row.invoiceNo}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                          {row.date}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{row.customerName}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          {row.itemSummary}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatGrams(row.netGoldGrams, 3)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div
                          className={
                            row.wastageGrams > 0
                              ? 'font-bold text-emerald-700 dark:text-emerald-400'
                              : 'font-medium text-slate-500 dark:text-slate-400'
                          }
                        >
                          {row.wastageGrams > 0 ? '+' : ''}
                          {formatGrams(row.wastageGrams, 3)}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">{row.wastagePct.toFixed(1)}%</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-[#9A7426] dark:text-[#E5C158] whitespace-nowrap">
                        {formatGrams(row.wastageFineGrams, 3)}
                      </td>
                      {showRupees && (
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {row.wastageValueINR > 0 ? formatINR(row.wastageValueINR) : '—'}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Gold With Customers Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {dUI.goldWithCustomers}
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                · {filteredCustomerRows.length}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCustomerFilter('ALL')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                    customerFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {ui.all}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilter('DUE')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                    customerFilter === 'DUE'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {payT.goldDue}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilter('CUSTODY')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                    customerFilter === 'CUSTODY'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {dUI.custodyShort}
                </button>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('customers')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{ui.all}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Flat Hairline Customer Gold Summary Row */}
          <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
            <div className="px-4 py-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{dUI.dueFromCustomers}</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span
                  className={`text-sm font-bold font-mono tabular-nums ${
                    customerGoldSummary.goldWithCustomersDueGrams > 0
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {formatGrams(customerGoldSummary.goldWithCustomersDueGrams, 3)}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                  · {customerGoldSummary.dueCustomersCount} {dUI.dueShort}
                </span>
              </div>
            </div>
            <div className="px-4 py-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{dUI.customerCustody}</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span
                  className={`text-sm font-bold font-mono tabular-nums ${
                    customerGoldSummary.customerCustodyGrams > 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {formatGrams(customerGoldSummary.customerCustodyGrams, 3)}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                  · {customerGoldSummary.custodyCustomersCount} {dUI.accountsShort}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Gold Balances Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-2.5 whitespace-nowrap">{ui.customerName}</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">{ui.status}</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">{payT.gold}</th>
                  {showRupees && (
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">{payT.balanceDue}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCustomerRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showRupees ? 4 : 3}
                      className="px-4 py-7 text-center text-slate-400 dark:text-slate-500"
                    >
                      <div className="text-xs text-slate-500 dark:text-slate-400">{dUI.noCustomerGoldBalances}</div>
                      <button
                        type="button"
                        onClick={() => onNavigate('customers')}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>{dUI.openCustomers}</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredCustomerRows.slice(0, 6).map((cust) => {
                    const goldBal = Number(cust.customerGoldBalanceGrams || 0);
                    const isDue = goldBal < 0;
                    const cashBal = Number(cust.monetaryBalanceINR || 0);

                    return (
                      <tr
                        key={cust.id}
                        onClick={() => onNavigate('customers')}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{cust.name}</div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                            {cust.phone || cust.accountCode}
                            {cust.city ? ` · ${cust.city}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
                          {isDue ? (
                            <span className="text-rose-700 dark:text-rose-400">↑ {dUI.dueFromCustomerStatus}</span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400">↓ {dUI.custodyHeldStatus}</span>
                          )}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                            isDue ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {formatGrams(Math.abs(goldBal), 3)}
                        </td>
                        {showRupees && (
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {cashBal > 0 ? (
                              <span className="text-rose-700 dark:text-rose-400 font-semibold">
                                {formatINR(cashBal)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* STANDALONE GOLD PURITY CONVERTER (24K EQUIVALENT CALCULATOR) */}
      <GoldPurityConverter
        activeLanguage={activeLanguage}
        goldRates={goldRates}
        showRupees={showRupees}
      />

      {/* 4. TWO CLEAN SIDE-BY-SIDE PANELS: PURITY STOCK & OPEN JOB CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left: Purity Stock Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{ui.purityStockBreakdown}</h2>
            <button
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{ui.quickReportsAction}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-2.5">{ui.purity}</th>
                  <th className="px-4 py-2.5">{t.fineness}</th>
                  <th className="px-4 py-2.5 text-right">{ui.netWt}</th>
                  <th className="px-4 py-2.5 text-right">{ui.fineWt}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayPurities.map((item: any) => (
                  <tr key={item.purity} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">{item.purity}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500 dark:text-slate-400">{item.fineness}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatGrams(item.netWeight, 3)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">
                      {formatGrams(item.fineGold, 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Open Karigar Job Cards Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {ui.activeJobCards} <span className="font-normal text-slate-400 dark:text-slate-500">· {activeJobs.length}</span>
            </h2>
            <button
              onClick={() => onNavigate('jobCards')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{ui.all}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="px-4 py-2.5">{ui.challanRef}</th>
                  <th className="px-4 py-2.5">{ui.partyOrKarigar}</th>
                  <th className="px-4 py-2.5">{ui.dueDate}</th>
                  <th className="px-4 py-2.5 text-right">{ui.issuedGold}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeJobs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      {ui.noRecordsFound}
                    </td>
                  </tr>
                ) : (
                  activeJobs.slice(0, 5).map((job) => {
                    const isOverdue = Boolean(job.dueDate && job.dueDate < todayStr);
                    return (
                      <tr
                        key={job.id}
                        onClick={() => onNavigate('jobCards')}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">{job.jobNo}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {job.jewelleryType} · {job.purity}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{job.karigarName}</td>
                        <td
                          className={`px-4 py-2.5 font-mono tabular-nums whitespace-nowrap ${
                            isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {job.dueDate || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {formatGrams(job.issuedNetWeightGrams, 3)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. RECENT GOLD MOVEMENTS TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{ui.recentGoldMovements}</h2>
          <button
            onClick={() => onNavigate('goldLedger')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{ui.tabLedgerReport}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
              <tr>
                <th className="px-4 py-2.5">{ui.date}</th>
                <th className="px-4 py-2.5">{ui.partyOrKarigar}</th>
                <th className="px-4 py-2.5">{ui.movementDirection}</th>
                <th className="px-4 py-2.5 text-center">{ui.purity}</th>
                <th className="px-4 py-2.5 text-right">{ui.netWt}</th>
                <th className="px-4 py-2.5 text-right">{ui.fineWt}</th>
                {showRupees && <th className="px-4 py-2.5 text-right">{ui.amountInr}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={showRupees ? 7 : 6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                    {ui.noRecordsFound}
                  </td>
                </tr>
              ) : (
                recentMovements.map((e) => {
                  const isIn =
                    INWARD_TYPES.has(e.type) ||
                    e.destinationAccount === 'BUSINESS_OWNED' ||
                    e.destinationAccount === 'FINISHED_GOODS';
                  const isConvert = e.type === 'MELTING_CONVERSION';

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{e.date.split('T')[0]}</div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">{e.transactionNo}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {e.counterpartyName ||
                            `${formatReadableCode(e.sourceAccount)} → ${formatReadableCode(
                              e.destinationAccount
                            )}`}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatReadableCode(e.type)}
                          {e.notes ? ` · ${e.notes}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
                        {isConvert ? (
                          <span className="text-amber-700 dark:text-amber-400">⇄ {ui.internalMovement}</span>
                        ) : isIn ? (
                          <span className="text-emerald-700 dark:text-emerald-400">↓ {ui.goldInLabel}</span>
                        ) : (
                          <span className="text-rose-700 dark:text-rose-400">↑ {ui.goldOutLabel}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-slate-700 dark:text-slate-300">{e.purity}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatGrams(e.netWeightGrams, 3)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">
                        {formatGrams(e.fineGoldWeightGrams, 3)}
                      </td>
                      {showRupees && (
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {e.valuationINR ? formatINR(e.valuationINR) : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
