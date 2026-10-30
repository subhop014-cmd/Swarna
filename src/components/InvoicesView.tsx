import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle,
  Coins,
  Copy,
  Download,
  FilePlus,
  FileText,
  Filter,
  Hammer,
  Plus,
  Printer,
  QrCode,
  Scale,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Customer, GoldPurityCode, GoldRate, IndianLanguage, Invoice, Tenant } from '../types';
import { formatGrams, formatINR, PURITY_STANDARDS } from '../utils/goldMath';
import { TRANSLATIONS } from '../i18n/translations';
import { POS_TRANSLATIONS } from '../i18n/posTranslations';
import { getUI } from '../i18n/uiTranslations';
import {
  formatInvoicePaymentMethodLabel,
  formatInvoiceStatusLabel,
  getPaymentStrings,
} from '../i18n/paymentTranslations';
import {
  DEFAULT_PRINTER_SETTINGS,
  PrinterSettings,
} from '../utils/printerSettings';
import { getPrinterStrings } from '../i18n/printerTranslations';
import { PrintPreviewModal } from './PrintPreviewModal';
import {
  computeRateForFineness,
  EditablePurityControl,
  isExactPresetFineness,
} from './EditablePurityControl';

interface InvoicesViewProps {
  invoices: Invoice[];
  customers: Customer[];
  goldRates: GoldRate[];
  currentTenant: Tenant | null;
  activeLanguage: IndianLanguage;
  showRupees?: boolean;
  printerSettings?: PrinterSettings;
  onUpdatePrinterSettings?: (next: PrinterSettings) => void;
  onCreateInvoice: (invoiceData: any) => Promise<any>;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  customers,
  goldRates,
  currentTenant,
  activeLanguage,
  showRupees = false,
  printerSettings = DEFAULT_PRINTER_SETTINGS,
  onUpdatePrinterSettings,
  onCreateInvoice,
}) => {
  const ui = getUI(activeLanguage);
  const posT = POS_TRANSLATIONS[activeLanguage] || POS_TRANSLATIONS.en;
  const payT = getPaymentStrings(activeLanguage);
  const printerT = getPrinterStrings(activeLanguage);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [autoPrintPreview, setAutoPrintPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const getRate = (p: GoldPurityCode) => {
    const found = goldRates.find((r) => r.purity === p);
    return found ? found.ratePerGram : p === '24K' ? 7450 : p === '22K' ? 6825 : p === '18K' ? 5588 : 4358;
  };

  // Simple Single-Card Bill / Challan State
  const [partyNameInput, setPartyNameInput] = useState('');
  const [partyPhoneInput, setPartyPhoneInput] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [billPaymentOption, setBillPaymentOption] = useState<'CASH' | 'GOLD' | 'DUE' | 'PARTIAL'>('CASH');
  const [cashChannel, setCashChannel] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [cashPaidInput, setCashPaidInput] = useState('');
  const [goldReceivedInput, setGoldReceivedInput] = useState('');
  const [useCustomerDeposit, setUseCustomerDeposit] = useState(false);
  const [goldReceivedPurity, setGoldReceivedPurity] = useState<GoldPurityCode>('22K');
  const [goldReceivedFineness, setGoldReceivedFineness] = useState<number>(
    PURITY_STANDARDS['22K'].fineness
  );
  const [goldReceivedRateInput, setGoldReceivedRateInput] = useState('');
  const [billDueDate, setBillDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const activeModalCustomer = useMemo(() => {
    const q = partyNameInput.trim().toLowerCase();
    if (!q) return undefined;
    return customers.find((c) => c.name.toLowerCase() === q);
  }, [customers, partyNameInput]);

  const availableModalCustodyGrams = Math.max(
    0,
    Number((activeModalCustomer?.customerGoldBalanceGrams || 0).toFixed(3))
  );

  // Current ornament entry (1-click ready without forcing +Add Item first)
  const [itemDesc, setItemDesc] = useState('');
  const [itemPurity, setItemPurity] = useState<GoldPurityCode>('22K');
  const [itemFineness, setItemFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);
  const [itemGross, setItemGross] = useState('');
  const [itemStone, setItemStone] = useState('0');
  const [itemWastage, setItemWastage] = useState('0');
  const [itemWastageMode, setItemWastageMode] = useState<'PERCENT' | 'GRAMS'>('PERCENT');
  const [itemRate, setItemRate] = useState<string>('');
  const [itemMaking, setItemMaking] = useState<string>('450');

  // Optional extra items if multi-item bill
  const [savedItems, setSavedItems] = useState<
    Array<{
      id: string;
      description: string;
      purity: GoldPurityCode;
      fineness: number;
      grossWeight: number;
      stoneWeight: number;
      netWeight: number;
      fineWeight: number;
      wastagePercent: number;
      wastageWeightGrams: number;
      goldRate: number;
      makingPerGram: number;
    }>
  >([]);

  const activeGoldRate =
    itemRate !== ''
      ? parseFloat(itemRate) || 0
      : computeRateForFineness(itemFineness, goldRates, itemPurity);
  const draftGross = parseFloat(itemGross) || 0;
  const draftStone = parseFloat(itemStone) || 0;
  const draftNet = Math.max(0, Number((draftGross - draftStone).toFixed(3)));
  const draftFineness = itemFineness;
  const draftFine = Number(((draftNet * draftFineness) / 1000).toFixed(4));
  const rawWastage = Math.max(0, parseFloat(itemWastage) || 0);
  const draftWastageGrams =
    itemWastageMode === 'PERCENT'
      ? Number(((draftNet * rawWastage) / 100).toFixed(3))
      : Number(rawWastage.toFixed(3));
  const draftWastagePct =
    itemWastageMode === 'PERCENT'
      ? Number(rawWastage.toFixed(2))
      : draftNet > 0
      ? Number(((draftWastageGrams / draftNet) * 100).toFixed(2))
      : 0;
  const draftMaking = parseFloat(itemMaking) || 0;

  const draftPurityLabel = isExactPresetFineness(itemPurity, draftFineness)
    ? itemPurity
    : `${(draftFineness / 10).toFixed(2)}%`;

  const effectiveItems = [
    ...savedItems,
    ...(draftGross > 0
      ? [
          {
            id: 'draft-current',
            description: itemDesc.trim() || `${draftPurityLabel} Gold Ornament`,
            purity: itemPurity,
            fineness: draftFineness,
            grossWeight: draftGross,
            stoneWeight: draftStone,
            netWeight: draftNet,
            fineWeight: draftFine,
            wastagePercent: draftWastagePct,
            wastageWeightGrams: draftWastageGrams,
            goldRate: showRupees ? activeGoldRate : 0,
            makingPerGram: showRupees ? draftMaking : 0,
          },
        ]
      : []),
  ];

  const handleAddMoreItem = () => {
    if (draftGross <= 0) {
      setFormError('Enter gross weight (g) before adding ornament.');
      return;
    }
    setFormError('');
    setSavedItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: itemDesc.trim() || `${draftPurityLabel} Gold Ornament`,
        purity: itemPurity,
        fineness: draftFineness,
        grossWeight: draftGross,
        stoneWeight: draftStone,
        netWeight: draftNet,
        fineWeight: draftFine,
        wastagePercent: draftWastagePct,
        wastageWeightGrams: draftWastageGrams,
        goldRate: showRupees ? activeGoldRate : 0,
        makingPerGram: showRupees ? draftMaking : 0,
      },
    ]);
    setItemDesc('');
    setItemGross('');
    setItemStone('0');
    setItemWastage('0');
  };

  const handleRemoveSavedItem = (id: string) => {
    setSavedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const totalGrossWeight = Number(effectiveItems.reduce((s, i) => s + i.grossWeight, 0).toFixed(3));
  const totalNetWeight = Number(effectiveItems.reduce((s, i) => s + i.netWeight, 0).toFixed(3));
  const totalFineWeight = Number(effectiveItems.reduce((s, i) => s + i.fineWeight, 0).toFixed(3));
  const totalWastageGrams = Number(effectiveItems.reduce((s, i) => s + i.wastageWeightGrams, 0).toFixed(3));

  const totalChargeableGold = Number((totalNetWeight + totalWastageGrams).toFixed(3));
  const taxableTotalINR = Math.round(
    effectiveItems.reduce(
      (s, i) => s + i.netWeight * (i.goldRate + i.makingPerGram) + i.wastageWeightGrams * i.goldRate,
      0
    )
  );
  const gstTotalINR = showRupees ? Math.round(taxableTotalINR * 0.03) : 0;
  const grandTotalINR = taxableTotalINR + gstTotalINR;

  // Live Settlement Calculation across Cash, Gold, Due, and Partly Payment
  const activeExchangeRate =
    goldReceivedRateInput !== ''
      ? parseFloat(goldReceivedRateInput) || 0
      : computeRateForFineness(goldReceivedFineness, goldRates, goldReceivedPurity);
  const enteredGoldGrams =
    billPaymentOption === 'GOLD' || billPaymentOption === 'PARTIAL'
      ? Math.max(0, Number((parseFloat(goldReceivedInput) || 0).toFixed(3)))
      : 0;
  const freshGoldValueINR =
    showRupees && enteredGoldGrams > 0 ? Math.round(enteredGoldGrams * activeExchangeRate) : 0;

  const canApplyCustody =
    (billPaymentOption === 'GOLD' || billPaymentOption === 'PARTIAL') &&
    useCustomerDeposit &&
    availableModalCustodyGrams > 0;

  const computedDepositUsedGrams = canApplyCustody
    ? !showRupees
      ? Math.min(
          availableModalCustodyGrams,
          Math.max(0, Number((totalChargeableGold - enteredGoldGrams).toFixed(3)))
        )
      : activeExchangeRate > 0
      ? Math.min(
          availableModalCustodyGrams,
          Number((Math.max(0, grandTotalINR - freshGoldValueINR) / activeExchangeRate).toFixed(3))
        )
      : 0
    : 0;

  const depositValueINR =
    showRupees && computedDepositUsedGrams > 0
      ? Math.round(computedDepositUsedGrams * activeExchangeRate)
      : 0;
  const totalSettledGoldGrams = Number((enteredGoldGrams + computedDepositUsedGrams).toFixed(3));
  const computedGoldValueINR = freshGoldValueINR + depositValueINR;
  const rawCashEntered = Math.max(0, Math.round(parseFloat(cashPaidInput) || 0));

  const computedPaidINR =
    billPaymentOption === 'CASH'
      ? showRupees
        ? grandTotalINR
        : rawCashEntered
      : billPaymentOption === 'PARTIAL'
      ? showRupees && grandTotalINR > 0
        ? Math.min(rawCashEntered, Math.max(0, grandTotalINR - computedGoldValueINR))
        : rawCashEntered
      : 0;

  const computedBalanceINR = showRupees
    ? billPaymentOption === 'CASH'
      ? 0
      : billPaymentOption === 'DUE'
      ? grandTotalINR
      : Math.max(0, grandTotalINR - computedGoldValueINR - computedPaidINR)
    : 0;

  const computedGoldDueGrams = !showRupees
    ? billPaymentOption === 'CASH'
      ? 0
      : billPaymentOption === 'DUE'
      ? totalChargeableGold
      : Math.max(0, Number((totalChargeableGold - totalSettledGoldGrams).toFixed(3)))
    : 0;

  const computedGoldExcessGrams =
    !showRupees && totalSettledGoldGrams > totalChargeableGold
      ? Number((totalSettledGoldGrams - totalChargeableGold).toFixed(3))
      : 0;

  const computedPaymentMethod: Invoice['paymentMethod'] =
    billPaymentOption === 'CASH'
      ? cashChannel
      : billPaymentOption === 'GOLD'
      ? 'OLD_GOLD_EXCHANGE'
      : billPaymentOption === 'DUE'
      ? 'CREDIT'
      : totalSettledGoldGrams > 0 && computedPaidINR > 0
      ? 'SPLIT'
      : totalSettledGoldGrams > 0
      ? 'OLD_GOLD_EXCHANGE'
      : computedPaidINR > 0
      ? cashChannel
      : 'CREDIT';

  const computedPaymentStatus: Invoice['paymentStatus'] =
    billPaymentOption === 'CASH'
      ? 'PAID'
      : billPaymentOption === 'DUE'
      ? 'UNPAID'
      : showRupees
      ? computedGoldValueINR + computedPaidINR <= 0
        ? 'UNPAID'
        : computedBalanceINR > 0
        ? 'PARTIAL'
        : 'PAID'
      : totalSettledGoldGrams <= 0 && computedPaidINR <= 0
      ? 'UNPAID'
      : computedGoldDueGrams > 0
      ? 'PARTIAL'
      : 'PAID';

  const handleCreateChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveItems.length === 0) {
      setFormError('Please enter ornament gross weight (g) to save.');
      return;
    }
    if (billPaymentOption === 'GOLD' && totalSettledGoldGrams <= 0) {
      setFormError('Please enter gold received weight (g) or apply customer deposit.');
      return;
    }
    setFormError('');
    setIsSubmitting(true);

    try {
      const matchedCustomer = customers.find(
        (c) => c.name.toLowerCase() === partyNameInput.trim().toLowerCase()
      );
      const finalCustomerName =
        partyNameInput.trim() || matchedCustomer?.name || 'Walk-in Customer';
      const finalCustomerPhone =
        partyPhoneInput.trim() || matchedCustomer?.phone || '';

      const formattedItems = effectiveItems.map((it, idx) => {
        const std = PURITY_STANDARDS[it.purity] || PURITY_STANDARDS['22K'];
        const goldVal = showRupees ? Math.round(it.netWeight * it.goldRate) : 0;
        const wastageVal = showRupees ? Math.round(it.wastageWeightGrams * it.goldRate) : 0;
        const makingVal = showRupees ? Math.round(it.netWeight * it.makingPerGram) : 0;
        const taxable = goldVal + wastageVal + makingVal;
        const gstAmt = showRupees ? Math.round(taxable * 0.03) : 0;
        return {
          id: `inv_item_${Date.now()}_${idx}`,
          description: it.description,
          hsnCode: '7113',
          grossWeightGrams: it.grossWeight,
          stoneWeightGrams: it.stoneWeight,
          netGoldWeightGrams: it.netWeight,
          purity: it.purity,
          fineness: it.fineness || std.fineness,
          fineGoldWeightGrams: it.fineWeight,
          goldRatePerGram: showRupees ? it.goldRate : 0,
          goldValueINR: goldVal,
          wastagePercent: it.wastagePercent,
          wastageWeightGrams: it.wastageWeightGrams,
          wastageValueINR: wastageVal,
          makingChargeType: 'PER_GRAM' as const,
          makingChargeRate: showRupees ? it.makingPerGram : 0,
          makingChargesINR: makingVal,
          stoneChargesINR: 0,
          otherChargesINR: 0,
          taxableAmountINR: taxable,
          gstRatePercent: showRupees ? 3 : 0,
          gstAmountINR: gstAmt,
          lineTotalINR: taxable + gstAmt,
        };
      });

      const cgst = Number((gstTotalINR / 2).toFixed(2));
      const sgst = Number((gstTotalINR / 2).toFixed(2));

      const invoicePayload = {
        branchId: 'branch_main',
        type: showRupees ? ('RETAIL_TAX_INVOICE' as const) : ('JOB_WORK_BILL' as const),
        date: deliveryDate || new Date().toISOString().split('T')[0],
        dueDate: billDueDate || undefined,
        customerId: matchedCustomer?.id,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        customerAddress: matchedCustomer?.address,
        customerGstin: matchedCustomer?.gstin,
        isInterstate: false,
        items: formattedItems,
        totalGrossWeightGrams: totalGrossWeight,
        totalNetGoldWeightGrams: totalNetWeight,
        totalFineGoldWeightGrams: totalFineWeight,
        taxableAmountINR: taxableTotalINR,
        cgstINR: cgst,
        sgstINR: sgst,
        igstINR: 0,
        totalGstINR: gstTotalINR,
        roundOffINR: 0,
        grandTotalINR,
        paidAmountINR: computedPaidINR,
        balanceAmountINR: computedBalanceINR,
        paymentMethod: computedPaymentMethod,
        cashPaymentChannel: computedPaidINR > 0 ? cashChannel : undefined,
        goldExchangeGrams: enteredGoldGrams > 0 ? enteredGoldGrams : undefined,
        goldExchangePurity: enteredGoldGrams > 0 ? goldReceivedPurity : undefined,
        goldExchangeFineness: enteredGoldGrams > 0 ? goldReceivedFineness : undefined,
        goldExchangeRatePerGram: enteredGoldGrams > 0 && showRupees ? activeExchangeRate : undefined,
        goldExchangeValueINR: computedGoldValueINR > 0 ? computedGoldValueINR : undefined,
        goldUsedFromDepositGrams:
          computedDepositUsedGrams > 0 ? computedDepositUsedGrams : undefined,
        goldBalanceDueGrams: computedGoldDueGrams > 0 ? computedGoldDueGrams : undefined,
        goldExcessCreditGrams:
          computedGoldExcessGrams > 0 ? computedGoldExcessGrams : undefined,
        paymentStatus: computedPaymentStatus,
        termsAndConditions:
          notes.trim() ||
          printerSettings.footerNote.trim() ||
          'BIS Hallmarked Jewellery. Subject to local jurisdiction.',
        createdBy: currentTenant?.name || 'Billing Counter',
        status: 'FINAL' as const,
      };

      const result = await onCreateInvoice(invoicePayload);
      setShowCreateModal(false);
      setSavedItems([]);
      setItemDesc('');
      setItemGross('');
      setItemStone('0');
      setItemWastage('0');
      setItemWastageMode('PERCENT');
      setPartyNameInput('');
      setPartyPhoneInput('');
      setBillPaymentOption('CASH');
      setCashPaidInput('');
      setGoldReceivedInput('');
      setUseCustomerDeposit(false);
      setGoldReceivedRateInput('');
      setBillDueDate('');
      setNotes('');
      if (result) {
        setAutoPrintPreview(Boolean(printerSettings.autoPrintOnSave));
        setSelectedInvoice(result);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'ALL' && (inv.paymentStatus || 'PAID') !== statusFilter) {
      return false;
    }
    const cust = customers.find((c) => c.id === inv.customerId);
    const displayName = inv.customerName || cust?.name || 'Walk-in Customer';
    const methodLabel = formatInvoicePaymentMethodLabel(inv, activeLanguage);
    const text = `${inv.invoiceNo} ${displayName} ${inv.paymentStatus} ${methodLabel}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  const allGrossSum = invoices.reduce(
    (sum, inv) =>
      sum +
      (inv.totalGrossWeightGrams ||
        inv.items?.reduce((isum, it) => isum + (it.grossWeightGrams || 0), 0) ||
        0),
    0
  );
  const allNetSum = invoices.reduce(
    (sum, inv) =>
      sum +
      (inv.totalNetGoldWeightGrams ||
        inv.items?.reduce((isum, it) => isum + (it.netGoldWeightGrams || 0), 0) ||
        0),
    0
  );
  const allFineSum = invoices.reduce(
    (sum, inv) =>
      sum +
      (inv.totalFineGoldWeightGrams ||
        inv.items?.reduce((isum, it) => isum + (it.fineGoldWeightGrams || 0), 0) ||
        0),
    0
  );

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {ui.invoicesTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ui.invoicesSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError('');
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{ui.createGstBill}</span>
        </button>
      </div>

      {/* Single-Elevation Summary Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.recordsCount}</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono tabular-nums">
            {invoices.length}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.netWt}</div>
          <div className="text-2xl font-bold text-[#9A7426] dark:text-[#E5C158] mt-1 font-mono tabular-nums">
            {formatGrams(allNetSum)}
          </div>
        </div>

        {showRupees ? (
          <>
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">{ui.gstAmount}</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono tabular-nums">
                {formatINR(
                  invoices.reduce(
                    (sum, inv) => sum + ((inv.cgstINR || 0) + (inv.sgstINR || 0)),
                    0
                  )
                )}
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">{ui.grandTotal}</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 font-mono tabular-nums">
                {formatINR(invoices.reduce((sum, inv) => sum + (inv.grandTotalINR || 0), 0))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">{ui.grossWt}</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono tabular-nums">
                {formatGrams(allGrossSum)}
              </div>
            </div>

            <div className="p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">{ui.fineWt}</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 font-mono tabular-nums">
                {formatGrams(allFineSum)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={ui.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#C9A24A]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-full sm:w-auto overflow-x-auto">
            {(
              [
                { id: 'ALL', label: ui.all },
                { id: 'PAID', label: payT.statusPaid },
                { id: 'PARTIAL', label: payT.statusPartial },
                { id: 'UNPAID', label: payT.statusDue },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === f.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0">
          <span className="text-slate-900 dark:text-slate-100 font-bold">{filteredInvoices.length}</span> {ui.recordsCount}
        </div>
      </div>

      {/* Invoices / Challans Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-semibold">
                <th className="py-3 px-4">{ui.billNo}</th>
                <th className="py-3 px-4">{ui.date}</th>
                <th className="py-3 px-4">{ui.customerName}</th>
                <th className="py-3 px-4 text-right">{ui.netWt}</th>
                {showRupees ? (
                  <>
                    <th className="py-3 px-4 text-right">{ui.grandTotal}</th>
                    <th className="py-3 px-4 text-right">{payT.paidNow}</th>
                    <th className="py-3 px-4 text-right">{payT.balanceDue}</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-4 text-right">{ui.fineWt}</th>
                    <th className="py-3 px-4 text-right">{payT.goldDue}</th>
                  </>
                )}
                <th className="py-3 px-4">{payT.paymentOption}</th>
                <th className="py-3 px-4 text-right">{ui.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={showRupees ? 9 : 8} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    {ui.noRecordsFound}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const cust = customers.find((c) => c.id === inv.customerId);
                  const displayName = inv.customerName || cust?.name || 'Walk-in Customer';
                  const displayPhone = inv.customerPhone || cust?.phone || '';
                  const totalNet =
                    inv.totalNetGoldWeightGrams ||
                    inv.items?.reduce((s, it) => s + (it.netGoldWeightGrams || 0), 0) ||
                    0;
                  const totalFine =
                    inv.totalFineGoldWeightGrams ||
                    inv.items?.reduce((s, it) => s + (it.fineGoldWeightGrams || 0), 0) ||
                    0;
                  const totalSettledINR = (inv.paidAmountINR || 0) + (inv.goldExchangeValueINR || 0);
                  const status = inv.paymentStatus || 'PAID';
                  const statusColor =
                    status === 'UNPAID'
                      ? 'text-rose-700'
                      : status === 'PARTIAL'
                      ? 'text-amber-700'
                      : 'text-emerald-700';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158] whitespace-nowrap">
                        {inv.invoiceNo}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {inv.date?.split('T')[0]}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{displayName}</div>
                        {displayPhone && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">{displayPhone}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatGrams(totalNet)}
                      </td>
                      {showRupees ? (
                        <>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {formatINR(inv.grandTotalINR || 0)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {formatINR(totalSettledINR)}
                            {(inv.goldExchangeGrams || 0) > 0 && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                {payT.gold}: {formatGrams(inv.goldExchangeGrams || 0)}
                              </div>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                              (inv.balanceAmountINR || 0) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {(inv.balanceAmountINR || 0) > 0 ? formatINR(inv.balanceAmountINR) : '—'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158] whitespace-nowrap">
                            {formatGrams(totalFine)}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                              (inv.goldBalanceDueGrams || 0) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {(inv.goldBalanceDueGrams || 0) > 0
                              ? formatGrams(inv.goldBalanceDueGrams || 0)
                              : (inv.goldExchangeGrams || 0) > 0
                              ? `${payT.gold}: ${formatGrams(inv.goldExchangeGrams || 0)}`
                              : '—'}
                          </td>
                        </>
                      )}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {formatInvoicePaymentMethodLabel(inv, activeLanguage)}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600 mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span className={`font-semibold ${statusColor}`}>
                          {formatInvoiceStatusLabel(status, activeLanguage)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAutoPrintPreview(false);
                            setSelectedInvoice(inv);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF5E8] dark:bg-[#C9A24A]/10 hover:bg-[#F5EED8] dark:hover:bg-[#C9A24A]/20 text-[#9A7426] dark:text-[#E5C158] border border-[#C9A24A]/30 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{printerT.printPreviewTitle}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SIMPLE SINGLE-CARD NEW SALES BILL / CHALLAN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-xl space-y-5 my-8 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#FAF5E8] dark:bg-[#C9A24A]/10 text-[#C9A24A] flex items-center justify-center border border-[#C9A24A]/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-cinzel">
                    {ui.createGstBill}
                  </h3>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {showRupees ? ui.rupeesVisible : ui.pureWeightMode}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateChallan} className="space-y-4">
              {/* 1. Customer & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {ui.customerName}
                  </label>
                  <input
                    type="text"
                    list="invCustomerDatalist"
                    placeholder="Walk-in / Jeweller Name"
                    value={partyNameInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPartyNameInput(val);
                      const found = customers.find((c) => c.name.toLowerCase() === val.toLowerCase());
                      if (found && !partyPhoneInput) {
                        setPartyPhoneInput(found.phone);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:bg-white focus:outline-none focus:border-[#C9A24A]"
                  />
                  <datalist id="invCustomerDatalist">
                    {customers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.phone}
                      </option>
                    ))}
                  </datalist>
                  {activeModalCustomer && (activeModalCustomer.customerGoldBalanceGrams || 0) !== 0 && (
                    <div className="mt-1 text-[11px] font-mono tabular-nums">
                      {(activeModalCustomer.customerGoldBalanceGrams || 0) > 0 ? (
                        <span className="text-[#9A7426] dark:text-[#E5C158]">
                          Custody: +{formatGrams(activeModalCustomer.customerGoldBalanceGrams)}
                        </span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-400">
                          {payT.goldDue}: {formatGrams(Math.abs(activeModalCustomer.customerGoldBalanceGrams))}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {ui.phoneNo}
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98..."
                    value={partyPhoneInput}
                    onChange={(e) => setPartyPhoneInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#C9A24A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {ui.date}
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#C9A24A]"
                  />
                </div>
              </div>

              {/* 2. Ornament Quick Selection & Purity */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {['Ring', 'Chain', 'Bangle', 'Necklace', 'Earrings', 'Mangalsutra', 'Gold Coin'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (preset === 'Gold Coin') {
                          setItemPurity('24K');
                          setItemFineness(PURITY_STANDARDS['24K'].fineness);
                          setItemDesc(`24K ${preset}`);
                        } else {
                          setItemDesc(`${draftPurityLabel} ${preset}`);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                        itemDesc.includes(preset)
                          ? 'bg-[#C9A24A] text-white dark:text-slate-950 border-[#B38F3B]'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Ornament / Item Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 22K Hallmarked Chain"
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {ui.purity}
                    </label>
                    <EditablePurityControl
                      purity={itemPurity}
                      fineness={itemFineness}
                      onChange={(nextPurity, nextFineness) => {
                        setItemPurity(nextPurity);
                        setItemFineness(nextFineness);
                        setItemRate('');
                      }}
                    />
                  </div>
                </div>

                {/* Weights, Wastage & Optional Rupee Rates */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap">
                      {ui.grossWt} (g) *
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={itemGross}
                      onChange={(e) => setItemGross(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-[#C9A24A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap">
                      Stone / Less Wt (g)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={itemStone}
                      onChange={(e) => setItemStone(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-[#C9A24A]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap truncate">
                        {posT.wastagePercent}
                      </label>
                      <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 rounded-md p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (itemWastageMode !== 'PERCENT') {
                              const curGrams = parseFloat(itemWastage) || 0;
                              setItemWastageMode('PERCENT');
                              setItemWastage(draftNet > 0 && curGrams > 0 ? String(Number(((curGrams / draftNet) * 100).toFixed(2))) : '0');
                            }
                          }}
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition cursor-pointer ${
                            itemWastageMode === 'PERCENT'
                              ? 'bg-white dark:bg-slate-700 text-[#9A7426] dark:text-[#E5C158] shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (itemWastageMode !== 'GRAMS') {
                              const curPct = parseFloat(itemWastage) || 0;
                              setItemWastageMode('GRAMS');
                              setItemWastage(draftNet > 0 && curPct > 0 ? String(Number(((draftNet * curPct) / 100).toFixed(3))) : '0');
                            }
                          }}
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition cursor-pointer ${
                            itemWastageMode === 'GRAMS'
                              ? 'bg-white dark:bg-slate-700 text-[#9A7426] dark:text-[#E5C158] shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          g
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step={itemWastageMode === 'PERCENT' ? '0.1' : '0.001'}
                        min="0"
                        placeholder={itemWastageMode === 'PERCENT' ? '0.0' : '0.000'}
                        value={itemWastage}
                        onChange={(e) => setItemWastage(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-3 pr-7 py-2 text-sm font-bold text-[#9A7426] dark:text-[#E5C158] font-mono tabular-nums focus:outline-none focus:border-[#C9A24A]"
                      />
                      <span className="absolute right-2.5 top-2 text-xs font-mono text-slate-400 dark:text-slate-500 pointer-events-none">
                        {itemWastageMode === 'PERCENT' ? '%' : 'g'}
                      </span>
                    </div>
                  </div>
                </div>

                {showRupees && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap">
                        Rate (₹/g)
                      </label>
                      <input
                        type="number"
                        value={itemRate !== '' ? itemRate : activeGoldRate}
                        onChange={(e) => setItemRate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-[#C9A24A]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap">
                        Making (₹/g)
                      </label>
                      <input
                        type="number"
                        value={itemMaking}
                        onChange={(e) => setItemMaking(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-[#C9A24A]"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    Net: <strong className="text-slate-900 dark:text-slate-100">{formatGrams(draftNet)}</strong>
                    {draftWastageGrams > 0 && (
                      <>
                        {' · '}VA: <strong className="text-[#9A7426] dark:text-[#E5C158]">+{formatGrams(draftWastageGrams)}</strong> ({draftWastagePct}%)
                      </>
                    )}
                    {' · '}Fine: <strong className="text-[#9A7426] dark:text-[#E5C158]">{formatGrams(draftFine)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddMoreItem}
                    className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Item</span>
                  </button>
                </div>
              </div>

              {/* Saved Multi-Items List (Only shown when > 0 items added) */}
              {savedItems.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {savedItems.map((it, idx) => (
                    <div key={it.id} className="px-3 py-2 flex items-center justify-between font-mono tabular-nums gap-2">
                      <div className="font-sans">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {idx + 1}. {it.description} (
                          {isExactPresetFineness(it.purity, it.fineness)
                            ? it.purity
                            : `${(it.fineness / 10).toFixed(2)}%`}
                          )
                        </span>
                        {it.wastageWeightGrams > 0 && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2 font-mono tabular-nums">
                            · VA +{formatGrams(it.wastageWeightGrams)} ({it.wastagePercent}%)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 shrink-0">
                        <span className="font-bold text-[#9A7426] dark:text-[#E5C158]">{formatGrams(it.netWeight)}</span>
                        {showRupees && (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                            {formatINR(
                              Math.round(it.netWeight * (it.goldRate + it.makingPerGram) + it.wastageWeightGrams * it.goldRate)
                            )}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveSavedItem(it.id)}
                          className="text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. Payment Option (Cash | Gold | Due | Partly Payment) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {payT.paymentOption}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full sm:w-auto">
                    {(
                      [
                        { id: 'CASH', label: payT.cash },
                        { id: 'GOLD', label: payT.gold },
                        { id: 'DUE', label: payT.due },
                        { id: 'PARTIAL', label: payT.partlyPayment },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBillPaymentOption(opt.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                          billPaymentOption === opt.id
                            ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Option A: CASH (Cash / UPI / Bank full payment) */}
                {billPaymentOption === 'CASH' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {payT.cashChannel} / {payT.upiChannel} / {payT.bankChannel}
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'CASH', label: payT.cashChannel },
                            { id: 'UPI', label: payT.upiChannel },
                            { id: 'BANK_TRANSFER', label: payT.bankChannel },
                          ] as const
                        ).map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => setCashChannel(ch.id)}
                            className={`py-2 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                              cashChannel === ch.id
                                ? 'bg-[#C9A24A] text-white dark:text-slate-950 border-[#B38F3B]'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {!showRupees && (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          {payT.cashPaidNow}
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={cashPaidInput}
                          onChange={(e) => setCashPaidInput(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Option B: GOLD (Gold received against bill) */}
                {billPaymentOption === 'GOLD' && (
                  <div className="space-y-2.5 pt-1">
                    {availableModalCustodyGrams > 0 && (
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                          Customer Custody Available:{' '}
                          <strong className="text-[#9A7426] dark:text-[#E5C158]">+{formatGrams(availableModalCustodyGrams)}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setUseCustomerDeposit((prev) => !prev)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                            useCustomerDeposit
                              ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {useCustomerDeposit
                            ? `Using Deposit (${formatGrams(computedDepositUsedGrams)})`
                            : 'Use Custody Deposit'}
                        </button>
                      </div>
                    )}
                    <div className={`grid grid-cols-1 ${showRupees ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {payT.goldReceivedGrams} *
                          </label>
                          {totalChargeableGold > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setGoldReceivedInput(
                                  String(
                                    Math.max(
                                      0,
                                      Number(
                                        (
                                          totalChargeableGold -
                                          (useCustomerDeposit ? availableModalCustodyGrams : 0)
                                        ).toFixed(3)
                                      )
                                    )
                                  )
                                )
                              }
                              className="text-[11px] font-semibold text-[#9A7426] dark:text-[#E5C158] hover:underline cursor-pointer whitespace-nowrap"
                            >
                              {payT.matchFullWeight} ({formatGrams(totalChargeableGold)})
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0.000"
                          value={goldReceivedInput}
                          onChange={(e) => setGoldReceivedInput(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          {ui.purity}
                        </label>
                        <EditablePurityControl
                          purity={goldReceivedPurity}
                          fineness={goldReceivedFineness}
                          onChange={(nextPurity, nextFineness) => {
                            setGoldReceivedPurity(nextPurity);
                            setGoldReceivedFineness(nextFineness);
                            setGoldReceivedRateInput('');
                          }}
                        />
                      </div>

                      {showRupees && (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 whitespace-nowrap">
                            {payT.goldRatePerGram}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={goldReceivedRateInput !== '' ? goldReceivedRateInput : activeExchangeRate}
                            onChange={(e) => setGoldReceivedRateInput(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Option C: DUE (Full credit / unpaid) */}
                {billPaymentOption === 'DUE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 items-end">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {payT.dueDateOptional}
                      </label>
                      <input
                        type="date"
                        value={billDueDate}
                        onChange={(e) => setBillDueDate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                      />
                    </div>
                    <div className="text-xs text-rose-700 dark:text-rose-400 font-mono tabular-nums py-2">
                      {payT.balanceDue}:{' '}
                      <strong>
                        {showRupees ? formatINR(grandTotalINR) : formatGrams(totalChargeableGold)}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Option D: PARTLY PAYMENT (Split Cash/UPI + Gold + Remaining Due) */}
                {billPaymentOption === 'PARTIAL' && (
                  <div className="space-y-3 pt-1">
                    {availableModalCustodyGrams > 0 && (
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                          Customer Custody Available:{' '}
                          <strong className="text-[#9A7426] dark:text-[#E5C158]">+{formatGrams(availableModalCustodyGrams)}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setUseCustomerDeposit((prev) => !prev)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                            useCustomerDeposit
                              ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {useCustomerDeposit
                            ? `Using Deposit (${formatGrams(computedDepositUsedGrams)})`
                            : 'Use Custody Deposit'}
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {payT.cashPaidNow}
                          </label>
                          {showRupees && Math.max(0, grandTotalINR - computedGoldValueINR) > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setCashPaidInput(String(Math.max(0, grandTotalINR - computedGoldValueINR)))
                              }
                              className="text-[11px] font-semibold text-[#9A7426] dark:text-[#E5C158] hover:underline cursor-pointer whitespace-nowrap"
                            >
                              {payT.fillBalanceCash}
                            </button>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={cashPaidInput}
                            onChange={(e) => setCashPaidInput(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                          />
                          <select
                            value={cashChannel}
                            onChange={(e) => setCashChannel(e.target.value as 'CASH' | 'UPI' | 'BANK_TRANSFER')}
                            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#C9A24A]"
                          >
                            <option value="CASH">{payT.cashChannel}</option>
                            <option value="UPI">{payT.upiChannel}</option>
                            <option value="BANK_TRANSFER">{payT.bankChannel}</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1 whitespace-nowrap">
                          {payT.goldReceivedGrams} & {ui.purity}
                        </label>
                        <div className="flex flex-col sm:flex-row gap-1.5">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            value={goldReceivedInput}
                            onChange={(e) => setGoldReceivedInput(e.target.value)}
                            className="w-full sm:w-28 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                          />
                          <EditablePurityControl
                            variant="inline"
                            purity={goldReceivedPurity}
                            fineness={goldReceivedFineness}
                            onChange={(nextPurity, nextFineness) => {
                              setGoldReceivedPurity(nextPurity);
                              setGoldReceivedFineness(nextFineness);
                              setGoldReceivedRateInput('');
                            }}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {showRupees && enteredGoldGrams > 0 && (
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            {payT.goldRatePerGram} ({payT.goldValue}: {formatINR(computedGoldValueINR)})
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={goldReceivedRateInput !== '' ? goldReceivedRateInput : activeExchangeRate}
                            onChange={(e) => setGoldReceivedRateInput(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          {payT.dueDateOptional}
                        </label>
                        <input
                          type="date"
                          value={billDueDate}
                          onChange={(e) => setBillDueDate(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Live Calculation & Settlement Summary Strip */}
              <div className="bg-[#FAF5E8] dark:bg-[#C9A24A]/10 border border-[#C9A24A]/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono tabular-nums text-xs">
                <div className="space-y-1">
                  <div className="text-slate-600 dark:text-slate-400">
                    {ui.netWt}: <strong className="text-slate-900 dark:text-slate-100 text-sm">{formatGrams(totalNetWeight)}</strong>
                    {totalWastageGrams > 0 && (
                      <span className="text-[#9A7426] dark:text-[#E5C158] ml-2">
                        · VA: <strong>+{formatGrams(totalWastageGrams)}</strong>
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    {ui.fineWt} (999.9): <strong className="text-[#9A7426] dark:text-[#E5C158]">{formatGrams(totalFineWeight)}</strong>
                    {totalSettledGoldGrams > 0 && (
                      <span className="text-emerald-700 dark:text-emerald-400 ml-2">
                        · {payT.gold}: <strong>−{formatGrams(totalSettledGoldGrams)}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {showRupees ? (
                  <div className="sm:text-right space-y-0.5">
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      {payT.totalBill}: <strong>{formatINR(grandTotalINR)}</strong> (GST 3%: {formatINR(gstTotalINR)})
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      {payT.paidNow}: <strong>{formatINR(computedPaidINR + computedGoldValueINR)}</strong>
                      {computedGoldValueINR > 0 && ` (${payT.gold}: ${formatINR(computedGoldValueINR)})`}
                    </div>
                    <div
                      className={`text-base font-bold ${
                        computedBalanceINR > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {computedBalanceINR > 0
                        ? `${payT.balanceDue}: ${formatINR(computedBalanceINR)}`
                        : `${formatInvoiceStatusLabel('PAID', activeLanguage)} · ${formatINR(grandTotalINR)}`}
                    </div>
                  </div>
                ) : (
                  <div className="sm:text-right space-y-0.5">
                    {computedPaidINR > 0 && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        {payT.cash}: <strong>{formatINR(computedPaidINR)}</strong>
                      </div>
                    )}
                    {computedGoldExcessGrams > 0 && (
                      <div className="text-[11px] text-[#9A7426] dark:text-[#E5C158]">
                        Custody Credit: <strong>+{formatGrams(computedGoldExcessGrams)}</strong>
                      </div>
                    )}
                    <div
                      className={`text-base font-bold ${
                        computedGoldDueGrams > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {computedGoldDueGrams > 0
                        ? `${payT.goldDue}: ${formatGrams(computedGoldDueGrams)}`
                        : `${formatInvoiceStatusLabel('PAID', activeLanguage)} · ${formatGrams(totalChargeableGold)}`}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {ui.notes}
                </label>
                <input
                  type="text"
                  placeholder="Optional HUID / remarks"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:bg-white focus:outline-none focus:border-[#C9A24A]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  {ui.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#C9A24A] hover:bg-[#B38F3B] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isSubmitting ? '...' : `${ui.save} & ${ui.printInvoice}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WYSIWYG PRINT PREVIEW MODAL FOR INVOICES & CHALLANS */}
      <PrintPreviewModal
        isOpen={Boolean(selectedInvoice)}
        onClose={() => {
          setSelectedInvoice(null);
          setAutoPrintPreview(false);
        }}
        docType="INVOICE"
        data={selectedInvoice}
        tenant={currentTenant}
        customers={customers}
        activeLanguage={activeLanguage}
        showRupees={showRupees}
        printerSettings={printerSettings}
        onUpdatePrinterSettings={onUpdatePrinterSettings}
        autoTriggerPrint={autoPrintPreview}
      />
    </div>
  );
};
