import React, { useState } from 'react';
import {
  Plus,
  Search,
  X,
} from 'lucide-react';
import { CashBankTransaction, IndianLanguage } from '../types';
import { getUI } from '../i18n/uiTranslations';
import { formatINR } from '../utils/goldMath';

interface CashBookViewProps {
  transactions: CashBankTransaction[];
  activeLanguage: IndianLanguage;
  onAddTransaction: (tx: any) => void;
}

function formatCategoryLabel(raw?: string): string {
  switch (raw) {
    case 'STAFF_ADVANCE':
      return 'Karigar / Staff Advance';
    case 'SALES_COLLECTION':
      return 'Sales Collection';
    case 'SUPPLIER_PAYMENT':
      return 'Supplier Payment';
    case 'WORKSHOP_EXPENSE':
      return 'Workshop Expense';
    case 'RENT_UTILITY':
      return 'Rent & Utility';
    default:
      if (!raw) return 'General';
      return raw
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
}

export const CashBookView: React.FC<CashBookViewProps> = ({
  transactions,
  activeLanguage,
  onAddTransaction,
}) => {
  const ui = getUI(activeLanguage);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [type, setType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [accountType, setAccountType] = useState<'CASH' | 'BANK'>('CASH');
  const [partyName, setPartyName] = useState('');
  const [category, setCategory] = useState<CashBankTransaction['category']>('STAFF_ADVANCE');
  const [amount, setAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  const totalReceipts = transactions
    .filter((tx) => tx.type === 'RECEIPT')
    .reduce((sum, tx) => sum + tx.amountINR, 0);

  const totalPayments = transactions
    .filter((tx) => tx.type === 'PAYMENT')
    .reduce((sum, tx) => sum + tx.amountINR, 0);

  const netBalance = totalReceipts - totalPayments;

  const filtered = transactions.filter((tx) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (tx.partyName && tx.partyName.toLowerCase().includes(q)) ||
      (tx.notes && tx.notes.toLowerCase().includes(q)) ||
      (tx.referenceNo && tx.referenceNo.toLowerCase().includes(q));
    const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;

    onAddTransaction({
      branchId: 'main',
      date: new Date().toISOString().split('T')[0],
      type,
      accountType,
      partyName,
      category,
      amountINR: amt,
      referenceNo: referenceNo || undefined,
      notes: notes || undefined,
      enteredBy: 'Current User',
    });

    setShowAddModal(false);
    setAmount('');
    setPartyName('');
    setReferenceNo('');
    setNotes('');
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {ui.cashBookTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ui.cashBookSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{ui.newCashEntry}</span>
        </button>
      </div>

      {/* Single-Elevation Summary Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.totalReceipts}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatINR(totalReceipts)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.totalPayments}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400">
            {formatINR(totalPayments)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.cashInHand}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatINR(netBalance)}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-full sm:w-auto">
          {(
            [
              { id: 'ALL', label: ui.all },
              { id: 'RECEIPT', label: ui.receiptIn },
              { id: 'PAYMENT', label: ui.paymentOut },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                typeFilter === f.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{ui.date}</th>
                <th className="px-4 py-3">{ui.type}</th>
                <th className="px-4 py-3">{ui.categoryModule}</th>
                <th className="px-4 py-3">{ui.partyOrKarigar}</th>
                <th className="px-4 py-3 text-right">{ui.amountInr}</th>
                <th className="px-4 py-3">{ui.challanRef}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    {ui.noRecordsFound}
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          tx.type === 'RECEIPT' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {tx.type === 'RECEIPT' ? ui.receiptIn : ui.paymentOut}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600 mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {tx.accountType === 'BANK' ? 'Bank / UPI' : 'Cash'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatCategoryLabel(tx.category)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{tx.partyName || '—'}</div>
                      {tx.notes && <div className="text-[11px] text-slate-400 dark:text-slate-500">{tx.notes}</div>}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        tx.type === 'RECEIPT' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {tx.type === 'RECEIPT' ? '+' : '-'} {formatINR(tx.amountINR)}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {tx.referenceNo || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cash / Bank Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{ui.newCashEntry}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Direction */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setType('RECEIPT')}
                  className={`py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    type === 'RECEIPT'
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {ui.receiptIn}
                </button>
                <button
                  type="button"
                  onClick={() => setType('PAYMENT')}
                  className={`py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    type === 'PAYMENT'
                      ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {ui.paymentOut}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Account
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as 'CASH' | 'BANK')}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  >
                    <option value="CASH">{ui.cashInHand}</option>
                    <option value="BANK">{ui.bankBalance} (Bank / UPI)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.categoryModule}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  >
                    <option value="STAFF_ADVANCE">Karigar / Staff Advance</option>
                    <option value="SALES_COLLECTION">Sales Collection</option>
                    <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
                    <option value="WORKSHOP_EXPENSE">Workshop Expense</option>
                    <option value="RENT_UTILITY">Rent & Utility</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.amountInr} *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.partyOrKarigar} *
                </label>
                <input
                  type="text"
                  required
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder={ui.partyOrKarigar}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.notes}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={ui.notes}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                >
                  {ui.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs cursor-pointer"
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
