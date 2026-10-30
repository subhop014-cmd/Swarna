import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Customer, GoldPurityCode, IndianLanguage } from '../types';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';
import { getUI } from '../i18n/uiTranslations';
import { getPaymentStrings } from '../i18n/paymentTranslations';
import { getIndividualReportUI } from '../i18n/individualReportTranslations';
import { formatGrams, formatINR, PURITY_STANDARDS } from '../utils/goldMath';
import { EditablePurityControl } from './EditablePurityControl';

interface CustomersViewProps {
  customers: Customer[];
  activeLanguage: IndianLanguage;
  showRupees?: boolean;
  onAddCustomer: (customer: any) => void;
  onDepositCustomerGold: (
    customerId: string,
    grossWeight: number,
    nonGoldWeight: number,
    purity: GoldPurityCode,
    notes?: string,
    fineness?: number
  ) => Promise<void> | void;
  onWithdrawCustomerGold?: (
    customerId: string,
    netWeight: number,
    purity: GoldPurityCode,
    notes?: string,
    fineness?: number
  ) => Promise<void> | void;
  onOpenCustomerReport?: (customerId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  activeLanguage,
  showRupees = false,
  onAddCustomer,
  onDepositCustomerGold,
  onWithdrawCustomerGold,
  onOpenCustomerReport,
}) => {
  const ui = getUI(activeLanguage);
  const payT = getPaymentStrings(activeLanguage);
  const ir = getIndividualReportUI(activeLanguage);
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'CUSTODY' | 'GOLD_DUE'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [depositCust, setDepositCust] = useState<Customer | null>(null);
  const [goldModalMode, setGoldModalMode] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [modalError, setModalError] = useState('');

  // New Customer Form State
  const [name, setName] = useState('');
  const [regionalName, setRegionalName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [prefLang, setPrefLang] = useState<IndianLanguage>(activeLanguage);
  const [gstin, setGstin] = useState('');

  // Customer Gold Movement State
  const [depGross, setDepGross] = useState('');
  const [depNonGold, setDepNonGold] = useState('0');
  const [depPurity, setDepPurity] = useState<GoldPurityCode>('22K');
  const [depFineness, setDepFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);
  const [depNotes, setDepNotes] = useState('');

  const filteredCustomers = customers.filter((c) => {
    const bal = c.customerGoldBalanceGrams || 0;
    if (balanceFilter === 'CUSTODY' && bal <= 0) return false;
    if (balanceFilter === 'GOLD_DUE' && bal >= 0) return false;

    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.regionalName && c.regionalName.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.accountCode && c.accountCode.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q))
    );
  });

  // Strictly separate positive custody gold from negative gold due receivables
  const totalGoldCustody = Number(
    customers
      .reduce((sum, c) => sum + Math.max(0, c.customerGoldBalanceGrams || 0), 0)
      .toFixed(3)
  );
  const totalGoldDue = Number(
    customers
      .reduce((sum, c) => sum + Math.abs(Math.min(0, c.customerGoldBalanceGrams || 0)), 0)
      .toFixed(3)
  );
  const totalCashReceivable = Math.round(
    customers.reduce((sum, c) => sum + Math.max(0, c.monetaryBalanceINR || 0), 0)
  );
  const totalCashAdvance = Math.round(
    customers.reduce((sum, c) => sum + Math.abs(Math.min(0, c.monetaryBalanceINR || 0)), 0)
  );
  const activeGoldAccounts = customers.filter((c) => (c.customerGoldBalanceGrams || 0) > 0).length;
  const dueGoldAccounts = customers.filter((c) => (c.customerGoldBalanceGrams || 0) < 0).length;

  const openGoldModal = (cust: Customer, initialMode: 'DEPOSIT' | 'WITHDRAW' = 'DEPOSIT') => {
    setDepositCust(cust);
    setGoldModalMode(initialMode);
    setModalError('');
    setDepGross('');
    setDepNonGold('0');
    setDepPurity('22K');
    setDepFineness(PURITY_STANDARDS['22K'].fineness);
    setDepNotes('');
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddCustomer({
      name: name.trim(),
      regionalName: regionalName.trim() || undefined,
      phone: phone.trim(),
      address: address.trim() || undefined,
      city: city.trim() || 'Mumbai',
      state: 'Maharashtra',
      preferredLanguage: prefLang,
      gstin: gstin.trim() || undefined,
      customerGoldBalanceGrams: 0,
      monetaryBalanceINR: 0,
      creditLimitINR: 100000,
    });

    setShowAddModal(false);
    setName('');
    setRegionalName('');
    setPhone('');
    setAddress('');
    setCity('');
    setGstin('');
  };

  const modalNetWeight = Number(
    Math.max(
      0,
      (parseFloat(depGross) || 0) - (goldModalMode === 'DEPOSIT' ? parseFloat(depNonGold) || 0 : 0)
    ).toFixed(3)
  );
  const currentModalBalance = Number((depositCust?.customerGoldBalanceGrams || 0).toFixed(3));
  const projectedModalBalance = Number(
    (
      currentModalBalance +
      (goldModalMode === 'DEPOSIT' ? modalNetWeight : -modalNetWeight)
    ).toFixed(3)
  );

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositCust) return;
    setModalError('');

    const g = parseFloat(depGross);
    const ng = goldModalMode === 'DEPOSIT' ? parseFloat(depNonGold) || 0 : 0;
    const net = Number(Math.max(0, (g || 0) - ng).toFixed(3));

    if (isNaN(g) || net <= 0) {
      setModalError('Please enter a valid gold weight greater than 0.000 g');
      return;
    }

    try {
      if (goldModalMode === 'WITHDRAW') {
        if (!onWithdrawCustomerGold) return;
        if (currentModalBalance <= 0) {
          setModalError('This customer has no custody gold available to return.');
          return;
        }
        if (net > currentModalBalance) {
          setModalError(
            `Return weight (${formatGrams(net)}) exceeds custody balance (${formatGrams(currentModalBalance)}).`
          );
          return;
        }
        await onWithdrawCustomerGold(
          depositCust.id,
          net,
          depPurity,
          depNotes || undefined,
          depFineness
        );
      } else {
        await onDepositCustomerGold(
          depositCust.id,
          g,
          ng,
          depPurity,
          depNotes || undefined,
          depFineness
        );
      }

      setDepositCust(null);
      setDepGross('');
      setDepNonGold('0');
      setDepNotes('');
      setModalError('');
    } catch (err: any) {
      setModalError(err.message || 'Unable to update customer gold balance');
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {ui.customersTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ui.customersSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{ui.addNewCustomer}</span>
        </button>
      </div>

      {/* Single-Elevation Summary Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.recordsCount}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {customers.length}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono tabular-nums">
            {activeGoldAccounts} custody · {dueGoldAccounts} due
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.goldDepositBalance}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158]">
            {formatGrams(totalGoldCustody)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            {ui.customerCustodyGold}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{payT.goldDue}</div>
          <div
            className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
              totalGoldDue > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {formatGrams(totalGoldDue)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            {dueGoldAccounts > 0 ? `${dueGoldAccounts} pending accounts` : 'All settled'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {showRupees ? ui.cashReceivable : ir.netGoldBalance}
          </div>
          {showRupees ? (
            <>
              <div
                className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                  totalCashReceivable > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {formatINR(totalCashReceivable)}
              </div>
              {totalCashAdvance > 0 && (
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                  Advance: {formatINR(totalCashAdvance)}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {totalGoldCustody - totalGoldDue >= 0 ? '+' : '−'}
                {formatGrams(Math.abs(totalGoldCustody - totalGoldDue))}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Custody minus Due
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
          {(
            [
              { id: 'ALL', label: ui.all },
              { id: 'CUSTODY', label: `${ui.customerCustodyGold} (${activeGoldAccounts})` },
              { id: 'GOLD_DUE', label: `${payT.goldDue} (${dueGoldAccounts})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBalanceFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                balanceFilter === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scannable Customers Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{ui.customerName}</th>
                <th className="px-4 py-3">{ui.phoneNo}</th>
                <th className="px-4 py-3">GSTIN</th>
                <th className="px-4 py-3 text-right">{ui.goldDepositBalance}</th>
                {showRupees && (
                  <th className="px-4 py-3 text-right">{ui.cashReceivable}</th>
                )}
                <th className="px-4 py-3 text-right">{ui.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={showRupees ? 6 : 5} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    {ui.noRecordsFound}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const goldBal = Number((cust.customerGoldBalanceGrams || 0).toFixed(3));
                  const cashBal = Math.round(cust.monetaryBalanceINR || 0);

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{cust.name}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{cust.accountCode}</span>
                          {cust.regionalName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-600 dark:text-slate-400">{cust.regionalName}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{cust.phone}</div>
                        {cust.city && <div className="text-[11px] text-slate-400 dark:text-slate-500">{cust.city}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {cust.gstin || '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {goldBal > 0 ? (
                          <div>
                            <div className="font-mono tabular-nums font-semibold text-[#9A7426] dark:text-[#E5C158]">
                              +{formatGrams(goldBal)}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">Custody</div>
                          </div>
                        ) : goldBal < 0 ? (
                          <div>
                            <div className="font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                              {formatGrams(Math.abs(goldBal))}
                            </div>
                            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{payT.goldDue}</div>
                          </div>
                        ) : (
                          <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500">0.000 g</span>
                        )}
                      </td>
                      {showRupees && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {cashBal > 0 ? (
                            <div>
                              <div className="font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                                {formatINR(cashBal)}
                              </div>
                              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{payT.due}</div>
                            </div>
                          ) : cashBal < 0 ? (
                            <div>
                              <div className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                                {formatINR(Math.abs(cashBal))}
                              </div>
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Advance</div>
                            </div>
                          ) : (
                            <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500">₹0</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openGoldModal(cust, 'DEPOSIT')}
                            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            {goldBal < 0 ? 'Settle Gold' : ui.depositGoldBtn}
                          </button>
                          {goldBal > 0 && onWithdrawCustomerGold && (
                            <button
                              type="button"
                              onClick={() => openGoldModal(cust, 'WITHDRAW')}
                              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Return Gold
                            </button>
                          )}
                          {onOpenCustomerReport && (
                            <button
                              type="button"
                              onClick={() => onOpenCustomerReport(cust.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{ir.viewIndividualReport}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{ui.addNewCustomer}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.customerName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Navratna Jewellers"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.activeLanguageLabel}
                  </label>
                  <input
                    type="text"
                    value={regionalName}
                    onChange={(e) => setRegionalName(e.target.value)}
                    placeholder="नवरत्न ज्वेलर्स"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.phoneNo} *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98200 12345"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="27AABCU9603R1ZM"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono uppercase focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.languagePreference}
                  </label>
                  <select
                    value={prefLang}
                    onChange={(e) => setPrefLang(e.target.value as IndianLanguage)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeName} ({l.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.notes}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address / Market"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap"
                >
                  {ui.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs cursor-pointer whitespace-nowrap"
                >
                  {ui.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Gold Deposit / Return Modal */}
      {depositCust && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {goldModalMode === 'WITHDRAW' ? 'Return Customer Custody Gold' : ui.depositGoldBtn}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {depositCust.name} · {depositCust.accountCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDepositCust(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {onWithdrawCustomerGold && (
              <div className="mt-4 grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setGoldModalMode('DEPOSIT');
                    setModalError('');
                  }}
                  className={`py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    goldModalMode === 'DEPOSIT'
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>{ui.posGoldInTitle}</span>
                </button>
                <button
                  type="button"
                  disabled={currentModalBalance <= 0}
                  onClick={() => {
                    setGoldModalMode('WITHDRAW');
                    setModalError('');
                    setDepNonGold('0');
                  }}
                  className={`py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                    goldModalMode === 'WITHDRAW'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  <span>Return Custody</span>
                </button>
              </div>
            )}

            {modalError && (
              <div className="mt-3 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleDepositSubmit} className="mt-4 space-y-4">
              {goldModalMode === 'DEPOSIT' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {ui.grossWt} *
                      </label>
                      {currentModalBalance < 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDepGross(String(Math.abs(currentModalBalance)));
                            setDepNonGold('0');
                          }}
                          className="text-[11px] font-semibold text-[#9A7426] dark:text-[#E5C158] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          Settle {formatGrams(Math.abs(currentModalBalance))}
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      required
                      value={depGross}
                      onChange={(e) => setDepGross(e.target.value)}
                      placeholder="50.000"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap">
                      {ui.posStoneBeadWt}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={depNonGold}
                      onChange={(e) => setDepNonGold(e.target.value)}
                      placeholder="0.000"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {ui.netWt} *
                    </label>
                    {currentModalBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setDepGross(String(currentModalBalance))}
                        className="text-[11px] font-semibold text-[#9A7426] dark:text-[#E5C158] hover:underline cursor-pointer whitespace-nowrap"
                      >
                        Full Custody ({formatGrams(currentModalBalance)})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max={currentModalBalance > 0 ? currentModalBalance : undefined}
                    required
                    value={depGross}
                    onChange={(e) => setDepGross(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.purity}
                </label>
                <EditablePurityControl
                  purity={depPurity}
                  fineness={depFineness}
                  onChange={(nextPurity, nextFineness) => {
                    setDepPurity(nextPurity);
                    setDepFineness(nextFineness);
                  }}
                />
                {modalNetWeight > 0 && (
                  <div className="mt-1.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {ui.fineWt} (24K):{' '}
                    <strong className="text-[#9A7426] dark:text-[#E5C158]">
                      {formatGrams((modalNetWeight * depFineness) / 1000, 3)}
                    </strong>
                  </div>
                )}
              </div>

              {/* Live Customer Gold Balance Preview */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                <div>
                  Current:{' '}
                  <strong className={currentModalBalance < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}>
                    {currentModalBalance < 0
                      ? `${formatGrams(Math.abs(currentModalBalance))} Due`
                      : `${formatGrams(currentModalBalance)}`}
                  </strong>
                </div>
                <div>
                  Updated:{' '}
                  <strong
                    className={
                      projectedModalBalance < 0
                        ? 'text-rose-700 dark:text-rose-400'
                        : projectedModalBalance > 0
                        ? 'text-[#9A7426] dark:text-[#E5C158]'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }
                  >
                    {projectedModalBalance < 0
                      ? `${formatGrams(Math.abs(projectedModalBalance))} Due`
                      : projectedModalBalance > 0
                      ? `+${formatGrams(projectedModalBalance)} Custody`
                      : '0.000 g Settled'}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.notes}
                </label>
                <input
                  type="text"
                  value={depNotes}
                  onChange={(e) => setDepNotes(e.target.value)}
                  placeholder={ui.notes}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDepositCust(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap"
                >
                  {ui.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs cursor-pointer whitespace-nowrap"
                >
                  {ui.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
