import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building,
  CheckCircle2,
  Copy,
  FileText,
  Flame,
  Hammer,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Scale,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  Branch,
  CashBankTransaction,
  Customer,
  GoldAccountType,
  GoldLedgerEntry,
  GoldLedgerTransactionType,
  GoldPurityCode,
  GoldRate,
  IndianLanguage,
  Invoice,
  InvoiceItem,
  JobCard,
  MeltingBatch,
  OutsideParty,
  OutsidePartyTransaction,
  Staff,
  Tenant,
} from '../types';
import {
  calculateFineGold,
  calculateWastageReconciliation,
  formatGrams,
  formatINR,
  PURITY_STANDARDS,
} from '../utils/goldMath';
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
import { computeRateForFineness, EditablePurityControl } from './EditablePurityControl';

export type POSTabKey =
  | 'quick_pos'
  | 'gold_in_out'
  | 'karigar_tx'
  | 'melting_refining'
  | 'party_tx'
  | 'payments';

interface POSTransactionCenterProps {
  tenant: Tenant | null;
  branches: Branch[];
  stockSummary: any;
  goldRates: GoldRate[];
  ledgerEntries: GoldLedgerEntry[];
  jobCards: JobCard[];
  invoices: Invoice[];
  customers: Customer[];
  staffList: Staff[];
  cashTransactions: CashBankTransaction[];
  activeLanguage: IndianLanguage;
  onRefresh: () => Promise<void>;
  onNewLedgerEntry: (entry: any) => Promise<any>;
  onCreateInvoice: (inv: any) => Promise<any>;
  onCreateJobCard: (job: any) => Promise<any>;
  onReturnJobCard: (
    jobId: string,
    gross: number,
    net: number,
    scrap: number,
    qcRemarks?: string
  ) => Promise<void>;
  onAddCashTransaction: (tx: any) => Promise<void>;
  onAddCustomer: (cust: any) => Promise<any>;
  showRupees?: boolean;
  onToggleRupees?: (val: boolean) => void;
  printerSettings?: PrinterSettings;
  onUpdatePrinterSettings?: (next: PrinterSettings) => void;
}

