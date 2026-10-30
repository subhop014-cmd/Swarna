import React, { useState } from 'react';
import {
  Download,
  Flame,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { GoldAccountType, GoldLedgerEntry, GoldPurityCode, IndianLanguage } from '../types';
import { getUI } from '../i18n/uiTranslations';
import { formatGrams, formatINR, PURITY_STANDARDS } from '../utils/goldMath';
import { EditablePurityControl, isExactPresetFineness } from './EditablePurityControl';

interface GoldLedgerViewProps {
  ledgerEntries: GoldLedgerEntry[];
  activeLanguage: IndianLanguage;
  showRupees?: boolean;
  onNewTransaction: (entry: any) => void;
  onOpenMeltingModal: () => void;
}

function formatAccountLabel(account?: string): string {
  switch (account) {
    case 'BUSINESS_OWNED':
      return 'Main Vault';
    case 'CUSTOMER_OWNED':
      return 'Customer Custody';
    case 'KARIGAR_HELD':
      return 'Karigar';
    case 'SCRAP_REFINING':
      return 'Melting / Scrap';
    case 'FINISHED_GOODS':
      return 'Finished Stock';
    default:
      if (!account) return 'Vault';
      return account
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
}

function formatMovementType(raw?: string): string {
  switch (raw) {
    case 'BULLION_PURCHASE':
      return 'Bullion Purchase';
    case 'CUSTOMER_OLD_GOLD':
    case 'CUSTOMER_DEPOSIT':
      return 'Customer Gold In';
    case 'CUSTOMER_WITHDRAWAL':
      return 'Customer Gold Out';
    case 'ISSUE_TO_KARIGAR':
      return 'Issued to Karigar';
    case 'RETURN_FROM_KARIGAR':
      return 'Received from Karigar';
    case 'SALE_DELIVERY':
      return 'Sales Bill Out';
    case 'SEND_TO_MELTING':
      return 'Sent to Melting';
    case 'RECEIVE_FROM_MELTING':
      return 'Received from Melting';
    case 'OPENING_BALANCE':
      return 'Opening Balance';
    default:
      if (!raw) return 'Movement';
      return raw
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
}

function formatAccountFlow(source?: string, dest?: string): string {
  const s = formatAccountLabel(source);
  const d = formatAccountLabel(dest);
  if (!dest || s === d) return s;
  return `${s} → ${d}`;
}

export const GoldLedgerView: React.FC<GoldLedgerViewProps> = ({
  ledgerEntries,
  activeLanguage,
  showRupees = false,
  onNewTransaction,
  onOpenMeltingModal,
}) => {
  const ui = getUI(activeLanguage);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurity, setSelectedPurity] = useState<string>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Transaction Form State
  const [txType, setTxType] = useState<string>('BULLION_PURCHASE');
  const [grossWeight, setGrossWeight] = useState('');
  const [nonGoldWeight, setNonGoldWeight] = useState('0');
  const [purity, setPurity] = useState<GoldPurityCode>('24K');
  const [fineness, setFineness] = useState<number>(PURITY_STANDARDS['24K'].fineness);
  const [ratePerGram, setRatePerGram] = useState('7450');
  const [counterparty, setCounterparty] = useState('');
  const [notes, setNotes] = useState('');

  const filteredEntries = ledgerEntries.filter((entry) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      entry.transactionNo.toLowerCase().includes(q) ||
      (entry.counterpartyName && entry.counterpartyName.toLowerCase().includes(q)) ||
      (entry.notes && entry.notes.toLowerCase().includes(q));

    const matchesPurity = selectedPurity === 'ALL' || entry.purity === selectedPurity;
    const matchesAccount =
      selectedAccount === 'ALL' ||
      entry.sourceAccount === selectedAccount ||
      entry.destinationAccount === selectedAccount;

    return matchesSearch && matchesPurity && matchesAccount;
  });

  const totalNetGrams = filteredEntries.reduce((sum, e) => sum + (e.netWeightGrams || 0), 0);
  const totalFineGrams = filteredEntries.reduce((sum, e) => sum + (e.fineGoldWeightGrams || 0), 0);

  const resolveAccounts = (typeVal: string): { source: GoldAccountType; dest: GoldAccountType } => {
    switch (typeVal) {
      case 'CUSTOMER_DEPOSIT':
      case 'CUSTOMER_WITHDRAWAL':
        return { source: 'CUSTOMER_OWNED', dest: 'CUSTOMER_OWNED' };
      case 'ISSUE_TO_KARIGAR':
        return { source: 'BUSINESS_OWNED', dest: 'KARIGAR_HELD' };
      case 'RETURN_FROM_KARIGAR':
        return { source: 'KARIGAR_HELD', dest: 'FINISHED_GOODS' };
      case 'SALE_DELIVERY':
        return { source: 'FINISHED_GOODS', dest: 'FINISHED_GOODS' };
      case 'SEND_TO_MELTING':
        return { source: 'BUSINESS_OWNED', dest: 'SCRAP_REFINING' };
      default:
        return { source: 'BUSINESS_OWNED', dest: 'BUSINESS_OWNED' };
    }
  };

  const handleCreateTx = (e: React.FormEvent) => {
    e.preventDefault();
    const g = parseFloat(grossWeight);
    const ng = parseFloat(nonGoldWeight) || 0;
    if (isNaN(g) || g <= 0) return;

    const net = Math.max(0, g - ng);
    const rate = parseFloat(ratePerGram) || 0;
    const { source, dest } = resolveAccounts(txType);

    onNewTransaction({
      date: new Date().toISOString(),
      type: txType,
      sourceAccount: source,
      destinationAccount: dest,
      counterpartyName: counterparty || undefined,
      counterpartyType:
        txType === 'CUSTOMER_DEPOSIT' || txType === 'CUSTOMER_WITHDRAWAL'
          ? 'CUSTOMER'
          : txType === 'ISSUE_TO_KARIGAR' || txType === 'RETURN_FROM_KARIGAR'
          ? 'KARIGAR'
          : undefined,
      grossWeightGrams: g,
      nonGoldWeightGrams: ng,
      netWeightGrams: net,
      purity,
      fineness,
      ratePerGram: rate,
      notes: notes || undefined,
    });

    setShowAddModal(false);
    setGrossWeight('');
    setNonGoldWeight('0');
    setCounterparty('');
    setNotes('');
  };

  const handleExportCSV = () => {
    const headers = [
      'Transaction No',
      'Date',
      'Type',
      'Account Flow',
      'Gross Wt (g)',
      'Net Wt (g)',
      'Purity',
      'Fine Gold (g)',
      ...(showRupees ? ['Valuation (INR)'] : []),
      'Party',
      'Notes',
    ];

    const rows = filteredEntries.map((e) => [
      e.transactionNo,
      e.date.split('T')[0],
      `"${formatMovementType(e.type)}"`,
      `"${formatAccountFlow(e.sourceAccount, e.destinationAccount)}"`,
      e.grossWeightGrams.toFixed(3),
      e.netWeightGrams.toFixed(3),
      e.purity,
      e.fineGoldWeightGrams.toFixed(3),
      ...(showRupees ? [e.valuationINR || 0] : []),
      `"${(e.counterpartyName || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `swarna_gold_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modalNetPreview = Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(nonGoldWeight) || 0));
  const modalFinePreview = (modalNetPreview * fineness) / 1000;

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {ui.ledgerTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ui.ledgerSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{ui.downloadCsv}</span>
          </button>
          <button
            type="button"
            onClick={onOpenMeltingModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Flame className="w-3.5 h-3.5 text-[#9A7426] dark:text-[#E5C158]" />
            <span>{ui.quickMeltAction}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{ui.recordGoldMovement}</span>
          </button>
        </div>
      </div>

      {/* Single-Elevation Summary Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.recordsCount}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {filteredEntries.length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.netWt}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {formatGrams(totalNetGrams)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.fineWt} (999.9)</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158]">
            {formatGrams(totalFineGrams, 3)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white transition-colors"
          />
        </div>

        <select
          value={selectedPurity}
          onChange={(e) => setSelectedPurity(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white"
        >
          <option value="ALL">{ui.all} ({ui.purity})</option>
          <option value="24K">24K (999.9)</option>
          <option value="22K">22K (916)</option>
          <option value="20K">20K (833)</option>
          <option value="18K">18K (750)</option>
          <option value="14K">14K (585)</option>
        </select>

        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white"
        >
          <option value="ALL">{ui.allMovementTypes}</option>
          <option value="BUSINESS_OWNED">{ui.businessFineGold}</option>
          <option value="CUSTOMER_OWNED">{ui.customerCustodyGold}</option>
          <option value="KARIGAR_HELD">{ui.goldWithKarigars}</option>
          <option value="SCRAP_REFINING">{ui.karigarScrapRecovered}</option>
          <option value="FINISHED_GOODS">Finished Stock</option>
        </select>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{ui.transactionNo}</th>
                <th className="px-4 py-3">{ui.type}</th>
                <th className="px-4 py-3">{ui.partyOrKarigar}</th>
                <th className="px-4 py-3 text-right">{ui.grossWt}</th>
                <th className="px-4 py-3 text-right">{ui.netWt}</th>
                <th className="px-4 py-3 text-center">{ui.purity}</th>
                <th className="px-4 py-3 text-right">{ui.fineWt}</th>
                {showRupees && <th className="px-4 py-3 text-right">{ui.amountInr}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={showRupees ? 8 : 7} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    {ui.noRecordsFound}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{entry.transactionNo}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{entry.date.split('T')[0]}</div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {formatMovementType(entry.type)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatAccountFlow(entry.sourceAccount, entry.destinationAccount)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {entry.counterpartyName || 'Workshop Vault'}
                      </div>
                      {entry.notes && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-xs">
                          {entry.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatGrams(entry.grossWeightGrams)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatGrams(entry.netWeightGrams)}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {isExactPresetFineness(entry.purity, entry.fineness)
                        ? entry.purity
                        : `${(entry.fineness / 10).toFixed(2)}% (${entry.purity})`}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-[#9A7426] dark:text-[#E5C158] whitespace-nowrap">
                      {formatGrams(entry.fineGoldWeightGrams, 3)}
                    </td>
                    {showRupees && (
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {entry.valuationINR ? formatINR(entry.valuationINR) : '—'}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simplified Record Gold Movement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {ui.recordGoldMovement}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTx} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.type}
                  </label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  >
                    <option value="BULLION_PURCHASE">Bullion Purchase (In)</option>
                    <option value="CUSTOMER_DEPOSIT">Customer Gold (In)</option>
                    <option value="CUSTOMER_WITHDRAWAL">Customer Gold Return (Out)</option>
                    <option value="ISSUE_TO_KARIGAR">Issue to Karigar (Out)</option>
                    <option value="RETURN_FROM_KARIGAR">Receive from Karigar (In)</option>
                    <option value="SALE_DELIVERY">Sales Dispatch (Out)</option>
                    <option value="SEND_TO_MELTING">Send to Melting (Out)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.purity}
                  </label>
                  <EditablePurityControl
                    variant="inline"
                    purity={purity}
                    fineness={fineness}
                    onChange={(nextPurity, nextFineness) => {
                      setPurity(nextPurity);
                      setFineness(nextFineness);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.grossWt} *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={grossWeight}
                    onChange={(e) => setGrossWeight(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.posStoneBeadWt}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={nonGoldWeight}
                    onChange={(e) => setNonGoldWeight(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
              </div>

              {modalNetPreview > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 font-mono tabular-nums">
                  <span>{ui.netWt}: <strong className="text-slate-900 dark:text-slate-100">{formatGrams(modalNetPreview)}</strong></span>
                  <span>{ui.fineWt}: <strong className="text-[#9A7426] dark:text-[#E5C158]">{formatGrams(modalFinePreview, 3)}</strong></span>
                </div>
              )}

              {showRupees && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Rate (₹/g)
                  </label>
                  <input
                    type="number"
                    value={ratePerGram}
                    onChange={(e) => setRatePerGram(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.partyOrKarigar}
                </label>
                <input
                  type="text"
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  placeholder="Party or Karigar Name"
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