export const POSTransactionCenter: React.FC<POSTransactionCenterProps> = ({
  tenant,
  branches,
  goldRates,
  jobCards,
  invoices,
  customers,
  staffList,
  cashTransactions,
  activeLanguage,
  onRefresh,
  onNewLedgerEntry,
  onCreateInvoice,
  onCreateJobCard,
  onReturnJobCard,
  onAddCashTransaction,
  onAddCustomer,
  showRupees = false,
  onToggleRupees,
  printerSettings = DEFAULT_PRINTER_SETTINGS,
  onUpdatePrinterSettings,
}) => {
  const posT = POS_TRANSLATIONS[activeLanguage] || POS_TRANSLATIONS.en;
  const ui = getUI(activeLanguage);
  const payT = getPaymentStrings(activeLanguage);
  const printerT = getPrinterStrings(activeLanguage);
  const [autoPrintPos, setAutoPrintPos] = useState(false);

  // Active workstation tab (6 clean, non-overlapping actions)
  const [activeTab, setActiveTab] = useState<POSTabKey>('quick_pos');
  const selectedBranchId = branches[0]?.id || 'branch_main';

  // Local operational collections fetched from server
  const [outsideParties, setOutsideParties] = useState<OutsideParty[]>([]);
  const [outsidePartyTransactions, setOutsidePartyTransactions] = useState<OutsidePartyTransaction[]>([]);
  const [meltingBatches, setMeltingBatches] = useState<MeltingBatch[]>([]);

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Printable Document Modal & Outside Party Modal
  const [printDoc, setPrintDoc] = useState<{
    type:
      | 'TAX_INVOICE'
      | 'THERMAL_RECEIPT'
      | 'GOLD_ISSUE_SLIP'
      | 'GOLD_RECEIPT_SLIP'
      | 'DELIVERY_CHALLAN'
      | 'MELTING_SLIP';
    data: any;
  } | null>(null);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);

  const loadPOSData = async () => {
    if (!tenant) return;
    try {
      const headers = { 'x-tenant-id': tenant.id };
      const [partiesRes, partyTxRes, meltRes] = await Promise.all([
        fetch('/api/pos/parties', { headers }).then((r) => r.json()),
        fetch('/api/pos/parties/transactions', { headers }).then((r) => r.json()),
        fetch('/api/pos/melting/batches', { headers }).then((r) => r.json()),
      ]);

      if (partiesRes.parties) {
        setOutsideParties(partiesRes.parties);
        if (partiesRes.parties.length === 0) {
          setSelectedPartyId('');
        } else if (!selectedPartyId && partiesRes.parties[0]?.id) {
          setSelectedPartyId(partiesRes.parties[0].id);
        }
      }
      if (partyTxRes.transactions) setOutsidePartyTransactions(partyTxRes.transactions);
      if (meltRes.batches) setMeltingBatches(meltRes.batches);
    } catch (e) {
      console.error('Error fetching POS collections:', e);
    }
  };

  useEffect(() => {
    loadPOSData();
  }, [tenant?.id, customers.length, invoices.length]);

  // Keyboard shortcuts (F1–F6 / Alt+1–6 / Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' || (e.altKey && e.key === '1')) {
        e.preventDefault();
        setActiveTab('quick_pos');
      } else if (e.key === 'F2' || (e.altKey && e.key === '2')) {
        e.preventDefault();
        setActiveTab('gold_in_out');
      } else if (e.key === 'F3' || (e.altKey && e.key === '3')) {
        e.preventDefault();
        setActiveTab('karigar_tx');
      } else if (e.key === 'F4' || (e.altKey && e.key === '4')) {
        e.preventDefault();
        setActiveTab('melting_refining');
      } else if (e.key === 'F5' || (e.altKey && e.key === '5')) {
        e.preventDefault();
        setActiveTab('party_tx');
      } else if (e.key === 'F6' || (e.altKey && e.key === '6')) {
        e.preventDefault();
        setActiveTab('payments');
      } else if (e.key === 'Escape') {
        if (printDoc) setPrintDoc(null);
        if (showAddPartyModal) setShowAddPartyModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printDoc, showAddPartyModal]);

  const getRate = (purity: GoldPurityCode) => {
    const r = goldRates.find((gr) => gr.purity === purity);
    return r ? r.ratePerGram : 6825;
  };

  // Preview handler handled by PrintPreviewModal

  // =============================================================
  // 1. SALES BILL STATE & CALCULATIONS
  // =============================================================
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [billItems, setBillItems] = useState<InvoiceItem[]>([]);

  const [fastDesc, setFastDesc] = useState('');
  const [fastGross, setFastGross] = useState<string>('');
  const [fastStone, setFastStone] = useState<string>('0');
  const [fastPurity, setFastPurity] = useState<GoldPurityCode>('22K');
  const [fastFineness, setFastFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);
  const [fastWastage, setFastWastage] = useState<string>('0');
  const [fastWastageMode, setFastWastageMode] = useState<'PERCENT' | 'GRAMS'>('PERCENT');
  const [fastCustomRate, setFastCustomRate] = useState<string>('');
  const [fastMakingRate, setFastMakingRate] = useState<string>('450');

  const [posPaymentOption, setPosPaymentOption] = useState<'CASH' | 'GOLD' | 'DUE' | 'PARTIAL'>('CASH');
  const [posCashChannel, setPosCashChannel] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [posCashPaidInput, setPosCashPaidInput] = useState<string>('');
  const [posGoldReceivedInput, setPosGoldReceivedInput] = useState<string>('');
  const [posUseDeposit, setPosUseDeposit] = useState<boolean>(false);
  const [posGoldPurity, setPosGoldPurity] = useState<GoldPurityCode>('22K');
  const [posGoldFineness, setPosGoldFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);
  const [posGoldRateInput, setPosGoldRateInput] = useState<string>('');
  const [posDueDate, setPosDueDate] = useState<string>('');
  const [billNotes, setBillNotes] = useState('');
  const [isSavingBill, setIsSavingBill] = useState(false);

  const activePosCustomer = useMemo(() => {
    const q = newCustName.trim().toLowerCase();
    if (!q) return undefined;
    return customers.find((c) => c.name.toLowerCase() === q);
  }, [customers, newCustName]);

  const availablePosCustodyGrams = Math.max(
    0,
    Number((activePosCustomer?.customerGoldBalanceGrams || 0).toFixed(3))
  );

  const handleSelectPreset = (itemKey: keyof typeof posT.presetItems) => {
    const itemName = posT.presetItems[itemKey];
    setFastDesc(itemName);
    setFastCustomRate('');
    if (itemKey === 'oldGold') {
      setFastPurity('22K');
      setFastFineness(PURITY_STANDARDS['22K'].fineness);
      setFastMakingRate('0');
      setFastWastage('0');
      setFastWastageMode('PERCENT');
    } else if (itemKey === 'coin') {
      setFastPurity('24K');
      setFastFineness(PURITY_STANDARDS['24K'].fineness);
      setFastMakingRate('150');
      setFastWastage('0');
      setFastWastageMode('PERCENT');
    } else {
      setFastPurity('22K');
      setFastFineness(PURITY_STANDARDS['22K'].fineness);
      setFastMakingRate('450');
    }
  };

  const activeItemRate =
    fastCustomRate !== ''
      ? parseFloat(fastCustomRate) || 0
      : computeRateForFineness(fastFineness, goldRates, fastPurity);

  const draftInvoiceItem = useMemo<InvoiceItem | null>(() => {
    const gross = parseFloat(fastGross) || 0;
    if (gross <= 0) return null;
    const stone = parseFloat(fastStone) || 0;
    const net = Math.max(0, Number((gross - stone).toFixed(3)));
    const fine = calculateFineGold(net, fastFineness).toNumber();

    const rawWastage = Math.max(0, parseFloat(fastWastage) || 0);
    const wastageGrams =
      fastWastageMode === 'PERCENT'
        ? Number(((net * rawWastage) / 100).toFixed(3))
        : Number(rawWastage.toFixed(3));
    const wastagePct =
      fastWastageMode === 'PERCENT'
        ? Number(rawWastage.toFixed(2))
        : net > 0
        ? Number(((wastageGrams / net) * 100).toFixed(2))
        : 0;

    const rate = showRupees ? activeItemRate : 0;
    const mRate = showRupees ? parseFloat(fastMakingRate) || 0 : 0;
    const goldVal = showRupees ? Math.round(net * rate) : 0;
    const wastageVal = showRupees ? Math.round(wastageGrams * rate) : 0;
    const makingCharges = showRupees ? Math.round(net * mRate) : 0;
    const taxable = goldVal + wastageVal + makingCharges;
    const gstRate = showRupees ? 3 : 0;
    const gst = showRupees ? Math.round((taxable * gstRate) / 100) : 0;
    const total = taxable + gst;

    return {
      id: 'draft_current_item',
      description: fastDesc.trim() || `${fastPurity} Gold Ornament`,
      hsnCode: '7113',
      grossWeightGrams: gross,
      stoneWeightGrams: stone,
      netGoldWeightGrams: net,
      purity: fastPurity,
      fineness: fastFineness,
      fineGoldWeightGrams: fine,
      goldRatePerGram: rate,
      goldValueINR: goldVal,
      wastagePercent: wastagePct,
      wastageWeightGrams: wastageGrams,
      wastageValueINR: wastageVal,
      makingChargeType: 'PER_GRAM',
      makingChargeRate: mRate,
      makingChargesINR: makingCharges,
      stoneChargesINR: 0,
      otherChargesINR: 0,
      taxableAmountINR: taxable,
      gstRatePercent: gstRate,
      gstAmountINR: gst,
      lineTotalINR: total,
    };
  }, [fastDesc, fastGross, fastStone, fastPurity, fastFineness, fastWastage, fastWastageMode, activeItemRate, fastMakingRate, showRupees]);

  const effectiveBillItems = useMemo<InvoiceItem[]>(() => {
    return [...billItems, ...(draftInvoiceItem ? [draftInvoiceItem] : [])];
  }, [billItems, draftInvoiceItem]);

  const billCalculations = useMemo(() => {
    let totalGross = 0;
    let totalNet = 0;
    let totalFine = 0;
    let totalWastageGrams = 0;
    let totalWastageINR = 0;
    let taxable = 0;
    let totalGst = 0;

    effectiveBillItems.forEach((item) => {
      const itemWastageWt =
        item.wastageWeightGrams !== undefined
          ? item.wastageWeightGrams
          : Number(((item.netGoldWeightGrams * (item.wastagePercent || 0)) / 100).toFixed(3));
      totalGross += item.grossWeightGrams;
      totalNet += item.netGoldWeightGrams;
      totalFine += item.fineGoldWeightGrams;
      totalWastageGrams += itemWastageWt;
      totalWastageINR += item.wastageValueINR || 0;
      taxable += item.taxableAmountINR;
      totalGst += item.gstAmountINR;
    });

    const totalChargeableGold = Number((totalNet + totalWastageGrams).toFixed(3));
    const grandTotalINR = Math.round(taxable + totalGst);

    const activeExchRate =
      posGoldRateInput !== ''
        ? parseFloat(posGoldRateInput) || 0
        : computeRateForFineness(posGoldFineness, goldRates, posGoldPurity);
    const enteredGoldGrams =
      posPaymentOption === 'GOLD' || posPaymentOption === 'PARTIAL'
        ? Math.max(0, Number((parseFloat(posGoldReceivedInput) || 0).toFixed(3)))
        : 0;
    const oldGoldValue = showRupees && enteredGoldGrams > 0 ? Math.round(enteredGoldGrams * activeExchRate) : 0;

    const canUseCustody =
      (posPaymentOption === 'GOLD' || posPaymentOption === 'PARTIAL') &&
      posUseDeposit &&
      availablePosCustodyGrams > 0;

    const goldUsedFromDepositGrams = canUseCustody
      ? !showRupees
        ? Math.min(
            availablePosCustodyGrams,
            Math.max(0, Number((totalChargeableGold - enteredGoldGrams).toFixed(3)))
          )
        : activeExchRate > 0
        ? Math.min(
            availablePosCustodyGrams,
            Number((Math.max(0, grandTotalINR - oldGoldValue) / activeExchRate).toFixed(3))
          )
        : 0
      : 0;

    const depositGoldValue =
      showRupees && goldUsedFromDepositGrams > 0
        ? Math.round(goldUsedFromDepositGrams * activeExchRate)
        : 0;
    const totalGoldSettledGrams = Number((enteredGoldGrams + goldUsedFromDepositGrams).toFixed(3));
    const totalGoldValue = oldGoldValue + depositGoldValue;

    const rawCashEntered = Math.max(0, Math.round(parseFloat(posCashPaidInput) || 0));

    const paidAmountINR =
      posPaymentOption === 'CASH'
        ? showRupees
          ? grandTotalINR
          : rawCashEntered
        : posPaymentOption === 'PARTIAL'
        ? showRupees && grandTotalINR > 0
          ? Math.min(rawCashEntered, Math.max(0, grandTotalINR - totalGoldValue))
          : rawCashEntered
        : 0;

    const balanceDueINR = showRupees
      ? posPaymentOption === 'CASH'
        ? 0
        : posPaymentOption === 'DUE'
        ? grandTotalINR
        : Math.max(0, grandTotalINR - totalGoldValue - paidAmountINR)
      : 0;

    const goldBalanceDueGrams = !showRupees
      ? posPaymentOption === 'CASH'
        ? 0
        : posPaymentOption === 'DUE'
        ? totalChargeableGold
        : Math.max(0, Number((totalChargeableGold - totalGoldSettledGrams).toFixed(3)))
      : 0;

    const goldExcessCreditGrams =
      !showRupees && totalGoldSettledGrams > totalChargeableGold
        ? Number((totalGoldSettledGrams - totalChargeableGold).toFixed(3))
        : 0;

    const computedPaymentMethod: Invoice['paymentMethod'] =
      posPaymentOption === 'CASH'
        ? posCashChannel
        : posPaymentOption === 'GOLD'
        ? 'OLD_GOLD_EXCHANGE'
        : posPaymentOption === 'DUE'
        ? 'CREDIT'
        : totalGoldSettledGrams > 0 && paidAmountINR > 0
        ? 'SPLIT'
        : totalGoldSettledGrams > 0
        ? 'OLD_GOLD_EXCHANGE'
        : paidAmountINR > 0
        ? posCashChannel
        : 'CREDIT';

    const computedPaymentStatus: Invoice['paymentStatus'] =
      posPaymentOption === 'CASH'
        ? 'PAID'
        : posPaymentOption === 'DUE'
        ? 'UNPAID'
        : showRupees
        ? totalGoldValue + paidAmountINR <= 0
          ? 'UNPAID'
          : balanceDueINR > 0
          ? 'PARTIAL'
          : 'PAID'
        : totalGoldSettledGrams <= 0 && paidAmountINR <= 0
        ? 'UNPAID'
        : goldBalanceDueGrams > 0
        ? 'PARTIAL'
        : 'PAID';

    return {
      totalGross: Number(totalGross.toFixed(3)),
      totalNet: Number(totalNet.toFixed(3)),
      totalFine: Number(totalFine.toFixed(3)),
      totalWastageGrams: Number(totalWastageGrams.toFixed(3)),
      totalWastageINR: Math.round(totalWastageINR),
      totalChargeableGold,
      taxable: Math.round(taxable),
      totalGst: Math.round(totalGst),
      subtotal: grandTotalINR,
      activeExchRate,
      enteredGoldGrams,
      goldUsedFromDepositGrams,
      totalGoldSettledGrams,
      oldGoldValue: totalGoldValue,
      grandTotal: grandTotalINR,
      paidAmountINR,
      balanceDue: balanceDueINR,
      goldBalanceDueGrams,
      goldExcessCreditGrams,
      computedPaymentMethod,
      computedPaymentStatus,
    };
  }, [
    effectiveBillItems,
    posPaymentOption,
    posCashChannel,
    posCashPaidInput,
    posGoldReceivedInput,
    posUseDeposit,
    availablePosCustodyGrams,
    posGoldPurity,
    posGoldRateInput,
    showRupees,
    goldRates,
  ]);

  const handleAddFastItem = () => {
    if (!draftInvoiceItem) {
      showToast('Enter gross weight (g) first', 'error');
      return;
    }
    setBillItems((prev) => [...prev, { ...draftInvoiceItem, id: `item_${Date.now()}` }]);
    setFastDesc('');
    setFastGross('');
    setFastStone('0');
    setFastWastage('0');
    showToast('Item added to bill');
  };

  const handleRemoveItem = (id: string) => {
    setBillItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearBill = () => {
    setBillItems([]);
    setFastDesc('');
    setFastGross('');
    setFastStone('0');
    setFastWastage('0');
    setFastWastageMode('PERCENT');
    setFastCustomRate('');
    setPosPaymentOption('CASH');
    setPosCashPaidInput('');
    setPosGoldReceivedInput('');
    setPosUseDeposit(false);
    setPosGoldRateInput('');
    setPosDueDate('');
    setNewCustName('');
    setNewCustPhone('');
    setBillNotes('');
    showToast('Bill cleared');
  };

  const handlePreviewDraftBill = () => {
    if (effectiveBillItems.length === 0) {
      showToast('Please enter ornament gross weight (g) to preview bill', 'error');
      return;
    }
    const trimmedName = newCustName.trim();
    const matchedCustomer = trimmedName
      ? customers.find((c) => c.name.toLowerCase() === trimmedName.toLowerCase())
      : undefined;
    const cgst = Number((billCalculations.totalGst / 2).toFixed(2));
    const sgst = Number((billCalculations.totalGst / 2).toFixed(2));
    setAutoPrintPos(false);
    setPrintDoc({
      type: 'TAX_INVOICE',
      data: {
        invoiceNo: 'DRAFT-PREVIEW',
        date: new Date().toISOString().split('T')[0],
        dueDate: posDueDate || undefined,
        customerId: matchedCustomer?.id,
        customerName: matchedCustomer?.name || trimmedName || 'Walk-in Customer',
        customerPhone: newCustPhone.trim() || matchedCustomer?.phone || '',
        customerGstin: matchedCustomer?.gstin || '',
        items: effectiveBillItems,
        totalGrossWeightGrams: billCalculations.totalGross,
        totalNetGoldWeightGrams: billCalculations.totalNet,
        totalFineGoldWeightGrams: billCalculations.totalFine,
        taxableAmountINR: billCalculations.taxable,
        cgstINR: cgst,
        sgstINR: sgst,
        totalGstINR: billCalculations.totalGst,
        grandTotalINR: billCalculations.grandTotal,
        paidAmountINR: billCalculations.paidAmountINR,
        balanceAmountINR: billCalculations.balanceDue,
        paymentMethod: billCalculations.computedPaymentMethod,
        goldExchangeGrams:
          billCalculations.enteredGoldGrams > 0 ? billCalculations.enteredGoldGrams : undefined,
        goldExchangePurity:
          billCalculations.enteredGoldGrams > 0 ? posGoldPurity : undefined,
        goldExchangeFineness:
          billCalculations.enteredGoldGrams > 0 ? posGoldFineness : undefined,
        goldExchangeValueINR:
          billCalculations.oldGoldValue > 0 ? billCalculations.oldGoldValue : undefined,
        goldUsedFromDepositGrams:
          billCalculations.goldUsedFromDepositGrams > 0
            ? billCalculations.goldUsedFromDepositGrams
            : undefined,
        goldBalanceDueGrams:
          billCalculations.goldBalanceDueGrams > 0 ? billCalculations.goldBalanceDueGrams : undefined,
        goldExcessCreditGrams:
          billCalculations.goldExcessCreditGrams > 0
            ? billCalculations.goldExcessCreditGrams
            : undefined,
        paymentStatus: billCalculations.computedPaymentStatus,
        termsAndConditions:
          billNotes.trim() ||
          printerSettings.footerNote.trim() ||
          'BIS Hallmarked 916 Jewellery. Subject to local jurisdiction.',
      },
    });
  };

  const handleFinalizeBill = async (docType: 'TAX_INVOICE' | 'THERMAL_RECEIPT' = 'TAX_INVOICE') => {
    if (effectiveBillItems.length === 0) {
      showToast('Please enter ornament gross weight (g) to save bill', 'error');
      return;
    }
    if (posPaymentOption === 'GOLD' && billCalculations.totalGoldSettledGrams <= 0) {
      showToast('Please enter gold received weight (g) or apply customer deposit', 'error');
      return;
    }
    setIsSavingBill(true);

    try {
      const trimmedName = newCustName.trim();
      const matchedCustomer = trimmedName
        ? customers.find((c) => c.name.toLowerCase() === trimmedName.toLowerCase())
        : undefined;

      const customerName = matchedCustomer?.name || trimmedName || 'Walk-in Customer';
      const customerPhone = newCustPhone.trim() || matchedCustomer?.phone || '';
      const customerGstin = matchedCustomer?.gstin || '';
      let custId: string | undefined = matchedCustomer?.id;

      if (trimmedName && !matchedCustomer) {
        const createdCust = await onAddCustomer({
          name: trimmedName,
          phone: customerPhone || '+91 90000 00000',
          city: tenant?.city || 'Local',
          preferredLanguage: activeLanguage,
          customerGoldBalanceGrams: 0,
          monetaryBalanceINR: 0,
          creditLimitINR: 100000,
        });
        if (createdCust?.id) {
          custId = createdCust.id;
        }
      }

      const finalItems = effectiveBillItems.map((it, idx) => ({
        ...it,
        id: it.id === 'draft_current_item' ? `item_${Date.now()}_${idx}` : it.id,
      }));

      const cgst = Number((billCalculations.totalGst / 2).toFixed(2));
      const sgst = Number((billCalculations.totalGst / 2).toFixed(2));

      const invoicePayload = {
        branchId: selectedBranchId,
        type: showRupees ? ('RETAIL_TAX_INVOICE' as const) : ('JOB_WORK_BILL' as const),
        date: new Date().toISOString().split('T')[0],
        dueDate: posDueDate || undefined,
        customerId: custId,
        customerName,
        customerPhone,
        customerGstin,
        isInterstate: false,
        items: finalItems,
        totalGrossWeightGrams: billCalculations.totalGross,
        totalNetGoldWeightGrams: billCalculations.totalNet,
        totalFineGoldWeightGrams: billCalculations.totalFine,
        taxableAmountINR: billCalculations.taxable,
        cgstINR: cgst,
        sgstINR: sgst,
        igstINR: 0,
        totalGstINR: billCalculations.totalGst,
        roundOffINR: 0,
        grandTotalINR: billCalculations.grandTotal,
        paidAmountINR: billCalculations.paidAmountINR,
        balanceAmountINR: billCalculations.balanceDue,
        paymentMethod: billCalculations.computedPaymentMethod,
        cashPaymentChannel: billCalculations.paidAmountINR > 0 ? posCashChannel : undefined,
        goldExchangeGrams:
          billCalculations.enteredGoldGrams > 0 ? billCalculations.enteredGoldGrams : undefined,
        goldExchangePurity:
          billCalculations.enteredGoldGrams > 0 ? posGoldPurity : undefined,
        goldExchangeFineness:
          billCalculations.enteredGoldGrams > 0 ? posGoldFineness : undefined,
        goldExchangeRatePerGram:
          billCalculations.enteredGoldGrams > 0 && showRupees ? billCalculations.activeExchRate : undefined,
        goldExchangeValueINR:
          billCalculations.oldGoldValue > 0 ? billCalculations.oldGoldValue : undefined,
        goldUsedFromDepositGrams:
          billCalculations.goldUsedFromDepositGrams > 0
            ? billCalculations.goldUsedFromDepositGrams
            : undefined,
        goldBalanceDueGrams:
          billCalculations.goldBalanceDueGrams > 0 ? billCalculations.goldBalanceDueGrams : undefined,
        goldExcessCreditGrams:
          billCalculations.goldExcessCreditGrams > 0
            ? billCalculations.goldExcessCreditGrams
            : undefined,
        paymentStatus: billCalculations.computedPaymentStatus,
        createdBy: tenant?.name || 'Billing Counter',
        status: 'FINAL' as const,
        termsAndConditions:
          billNotes.trim() ||
          printerSettings.footerNote.trim() ||
          '1. BIS Hallmarked Jewellery. 2. Subject to local jurisdiction.',
      };

      const savedInv = await onCreateInvoice(invoicePayload);
      showToast(`Sales Bill ${savedInv?.invoiceNo || ''} saved`);
      setAutoPrintPos(Boolean(printerSettings.autoPrintOnSave));
      setPrintDoc({
        type: docType,
        data: savedInv || invoicePayload,
      });

      setBillItems([]);
      setFastDesc('');
      setFastGross('');
      setFastStone('0');
      setFastWastage('0');
      setFastWastageMode('PERCENT');
      setFastCustomRate('');
      setPosPaymentOption('CASH');
      setPosCashPaidInput('');
      setPosGoldReceivedInput('');
      setPosUseDeposit(false);
      setPosGoldRateInput('');
      setPosDueDate('');
      setNewCustName('');
      setNewCustPhone('');
      setBillNotes('');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Error generating bill', 'error');
    } finally {
      setIsSavingBill(false);
    }
  };

  // =============================================================
  // 2. GOLD IN / OUT STATE & HANDLER
  // =============================================================
  const [gioDirection, setGioDirection] = useState<'IN' | 'OUT'>('IN');
  const [gioPurposePreset, setGioPurposePreset] = useState<'CUSTOMER' | 'BULLION' | 'SCRAP'>('CUSTOMER');
  const [gioPartyName, setGioPartyName] = useState('');
  const [gioPurity, setGioPurity] = useState<GoldPurityCode>('22K');
  const [gioFineness, setGioFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);
  const [gioGrossWeight, setGioGrossWeight] = useState<string>('');
  const [gioNonGoldWeight, setGioNonGoldWeight] = useState<string>('0');
  const [gioRatePerGram, setGioRatePerGram] = useState<string>('6825');
  const [gioReason, setGioReason] = useState('');

  const gioNetWeight = Math.max(0, Number(((parseFloat(gioGrossWeight) || 0) - (parseFloat(gioNonGoldWeight) || 0)).toFixed(3)));
  const gioFineGold = calculateFineGold(gioNetWeight, gioFineness).toNumber();
  const gioValuation = Math.round(gioNetWeight * (parseFloat(gioRatePerGram) || 0));

  const handleSubmitGoldInOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gioNetWeight <= 0) {
      showToast('Please enter valid gold weight', 'error');
      return;
    }

    const trimmedGioParty = gioPartyName.trim();
    const matchedGioCustomer =
      gioPurposePreset === 'CUSTOMER' && trimmedGioParty
        ? customers.find((c) => c.name.toLowerCase() === trimmedGioParty.toLowerCase())
        : undefined;

    const effectiveCounterparty =
      matchedGioCustomer?.name ||
      trimmedGioParty ||
      (gioPurposePreset === 'BULLION'
        ? 'Bullion Trader'
        : gioPurposePreset === 'SCRAP'
        ? 'Workshop Bench'
        : gioDirection === 'IN'
        ? 'Customer Custody Account'
        : 'Customer Custody Account');

    const txType: GoldLedgerTransactionType =
      gioPurposePreset === 'BULLION'
        ? gioDirection === 'IN'
          ? 'BULLION_PURCHASE'
          : 'SUPPLIER_SETTLEMENT'
        : gioPurposePreset === 'SCRAP'
        ? gioDirection === 'IN'
          ? 'SCRAP_RECOVERY'
          : 'SEND_TO_MELTING'
        : gioDirection === 'IN'
        ? 'CUSTOMER_DEPOSIT'
        : 'CUSTOMER_WITHDRAWAL';

    const accountBucket: GoldAccountType =
      gioPurposePreset === 'BULLION'
        ? 'BUSINESS_OWNED'
        : gioPurposePreset === 'SCRAP'
        ? 'SCRAP_REFINING'
        : 'CUSTOMER_OWNED';

    const payload = {
      branchId: selectedBranchId,
      date: new Date().toISOString(),
      type: txType,
      sourceAccount: accountBucket,
      destinationAccount: accountBucket,
      counterpartyId: matchedGioCustomer?.id,
      counterpartyName: effectiveCounterparty,
      counterpartyType:
        gioPurposePreset === 'BULLION'
          ? ('SUPPLIER' as const)
          : gioPurposePreset === 'SCRAP'
          ? ('INTERNAL' as const)
          : ('CUSTOMER' as const),
      grossWeightGrams: parseFloat(gioGrossWeight) || 0,
      nonGoldWeightGrams: parseFloat(gioNonGoldWeight) || 0,
      netWeightGrams: gioNetWeight,
      purity: gioPurity,
      fineness: gioFineness,
      fineGoldWeightGrams: gioFineGold,
      ratePerGram: showRupees ? parseFloat(gioRatePerGram) || 0 : undefined,
      valuationINR: showRupees ? gioValuation : undefined,
      enteredBy: tenant?.name || 'Authorized Goldsmith',
      notes: `${gioDirection === 'IN' ? 'Gold In' : 'Gold Out'}: ${
        gioReason.trim() ||
        (gioPurposePreset === 'BULLION'
          ? 'Bullion Transaction'
          : gioPurposePreset === 'SCRAP'
          ? 'Workshop Scrap / Dust'
          : 'Customer Gold')
      }`,
    };

    try {
      await onNewLedgerEntry(payload);
      showToast(`Gold ${gioDirection} of ${formatGrams(gioNetWeight)} recorded`);
      setPrintDoc({
        type: gioDirection === 'IN' ? 'GOLD_RECEIPT_SLIP' : 'GOLD_ISSUE_SLIP',
        data: payload,
      });
      setGioGrossWeight('');
      setGioNonGoldWeight('0');
      setGioReason('');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Error recording gold movement', 'error');
    }
  };

  // =============================================================
  // 3. KARIGAR GIVE & RECEIVE STATE & HANDLERS
  // =============================================================
  const [karigarSubMode, setKarigarSubMode] = useState<'GIVE' | 'RECEIVE'>('GIVE');
  const [selectedKarigarId, setSelectedKarigarId] = useState<string>(
    staffList.find((s) => s.role === 'KARIGAR')?.id || staffList[0]?.id || ''
  );
  const [karigarPurity, setKarigarPurity] = useState<GoldPurityCode>('22K');
  const [karigarFineness, setKarigarFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);
  const [karigarNet, setKarigarNet] = useState<string>('25.0');
  const [karigarJewelleryType, setKarigarJewelleryType] = useState('Necklace');
  const [karigarWastage, setKarigarWastage] = useState<string>('2.5');
  const [karigarLabourRate] = useState<string>('450');
  const [karigarDueDate, setKarigarDueDate] = useState<string>(
    new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [karigarWorkInstructions, setKarigarWorkInstructions] = useState('');

  const [recJobCardId, setRecJobCardId] = useState<string>('');
  const [recJewelleryNet, setRecJewelleryNet] = useState<string>('');
  const [recScrapWeight, setRecScrapWeight] = useState<string>('0');
  const [recQcRemarks, setRecQcRemarks] = useState('Passed Quality Inspection & Hallmark Standard');

  useEffect(() => {
    if (!selectedKarigarId && staffList.length > 0) {
      const firstKarigar = staffList.find((s) => s.role === 'KARIGAR') || staffList[0];
      if (firstKarigar) setSelectedKarigarId(firstKarigar.id);
    }
  }, [staffList, selectedKarigarId]);

  const karigarReconciliationPreview = useMemo(() => {
    if (!recJobCardId) return null;
    const jc = jobCards.find((j) => j.id === recJobCardId);
    if (!jc) return null;

    const netOut = parseFloat(recJewelleryNet) || 0;
    const scrapOut = parseFloat(recScrapWeight) || 0;
    const issued = jc.issuedNetWeightGrams;

    const res = calculateWastageReconciliation(issued, netOut, scrapOut, jc.agreedWastagePercent);
    return {
      jobNo: jc.jobNo,
      issued,
      netOut,
      scrapOut,
      actualLoss: res.actualLoss.toNumber(),
      allowedWastage: res.allowedWastage.toNumber(),
      excessLoss: res.excessLoss.toNumber(),
      isExcess: res.isExcessLoss,
      karigarName: jc.karigarName,
      jewelleryType: jc.jewelleryType,
    };
  }, [recJobCardId, recJewelleryNet, recScrapWeight, jobCards]);

  const handleGiveGoldToKarigar = async (e: React.FormEvent) => {
    e.preventDefault();
    const k = staffList.find((s) => s.id === selectedKarigarId);
    if (!k) {
      showToast('Please select a karigar', 'error');
      return;
    }
    const net = parseFloat(karigarNet) || 0;
    if (net <= 0) {
      showToast('Please enter valid gold weight', 'error');
      return;
    }

    const payload = {
      branchId: selectedBranchId,
      karigarId: k.id,
      karigarName: k.name,
      jewelleryType: karigarJewelleryType,
      purity: karigarPurity,
      fineness: karigarFineness,
      issuedGrossWeightGrams: net,
      issuedNetWeightGrams: net,
      issueDate: new Date().toISOString(),
      dueDate: karigarDueDate,
      agreedWastagePercent: parseFloat(karigarWastage) || 2.5,
      labourRatePerGram: parseFloat(karigarLabourRate) || 450,
      labourTotalINR: net * (parseFloat(karigarLabourRate) || 450),
      labourPaidINR: 0,
      status: 'ASSIGNED',
      qcPassed: false,
      notes: karigarWorkInstructions,
    };

    try {
      await onCreateJobCard(payload);
      showToast(`Issued ${formatGrams(net)} gold to ${k.name}`);
      setPrintDoc({
        type: 'GOLD_ISSUE_SLIP',
        data: {
          ...payload,
          transactionNo: `JC-ISSUE-${Date.now().toString().slice(-4)}`,
          counterpartyName: k.name,
          fineGoldWeightGrams: calculateFineGold(net, karigarFineness).toNumber(),
        },
      });
      setKarigarNet('25.0');
      setKarigarWorkInstructions('');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Error issuing gold to karigar', 'error');
    }
  };

  const handleReceiveGoldFromKarigar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recJobCardId) {
      showToast('Please select an active job order', 'error');
      return;
    }
    const jNet = parseFloat(recJewelleryNet) || 0;
    const sWeight = parseFloat(recScrapWeight) || 0;

    if (jNet <= 0 && sWeight <= 0) {
      showToast('Please enter finished jewellery or scrap weight', 'error');
      return;
    }

    try {
      await onReturnJobCard(recJobCardId, jNet, jNet, sWeight, recQcRemarks);
      showToast('Gold received from karigar & reconciled');

      const jc = jobCards.find((j) => j.id === recJobCardId);
      setPrintDoc({
        type: 'GOLD_RECEIPT_SLIP',
        data: {
          jobNo: jc?.jobNo,
          karigarName: jc?.karigarName,
          purity: jc?.purity,
          returnedJewelleryNet: jNet,
          returnedScrap: sWeight,
          actualLoss: karigarReconciliationPreview?.actualLoss,
          allowedWastage: karigarReconciliationPreview?.allowedWastage,
          excessLoss: karigarReconciliationPreview?.excessLoss,
          date: new Date().toISOString(),
        },
      });

      setRecJewelleryNet('');
      setRecScrapWeight('0');
      setRecJobCardId('');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Error receiving gold from karigar', 'error');
    }
  };

  // =============================================================
  // 4. MELTING SEND & RECEIVE STATE & HANDLERS
  // =============================================================
  const [meltingMode, setMeltingMode] = useState<'SEND' | 'RECEIVE'>('SEND');
  const [meltOperator, setMeltOperator] = useState('Babu Master (Furnace Head)');
  const [meltRefinerType, setMeltRefinerType] = useState<'INTERNAL_KARIGAR' | 'OUTSIDE_REFINER' | 'ASSAY_LAB'>('INTERNAL_KARIGAR');

  const [meltInputs, setMeltInputs] = useState<
    Array<{ description: string; weightGrams: number; purity: GoldPurityCode; fineness: number; fineGoldWeightGrams: number }>
  >([]);
  const [meltInputDesc, setMeltInputDesc] = useState('');
  const [meltInputWeight, setMeltInputWeight] = useState('25.0');
  const [meltInputPurity, setMeltInputPurity] = useState<GoldPurityCode>('22K');
  const [meltInputFineness, setMeltInputFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);

  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [outputGrossWeight, setOutputGrossWeight] = useState<string>('49.5');
  const [outputPurity, setOutputPurity] = useState<GoldPurityCode>('22K');
  const [outputFineness, setOutputFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);
  const [outputRecoveredScrap, setOutputRecoveredScrap] = useState<string>('0.2');
  const [outputRefiningFee, setOutputRefiningFee] = useState<string>('1500');
  const [outputExplanation, setOutputExplanation] = useState(
    'Standard fire assay process loss within permissible tolerance'
  );

  const handleAddMeltingInput = () => {
    const w = parseFloat(meltInputWeight) || 0;
    if (w <= 0) return;
    const fine = calculateFineGold(w, meltInputFineness).toNumber();
    setMeltInputs((prev) => [
      ...prev,
      {
        description: meltInputDesc.trim() || `${meltInputPurity} (${(meltInputFineness / 10).toFixed(2)}%) Scrap Lot`,
        weightGrams: w,
        purity: meltInputPurity,
        fineness: meltInputFineness,
        fineGoldWeightGrams: fine,
      },
    ]);
    setMeltInputDesc('');
    setMeltInputWeight('');
  };

  const handleSendToMelting = async (e: React.FormEvent) => {
    e.preventDefault();
    const pendingWt = parseFloat(meltInputWeight) || 0;
    const finalInputs =
      meltInputs.length > 0
        ? meltInputs
        : pendingWt > 0
        ? [
            {
              description:
                meltInputDesc.trim() || `${meltInputPurity} (${(meltInputFineness / 10).toFixed(2)}%) Scrap Lot`,
              weightGrams: pendingWt,
              purity: meltInputPurity,
              fineness: meltInputFineness,
              fineGoldWeightGrams: calculateFineGold(pendingWt, meltInputFineness).toNumber(),
            },
          ]
        : [];
    if (finalInputs.length === 0) {
      showToast('Please add at least one scrap lot for melting', 'error');
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json', 'x-tenant-id': tenant?.id || '' };
      const res = await fetch('/api/pos/melting/batches', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branchId: selectedBranchId,
          sentDate: new Date().toISOString(),
          operatorOrRefiner: meltOperator,
          refinerType: meltRefinerType,
          sourceAccount: 'SCRAP_REFINING',
          inputs: finalInputs,
          expectedReturnDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
          approvalStatus: 'PENDING',
          createdBy: tenant?.name || 'Furnace Manager',
        }),
      });
      const data = await res.json();
      if (data.id) {
        setMeltingBatches((prev) => [data, ...prev]);
        showToast(`Melting Batch #${data.batchNo} sent`);
        setPrintDoc({ type: 'MELTING_SLIP', data });
        await onRefresh();
      }
    } catch (err: any) {
      showToast(err.message || 'Error creating melting batch', 'error');
    }
  };

  const handleCompleteMelting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) {
      showToast('Please select a melting batch', 'error');
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json', 'x-tenant-id': tenant?.id || '' };
      const res = await fetch(`/api/pos/melting/batches/${selectedBatchId}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          outputGrossGrams: parseFloat(outputGrossWeight) || 0,
          outputPurity,
          outputFineness: outputFineness || 999.0,
          recoveredScrapGrams: parseFloat(outputRecoveredScrap) || 0,
          refiningChargesINR: parseFloat(outputRefiningFee) || 0,
          explanationNotes: outputExplanation,
          approvedBy: tenant?.name || 'Owner',
        }),
      });
      const data = await res.json();
      if (data.id) {
        setMeltingBatches((prev) => prev.map((m) => (m.id === selectedBatchId ? data : m)));
        showToast(`Melting Batch #${data.batchNo} completed & deposited to vault`);
        setSelectedBatchId('');
        await onRefresh();
        loadPOSData();
      }
    } catch (err: any) {
      showToast(err.message || 'Error finalizing melting batch', 'error');
    }
  };

  // =============================================================
  // 5. OUTSIDE PARTY CHALLAN STATE & HANDLERS
  // =============================================================
  const [partyDirection, setPartyDirection] = useState<'ISSUE' | 'RECEIPT'>('ISSUE');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [partyPurpose, setPartyPurpose] = useState<
    'JOB_WORK' | 'HALLMARKING' | 'MELTING_ASSAY' | 'TEMPORARY_APPROVAL' | 'RETURN'
  >('HALLMARKING');
  const [partyPurity, setPartyPurity] = useState<GoldPurityCode>('22K');
  const [partyFineness, setPartyFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);
  const [partyNetWeight, setPartyNetWeight] = useState<string>('50.0');
  const [partyExpectedDate, setPartyExpectedDate] = useState<string>(
    new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]
  );
  const [partyNotes, setPartyNotes] = useState('');

  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyType, setNewPartyType] = useState<OutsideParty['partyType']>('HALLMARK_CENTER');
  const [newPartyCity, setNewPartyCity] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');

  const handleCreateOutsidePartyChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = outsideParties.find((pt) => pt.id === selectedPartyId);
    if (!p) {
      showToast('Please select a business party', 'error');
      return;
    }
    const net = parseFloat(partyNetWeight) || 0;
    if (net <= 0) {
      showToast('Please enter valid gold weight', 'error');
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json', 'x-tenant-id': tenant?.id || '' };
      const payload = {
        branchId: selectedBranchId,
        date: new Date().toISOString(),
        partyId: p.id,
        partyName: p.name,
        partyType: p.partyType,
        direction: partyDirection,
        purpose: partyPurpose,
        purity: partyPurity,
        fineness: partyFineness,
        grossWeightGrams: net,
        netWeightGrams: net,
        expectedReturnDate: partyExpectedDate,
        acknowledgementReceived: true,
        notes: partyNotes,
        createdBy: tenant?.name || 'Staff',
      };

      const res = await fetch('/api/pos/parties/transactions', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.id) {
        setOutsidePartyTransactions((prev) => [data, ...prev]);
        showToast(`Party Challan #${data.challanNo} saved`);
        setPrintDoc({ type: 'DELIVERY_CHALLAN', data });
        await onRefresh();
        loadPOSData();
      }
    } catch (err: any) {
      showToast(err.message || 'Error recording party challan', 'error');
    }
  };

  const handleCreateParty = async () => {
    if (!newPartyName.trim()) return;
    try {
      const headers = { 'Content-Type': 'application/json', 'x-tenant-id': tenant?.id || '' };
      const res = await fetch('/api/pos/parties', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newPartyName,
          partyType: newPartyType,
          city: newPartyCity,
          phone: newPartyPhone,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setOutsideParties((prev) => [...prev, data]);
        setSelectedPartyId(data.id);
        setShowAddPartyModal(false);
        setNewPartyName('');
        showToast('Outside party added');
      }
    } catch {
      showToast('Error creating party', 'error');
    }
  };

  // =============================================================
  // 6. CASH / BANK RECEIPTS & PAYMENTS STATE & HANDLER
  // =============================================================
  const [payType, setPayType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [payAccount, setPayAccount] = useState<'CASH' | 'BANK'>('CASH');
  const [payCategory, setPayCategory] = useState<CashBankTransaction['category']>('SALES_COLLECTION');
  const [payAmount, setPayAmount] = useState('');
  const [payPartyName, setPayPartyName] = useState('');
  const [payRefNo, setPayRefNo] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      await onAddCashTransaction({
        branchId: selectedBranchId,
        date: new Date().toISOString().split('T')[0],
        type: payType,
        accountType: payAccount,
        partyName: payPartyName || 'Cash Counter',
        category: payCategory,
        amountINR: amt,
        referenceNo: payRefNo,
        notes: payNotes,
        enteredBy: tenant?.name || 'Cashier',
      });
      showToast(`${payType === 'RECEIPT' ? 'Receipt' : 'Payment'} of ${formatINR(amt)} saved`);
      setPayAmount('');
      setPayPartyName('');
      setPayRefNo('');
      setPayNotes('');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Error saving payment voucher', 'error');
    }
  };

  // 6 Clean Workstation Tabs (Single Navigation Bar)
  const workstationTabs: Array<{
    id: POSTabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'quick_pos', label: posT.actionNewSale, icon: Receipt },
    { id: 'gold_in_out', label: posT.tabs.goldInOut, icon: Scale },
    { id: 'karigar_tx', label: posT.tabs.karigarTx, icon: Hammer },
    { id: 'melting_refining', label: posT.actionMelting, icon: Flame },
    { id: 'party_tx', label: posT.actionPartyChallan, icon: Building },
    { id: 'payments', label: posT.tabs.payments, icon: Wallet },
  ];

  return (
    <div className="space-y-5 text-slate-900 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 border transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
              : toastMessage.type === 'info'
              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/60'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. COMPACT WORKSTATION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-cinzel">
            {posT.quickActionWorkstation}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
            {showRupees ? (
              <>
                <span>
                  22K: <strong className="text-[#9A7426] dark:text-[#E5C158]">₹{getRate('22K').toLocaleString('en-IN')}/g</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  24K: <strong className="text-slate-800 dark:text-slate-200">₹{getRate('24K').toLocaleString('en-IN')}/g</strong>
                </span>
                {onToggleRupees && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => onToggleRupees(false)}
                      className="font-sans text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline cursor-pointer"
                    >
                      {ui.pureWeightMode}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="font-sans">{posT.quickActionSubtitle}</span>
                <span aria-hidden="true">·</span>
                <span>22K (916.0‰) · 24K (999.9‰)</span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onRefresh();
            loadPOSData();
            showToast('Data synced');
          }}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg text-xs font-semibold transition cursor-pointer border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span>Sync</span>
        </button>
      </div>

      {/* 2. SINGLE CLEAN 6-ACTION WORKSTATION BAR */}
      <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1">
        {workstationTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center space-x-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#C9A24A]' : 'text-slate-400 dark:text-slate-500'}`} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* ACTION 1: SALES BILL (Single-Elevation Card + Recent List) */}
      {/* ========================================================= */}
      {activeTab === 'quick_pos' && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
            {/* Card Title */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{posT.actionNewSale}</h2>
              {(billItems.length > 0 || fastGross !== '' || newCustName !== '') && (
                <button
                  type="button"
                  onClick={handleClearBill}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline cursor-pointer whitespace-nowrap"
                >
                  {posT.clearBill}
                </button>
              )}
            </div>

            {/* Customer Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {ui.customerName}{' '}
                  <span className="font-normal text-slate-400 dark:text-slate-500">({posT.quickWalkin})</span>
                </label>
                <input
                  type="text"
                  list="posCustomerDatalist"
                  placeholder={posT.customerNamePlaceholder}
                  value={newCustName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewCustName(val);
                    const matched = customers.find(
                      (c) => c.name.toLowerCase() === val.toLowerCase()
                    );
                    if (matched && !newCustPhone) {
                      setNewCustPhone(matched.phone);
                    }
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                />
                <datalist id="posCustomerDatalist">
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.phone}
                    </option>
                  ))}
                </datalist>
                {activePosCustomer && (activePosCustomer.customerGoldBalanceGrams || 0) !== 0 && (
                  <div className="mt-1 text-[11px] font-mono tabular-nums">
                    {(activePosCustomer.customerGoldBalanceGrams || 0) > 0 ? (
                      <span className="text-[#9A7426] dark:text-[#E5C158]">
                        Custody: +{formatGrams(activePosCustomer.customerGoldBalanceGrams)}
                      </span>
                    ) : (
                      <span className="text-rose-700 dark:text-rose-400">
                        {payT.goldDue}: {formatGrams(Math.abs(activePosCustomer.customerGoldBalanceGrams))}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {ui.phoneNo}
                </label>
                <input
                  type="text"
                  placeholder={posT.customerMobilePlaceholder}
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                />
              </div>
            </div>

            {/* Ornament & Purity */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {posT.itemDescription} & {posT.selectPurity}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    ['ring', 'chain', 'bangle', 'necklace', 'earrings', 'mangalsutra', 'coin'] as Array<
                      keyof typeof posT.presetItems
                    >
                  ).map((key) => {
                    const label = posT.presetItems[key];
                    const isSelected = fastDesc === label;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectPreset(key)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={fastDesc}
                  onChange={(e) => setFastDesc(e.target.value)}
                  placeholder="e.g. 22K Hallmarked Chain / Ring"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                />

                <EditablePurityControl
                  purity={fastPurity}
                  fineness={fastFineness}
                  presets={['22K', '24K', '18K', '14K']}
                  onChange={(nextPurity, nextFineness) => {
                    setFastPurity(nextPurity);
                    setFastFineness(nextFineness);
                    setFastCustomRate('');
                  }}
                />
              </div>
            </div>

            {/* Weight, Wastage & Optional Rupee Rate */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {posT.grossWeight} & {posT.wastagePercent}
                </span>
                <button
                  type="button"
                  onClick={handleAddFastItem}
                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center space-x-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{posT.addItemToBill}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1 whitespace-nowrap">
                    {posT.grossWeight} *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={fastGross}
                    onChange={(e) => setFastGross(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1 whitespace-nowrap">
                    {posT.stoneWeight}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={fastStone}
                    onChange={(e) => setFastStone(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap truncate">
                      {posT.wastagePercent}
                    </label>
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (fastWastageMode !== 'PERCENT') {
                            const net = Math.max(0, (parseFloat(fastGross) || 0) - (parseFloat(fastStone) || 0));
                            const curGrams = parseFloat(fastWastage) || 0;
                            setFastWastageMode('PERCENT');
                            setFastWastage(
                              net > 0 && curGrams > 0 ? String(Number(((curGrams / net) * 100).toFixed(2))) : '0'
                            );
                          }
                        }}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition cursor-pointer ${
                          fastWastageMode === 'PERCENT'
                            ? 'bg-white dark:bg-slate-700 text-[#9A7426] dark:text-[#E5C158] shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (fastWastageMode !== 'GRAMS') {
                            const net = Math.max(0, (parseFloat(fastGross) || 0) - (parseFloat(fastStone) || 0));
                            const curPct = parseFloat(fastWastage) || 0;
                            setFastWastageMode('GRAMS');
                            setFastWastage(
                              net > 0 && curPct > 0 ? String(Number(((net * curPct) / 100).toFixed(3))) : '0'
                            );
                          }
                        }}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition cursor-pointer ${
                          fastWastageMode === 'GRAMS'
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
                      step={fastWastageMode === 'PERCENT' ? '0.1' : '0.001'}
                      min="0"
                      placeholder={fastWastageMode === 'PERCENT' ? '0.0' : '0.000'}
                      value={fastWastage}
                      onChange={(e) => setFastWastage(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-3 pr-7 py-2 text-sm font-bold text-[#9A7426] dark:text-[#E5C158] font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-2 text-xs font-mono text-slate-400 dark:text-slate-500 pointer-events-none">
                      {fastWastageMode === 'PERCENT' ? '%' : 'g'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick VA Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">VA:</span>
                  {['0', '2.5', '5', '8', '10', '12'].map((pct) => {
                    const isSelected = fastWastageMode === 'PERCENT' && fastWastage === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setFastWastageMode('PERCENT');
                          setFastWastage(pct);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums font-semibold border transition cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-[#101C32] dark:bg-[#C9A24A] text-[#C9A24A] dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>

                {draftInvoiceItem && (draftInvoiceItem.wastageWeightGrams || 0) > 0 && (
                  <div className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    +{formatGrams(draftInvoiceItem.wastageWeightGrams || 0)} · {draftInvoiceItem.wastagePercent}%
                    {showRupees && draftInvoiceItem.wastageValueINR > 0 && (
                      <> · ₹{draftInvoiceItem.wastageValueINR.toLocaleString('en-IN')}</>
                    )}
                  </div>
                )}
              </div>

              {showRupees && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1 whitespace-nowrap">
                      {posT.ratePerGram}
                    </label>
                    <input
                      type="number"
                      value={fastCustomRate !== '' ? fastCustomRate : activeItemRate}
                      onChange={(e) => setFastCustomRate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1 whitespace-nowrap">
                      {posT.makingCharge} (/g)
                    </label>
                    <input
                      type="number"
                      value={fastMakingRate}
                      onChange={(e) => setFastMakingRate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Multi-item list */}
              {billItems.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-2 text-xs">
                  {billItems.map((item, idx) => {
                    const itemVaWt =
                      item.wastageWeightGrams !== undefined
                        ? item.wastageWeightGrams
                        : Number(((item.netGoldWeightGrams * (item.wastagePercent || 0)) / 100).toFixed(3));
                    return (
                      <div key={item.id} className="py-2 flex items-center justify-between font-mono tabular-nums gap-2">
                        <div className="font-sans">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {idx + 1}. {item.description} ({item.purity})
                          </span>
                          {itemVaWt > 0 && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2 font-mono tabular-nums">
                              · VA +{formatGrams(itemVaWt)} ({item.wastagePercent}%)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3 shrink-0">
                          <span className="font-bold text-[#9A7426] dark:text-[#E5C158]">{formatGrams(item.netGoldWeightGrams)}</span>
                          {showRupees && (
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              ₹{item.lineTotalINR.toLocaleString('en-IN')}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Option (Cash | Gold | Due | Partly Payment) */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {payT.paymentOption}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-full sm:w-auto">
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
                      onClick={() => setPosPaymentOption(opt.id)}
                      className={`py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        posPaymentOption === opt.id
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {posPaymentOption === 'CASH' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          onClick={() => setPosCashChannel(ch.id)}
                          className={`py-2 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                            posCashChannel === ch.id
                              ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
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
                        value={posCashPaidInput}
                        onChange={(e) => setPosCashPaidInput(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {posPaymentOption === 'GOLD' && (
                <div className="space-y-2.5">
                  {availablePosCustodyGrams > 0 && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        Customer Custody Available: <strong className="text-[#9A7426] dark:text-[#E5C158]">+{formatGrams(availablePosCustodyGrams)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPosUseDeposit((prev) => !prev)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                          posUseDeposit
                            ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {posUseDeposit
                          ? `Using Deposit (${formatGrams(billCalculations.goldUsedFromDepositGrams)})`
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
                        {billCalculations.totalChargeableGold > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPosGoldReceivedInput(
                                String(
                                  Math.max(
                                    0,
                                    Number(
                                      (
                                        billCalculations.totalChargeableGold -
                                        (posUseDeposit ? availablePosCustodyGrams : 0)
                                      ).toFixed(3)
                                    )
                                  )
                                )
                              )
                            }
                            className="text-[11px] font-semibold text-[#9A7426] dark:text-[#E5C158] hover:underline cursor-pointer whitespace-nowrap"
                          >
                            {payT.matchFullWeight} ({formatGrams(billCalculations.totalChargeableGold)})
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="0.000"
                        value={posGoldReceivedInput}
                        onChange={(e) => setPosGoldReceivedInput(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">{ui.purity}</label>
                      <EditablePurityControl
                        purity={posGoldPurity}
                        fineness={posGoldFineness}
                        presets={['22K', '24K', '18K', '14K']}
                        onChange={(nextPurity, nextFineness) => {
                          setPosGoldPurity(nextPurity);
                          setPosGoldFineness(nextFineness);
                          setPosGoldRateInput('');
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
                          value={posGoldRateInput !== '' ? posGoldRateInput : billCalculations.activeExchRate}
                          onChange={(e) => setPosGoldRateInput(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {posPaymentOption === 'DUE' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      {payT.dueDateOptional}
                    </label>
                    <input
                      type="date"
                      value={posDueDate}
                      onChange={(e) => setPosDueDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                    />
                  </div>
                  <div className="text-xs text-rose-700 dark:text-rose-400 font-mono tabular-nums py-2">
                    {payT.balanceDue}:{' '}
                    <strong>
                      {showRupees
                        ? formatINR(billCalculations.grandTotal)
                        : formatGrams(billCalculations.totalChargeableGold)}
                    </strong>
                  </div>
                </div>
              )}

              {posPaymentOption === 'PARTIAL' && (
                <div className="space-y-3">
                  {availablePosCustodyGrams > 0 && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        Customer Custody Available: <strong className="text-[#9A7426] dark:text-[#E5C158]">+{formatGrams(availablePosCustodyGrams)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPosUseDeposit((prev) => !prev)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                          posUseDeposit
                            ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {posUseDeposit
                          ? `Using Deposit (${formatGrams(billCalculations.goldUsedFromDepositGrams)})`
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
                        {showRupees &&
                          Math.max(0, billCalculations.grandTotal - billCalculations.oldGoldValue) > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPosCashPaidInput(
                                  String(Math.max(0, billCalculations.grandTotal - billCalculations.oldGoldValue))
                                )
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
                          value={posCashPaidInput}
                          onChange={(e) => setPosCashPaidInput(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                        />
                        <select
                          value={posCashChannel}
                          onChange={(e) => setPosCashChannel(e.target.value as 'CASH' | 'UPI' | 'BANK_TRANSFER')}
                          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:border-[#C9A24A] focus:outline-none"
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
                      <div className="flex flex-wrap sm:flex-nowrap gap-1.5">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0.000"
                          value={posGoldReceivedInput}
                          onChange={(e) => setPosGoldReceivedInput(e.target.value)}
                          className="w-28 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                        />
                        <EditablePurityControl
                          variant="inline"
                          className="flex-1"
                          purity={posGoldPurity}
                          fineness={posGoldFineness}
                          onChange={(nextPurity, nextFineness) => {
                            setPosGoldPurity(nextPurity);
                            setPosGoldFineness(nextFineness);
                            setPosGoldRateInput('');
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {showRupees && billCalculations.enteredGoldGrams > 0 && (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          {payT.goldRatePerGram} ({payT.goldValue}: {formatINR(billCalculations.oldGoldValue)})
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={posGoldRateInput !== '' ? posGoldRateInput : billCalculations.activeExchRate}
                          onChange={(e) => setPosGoldRateInput(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {payT.dueDateOptional}
                      </label>
                      <input
                        type="date"
                        value={posDueDate}
                        onChange={(e) => setPosDueDate(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Live Totals & Save Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono tabular-nums text-xs">
                <div className="space-y-1">
                  <div className="text-slate-600 dark:text-slate-400">
                    {posT.netGoldWeight}:{' '}
                    <strong className="text-slate-900 dark:text-slate-100 text-sm">{formatGrams(billCalculations.totalNet)}</strong>
                    {billCalculations.totalWastageGrams > 0 && (
                      <span className="text-[#9A7426] dark:text-[#E5C158] ml-2">
                        · VA: <strong>+{formatGrams(billCalculations.totalWastageGrams)}</strong>
                      </span>
                    )}
                  </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      {ui.fineWt} (999.9):{' '}
                      <strong className="text-[#9A7426] dark:text-[#E5C158]">{formatGrams(billCalculations.totalFine)}</strong>
                      {billCalculations.totalGoldSettledGrams > 0 && (
                        <span className="text-emerald-700 dark:text-emerald-400 ml-2">
                          · {payT.gold}: <strong>−{formatGrams(billCalculations.totalGoldSettledGrams)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {showRupees ? (
                    <div className="sm:text-right space-y-0.5">
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {payT.totalBill}: <strong>₹{billCalculations.grandTotal.toLocaleString('en-IN')}</strong> (GST 3%: ₹
                        {billCalculations.totalGst.toLocaleString('en-IN')})
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        {payT.paidNow}:{' '}
                        <strong>
                          ₹{(billCalculations.paidAmountINR + billCalculations.oldGoldValue).toLocaleString('en-IN')}
                        </strong>
                        {billCalculations.oldGoldValue > 0 &&
                          ` (${payT.gold}: ₹${billCalculations.oldGoldValue.toLocaleString('en-IN')})`}
                      </div>
                      <div
                        className={`text-base font-bold ${
                          billCalculations.balanceDue > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {billCalculations.balanceDue > 0
                          ? `${payT.balanceDue}: ₹${billCalculations.balanceDue.toLocaleString('en-IN')}`
                          : `${formatInvoiceStatusLabel('PAID', activeLanguage)} · ₹${billCalculations.grandTotal.toLocaleString('en-IN')}`}
                      </div>
                    </div>
                  ) : (
                    <div className="sm:text-right space-y-0.5">
                      {billCalculations.paidAmountINR > 0 && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          {payT.cash}: <strong>₹{billCalculations.paidAmountINR.toLocaleString('en-IN')}</strong>
                        </div>
                      )}
                      {billCalculations.goldExcessCreditGrams > 0 && (
                        <div className="text-[11px] text-[#9A7426] dark:text-[#E5C158]">
                          Custody Credit: <strong>+{formatGrams(billCalculations.goldExcessCreditGrams)}</strong>
                        </div>
                      )}
                      <div
                        className={`text-base font-bold ${
                          billCalculations.goldBalanceDueGrams > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {billCalculations.goldBalanceDueGrams > 0
                          ? `${payT.goldDue}: ${formatGrams(billCalculations.goldBalanceDueGrams)}`
                          : `${formatInvoiceStatusLabel('PAID', activeLanguage)} · ${formatGrams(
                              billCalculations.totalChargeableGold
                            )}`}
                      </div>
                    </div>
                  )}
                </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={handlePreviewDraftBill}
                  className="w-full py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer flex items-center justify-center space-x-2 whitespace-nowrap"
                >
                  <Printer className="w-4 h-4 text-[#9A7426] dark:text-[#E5C158] shrink-0" />
                  <span>{printerT.printPreviewTitle}</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingBill}
                  onClick={() => handleFinalizeBill('TAX_INVOICE')}
                  className="w-full py-3 px-4 bg-[#C9A24A] hover:bg-[#B38F3B] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 whitespace-nowrap"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>{showRupees ? posT.printGstTaxInvoice : 'Save & Preview Challan'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingBill}
                  onClick={() => handleFinalizeBill('THERMAL_RECEIPT')}
                  className="w-full py-3 px-4 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-[#1E2D4A] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 whitespace-nowrap"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>{showRupees ? posT.printThermalSlip : 'Save & Preview Thermal'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sibling Recent Sales Bills Table (Never nested inside the form card) */}
          {invoices.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Recent Sales Bills</h3>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono tabular-nums">{Math.min(5, invoices.length)} shown</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] border-b border-slate-200 dark:border-slate-800 font-sans">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">{ui.billNo}</th>
                      <th className="px-4 py-2.5 font-medium">{ui.customerName}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{ui.netWt}</th>
                      {showRupees && <th className="px-4 py-2.5 text-right font-medium">{ui.grandTotal}</th>}
                      <th className="px-4 py-2.5 font-medium">{payT.paymentOption}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{ui.action}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invoices.slice(0, 5).map((inv) => {
                      const status = inv.paymentStatus || 'PAID';
                      const statusColor =
                        status === 'UNPAID'
                          ? 'text-rose-700'
                          : status === 'PARTIAL'
                          ? 'text-amber-700'
                          : 'text-emerald-700';
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-2.5 font-bold text-[#9A7426] dark:text-[#E5C158] whitespace-nowrap">{inv.invoiceNo}</td>
                          <td className="px-4 py-2.5 font-sans text-slate-800 dark:text-slate-200">
                            {inv.customerName || 'Walk-in Customer'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {formatGrams(inv.totalNetGoldWeightGrams || 0)}
                          </td>
                          {showRupees && (
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              ₹{(inv.grandTotalINR || 0).toLocaleString('en-IN')}
                            </td>
                          )}
                          <td className="px-4 py-2.5 font-sans whitespace-nowrap">
                            <span className="text-slate-700 dark:text-slate-300">
                              {formatInvoicePaymentMethodLabel(inv, activeLanguage)}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600 mx-1" aria-hidden="true">
                              ·
                            </span>
                            <span className={`font-semibold ${statusColor}`}>
                              {formatInvoiceStatusLabel(status, activeLanguage)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setAutoPrintPos(false);
                                setPrintDoc({ type: 'TAX_INVOICE', data: inv });
                              }}
                              className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-[#9A7426] dark:text-[#E5C158] hover:underline cursor-pointer whitespace-nowrap"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{printerT.printPreviewTitle}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ACTION 2: GOLD IN / GOLD OUT                              */}
      {/* ========================================================= */}
      {activeTab === 'gold_in_out' && (
        <form
          onSubmit={handleSubmitGoldInOut}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5 max-w-2xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{posT.tabs.goldInOut}</h2>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setGioDirection('IN')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                  gioDirection === 'IN' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                <span>{ui.posGoldInTitle}</span>
              </button>
              <button
                type="button"
                onClick={() => setGioDirection('OUT')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                  gioDirection === 'OUT' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                <span>{ui.posGoldOutTitle}</span>
              </button>
            </div>
          </div>

          {/* Entry Category Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{ui.type}</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'CUSTOMER', label: 'Customer Gold' },
                  { id: 'BULLION', label: gioDirection === 'IN' ? 'Bullion Purchase' : 'Bullion Sale' },
                  { id: 'SCRAP', label: 'Workshop Scrap' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setGioPurposePreset(item.id);
                    if (item.id === 'BULLION') {
                      setGioPurity('24K');
                      setGioFineness(PURITY_STANDARDS['24K'].fineness);
                      setGioRatePerGram(String(getRate('24K')));
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                    gioPurposePreset === item.id
                      ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Party Name */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.partyOrKarigar} *</label>
            <input
              type="text"
              list="partySuggestions"
              placeholder="e.g. Ramesh Kumar / Shree Bullion"
              required
              value={gioPartyName}
              onChange={(e) => setGioPartyName(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
            />
            <datalist id="partySuggestions">
              {customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
              {staffList.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            {gioPurposePreset === 'CUSTOMER' &&
              gioPartyName.trim() !== '' &&
              (() => {
                const matched = customers.find(
                  (c) => c.name.toLowerCase() === gioPartyName.trim().toLowerCase()
                );
                if (!matched) return null;
                const bal = matched.customerGoldBalanceGrams || 0;
                return (
                  <div className="mt-1 text-[11px] font-mono tabular-nums">
                    {bal > 0 ? (
                      <span className="text-[#9A7426] dark:text-[#E5C158]">
                        Current Custody: +{formatGrams(bal)}
                      </span>
                    ) : bal < 0 ? (
                      <span className="text-rose-700 dark:text-rose-400">
                        Current {payT.goldDue}: {formatGrams(Math.abs(bal))}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">Current Balance: 0.000 g</span>
                    )}
                  </div>
                );
              })()}
          </div>

          {/* Purity & Weights */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{ui.purity}</label>
              <EditablePurityControl
                purity={gioPurity}
                fineness={gioFineness}
                presets={['22K', '24K', '18K', '20K']}
                onChange={(nextPurity, nextFineness) => {
                  setGioPurity(nextPurity);
                  setGioFineness(nextFineness);
                  setGioRatePerGram(String(computeRateForFineness(nextFineness, goldRates, nextPurity)));
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.grossWt} *</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  required
                  value={gioGrossWeight}
                  onChange={(e) => setGioGrossWeight(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold focus:border-[#C9A24A] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.posStoneBeadWt}</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={gioNonGoldWeight}
                  onChange={(e) => setGioNonGoldWeight(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.notes}</label>
              <input
                type="text"
                placeholder="Optional remarks..."
                value={gioReason}
                onChange={(e) => setGioReason(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
              />
            </div>
          </div>

          {/* Live Summary & Submit */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-sans">{ui.netWt}: </span>
                <strong className="text-sm text-slate-900 dark:text-slate-100">{formatGrams(gioNetWeight)}</strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-sans">{ui.fineWt} (999.9): </span>
                <strong className="text-sm text-[#9A7426] dark:text-[#E5C158]">{formatGrams(gioFineGold)}</strong>
              </div>
              {showRupees && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-sans">{ui.amountInr}: </span>
                  <strong className="text-sm text-slate-900 dark:text-slate-100">{formatINR(gioValuation)}</strong>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-2 text-white dark:text-slate-950 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-[#1E2D4A] dark:hover:bg-[#E5C158] whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {ui.posSaveEntry} ({gioDirection === 'IN' ? ui.posGoldInTitle : ui.posGoldOutTitle})
              </span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* ACTION 3: KARIGAR GIVE & RECEIVE                          */}
      {/* ========================================================= */}
      {activeTab === 'karigar_tx' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5 max-w-3xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{posT.tabs.karigarTx}</h2>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setKarigarSubMode('GIVE')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                  karigarSubMode === 'GIVE' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                <span>{ui.posKarigarGiveTitle}</span>
              </button>
              <button
                type="button"
                onClick={() => setKarigarSubMode('RECEIVE')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                  karigarSubMode === 'RECEIVE'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Scale className="w-3.5 h-3.5 shrink-0" />
                <span>{ui.posKarigarReceiveTitle}</span>
              </button>
            </div>
          </div>

          {karigarSubMode === 'GIVE' ? (
            <form onSubmit={handleGiveGoldToKarigar} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.selectKarigar} *</label>
                  <select
                    value={selectedKarigarId}
                    onChange={(e) => setSelectedKarigarId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-[#C9A24A] focus:outline-none"
                  >
                    {staffList
                      .filter((s) => s.role === 'KARIGAR')
                      .map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} ({k.code}) · Holding: {formatGrams(k.currentGoldHoldingGrams)}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Ornament / Work Item *</label>
                  <input
                    type="text"
                    required
                    value={karigarJewelleryType}
                    onChange={(e) => setKarigarJewelleryType(e.target.value)}
                    placeholder="e.g. Necklace / Bangles / Chain"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {['Necklace', 'Bangles', 'Ring', 'Chain', 'Earrings', 'Mangalsutra'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setKarigarJewelleryType(item)}
                    className={`px-2.5 py-1 text-xs rounded-md border font-medium transition cursor-pointer whitespace-nowrap ${
                      karigarJewelleryType === item
                        ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.purity}</label>
                  <EditablePurityControl
                    variant="inline"
                    purity={karigarPurity}
                    fineness={karigarFineness}
                    onChange={(nextPurity, nextFineness) => {
                      setKarigarPurity(nextPurity);
                      setKarigarFineness(nextFineness);
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.grossWt} *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={karigarNet}
                    onChange={(e) => setKarigarNet(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.allowedWastagePct}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={karigarWastage}
                    onChange={(e) => setKarigarWastage(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.dueDate}</label>
                  <input
                    type="date"
                    value={karigarDueDate}
                    onChange={(e) => setKarigarDueDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.notes}</label>
                  <input
                    type="text"
                    placeholder="Design / size instructions..."
                    value={karigarWorkInstructions}
                    onChange={(e) => setKarigarWorkInstructions(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {ui.fineWt}:{' '}
                  <strong className="text-[#9A7426] dark:text-[#E5C158]">
                    {formatGrams(((parseFloat(karigarNet) || 0) * karigarFineness) / 1000)}
                  </strong>
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#C9A24A] hover:bg-[#B38F3B] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer inline-flex items-center justify-center space-x-2 whitespace-nowrap"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>
                    {ui.posSaveEntry} ({karigarNet || '0'}g)
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleReceiveGoldFromKarigar} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Active Job Order *
                </label>
                <select
                  value={recJobCardId}
                  onChange={(e) => {
                    setRecJobCardId(e.target.value);
                    const jc = jobCards.find((j) => j.id === e.target.value);
                    if (jc) {
                      setRecJewelleryNet(String(Number((jc.issuedNetWeightGrams * 0.97).toFixed(3))));
                      setRecScrapWeight(String(Number((jc.issuedNetWeightGrams * 0.01).toFixed(3))));
                    }
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-[#C9A24A] focus:outline-none"
                >
                  <option value="">-- Choose Karigar Job Order --</option>
                  {jobCards
                    .filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED')
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.jobNo} · {j.karigarName} · {j.jewelleryType} (Issued: {formatGrams(j.issuedNetWeightGrams)}{' '}
                        {j.purity})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    {ui.returnedOrnament} (g) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={recJewelleryNet}
                    onChange={(e) => setRecJewelleryNet(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    {ui.returnedScrap} (g)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={recScrapWeight}
                    onChange={(e) => setRecScrapWeight(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>
              </div>

              {karigarReconciliationPreview && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono tabular-nums text-xs">
                  <div>
                    <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">Issued Net</div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatGrams(karigarReconciliationPreview.issued)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">Actual Loss</div>
                    <div className="font-bold text-[#9A7426] dark:text-[#E5C158] mt-0.5">
                      {formatGrams(karigarReconciliationPreview.actualLoss)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">Allowed Ghat</div>
                    <div className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                      {formatGrams(karigarReconciliationPreview.allowedWastage)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">Ghat Status</div>
                    <div
                      className={`font-bold mt-0.5 ${
                        karigarReconciliationPreview.isExcess ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {karigarReconciliationPreview.isExcess
                        ? `+${formatGrams(karigarReconciliationPreview.excessLoss)} Excess`
                        : 'Within Ghat'}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.notes}</label>
                <input
                  type="text"
                  value={recQcRemarks}
                  onChange={(e) => setRecQcRemarks(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-[#1E2D4A] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center space-x-2 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {ui.posSaveEntry} ({ui.posKarigarReceiveTitle})
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ACTION 4: MELTING & REFINING                              */}
      {/* ========================================================= */}
      {activeTab === 'melting_refining' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5 max-w-3xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{ui.meltingTitle}</h2>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setMeltingMode('SEND')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  meltingMode === 'SEND' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                <span>{ui.posMeltSendTitle}</span>
              </button>
              <button
                type="button"
                onClick={() => setMeltingMode('RECEIVE')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap shrink-0 ${
                  meltingMode === 'RECEIVE'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{ui.posMeltReceiveTitle}</span>
              </button>
            </div>
          </div>

          {meltingMode === 'SEND' ? (
            <form onSubmit={handleSendToMelting} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.operatorRefiner}</label>
                  <input
                    type="text"
                    value={meltOperator}
                    onChange={(e) => setMeltOperator(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Refinery Type</label>
                  <select
                    value={meltRefinerType}
                    onChange={(e: any) => setMeltRefinerType(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                  >
                    <option value="INTERNAL_KARIGAR">In-house Induction Furnace</option>
                    <option value="OUTSIDE_REFINER">Outside Gold Refinery Hub</option>
                    <option value="ASSAY_LAB">Certified Assay Laboratory</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Input Scrap Lots</span>
                  <span className="font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">
                    Total: {formatGrams(meltInputs.reduce((s, i) => s + i.weightGrams, 0))}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Lot description (e.g. Polishing dust)"
                    value={meltInputDesc}
                    onChange={(e) => setMeltInputDesc(e.target.value)}
                    className="flex-1 min-w-[160px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                  />
                  <EditablePurityControl
                    variant="inline"
                    presets={['22K', '20K', '18K', '14K', '9K']}
                    purity={meltInputPurity}
                    fineness={meltInputFineness}
                    onChange={(nextPurity, nextFineness) => {
                      setMeltInputPurity(nextPurity);
                      setMeltInputFineness(nextFineness);
                    }}
                  />
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Wt (g)"
                    value={meltInputWeight}
                    onChange={(e) => setMeltInputWeight(e.target.value)}
                    className="w-24 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={handleAddMeltingInput}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    + Add Lot
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums text-xs">
                  {meltInputs.map((lot, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between gap-2">
                      <span className="text-slate-700 dark:text-slate-300 font-sans">{lot.description}</span>
                      <div className="flex items-center space-x-3 shrink-0">
                        <span className="text-[#9A7426] dark:text-[#E5C158] font-bold">{lot.purity}</span>
                        <span className="text-slate-900 dark:text-slate-100 font-semibold">{formatGrams(lot.weightGrams)}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">({formatGrams(lot.fineGoldWeightGrams)} fine)</span>
                        <button
                          type="button"
                          onClick={() => setMeltInputs((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-[#1E2D4A] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center space-x-2 whitespace-nowrap"
                >
                  <Flame className="w-4 h-4 shrink-0 text-[#C9A24A]" />
                  <span>
                    {ui.posSaveEntry} ({ui.posMeltSendTitle})
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCompleteMelting} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Select Melting Batch in Process *
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-[#C9A24A] focus:outline-none"
                >
                  <option value="">-- Select Active Furnace Batch --</option>
                  {meltingBatches
                    .filter((m) => m.status === 'IN_PROCESS')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.batchNo} ({m.operatorOrRefiner}) · Input: {formatGrams(m.totalInputGrossGrams)} (
                        {formatGrams(m.totalInputFineGoldGrams)} fine)
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Melted Gold Wt (g) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={outputGrossWeight}
                    onChange={(e) => setOutputGrossWeight(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-[#9A7426] dark:text-[#E5C158] font-mono tabular-nums font-bold focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Assay Purity (Editable)</label>
                  <EditablePurityControl
                    variant="inline"
                    presets={['22K', '20K', '18K', '14K', '9K']}
                    purity={outputPurity}
                    fineness={outputFineness}
                    onChange={(nextPurity, nextFineness) => {
                      setOutputPurity(nextPurity);
                      setOutputFineness(nextFineness);
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Recovered Scrap (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={outputRecoveredScrap}
                    onChange={(e) => setOutputRecoveredScrap(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Refining Fee (₹)</label>
                  <input
                    type="number"
                    value={outputRefiningFee}
                    onChange={(e) => setOutputRefiningFee(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.notes}</label>
                <input
                  type="text"
                  value={outputExplanation}
                  onChange={(e) => setOutputExplanation(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-[#C9A24A] hover:bg-[#B38F3B] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center space-x-2 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{ui.recordMelting}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ACTION 5: PARTY CHALLAN (Single-Elevation Card + Table)    */}
      {/* ========================================================= */}
      {activeTab === 'party_tx' && (
        <div className="space-y-6 max-w-3xl">
          <form
            onSubmit={handleCreateOutsidePartyChallan}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{posT.tabs.partyTx}</h2>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPartyDirection('ISSUE')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                    partyDirection === 'ISSUE' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  <span>{ui.posPartyGiveTitle}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPartyDirection('RECEIPT')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                    partyDirection === 'RECEIPT'
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>{ui.posPartyReceiveTitle}</span>
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{ui.partyOrKarigar} *</label>
                <button
                  type="button"
                  onClick={() => setShowAddPartyModal(true)}
                  className="text-xs text-[#9A7426] dark:text-[#E5C158] hover:underline font-semibold cursor-pointer whitespace-nowrap"
                >
                  + Add Party
                </button>
              </div>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-[#C9A24A] focus:outline-none"
              >
                {outsideParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.partyType}) · Custody: {formatGrams(p.currentGoldHoldingGrams)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Purpose *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'HALLMARKING', label: 'BIS Hallmarking' },
                  { id: 'MELTING_ASSAY', label: 'Melting / Assay' },
                  { id: 'JOB_WORK', label: 'Outside Job Work' },
                  { id: 'TEMPORARY_APPROVAL', label: 'Approval' },
                ].map((pur) => {
                  const isSel = partyPurpose === pur.id;
                  return (
                    <button
                      key={pur.id}
                      type="button"
                      onClick={() => setPartyPurpose(pur.id as any)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                        isSel
                          ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {pur.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.purity}</label>
                <EditablePurityControl
                  variant="inline"
                  purity={partyPurity}
                  fineness={partyFineness}
                  onChange={(nextPurity, nextFineness) => {
                    setPartyPurity(nextPurity);
                    setPartyFineness(nextFineness);
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.grossWt} *</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={partyNetWeight}
                  onChange={(e) => setPartyNetWeight(e.target.value)}
                  placeholder="0.000"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.dueDate}</label>
                <input
                  type="date"
                  value={partyExpectedDate}
                  onChange={(e) => setPartyExpectedDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.notes}</label>
              <input
                type="text"
                placeholder="Box seal / hallmark batch remarks..."
                value={partyNotes}
                onChange={(e) => setPartyNotes(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {ui.fineWt}:{' '}
                <strong className="text-[#9A7426] dark:text-[#E5C158]">
                  {formatGrams(((parseFloat(partyNetWeight) || 0) * partyFineness) / 1000)}
                </strong>
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-[#1E2D4A] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer inline-flex items-center justify-center space-x-2 whitespace-nowrap"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>
                  {ui.posSaveEntry} ({partyNetWeight || '0'}g)
                </span>
              </button>
            </div>
          </form>

          {/* Sibling Recent Party Challans Table */}
          {outsidePartyTransactions.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{ui.posRecentEntries}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] border-b border-slate-200 dark:border-slate-800 font-sans">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">{ui.challanRef}</th>
                      <th className="px-4 py-2.5 font-medium">{ui.date}</th>
                      <th className="px-4 py-2.5 font-medium">{ui.partyOrKarigar}</th>
                      <th className="px-4 py-2.5 font-medium">{ui.type}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{ui.netWt}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{ui.action}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {outsidePartyTransactions.slice(0, 6).map((opt) => (
                      <tr key={opt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 text-[#9A7426] dark:text-[#E5C158] font-bold whitespace-nowrap">{opt.challanNo}</td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{opt.date?.split('T')[0]}</td>
                        <td className="px-4 py-2.5 font-sans text-slate-800 dark:text-slate-200">{opt.partyName}</td>
                        <td className="px-4 py-2.5 font-sans">
                          <span
                            className={`font-semibold ${
                              opt.direction === 'ISSUE' ? 'text-slate-700 dark:text-slate-300' : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {opt.direction}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600 mx-1" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">{opt.purpose}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatGrams(opt.netWeightGrams)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setPrintDoc({ type: 'DELIVERY_CHALLAN', data: opt })}
                            className="text-xs font-sans font-semibold text-[#9A7426] dark:text-[#E5C158] hover:underline cursor-pointer whitespace-nowrap"
                          >
                            {ui.printReport}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ACTION 6: CASH / BANK VOUCHER (Single-Elevation + Table)  */}
      {/* ========================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6 max-w-3xl">
          <form
            onSubmit={handleAddPayment}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{posT.tabs.payments}</h2>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPayType('RECEIPT')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                    payType === 'RECEIPT'
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>{ui.posCashInTitle}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayType('PAYMENT')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer inline-flex items-center justify-center space-x-1.5 whitespace-nowrap ${
                    payType === 'PAYMENT' ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  <span>{ui.posCashOutTitle}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Channel</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'CASH', label: payT.cashChannel },
                    { id: 'BANK', label: `${payT.upiChannel} / ${payT.bankChannel}` },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setPayAccount(ch.id as any)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                        payAccount === ch.id
                          ? 'bg-[#101C32] dark:bg-[#C9A24A] text-white dark:text-slate-950 border-[#101C32] dark:border-[#C9A24A]'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Category</label>
                <select
                  value={payCategory}
                  onChange={(e: any) => setPayCategory(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-[#C9A24A] focus:outline-none"
                >
                  <option value="SALES_COLLECTION">Customer Sale / Due Collection</option>
                  <option value="KARIGAR_LABOUR">Karigar Wages</option>
                  <option value="STAFF_ADVANCE">Karigar Advance</option>
                  <option value="GOLD_PURCHASE">Bullion Purchase</option>
                  <option value="EXPENSE">Workshop Expense</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Amount (₹) *</label>
                <div className="flex flex-wrap gap-1.5">
                  {[1000, 5000, 10000, 25000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPayAmount(String((parseFloat(payAmount) || 0) + amt))}
                      className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      +{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-bold text-slate-400 dark:text-slate-500">₹</span>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.partyOrKarigar} *</label>
                <input
                  type="text"
                  required
                  list="cashPartyList"
                  placeholder="e.g. Ramesh Kumar / Karigar Name"
                  value={payPartyName}
                  onChange={(e) => setPayPartyName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                />
                <datalist id="cashPartyList">
                  {customers.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                  {staffList.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Ref / UTR (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. UPI/42918821"
                  value={payRefNo}
                  onChange={(e) => setPayRefNo(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">{ui.notes}</label>
              <input
                type="text"
                placeholder="Optional voucher notes..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-2 text-white dark:text-slate-950 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-[#1E2D4A] dark:hover:bg-[#E5C158] whitespace-nowrap"
              >
                <Wallet className="w-4 h-4 shrink-0 text-[#C9A24A]" />
                <span>
                  {ui.posSaveEntry} (₹{payAmount ? Number(payAmount).toLocaleString('en-IN') : '0'})
                </span>
              </button>
            </div>
          </form>

          {/* Sibling Recent Cash Entries Table */}
          {cashTransactions.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{ui.posRecentEntries}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono tabular-nums">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] border-b border-slate-200 dark:border-slate-800 font-sans">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">{ui.date}</th>
                      <th className="px-4 py-2.5 font-medium">{ui.partyOrKarigar}</th>
                      <th className="px-4 py-2.5 font-medium">{ui.type}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{ui.amountInr}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cashTransactions.slice(0, 6).map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{tx.date}</td>
                        <td className="px-4 py-2.5 font-sans text-slate-800 dark:text-slate-200">{tx.partyName || 'Cash Counter'}</td>
                        <td className="px-4 py-2.5 font-sans">
                          <span
                            className={`font-semibold ${
                              tx.type === 'RECEIPT' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {tx.type}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600 mx-1" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">{tx.accountType}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatINR(tx.amountINR)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* WYSIWYG PRINT PREVIEW MODAL (A4 / A5 / 80MM / 58MM)       */}
      {/* ========================================================= */}
      <PrintPreviewModal
        isOpen={Boolean(printDoc)}
        onClose={() => {
          setPrintDoc(null);
          setAutoPrintPos(false);
        }}
        docType={printDoc?.type || 'TAX_INVOICE'}
        data={printDoc?.data}
        tenant={tenant}
        customers={customers}
        activeLanguage={activeLanguage}
        showRupees={showRupees}
        printerSettings={printerSettings}
        onUpdatePrinterSettings={onUpdatePrinterSettings}
        autoTriggerPrint={autoPrintPos}
      />

      {/* NEW OUTSIDE PARTY MODAL */}
      {showAddPartyModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base font-cinzel">Add Outside Party</h3>
              <button
                onClick={() => setShowAddPartyModal(false)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Party / Business Name</label>
                <input
                  type="text"
                  placeholder="e.g. Zaveri Fire Assay Labs"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Party Type</label>
                <select
                  value={newPartyType}
                  onChange={(e: any) => setNewPartyType(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                >
                  <option value="HALLMARK_CENTER">BIS Hallmarking Center</option>
                  <option value="REFINER">Gold Smelter / Refinery</option>
                  <option value="OUTSIDE_KARIGAR">External Jadau / Stone Setter</option>
                  <option value="DEALER">Outside Bullion Dealer</option>
                  <option value="CUSTOMER_PARTNER">Showroom B2B Consignee</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">City / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai / Chennai"
                  value={newPartyCity}
                  onChange={(e) => setNewPartyCity(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98..."
                  value={newPartyPhone}
                  onChange={(e) => setNewPartyPhone(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:border-[#C9A24A] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3">
              <button
                type="button"
                onClick={() => setShowAddPartyModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {ui.cancel}
              </button>
              <button
                type="button"
                onClick={handleCreateParty}
                className="px-5 py-2 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-[#1E2D4A] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
              >
                {ui.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
