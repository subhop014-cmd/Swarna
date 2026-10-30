import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarRange,
  CheckCircle,
  ChevronRight,
  Download,
  Printer,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  BranchTransfer,
  CashBankTransaction,
  Customer,
  GoldLedgerEntry,
  GoldPurityCode,
  GoldRate,
  IndianLanguage,
  JobCard,
  MeltingBatch,
  OutsidePartyTransaction,
  Staff,
  Tenant,
} from '../types';
import { getUI } from '../i18n/uiTranslations';
import { getIndividualReportUI } from '../i18n/individualReportTranslations';
import {
  formatInvoicePaymentMethodLabel,
  formatInvoiceStatusLabel,
  getPaymentStrings,
} from '../i18n/paymentTranslations';
import { TRANSLATIONS } from '../i18n/translations';
import { formatGrams, formatINR, PURITY_STANDARDS } from '../utils/goldMath';
import {
  CustomerGivenTakenRow,
  CustomerSummaryMetric,
  downloadCSV,
  generateAllTransactionsCSV,
  generateCustomerGivenTakenCSV,
  generateGoldInOutCSV,
  generateInvoicesCSV,
  generateKarigarTransactionsCSV,
  generateLedgerCSV,
  generateMeltingReportCSV,
  generateStockSummaryCSV,
  generateWastageAuditCSV,
  KarigarTransactionRow,
  UnifiedTransactionRow,
} from '../utils/csvExport';

interface ReportsViewProps {
  stockSummary: any;
  ledgerEntries?: GoldLedgerEntry[];
  jobCards: JobCard[];
  staff: Staff[];
  customers?: Customer[];
  invoices: any[];
  cashTransactions?: CashBankTransaction[];
  meltingBatches?: MeltingBatch[];
  outsidePartyTransactions?: OutsidePartyTransaction[];
  branchTransfers?: BranchTransfer[];
  currentTenant: Tenant | null;
  activeLanguage: IndianLanguage;
  goldRates?: GoldRate[];
  showRupees?: boolean;
  initialFocus?: { tab: 'customer' | 'karigar'; entityId: string; ts: number } | null;
}

type ReportTab =
  | 'all_tx'
  | 'customer'
  | 'karigar'
  | 'gold_in_out'
  | 'melting'
  | 'stock'
  | 'gst';

const GOLD_IN_TYPES = new Set([
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

const GOLD_OUT_TYPES = new Set([
  'GOLD_SALE',
  'SALE_DELIVERY',
  'CUSTOMER_WITHDRAWAL',
  'ISSUE_TO_KARIGAR',
  'ISSUE_TO_PARTY',
  'SEND_TO_MELTING',
  'SUPPLIER_SETTLEMENT',
  'BRANCH_TRANSFER',
]);

function classifyLedgerDirection(e: GoldLedgerEntry): 'IN' | 'OUT' | 'CONVERSION' {
  if (e.type === 'MELTING_CONVERSION') return 'CONVERSION';
  if (GOLD_IN_TYPES.has(e.type)) return 'IN';
  if (GOLD_OUT_TYPES.has(e.type)) return 'OUT';
  if (e.destinationAccount === 'BUSINESS_OWNED' || e.destinationAccount === 'FINISHED_GOODS') {
    return 'IN';
  }
  return 'OUT';
}

function formatReadableCode(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  stockSummary,
  ledgerEntries = [],
  jobCards = [],
  staff = [],
  customers = [],
  invoices = [],
  cashTransactions = [],
  meltingBatches = [],
  currentTenant,
  activeLanguage,
  goldRates = [],
  showRupees = false,
  initialFocus = null,
}) => {
  const ui = getUI(activeLanguage);
  const ir = getIndividualReportUI(activeLanguage);
  const payT = getPaymentStrings(activeLanguage);
  const t = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [selectedReport, setSelectedReport] = useState<ReportTab>('all_tx');

  // Clean Period Filter State
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [exactDate, setExactDate] = useState<string>('');
  const [showCustomRange, setShowCustomRange] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Focused Sub-States (One clear view at a time — never stacked tables)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [selectedKarigarId, setSelectedKarigarId] = useState<string>('ALL');
  const [individualLayout, setIndividualLayout] = useState<'split' | 'passbook'>('split');
  const [karigarSubView, setKarigarSubView] = useState<'summary' | 'wastage'>('summary');
  const [ioDirectionFilter, setIoDirectionFilter] = useState<'ALL' | 'IN' | 'OUT' | 'LEDGER'>('ALL');
  const [ioPurityFilter, setIoPurityFilter] = useState<'ALL' | GoldPurityCode>('ALL');

  const [showExportSuccess, setShowExportSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!initialFocus) return;
    if (initialFocus.tab === 'customer') {
      setSelectedReport('customer');
      setSelectedCustomerId(initialFocus.entityId || 'ALL');
      setIndividualLayout('split');
    } else if (initialFocus.tab === 'karigar') {
      setSelectedReport('karigar');
      setSelectedKarigarId(initialFocus.entityId || 'ALL');
      setKarigarSubView('summary');
      setIndividualLayout('split');
    }
  }, [initialFocus]);

  const tenantName = currentTenant?.name || 'Swarna Karkhana';

  // Available years dynamically collected
  const availableYears = useMemo(() => {
    const years = new Set<string>([String(new Date().getFullYear()), '2026', '2025']);
    const collectYear = (d?: string) => {
      if (d && d.length >= 4) years.add(d.slice(0, 4));
    };
    ledgerEntries.forEach((e) => collectYear(e.date));
    jobCards.forEach((j) => collectYear(j.issueDate || j.createdAt));
    invoices.forEach((i) => collectYear(i.date));
    cashTransactions.forEach((c) => collectYear(c.date));
    meltingBatches.forEach((m) => collectYear(m.completedDate || m.sentDate));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [ledgerEntries, jobCards, invoices, cashTransactions, meltingBatches]);

  // Period Matcher
  const matchesPeriod = (rawDate?: string): boolean => {
    if (!rawDate) return true;
    const d = rawDate.split('T')[0];
    if (exactDate && d !== exactDate) return false;
    if (!exactDate) {
      if (selectedYear !== 'ALL' && !d.startsWith(selectedYear)) return false;
      if (selectedMonth !== 'ALL') {
        const m = d.slice(5, 7);
        if (m !== selectedMonth) return false;
      }
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
    }
    return true;
  };

  const periodSummaryLabel = useMemo(() => {
    if (exactDate) return exactDate;
    const parts: string[] = [];
    if (selectedMonth !== 'ALL') {
      const mIdx = parseInt(selectedMonth, 10) - 1;
      parts.push(ui.months[mIdx] || selectedMonth);
    }
    if (selectedYear !== 'ALL') parts.push(selectedYear);
    if (startDate || endDate) parts.push(`${startDate || '...'} → ${endDate || '...'}`);
    return parts.length > 0 ? parts.join(' ') : `${ui.allYears} · ${ui.allMonths}`;
  }, [exactDate, selectedMonth, selectedYear, startDate, endDate, ui]);

  const q = searchTerm.trim().toLowerCase();

  // 1. Filtered Base Datasets
  const filteredLedger = useMemo(
    () =>
      ledgerEntries.filter(
        (e) =>
          matchesPeriod(e.date) &&
          (!q ||
            e.transactionNo.toLowerCase().includes(q) ||
            e.type.toLowerCase().includes(q) ||
            (e.counterpartyName && e.counterpartyName.toLowerCase().includes(q)) ||
            (e.notes && e.notes.toLowerCase().includes(q)))
      ),
    [ledgerEntries, selectedYear, selectedMonth, exactDate, startDate, endDate, q]
  );

  const filteredJobs = useMemo(
    () =>
      jobCards.filter(
        (j) =>
          matchesPeriod(j.submittedDate || j.issueDate || j.createdAt) &&
          (!q ||
            j.jobNo.toLowerCase().includes(q) ||
            j.jewelleryType.toLowerCase().includes(q) ||
            j.karigarName.toLowerCase().includes(q) ||
            (j.customerName && j.customerName.toLowerCase().includes(q)))
      ),
    [jobCards, selectedYear, selectedMonth, exactDate, startDate, endDate, q]
  );

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          matchesPeriod(inv.date) &&
          (!q ||
            inv.invoiceNo.toLowerCase().includes(q) ||
            (inv.customerName && inv.customerName.toLowerCase().includes(q)))
      ),
    [invoices, selectedYear, selectedMonth, exactDate, startDate, endDate, q]
  );

  const filteredCash = useMemo(
    () =>
      cashTransactions.filter(
        (c) =>
          matchesPeriod(c.date) &&
          (!q ||
            (c.partyName && c.partyName.toLowerCase().includes(q)) ||
            (c.referenceNo && c.referenceNo.toLowerCase().includes(q)) ||
            c.category.toLowerCase().includes(q) ||
            (c.notes && c.notes.toLowerCase().includes(q)))
      ),
    [cashTransactions, selectedYear, selectedMonth, exactDate, startDate, endDate, q]
  );

  // Melting Batches + legacy MELTING_CONVERSION entries
  const filteredMeltingBatches = useMemo(() => {
    const realBatches = meltingBatches.filter(
      (b) =>
        matchesPeriod(b.completedDate || b.sentDate) &&
        (!q ||
          b.batchNo.toLowerCase().includes(q) ||
          b.operatorOrRefiner.toLowerCase().includes(q) ||
          (b.explanationNotes && b.explanationNotes.toLowerCase().includes(q)))
    );

    const legacyConversions = filteredLedger.filter(
      (e) =>
        e.type === 'MELTING_CONVERSION' &&
        e.destinationAccount === 'BUSINESS_OWNED' &&
        (e.notes || '').includes('Refined bar output')
    );

    const syntheticFromLedger: MeltingBatch[] = legacyConversions.map((e) => ({
      id: `syn_${e.id}`,
      tenantId: e.tenantId,
      branchId: e.branchId,
      batchNo: e.transactionNo,
      status: 'COMPLETED',
      sentDate: e.date,
      completedDate: e.date,
      operatorOrRefiner: e.enteredBy || 'Furnace',
      refinerType: 'INTERNAL_KARIGAR',
      sourceAccount: 'SCRAP_REFINING',
      inputs: [
        {
          description: 'Scrap / Bullion Melt',
          weightGrams: e.grossWeightGrams,
          purity: e.purity,
          fineness: e.fineness,
          fineGoldWeightGrams: e.fineGoldWeightGrams,
        },
      ],
      totalInputGrossGrams: e.grossWeightGrams,
      totalInputFineGoldGrams: e.fineGoldWeightGrams,
      outputGrossGrams: e.netWeightGrams,
      outputPurity: e.purity,
      outputFineness: e.fineness,
      outputFineGoldGrams: e.fineGoldWeightGrams,
      weightLossGrams: 0,
      fineGoldLossOrGainGrams: 0,
      explanationNotes: e.notes,
      approvalStatus: 'APPROVED',
      createdBy: e.enteredBy,
    }));

    return [...realBatches, ...syntheticFromLedger].sort((a, b) =>
      (b.completedDate || b.sentDate).localeCompare(a.completedDate || a.sentDate)
    );
  }, [meltingBatches, filteredLedger, selectedYear, selectedMonth, exactDate, startDate, endDate, q]);

  // 2. Unified Transactions
  const unifiedTransactions: UnifiedTransactionRow[] = useMemo(() => {
    const rows: UnifiedTransactionRow[] = [];

    for (const e of filteredLedger) {
      const dir = classifyLedgerDirection(e);
      rows.push({
        id: `gl_${e.id}`,
        date: e.date.split('T')[0],
        refNo: e.transactionNo,
        module: 'Gold',
        direction: dir,
        typeLabel: formatReadableCode(e.type),
        partyName:
          e.counterpartyName ||
          `${formatReadableCode(e.sourceAccount)} → ${formatReadableCode(e.destinationAccount)}`,
        purity: e.purity,
        grossGrams: e.grossWeightGrams,
        netGrams: e.netWeightGrams,
        fineGrams: e.fineGoldWeightGrams,
        lossGrams: 0,
        amountINR: e.valuationINR || 0,
        notes: e.notes || '',
      });
    }

    for (const j of filteredJobs.filter((jc) => jc.isReconciled && jc.actualLossGrams > 0)) {
      rows.push({
        id: `jc_${j.id}`,
        date: (j.submittedDate || j.issueDate || j.createdAt).split('T')[0],
        refNo: j.jobNo,
        module: 'Ghat',
        direction: 'OUT',
        typeLabel: t.wastageGhat,
        partyName: j.karigarName,
        purity: j.purity,
        grossGrams: j.actualLossGrams,
        netGrams: j.actualLossGrams,
        fineGrams: Number(((j.actualLossGrams * j.fineness) / 1000).toFixed(4)),
        lossGrams: j.actualLossGrams,
        amountINR: j.labourTotalINR || 0,
        notes: `${j.jewelleryType} (${j.agreedWastagePercent}%)`,
      });
    }

    if (showRupees) {
      for (const c of filteredCash) {
        rows.push({
          id: `cb_${c.id}`,
          date: c.date.split('T')[0],
          refNo: c.referenceNo || c.id.slice(-6).toUpperCase(),
          module: formatReadableCode(c.accountType),
          direction: c.type === 'RECEIPT' ? 'IN' : 'OUT',
          typeLabel: formatReadableCode(c.category),
          partyName: c.partyName || formatReadableCode(c.partyType) || tenantName,
          purity: '-',
          grossGrams: 0,
          netGrams: 0,
          fineGrams: 0,
          lossGrams: 0,
          amountINR: c.amountINR,
          notes: c.notes || '',
        });
      }
    }

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredLedger, filteredJobs, filteredCash, showRupees, t.wastageGhat, tenantName]);

  // 3A. Individual Customer Given & Taken Engine
  const allCustomerRows: CustomerGivenTakenRow[] = useMemo(() => {
    const rows: CustomerGivenTakenRow[] = [];
    const coveredInvoiceIds = new Set<string>();
    const coveredCashInvoiceNos = new Set<string>();

    for (const c of filteredCash) {
      if (c.type === 'RECEIPT' && c.notes) {
        const match = c.notes.match(/INV-\d{4}-\d+/);
        if (match) coveredCashInvoiceNos.add(match[0]);
      }
    }

    const resolveCust = (id?: string, name?: string) => {
      if (id) {
        const byId = customers.find((c) => c.id === id);
        if (byId) return { id: byId.id, name: byId.name };
      }
      if (name) {
        const clean = name.trim();
        const byName = customers.find((c) => c.name.toLowerCase() === clean.toLowerCase());
        if (byName) return { id: byName.id, name: byName.name };
        return { id: `walkin:${clean.toLowerCase()}`, name: clean };
      }
      return { id: 'walkin:walk-in customer', name: 'Walk-in Customer' };
    };

    for (const inv of filteredInvoices) {
      if (inv.status === 'CANCELLED') continue;
      coveredInvoiceIds.add(inv.id);
      const custRef = resolveCust(inv.customerId, inv.customerName);
      const itemsText = Array.isArray(inv.items)
        ? inv.items.map((it: any) => `${it.description} (${it.netGoldWeightGrams}g ${it.purity})`).join(', ')
        : ui.posSaleTitle;
      const primaryPurity = inv.items?.[0]?.purity || '22K';

      rows.push({
        id: `cinv_take_${inv.id}`,
        date: inv.date.split('T')[0],
        refNo: inv.invoiceNo,
        customerId: custRef.id,
        customerName: custRef.name,
        side: 'TAKEN',
        categoryLabel: ui.posSaleTitle,
        itemDetails: itemsText,
        purity: primaryPurity,
        netGrams: inv.totalNetGoldWeightGrams || 0,
        fineGrams: inv.totalFineGoldWeightGrams || 0,
        amountINR: inv.grandTotalINR || 0,
        notes: `${formatInvoicePaymentMethodLabel(inv, activeLanguage)} · ${formatInvoiceStatusLabel(inv.paymentStatus, activeLanguage)}`,
      });

      if (inv.goldExchangeGrams && inv.goldExchangeGrams > 0) {
        const exchPurity: GoldPurityCode = inv.goldExchangePurity || '22K';
        const exchFineness = PURITY_STANDARDS[exchPurity]?.fineness || 916;
        rows.push({
          id: `cinv_old_${inv.id}`,
          date: inv.date.split('T')[0],
          refNo: inv.invoiceNo,
          customerId: custRef.id,
          customerName: custRef.name,
          side: 'GIVEN',
          categoryLabel: ui.oldGoldExchange,
          itemDetails: `${ui.oldGoldExchange} (${inv.invoiceNo})`,
          purity: exchPurity,
          netGrams: inv.goldExchangeGrams,
          fineGrams: Number(((inv.goldExchangeGrams * exchFineness) / 1000).toFixed(4)),
          amountINR: inv.goldExchangeValueINR || 0,
          notes: inv.invoiceNo,
        });
      }

      if (showRupees && inv.paidAmountINR > 0 && !coveredCashInvoiceNos.has(inv.invoiceNo)) {
        rows.push({
          id: `cinv_pay_${inv.id}`,
          date: inv.date.split('T')[0],
          refNo: inv.invoiceNo,
          customerId: custRef.id,
          customerName: custRef.name,
          side: 'GIVEN',
          categoryLabel: ui.receiptIn,
          itemDetails: `${inv.paymentMethod || 'PAYMENT'} (${inv.invoiceNo})`,
          purity: '-',
          netGrams: 0,
          fineGrams: 0,
          amountINR: inv.paidAmountINR,
          notes: inv.invoiceNo,
        });
      }
    }

    for (const e of filteredLedger) {
      if (e.invoiceId && coveredInvoiceIds.has(e.invoiceId)) continue;
      const isCustTx =
        e.counterpartyType === 'CUSTOMER' ||
        e.type === 'CUSTOMER_DEPOSIT' ||
        e.type === 'CUSTOMER_OLD_GOLD' ||
        e.type === 'CUSTOMER_WITHDRAWAL' ||
        e.sourceAccount === 'CUSTOMER_OWNED' ||
        e.destinationAccount === 'CUSTOMER_OWNED';

      if (!isCustTx) continue;
      const custRef = resolveCust(e.counterpartyId, e.counterpartyName);
      const isGiven =
        e.type === 'CUSTOMER_DEPOSIT' ||
        e.type === 'CUSTOMER_OLD_GOLD' ||
        (e.destinationAccount === 'CUSTOMER_OWNED' &&
          e.type !== 'CUSTOMER_WITHDRAWAL' &&
          e.type !== 'SALE_DELIVERY');

      rows.push({
        id: `cgl_${e.id}`,
        date: e.date.split('T')[0],
        refNo: e.transactionNo,
        customerId: custRef.id,
        customerName: custRef.name,
        side: isGiven ? 'GIVEN' : 'TAKEN',
        categoryLabel: isGiven ? ui.posGoldInTitle : ui.posGoldOutTitle,
        itemDetails: e.notes || formatReadableCode(e.type),
        purity: e.purity,
        netGrams: e.netWeightGrams,
        fineGrams: e.fineGoldWeightGrams,
        amountINR: e.valuationINR || 0,
        notes: e.notes || '',
      });
    }

    if (showRupees) {
      for (const c of filteredCash) {
        const isCustCash =
          c.partyType === 'CUSTOMER' ||
          c.category === 'SALES_COLLECTION' ||
          c.category === 'CUSTOMER_REFUND';
        if (!isCustCash) continue;
        const custRef = resolveCust(undefined, c.partyName);
        const isGiven = c.type === 'RECEIPT';

        rows.push({
          id: `ccb_${c.id}`,
          date: c.date.split('T')[0],
          refNo: c.referenceNo || c.id.slice(-6).toUpperCase(),
          customerId: custRef.id,
          customerName: custRef.name,
          side: isGiven ? 'GIVEN' : 'TAKEN',
          categoryLabel: isGiven ? ui.receiptIn : ui.paymentOut,
          itemDetails: `${formatReadableCode(c.accountType)} · ${formatReadableCode(c.category)}`,
          purity: '-',
          netGrams: 0,
          fineGrams: 0,
          amountINR: c.amountINR,
          notes: c.notes || '',
        });
      }
    }

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredInvoices, filteredLedger, filteredCash, customers, ui, showRupees]);

  const customerSummaries: CustomerSummaryMetric[] = useMemo(() => {
    const map = new Map<string, CustomerSummaryMetric>();

    for (const c of customers) {
      map.set(c.id, {
        id: c.id,
        accountCode: c.accountCode,
        name: c.name,
        phone: c.phone || '-',
        city: c.city,
        givenNetGrams: 0,
        givenFineGrams: 0,
        givenCashINR: 0,
        takenNetGrams: 0,
        takenFineGrams: 0,
        takenAmountINR: 0,
        custodyGoldGrams: c.customerGoldBalanceGrams || 0,
        monetaryBalanceINR: c.monetaryBalanceINR || 0,
        txCount: 0,
      });
    }

    for (const r of allCustomerRows) {
      const cid = r.customerId || `walkin:${r.customerName.toLowerCase()}`;
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          accountCode: 'WALK-IN',
          name: r.customerName,
          phone: '-',
          givenNetGrams: 0,
          givenFineGrams: 0,
          givenCashINR: 0,
          takenNetGrams: 0,
          takenFineGrams: 0,
          takenAmountINR: 0,
          custodyGoldGrams: 0,
          monetaryBalanceINR: 0,
          txCount: 0,
        });
      }
      const entry = map.get(cid)!;
      entry.txCount += 1;
      if (r.side === 'GIVEN') {
        entry.givenNetGrams += r.netGrams;
        entry.givenFineGrams += r.fineGrams;
        entry.givenCashINR += r.amountINR;
      } else {
        entry.takenNetGrams += r.netGrams;
        entry.takenFineGrams += r.fineGrams;
        entry.takenAmountINR += r.amountINR;
      }
    }

    return Array.from(map.values()).filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.accountCode.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, allCustomerRows, q]);

  const customerTransactions = useMemo(() => {
    if (selectedCustomerId === 'ALL') return allCustomerRows;
    return allCustomerRows.filter((r) => r.customerId === selectedCustomerId);
  }, [allCustomerRows, selectedCustomerId]);

  const customerGivenRows = useMemo(
    () => customerTransactions.filter((r) => r.side === 'GIVEN'),
    [customerTransactions]
  );
  const customerTakenRows = useMemo(
    () => customerTransactions.filter((r) => r.side === 'TAKEN'),
    [customerTransactions]
  );

  const customerTotals = useMemo(
    () => ({
      givenNet: customerGivenRows.reduce((s, r) => s + r.netGrams, 0),
      givenFine: customerGivenRows.reduce((s, r) => s + r.fineGrams, 0),
      givenCash: customerGivenRows.reduce((s, r) => s + r.amountINR, 0),
      takenNet: customerTakenRows.reduce((s, r) => s + r.netGrams, 0),
      takenFine: customerTakenRows.reduce((s, r) => s + r.fineGrams, 0),
      takenCash: customerTakenRows.reduce((s, r) => s + r.amountINR, 0),
    }),
    [customerGivenRows, customerTakenRows]
  );

  const activeCustomerSummary = useMemo(
    () => customerSummaries.find((c) => c.id === selectedCustomerId) || null,
    [customerSummaries, selectedCustomerId]
  );

  // 3B. Individual Karigar Given & Taken Engine
  const karigarsList = useMemo(() => staff.filter((s) => s.role === 'KARIGAR'), [staff]);

  const allKarigarRows: KarigarTransactionRow[] = useMemo(() => {
    const rows: KarigarTransactionRow[] = [];
    const ledgerJobIdsIssued = new Set<string>();
    const ledgerJobIdsReturned = new Set<string>();
    const cashCoveredJobNos = new Set<string>();

    for (const c of filteredCash) {
      if (c.notes) {
        const m = c.notes.match(/JC-\d{4}-\d+/);
        if (m) cashCoveredJobNos.add(m[0]);
      }
    }

    const resolveKarigar = (id?: string, name?: string) => {
      if (id) {
        const byId = karigarsList.find((k) => k.id === id);
        if (byId) return { id: byId.id, name: byId.name };
      }
      if (name) {
        const clean = name.trim();
        const byName = karigarsList.find((k) => k.name.toLowerCase() === clean.toLowerCase());
        if (byName) return { id: byName.id, name: byName.name };
        return { id: `extkar:${clean.toLowerCase()}`, name: clean };
      }
      return { id: 'extkar:karigar', name: 'Karigar' };
    };

    for (const e of filteredLedger) {
      const isKarigarTx =
        e.counterpartyType === 'KARIGAR' ||
        e.type === 'ISSUE_TO_KARIGAR' ||
        e.type === 'RETURN_FROM_KARIGAR' ||
        e.sourceAccount === 'KARIGAR_HELD' ||
        e.destinationAccount === 'KARIGAR_HELD';

      if (!isKarigarTx) continue;
      const kRef = resolveKarigar(e.counterpartyId, e.counterpartyName);

      if (e.type === 'ISSUE_TO_KARIGAR' || e.destinationAccount === 'KARIGAR_HELD') {
        if (e.jobCardId) ledgerJobIdsIssued.add(e.jobCardId);
        rows.push({
          id: `kgl_in_${e.id}`,
          date: e.date.split('T')[0],
          refNo: e.transactionNo,
          karigarId: kRef.id,
          karigarName: kRef.name,
          category: 'GOLD_ISSUED',
          categoryLabel: ui.posKarigarGiveTitle,
          purity: e.purity,
          issuedNetGrams: e.netWeightGrams,
          issuedFineGrams: e.fineGoldWeightGrams,
          returnedOrnamentNetGrams: 0,
          returnedScrapGrams: 0,
          ghatLossGrams: 0,
          cashPaidINR: 0,
          notes: e.notes || '',
        });
      } else if (e.type === 'SCRAP_RECOVERY' || e.destinationAccount === 'SCRAP_REFINING') {
        rows.push({
          id: `kgl_scr_${e.id}`,
          date: e.date.split('T')[0],
          refNo: e.transactionNo,
          karigarId: kRef.id,
          karigarName: kRef.name,
          category: 'SCRAP_RETURNED',
          categoryLabel: ui.karigarScrapRecovered,
          purity: e.purity,
          issuedNetGrams: 0,
          issuedFineGrams: 0,
          returnedOrnamentNetGrams: 0,
          returnedScrapGrams: e.netWeightGrams,
          ghatLossGrams: 0,
          cashPaidINR: 0,
          notes: e.notes || '',
        });
      } else {
        if (e.jobCardId) ledgerJobIdsReturned.add(e.jobCardId);
        rows.push({
          id: `kgl_ret_${e.id}`,
          date: e.date.split('T')[0],
          refNo: e.transactionNo,
          karigarId: kRef.id,
          karigarName: kRef.name,
          category: 'ORNAMENT_RETURNED',
          categoryLabel: ui.posKarigarReceiveTitle,
          purity: e.purity,
          issuedNetGrams: 0,
          issuedFineGrams: 0,
          returnedOrnamentNetGrams: e.netWeightGrams,
          returnedScrapGrams: 0,
          ghatLossGrams: 0,
          cashPaidINR: 0,
          notes: e.notes || '',
        });
      }
    }

    for (const j of filteredJobs) {
      const kRef = resolveKarigar(j.karigarId, j.karigarName);

      if (!ledgerJobIdsIssued.has(j.id) && matchesPeriod(j.issueDate)) {
        rows.push({
          id: `kjc_iss_${j.id}`,
          date: j.issueDate,
          refNo: j.jobNo,
          karigarId: kRef.id,
          karigarName: kRef.name,
          category: 'GOLD_ISSUED',
          categoryLabel: ui.posKarigarGiveTitle,
          purity: j.purity,
          issuedNetGrams: j.issuedNetWeightGrams,
          issuedFineGrams: j.issuedFineGoldWeightGrams,
          returnedOrnamentNetGrams: 0,
          returnedScrapGrams: 0,
          ghatLossGrams: 0,
          cashPaidINR: 0,
          notes: `${j.jewelleryType}${j.customerName ? ` · ${j.customerName}` : ''}`,
        });
      }

      if (j.isReconciled) {
        const retNet = ledgerJobIdsReturned.has(j.id) ? 0 : j.returnedJewelleryNetWeight;
        const paidCash = cashCoveredJobNos.has(j.jobNo) ? 0 : j.labourPaidINR || 0;
        rows.push({
          id: `kjc_rec_${j.id}`,
          date: (j.submittedDate || j.issueDate).split('T')[0],
          refNo: j.jobNo,
          karigarId: kRef.id,
          karigarName: kRef.name,
          category: 'JOB_RECONCILED',
          categoryLabel: ui.reconcileReturn,
          purity: j.purity,
          issuedNetGrams: 0,
          issuedFineGrams: 0,
          returnedOrnamentNetGrams: retNet,
          returnedScrapGrams: ledgerJobIdsReturned.has(j.id) ? 0 : j.returnedScrapWeightGrams,
          ghatLossGrams: j.actualLossGrams,
          cashPaidINR: paidCash,
          notes: j.jewelleryType,
        });
      }
    }

    if (showRupees) {
      for (const c of filteredCash) {
        const isKarigarCash =
          c.partyType === 'KARIGAR' ||
          c.category === 'KARIGAR_LABOUR' ||
          c.category === 'STAFF_ADVANCE';
        if (!isKarigarCash) continue;
        const kRef = resolveKarigar(undefined, c.partyName);

        rows.push({
          id: `kcb_${c.id}`,
          date: c.date.split('T')[0],
          refNo: c.referenceNo || 'CASH-VCH',
          karigarId: kRef.id,
          karigarName: kRef.name,
          category: 'CASH_ADVANCE',
          categoryLabel: ui.karigarCashPaid,
          purity: '-',
          issuedNetGrams: 0,
          issuedFineGrams: 0,
          returnedOrnamentNetGrams: 0,
          returnedScrapGrams: 0,
          ghatLossGrams: 0,
          cashPaidINR: c.type === 'PAYMENT' ? c.amountINR : -c.amountINR,
          notes: c.notes || '',
        });
      }
    }

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredLedger, filteredJobs, filteredCash, karigarsList, ui, showRupees]);

  const karigarSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        regionalName?: string;
        phone: string;
        skill: string;
        givenNetGrams: number;
        givenFineGrams: number;
        givenCashINR: number;
        ornamentsTakenNetGrams: number;
        scrapTakenGrams: number;
        ghatLossGrams: number;
        goldInHandGrams: number;
        advanceBalanceINR: number;
        activeJobsCount: number;
        txCount: number;
      }
    >();

    for (const k of karigarsList) {
      map.set(k.id, {
        id: k.id,
        code: k.code,
        name: k.name,
        regionalName: k.regionalName,
        phone: k.phone,
        skill: k.skillCategory || 'Goldsmith',
        givenNetGrams: 0,
        givenFineGrams: 0,
        givenCashINR: 0,
        ornamentsTakenNetGrams: 0,
        scrapTakenGrams: 0,
        ghatLossGrams: 0,
        goldInHandGrams: k.currentGoldHoldingGrams || 0,
        advanceBalanceINR: k.advanceBalanceINR || 0,
        activeJobsCount: k.activeJobsCount || 0,
        txCount: 0,
      });
    }

    for (const r of allKarigarRows) {
      const kid = r.karigarId || `extkar:${r.karigarName.toLowerCase()}`;
      if (!map.has(kid)) {
        map.set(kid, {
          id: kid,
          code: 'KAR-EXT',
          name: r.karigarName,
          phone: '-',
          skill: 'Goldsmith',
          givenNetGrams: 0,
          givenFineGrams: 0,
          givenCashINR: 0,
          ornamentsTakenNetGrams: 0,
          scrapTakenGrams: 0,
          ghatLossGrams: 0,
          goldInHandGrams: 0,
          advanceBalanceINR: 0,
          activeJobsCount: 0,
          txCount: 0,
        });
      }
      const entry = map.get(kid)!;
      entry.txCount += 1;
      entry.givenNetGrams += r.issuedNetGrams;
      entry.givenFineGrams += r.issuedFineGrams;
      entry.givenCashINR += r.cashPaidINR;
      entry.ornamentsTakenNetGrams += r.returnedOrnamentNetGrams;
      entry.scrapTakenGrams += r.returnedScrapGrams;
      entry.ghatLossGrams += r.ghatLossGrams;
    }

    return Array.from(map.values()).filter(
      (k) =>
        !q ||
        k.name.toLowerCase().includes(q) ||
        k.code.toLowerCase().includes(q) ||
        k.skill.toLowerCase().includes(q)
    );
  }, [karigarsList, allKarigarRows, q]);

  const karigarTransactions: KarigarTransactionRow[] = useMemo(() => {
    if (selectedKarigarId === 'ALL') return allKarigarRows;
    return allKarigarRows.filter((r) => r.karigarId === selectedKarigarId);
  }, [allKarigarRows, selectedKarigarId]);

  const karigarGivenRows = useMemo(
    () => karigarTransactions.filter((r) => r.issuedNetGrams > 0 || (showRupees && r.cashPaidINR !== 0)),
    [karigarTransactions, showRupees]
  );

  const karigarTakenRows = useMemo(
    () =>
      karigarTransactions.filter(
        (r) => r.returnedOrnamentNetGrams > 0 || r.returnedScrapGrams > 0 || r.ghatLossGrams > 0
      ),
    [karigarTransactions]
  );

  const activeKarigarSummary = useMemo(
    () => karigarSummaries.find((k) => k.id === selectedKarigarId) || null,
    [karigarSummaries, selectedKarigarId]
  );

  // 4. Gold IN / OUT & Ledger Entries
  const goldInOutEntries = useMemo(() => {
    return filteredLedger
      .map((e) => {
        const dir = classifyLedgerDirection(e);
        return { ...e, ioDirection: dir };
      })
      .filter((e) => {
        if (ioDirectionFilter === 'IN' && e.ioDirection !== 'IN') return false;
        if (ioDirectionFilter === 'OUT' && e.ioDirection !== 'OUT') return false;
        if (ioDirectionFilter === 'ALL' && e.ioDirection === 'CONVERSION') return false;
        if (ioPurityFilter !== 'ALL' && e.purity !== ioPurityFilter) return false;
        return true;
      });
  }, [filteredLedger, ioDirectionFilter, ioPurityFilter]);

  // Contextual Summaries
  const periodTotals = useMemo(() => {
    let goldInFine = 0;
    let goldInNet = 0;
    let goldOutFine = 0;
    let goldOutNet = 0;

    for (const e of filteredLedger) {
      const dir = classifyLedgerDirection(e);
      if (dir === 'IN') {
        goldInFine += e.fineGoldWeightGrams;
        goldInNet += e.netWeightGrams;
      } else if (dir === 'OUT') {
        goldOutFine += e.fineGoldWeightGrams;
        goldOutNet += e.netWeightGrams;
      }
    }

    const cashIn = filteredCash
      .filter((c) => c.type === 'RECEIPT')
      .reduce((s, c) => s + c.amountINR, 0);
    const cashOut = filteredCash
      .filter((c) => c.type === 'PAYMENT')
      .reduce((s, c) => s + c.amountINR, 0);

    return {
      goldInFine,
      goldInNet,
      goldOutFine,
      goldOutNet,
      netGoldFine: goldInFine - goldOutFine,
      cashIn,
      cashOut,
      cashNet: cashIn - cashOut,
    };
  }, [filteredLedger, filteredCash]);

  const karigarTotals = useMemo(
    () => ({
      givenFine: karigarTransactions.reduce((s, r) => s + r.issuedFineGrams, 0),
      givenNet: karigarTransactions.reduce((s, r) => s + r.issuedNetGrams, 0),
      ornamentsNet: karigarTransactions.reduce((s, r) => s + r.returnedOrnamentNetGrams, 0),
      scrapGrams: karigarTransactions.reduce((s, r) => s + r.returnedScrapGrams, 0),
      ghatLoss: karigarTransactions.reduce((s, r) => s + r.ghatLossGrams, 0),
      cashPaid: karigarTransactions.reduce((s, r) => s + r.cashPaidINR, 0),
    }),
    [karigarTransactions]
  );

  const meltingTotals = useMemo(
    () => ({
      inputGross: filteredMeltingBatches.reduce((s, b) => s + (b.totalInputGrossGrams || 0), 0),
      inputFine: filteredMeltingBatches.reduce((s, b) => s + (b.totalInputFineGoldGrams || 0), 0),
      outputGross: filteredMeltingBatches.reduce((s, b) => s + (b.outputGrossGrams || 0), 0),
      outputFine: filteredMeltingBatches.reduce((s, b) => s + (b.outputFineGoldGrams || 0), 0),
      lossGross: filteredMeltingBatches.reduce((s, b) => s + (b.weightLossGrams || 0), 0),
    }),
    [filteredMeltingBatches]
  );

  const gstTotals = useMemo(
    () => ({
      netGold: filteredInvoices.reduce((s, inv) => s + (inv.totalNetGoldWeightGrams || 0), 0),
      taxable: filteredInvoices.reduce((s, inv) => s + (inv.taxableAmountINR || 0), 0),
      gst: filteredInvoices.reduce((s, inv) => s + (inv.totalGstINR || 0), 0),
      grandTotal: filteredInvoices.reduce((s, inv) => s + (inv.grandTotalINR || 0), 0),
    }),
    [filteredInvoices]
  );

  const reconciledJobs = useMemo(() => filteredJobs.filter((j) => j.isReconciled), [filteredJobs]);

  const notifyExport = (msg: string) => {
    setShowExportSuccess(msg);
    setTimeout(() => setShowExportSuccess(null), 3200);
  };

  const resetFilters = () => {
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
    setExactDate('');
    setStartDate('');
    setEndDate('');
    setShowCustomRange(false);
    setSearchTerm('');
    setSelectedCustomerId('ALL');
    setSelectedKarigarId('ALL');
    setIoDirectionFilter('ALL');
    setIoPurityFilter('ALL');
  };

  // CSV Export Dispatcher
  const handleDownloadActiveCSV = () => {
    const safeTenant = tenantName.replace(/\s+/g, '_');
    const safePeriod = periodSummaryLabel.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (selectedReport === 'all_tx') {
      const rows = generateAllTransactionsCSV(unifiedTransactions, periodSummaryLabel, tenantName);
      downloadCSV(`${safeTenant}_All_Transactions_${safePeriod}.csv`, rows);
      notifyExport(`${ui.tabAllTransactions} CSV (${unifiedTransactions.length})`);
    } else if (selectedReport === 'customer') {
      const cName =
        selectedCustomerId === 'ALL'
          ? ir.allCustomersSummary
          : customerSummaries.find((c) => c.id === selectedCustomerId)?.name || 'Customer';
      const summariesToExport =
        selectedCustomerId === 'ALL'
          ? customerSummaries
          : customerSummaries.filter((c) => c.id === selectedCustomerId);
      const rows = generateCustomerGivenTakenCSV(
        customerTransactions,
        summariesToExport,
        periodSummaryLabel,
        cName,
        tenantName
      );
      downloadCSV(
        `${safeTenant}_Customer_Given_Taken_${cName.replace(/\s+/g, '_')}_${safePeriod}.csv`,
        rows
      );
      notifyExport(`${ir.tabCustomerReport} CSV (${customerTransactions.length})`);
    } else if (selectedReport === 'karigar') {
      if (selectedKarigarId === 'ALL' && karigarSubView === 'wastage') {
        const rows = generateWastageAuditCSV(reconciledJobs, tenantName);
        downloadCSV(`${safeTenant}_Wastage_Audit_${safePeriod}.csv`, rows);
        notifyExport(`${ui.tabWastageReport} CSV (${reconciledJobs.length})`);
      } else {
        const kName =
          selectedKarigarId === 'ALL'
            ? ui.allKarigars
            : karigarSummaries.find((k) => k.id === selectedKarigarId)?.name || 'Karigar';
        const rows = generateKarigarTransactionsCSV(
          karigarTransactions,
          selectedKarigarId === 'ALL'
            ? karigarsList
            : karigarsList.filter((k) => k.id === selectedKarigarId),
          periodSummaryLabel,
          kName,
          tenantName
        );
        downloadCSV(
          `${safeTenant}_Karigar_Given_Taken_${kName.replace(/\s+/g, '_')}_${safePeriod}.csv`,
          rows
        );
        notifyExport(`${ir.tabKarigarReport} CSV (${karigarTransactions.length})`);
      }
    } else if (selectedReport === 'gold_in_out') {
      if (ioDirectionFilter === 'LEDGER') {
        const rows = generateLedgerCSV(filteredLedger, tenantName);
        downloadCSV(`${safeTenant}_Gold_Ledger_${safePeriod}.csv`, rows);
        notifyExport(`${ui.tabLedgerReport} CSV (${filteredLedger.length})`);
      } else {
        const onlyInOut = goldInOutEntries.filter(
          (e): e is GoldLedgerEntry & { ioDirection: 'IN' | 'OUT' } =>
            e.ioDirection === 'IN' || e.ioDirection === 'OUT'
        );
        const rows = generateGoldInOutCSV(onlyInOut, periodSummaryLabel, tenantName);
        downloadCSV(`${safeTenant}_Gold_In_Out_${safePeriod}.csv`, rows);
        notifyExport(`${ui.tabGoldInOutReport} CSV (${onlyInOut.length})`);
      }
    } else if (selectedReport === 'melting') {
      const rows = generateMeltingReportCSV(filteredMeltingBatches, periodSummaryLabel, tenantName);
      downloadCSV(`${safeTenant}_Melting_Report_${safePeriod}.csv`, rows);
      notifyExport(`${ui.tabMeltingReport} CSV (${filteredMeltingBatches.length})`);
    } else if (selectedReport === 'stock') {
      const rows = generateStockSummaryCSV(stockSummary, goldRates, tenantName);
      downloadCSV(`${safeTenant}_Stock_Summary_${safePeriod}.csv`, rows);
      notifyExport(`${ui.tabStockReport} CSV`);
    } else if (selectedReport === 'gst') {
      const rows = generateInvoicesCSV(filteredInvoices, tenantName);
      downloadCSV(`${safeTenant}_GST_Bills_${safePeriod}.csv`, rows);
      notifyExport(`${ui.tabGstReport} CSV (${filteredInvoices.length})`);
    }
  };

  // Hidden Iframe Print (Clean, isolated, no window.open)
  const handlePrintReport = () => {
    if (!printAreaRef.current) return;
    const htmlContent = printAreaRef.current.innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${tenantName} - ${ui.reportsTitle}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 24px; font-size: 12px; }
            h1, h2, h3 { margin: 0 0 6px 0; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 18px; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; font-weight: 700; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-mono { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
            button, select { display: none !important; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>${tenantName}</h2>
              <div>${ui.reportsTitle} · ${periodSummaryLabel}</div>
            </div>
            <div>${new Date().toLocaleDateString()}</div>
          </div>
          ${htmlContent}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1500);
    }, 250);
  };

  const hasActiveFilter =
    selectedYear !== 'ALL' ||
    selectedMonth !== 'ALL' ||
    Boolean(exactDate) ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(searchTerm);

  const reportTabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'all_tx', label: ui.tabAllTransactions },
    { id: 'customer', label: ir.tabCustomerReport.split(' (')[0] },
    { id: 'karigar', label: ui.tabKarigarReport },
    { id: 'gold_in_out', label: ui.tabGoldInOutReport },
    { id: 'melting', label: ui.tabMeltingReport },
    { id: 'stock', label: ui.tabStockReport },
    { id: 'gst', label: ui.tabGstReport },
  ];

  return (
    <div className="space-y-5 text-slate-900 dark:text-slate-100">
      {/* 1. CLEAN PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{ui.reportsTitle}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {tenantName} · {periodSummaryLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{ui.printReport}</span>
          </button>
          <button
            onClick={handleDownloadActiveCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-[#E5C158] dark:text-slate-950 font-semibold rounded-lg text-xs transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{ui.downloadCsv}</span>
          </button>
        </div>
      </div>

      {showExportSuccess && (
        <div className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">{showExportSuccess}</span>
        </div>
      )}

      {/* 2. CLEAN HORIZONTAL UNDERLINE TABS */}
      <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <nav className="flex items-center gap-1 min-w-max" aria-label="Reports">
          {reportTabs.map((tab) => {
            const active = selectedReport === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedReport(tab.id)}
                className={`px-3.5 py-2.5 text-xs sm:text-sm border-b-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[#101C32] text-[#101C32] dark:text-slate-100 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 font-medium'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. COMPACT SINGLE-ROW FILTER BAR (Shown on date-filtered reports) */}
      {selectedReport !== 'stock' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={ui.searchPlaceholder}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white focus:border-[#C9A24A]"
              />
            </div>

            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setExactDate('');
              }}
              aria-label={ui.selectYear}
              className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#C9A24A]"
            >
              <option value="ALL">{ui.allYears}</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            {/* Month Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setExactDate('');
              }}
              aria-label={ui.selectMonth}
              className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#C9A24A]"
            >
              <option value="ALL">{ui.allMonths}</option>
              {ui.months.map((mName, idx) => {
                const mCode = String(idx + 1).padStart(2, '0');
                return (
                  <option key={mCode} value={mCode}>
                    {mName}
                  </option>
                );
              })}
            </select>

            {/* Single Exact Date Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">{ui.date}:</span>
              <input
                type="date"
                value={exactDate}
                onChange={(e) => {
                  setExactDate(e.target.value);
                  if (e.target.value) {
                    setStartDate('');
                    setEndDate('');
                  }
                }}
                aria-label={ui.exactDate}
                className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>

            {/* Optional Date Range Toggle */}
            <button
              type="button"
              onClick={() => setShowCustomRange((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap ${
                showCustomRange || startDate || endDate
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>
                {ui.fromDate} – {ui.toDate}
              </span>
            </button>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{ui.clearFilters}</span>
              </button>
            )}
          </div>

          {/* Expandable Custom Date Range Row (only when requested) */}
          {(showCustomRange || startDate || endDate) && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span className="font-medium">{ui.fromDate}:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setExactDate('');
                  }}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                />
              </label>
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span className="font-medium">{ui.toDate}:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setExactDate('');
                  }}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* 4. PRINTABLE FOCUSED REPORT AREA */}
      <div ref={printAreaRef} className="space-y-4">
        {/* =========================================================
            REPORT 1: ALL TRANSACTIONS
           ========================================================= */}
        {selectedReport === 'all_tx' && (
          <div className="space-y-4">
            {/* Single-Elevation Divided Summary Strip */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.periodGoldIn}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                  +{formatGrams(periodTotals.goldInFine, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  {ui.netWt}: {formatGrams(periodTotals.goldInNet, 2)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.periodGoldOut}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 mt-1">
                  -{formatGrams(periodTotals.goldOutFine, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  {ui.netWt}: {formatGrams(periodTotals.goldOutNet, 2)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.periodNetMovement}</div>
                <div
                  className={`text-lg font-bold font-mono tabular-nums mt-1 ${
                    periodTotals.netGoldFine >= 0 ? 'text-[#9A7426] dark:text-[#E5C158]' : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {periodTotals.netGoldFine >= 0 ? '+' : ''}
                  {formatGrams(periodTotals.netGoldFine, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  999.9 {t.fineGold}
                </div>
              </div>

              {showRupees ? (
                <div className="p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{ui.periodCashNet}</div>
                  <div
                    className={`text-lg font-bold font-mono tabular-nums mt-1 ${
                      periodTotals.cashNet >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {formatINR(periodTotals.cashNet)}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                    +{formatINR(periodTotals.cashIn)} · -{formatINR(periodTotals.cashOut)}
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">{ui.recordsCount}</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                    {unifiedTransactions.length}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{periodSummaryLabel}</div>
                </div>
              )}
            </div>

            {/* Clean 6-Column Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{ui.tabAllTransactions}</h2>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {unifiedTransactions.length} {ui.recordsCount}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="px-4 py-3">{ui.date}</th>
                      <th className="px-4 py-3">{ui.partyOrKarigar}</th>
                      <th className="px-4 py-3">{ui.movementDirection}</th>
                      <th className="px-4 py-3 text-center">{ui.purity}</th>
                      <th className="px-4 py-3 text-right">{ui.netWt}</th>
                      <th className="px-4 py-3 text-right">{ui.fineWt}</th>
                      {showRupees && <th className="px-4 py-3 text-right">{ui.amountInr}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {unifiedTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={showRupees ? 7 : 6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                          {ui.noRecordsFound}
                        </td>
                      </tr>
                    ) : (
                      unifiedTransactions.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-medium">{r.date}</div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">{r.refNo}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{r.partyName}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {r.typeLabel}
                              {r.notes ? ` · ${r.notes}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-semibold">
                            {r.direction === 'IN' ? (
                              <span className="text-emerald-700 dark:text-emerald-400">↓ {ui.goldInLabel}</span>
                            ) : r.direction === 'OUT' ? (
                              <span className="text-rose-700 dark:text-rose-400">↑ {ui.goldOutLabel}</span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400">⇄ {ui.internalMovement}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono tabular-nums text-slate-700 dark:text-slate-300 font-medium">
                            {r.purity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                            {r.netGrams > 0 ? formatGrams(r.netGrams, 3) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">
                            {r.fineGrams > 0 ? formatGrams(r.fineGrams, 3) : '—'}
                          </td>
                          {showRupees && (
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                              {r.amountINR > 0 ? formatINR(r.amountINR) : '—'}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            REPORT 2: CUSTOMER REPORT (MASTER LIST -> INDIVIDUAL GIVEN / TAKEN)
           ========================================================= */}
        {selectedReport === 'customer' && (
          <div className="space-y-4">
            {/* Customer Navigation & Mode Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                {selectedCustomerId !== 'ALL' && (
                  <button
                    onClick={() => setSelectedCustomerId('ALL')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{ir.allCustomersSummary}</span>
                  </button>
                )}
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeCustomerSummary ? activeCustomerSummary.name : ir.customerSummaryTitle}
                  </h2>
                  {activeCustomerSummary && (
                    <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {activeCustomerSummary.accountCode} · {activeCustomerSummary.phone}
                      {activeCustomerSummary.city ? ` · ${activeCustomerSummary.city}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedCustomerId !== 'ALL' && (
                  <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setIndividualLayout('split')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        individualLayout === 'split'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {ir.givenLabel} / {ir.takenLabel}
                    </button>
                    <button
                      onClick={() => setIndividualLayout('passbook')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        individualLayout === 'passbook'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {ir.chronologicalStatement.split(' (')[0]}
                    </button>
                  </div>
                )}

                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  aria-label={ir.selectCustomer}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                >
                  <option value="ALL">{ir.allCustomersSummary}</option>
                  {customerSummaries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.accountCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clean Divided Summary Strip */}
            <div
              className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 ${
                showRupees ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
              } divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800`}
            >
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ir.goldGiven}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                  +{formatGrams(customerTotals.givenNet, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  999.9 {t.fineGold}: {formatGrams(customerTotals.givenFine, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ir.goldTaken}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 mt-1">
                  -{formatGrams(customerTotals.takenNet, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  999.9 {t.fineGold}: {formatGrams(customerTotals.takenFine, 3)}
                </div>
              </div>

              <div className="p-4">
                {(() => {
                  const totalPositiveCustody = Number(
                    customerSummaries
                      .reduce((s, c) => s + Math.max(0, c.custodyGoldGrams || 0), 0)
                      .toFixed(3)
                  );
                  const totalNegativeDue = Number(
                    customerSummaries
                      .reduce((s, c) => s + Math.abs(Math.min(0, c.custodyGoldGrams || 0)), 0)
                      .toFixed(3)
                  );

                  if (activeCustomerSummary) {
                    const bal = Number((activeCustomerSummary.custodyGoldGrams || 0).toFixed(3));
                    if (bal < 0) {
                      return (
                        <>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Gold Due</div>
                          <div className="text-lg font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 mt-1">
                            {formatGrams(Math.abs(bal), 3)}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
                            {ir.netGoldBalance}: −{formatGrams(Math.abs(bal), 3)}
                          </div>
                        </>
                      );
                    }
                    if (bal > 0) {
                      return (
                        <>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{ir.customerCustodyBalance}</div>
                          <div className="text-lg font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158] mt-1">
                            +{formatGrams(bal, 3)}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                            {ir.netGoldBalance}: +{formatGrams(bal, 3)}
                          </div>
                        </>
                      );
                    }
                    return (
                      <>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{ir.customerCustodyBalance}</div>
                        <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                          0.000 g
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                          {ir.netGoldBalance}: 0.000 g
                        </div>
                      </>
                    );
                  }

                  return (
                    <>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{ir.customerCustodyBalance}</div>
                      <div className="text-lg font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158] mt-1">
                        {formatGrams(totalPositiveCustody, 3)}
                      </div>
                      <div
                        className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                          totalNegativeDue > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {totalNegativeDue > 0
                          ? `Gold Due: ${formatGrams(totalNegativeDue, 3)}`
                          : 'Gold Due: 0.000 g'}
                      </div>
                    </>
                  );
                })()}
              </div>

              {showRupees && (
                <div className="p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {ir.cashGiven} / {ir.cashTaken}
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                    {formatINR(customerTotals.givenCash)}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                    {ir.cashTaken}: {formatINR(customerTotals.takenCash)}
                  </div>
                </div>
              )}
            </div>

            {/* MODE A: ALL CUSTOMERS SUMMARY TABLE (Clean Master View) */}
            {selectedCustomerId === 'ALL' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="px-4 py-3">{ui.customerName}</th>
                        <th className="px-4 py-3 text-right">{ir.goldGiven}</th>
                        <th className="px-4 py-3 text-right">{ir.goldTaken}</th>
                        {showRupees && <th className="px-4 py-3 text-right">{ir.cashGiven}</th>}
                        {showRupees && <th className="px-4 py-3 text-right">{ir.cashTaken}</th>}
                        <th className="px-4 py-3 text-right">{ir.customerCustodyBalance}</th>
                        <th className="px-4 py-3 text-right">{ui.action}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {customerSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={showRupees ? 7 : 5} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                            {ui.noRecordsFound}
                          </td>
                        </tr>
                      ) : (
                        customerSummaries.map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedCustomerId(c.id)}
                            className="hover:bg-slate-50/90 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                                {c.accountCode} · {c.phone}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                              {c.givenNetGrams > 0 ? `+${formatGrams(c.givenNetGrams, 3)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                              {c.takenNetGrams > 0 ? `-${formatGrams(c.takenNetGrams, 3)}` : '—'}
                            </td>
                            {showRupees && (
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                                {c.givenCashINR > 0 ? formatINR(c.givenCashINR) : '—'}
                              </td>
                            )}
                            {showRupees && (
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 font-medium">
                                {c.takenAmountINR > 0 ? formatINR(c.takenAmountINR) : '—'}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                              {c.custodyGoldGrams > 0 ? (
                                <span className="text-[#9A7426] dark:text-[#E5C158]">+{formatGrams(c.custodyGoldGrams, 3)}</span>
                              ) : c.custodyGoldGrams < 0 ? (
                                <span className="text-rose-700 dark:text-rose-400">
                                  {formatGrams(Math.abs(c.custodyGoldGrams), 3)} Due
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 font-normal">0.000 g</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCustomerId(c.id);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#101C32] dark:text-slate-100 hover:text-[#9A7426] dark:hover:text-[#E5C158] transition cursor-pointer whitespace-nowrap"
                              >
                                <span>{ir.viewIndividualReport}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODE B1: INDIVIDUAL CUSTOMER — SIDE-BY-SIDE GIVEN vs TAKEN */}
            {selectedCustomerId !== 'ALL' && individualLayout === 'split' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                {/* GIVEN BY CUSTOMER */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{ir.givenByCustomerTitle}</span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                        {customerGivenRows.length}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                          <tr>
                            <th className="px-3.5 py-2.5">{ui.date}</th>
                            <th className="px-3.5 py-2.5">{ir.itemOrDetails}</th>
                            <th className="px-3.5 py-2.5 text-center">{ui.purity}</th>
                            <th className="px-3.5 py-2.5 text-right">{ui.netWt}</th>
                            {showRupees && <th className="px-3.5 py-2.5 text-right">{ir.cashGiven}</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {customerGivenRows.length === 0 ? (
                            <tr>
                              <td colSpan={showRupees ? 5 : 4} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                                {ir.noGivenEntries}
                              </td>
                            </tr>
                          ) : (
                            customerGivenRows.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {r.date}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">{r.categoryLabel}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {r.refNo} · {r.itemDetails}
                                  </div>
                                </td>
                                <td className="px-3.5 py-2.5 text-center font-mono text-slate-700 dark:text-slate-300">{r.purity}</td>
                                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                                  {r.netGrams > 0 ? `+${formatGrams(r.netGrams, 3)}` : '—'}
                                </td>
                                {showRupees && (
                                  <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                                    {r.amountINR > 0 ? formatINR(r.amountINR) : '—'}
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{ir.totalGiven}</span>
                    <div className="flex items-center gap-3 font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
                      <span>+{formatGrams(customerTotals.givenNet, 3)}</span>
                      {showRupees && <span>· {formatINR(customerTotals.givenCash)}</span>}
                    </div>
                  </div>
                </div>

                {/* TAKEN BY CUSTOMER */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                        <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>{ir.takenByCustomerTitle}</span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                        {customerTakenRows.length}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                          <tr>
                            <th className="px-3.5 py-2.5">{ui.date}</th>
                            <th className="px-3.5 py-2.5">{ir.itemOrDetails}</th>
                            <th className="px-3.5 py-2.5 text-center">{ui.purity}</th>
                            <th className="px-3.5 py-2.5 text-right">{ui.netWt}</th>
                            {showRupees && <th className="px-3.5 py-2.5 text-right">{ir.cashTaken}</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {customerTakenRows.length === 0 ? (
                            <tr>
                              <td colSpan={showRupees ? 5 : 4} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                                {ir.noTakenEntries}
                              </td>
                            </tr>
                          ) : (
                            customerTakenRows.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {r.date}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">{r.categoryLabel}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {r.refNo} · {r.itemDetails}
                                  </div>
                                </td>
                                <td className="px-3.5 py-2.5 text-center font-mono text-slate-700 dark:text-slate-300">{r.purity}</td>
                                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                                  {r.netGrams > 0 ? `-${formatGrams(r.netGrams, 3)}` : '—'}
                                </td>
                                {showRupees && (
                                  <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                                    {r.amountINR > 0 ? formatINR(r.amountINR) : '—'}
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{ir.totalTaken}</span>
                    <div className="flex items-center gap-3 font-mono tabular-nums text-rose-800 dark:text-rose-300">
                      <span>-{formatGrams(customerTotals.takenNet, 3)}</span>
                      {showRupees && <span>· {formatINR(customerTotals.takenCash)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODE B2: INDIVIDUAL CUSTOMER — CHRONOLOGICAL PASSBOOK */}
            {selectedCustomerId !== 'ALL' && individualLayout === 'passbook' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{ir.chronologicalStatement}</h3>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {customerTransactions.length} {ui.recordsCount}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="px-4 py-3">{ui.date}</th>
                        <th className="px-4 py-3">{ir.itemOrDetails}</th>
                        <th className="px-4 py-3">{ui.movementDirection}</th>
                        <th className="px-4 py-3 text-center">{ui.purity}</th>
                        <th className="px-4 py-3 text-right">{ir.goldGiven}</th>
                        <th className="px-4 py-3 text-right">{ir.goldTaken}</th>
                        {showRupees && <th className="px-4 py-3 text-right">{ui.amountInr}</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {customerTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={showRupees ? 7 : 6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                            {ui.noRecordsFound}
                          </td>
                        </tr>
                      ) : (
                        customerTransactions.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{r.date}</div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">{r.refNo}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900 dark:text-slate-100">{r.itemDetails}</div>
                              {r.notes && <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.notes}</div>}
                            </td>
                            <td className="px-4 py-3 font-semibold whitespace-nowrap">
                              {r.side === 'GIVEN' ? (
                                <span className="text-emerald-700 dark:text-emerald-400">↓ {ir.givenLabel}</span>
                              ) : (
                                <span className="text-rose-700 dark:text-rose-400">↑ {ir.takenLabel}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-slate-700 dark:text-slate-300">{r.purity}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                              {r.side === 'GIVEN' && r.netGrams > 0 ? `+${formatGrams(r.netGrams, 3)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                              {r.side === 'TAKEN' && r.netGrams > 0 ? `-${formatGrams(r.netGrams, 3)}` : '—'}
                            </td>
                            {showRupees && (
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                {r.amountINR > 0 ? formatINR(r.amountINR) : '—'}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            REPORT 3: KARIGAR REPORT (MASTER LIST -> INDIVIDUAL GIVEN / TAKEN + GHAT)
           ========================================================= */}
        {selectedReport === 'karigar' && (
          <div className="space-y-4">
            {/* Karigar Navigation & Mode Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                {selectedKarigarId !== 'ALL' && (
                  <button
                    onClick={() => setSelectedKarigarId('ALL')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{ir.allKarigarsSummary}</span>
                  </button>
                )}
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeKarigarSummary ? activeKarigarSummary.name : ir.karigarSummaryTitle}
                  </h2>
                  {activeKarigarSummary && (
                    <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {activeKarigarSummary.code} · {activeKarigarSummary.phone} · {activeKarigarSummary.skill}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedKarigarId === 'ALL' ? (
                  <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setKarigarSubView('summary')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        karigarSubView === 'summary'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {ir.allKarigarsSummary}
                    </button>
                    <button
                      onClick={() => setKarigarSubView('wastage')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        karigarSubView === 'wastage'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {ui.tabWastageReport} ({reconciledJobs.length})
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setIndividualLayout('split')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        individualLayout === 'split'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {ir.givenLabel} / {ir.takenLabel}
                    </button>
                    <button
                      onClick={() => setIndividualLayout('passbook')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        individualLayout === 'passbook'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {ir.chronologicalStatement.split(' (')[0]}
                    </button>
                  </div>
                )}

                <select
                  value={selectedKarigarId}
                  onChange={(e) => setSelectedKarigarId(e.target.value)}
                  aria-label={ir.selectKarigar}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                >
                  <option value="ALL">{ir.allKarigarsSummary}</option>
                  {karigarSummaries.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clean Divided Summary Strip */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.karigarGoldGiven}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                  {formatGrams(karigarTotals.givenNet, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  999.9 {t.fineGold}: {formatGrams(karigarTotals.givenFine, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ir.ornamentsTaken}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                  {formatGrams(karigarTotals.ornamentsNet, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  {ir.scrapTaken}: {formatGrams(karigarTotals.scrapGrams, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ir.ghatSettled}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-1">
                  {formatGrams(karigarTotals.ghatLoss, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  {reconciledJobs.length} {ui.completedJobs}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ir.pendingWithKarigar}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158] mt-1">
                  {formatGrams(
                    activeKarigarSummary
                      ? activeKarigarSummary.goldInHandGrams
                      : karigarSummaries.reduce((s, k) => s + k.goldInHandGrams, 0),
                    3
                  )}
                </div>
                {showRupees && (
                  <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                    {ui.karigarCashPaid}: {formatINR(karigarTotals.cashPaid)}
                  </div>
                )}
              </div>
            </div>

            {/* MODE A1: ALL KARIGARS SUMMARY TABLE */}
            {selectedKarigarId === 'ALL' && karigarSubView === 'summary' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="px-4 py-3">{ui.partyOrKarigar}</th>
                        <th className="px-4 py-3 text-right">{ir.goldGiven}</th>
                        <th className="px-4 py-3 text-right">{ir.ornamentsTaken}</th>
                        <th className="px-4 py-3 text-right">{ir.scrapTaken}</th>
                        <th className="px-4 py-3 text-right">{ir.ghatSettled}</th>
                        <th className="px-4 py-3 text-right">{ir.pendingWithKarigar}</th>
                        {showRupees && <th className="px-4 py-3 text-right">{ui.karigarCashPaid}</th>}
                        <th className="px-4 py-3 text-right">{ui.action}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {karigarSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={showRupees ? 8 : 7} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                            {ui.noRecordsFound}
                          </td>
                        </tr>
                      ) : (
                        karigarSummaries.map((k) => (
                          <tr
                            key={k.id}
                            onClick={() => setSelectedKarigarId(k.id)}
                            className="hover:bg-slate-50/90 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{k.name}</div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                                {k.code} · {k.skill}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                              {k.givenNetGrams > 0 ? formatGrams(k.givenNetGrams, 3) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                              {k.ornamentsTakenNetGrams > 0 ? formatGrams(k.ornamentsTakenNetGrams, 3) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {k.scrapTakenGrams > 0 ? formatGrams(k.scrapTakenGrams, 3) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                              {k.ghatLossGrams > 0 ? formatGrams(k.ghatLossGrams, 3) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">
                              {formatGrams(k.goldInHandGrams, 3)}
                            </td>
                            {showRupees && (
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                                {k.givenCashINR > 0 ? formatINR(k.givenCashINR) : '—'}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedKarigarId(k.id);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#101C32] dark:text-slate-100 hover:text-[#9A7426] dark:hover:text-[#E5C158] transition cursor-pointer whitespace-nowrap"
                              >
                                <span>{ir.viewIndividualReport}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODE A2: GHAT / WASTAGE AUDIT TABLE */}
            {selectedKarigarId === 'ALL' && karigarSubView === 'wastage' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{ui.tabWastageReport}</h3>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {reconciledJobs.length} {ui.recordsCount}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="px-4 py-3">{ui.challanRef}</th>
                        <th className="px-4 py-3">{ui.partyOrKarigar}</th>
                        <th className="px-4 py-3 text-right">{ui.issuedGold}</th>
                        <th className="px-4 py-3 text-right">{ui.returnedOrnament}</th>
                        <th className="px-4 py-3 text-right">{ui.returnedScrap}</th>
                        <th className="px-4 py-3 text-right">{ui.actualLoss}</th>
                        <th className="px-4 py-3 text-right">{ui.agreedWastage}</th>
                        <th className="px-4 py-3 text-right">{ui.excessLoss}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reconciledJobs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                            {ui.noRecordsFound}
                          </td>
                        </tr>
                      ) : (
                        reconciledJobs.map((j) => (
                          <tr key={j.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                              {j.jobNo}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900 dark:text-slate-100">{j.karigarName}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">{j.jewelleryType}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums">
                              {formatGrams(j.issuedNetWeightGrams)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                              {formatGrams(j.returnedJewelleryNetWeight)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {formatGrams(j.returnedScrapWeightGrams)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                              {formatGrams(j.actualLossGrams)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                              {formatGrams(j.allowedWastageGrams)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-bold">
                              <span className={j.excessLossGrams > 0.05 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}>
                                {formatGrams(j.excessLossGrams)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODE B1: INDIVIDUAL KARIGAR — SIDE-BY-SIDE GIVEN vs TAKEN */}
            {selectedKarigarId !== 'ALL' && individualLayout === 'split' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                {/* GIVEN TO KARIGAR */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                        <ArrowUpRight className="w-4 h-4 text-[#9A7426] dark:text-[#E5C158]" />
                        <span>{ir.givenToKarigarTitle}</span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                        {karigarGivenRows.length}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                          <tr>
                            <th className="px-3.5 py-2.5">{ui.date}</th>
                            <th className="px-3.5 py-2.5">{ir.itemOrDetails}</th>
                            <th className="px-3.5 py-2.5 text-center">{ui.purity}</th>
                            <th className="px-3.5 py-2.5 text-right">{ui.netWt}</th>
                            {showRupees && <th className="px-3.5 py-2.5 text-right">{ir.cashGiven}</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {karigarGivenRows.length === 0 ? (
                            <tr>
                              <td colSpan={showRupees ? 5 : 4} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                                {ir.noGivenEntries}
                              </td>
                            </tr>
                          ) : (
                            karigarGivenRows.map((kt) => (
                              <tr key={kt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {kt.date}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">{kt.categoryLabel}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {kt.refNo}
                                    {kt.notes ? ` · ${kt.notes}` : ''}
                                  </div>
                                </td>
                                <td className="px-3.5 py-2.5 text-center font-mono text-slate-700 dark:text-slate-300">{kt.purity}</td>
                                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                                  {kt.issuedNetGrams > 0 ? formatGrams(kt.issuedNetGrams, 3) : '—'}
                                </td>
                                {showRupees && (
                                  <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                                    {kt.cashPaidINR !== 0 ? formatINR(kt.cashPaidINR) : '—'}
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{ir.totalGiven}</span>
                    <div className="flex items-center gap-3 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      <span>{formatGrams(karigarTotals.givenNet, 3)}</span>
                      {showRupees && <span>· {formatINR(karigarTotals.cashPaid)}</span>}
                    </div>
                  </div>
                </div>

                {/* TAKEN FROM KARIGAR */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{ir.takenFromKarigarTitle}</span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                        {karigarTakenRows.length}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                          <tr>
                            <th className="px-3.5 py-2.5">{ui.date}</th>
                            <th className="px-3.5 py-2.5">{ir.itemOrDetails}</th>
                            <th className="px-3.5 py-2.5 text-right">{ir.ornamentsTaken}</th>
                            <th className="px-3.5 py-2.5 text-right">{ir.scrapTaken}</th>
                            <th className="px-3.5 py-2.5 text-right">{ir.ghatSettled}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {karigarTakenRows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                                {ir.noTakenEntries}
                              </td>
                            </tr>
                          ) : (
                            karigarTakenRows.map((kt) => (
                              <tr key={kt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {kt.date}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">{kt.categoryLabel}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {kt.refNo} · {kt.purity}
                                    {kt.notes ? ` · ${kt.notes}` : ''}
                                  </div>
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                                  {kt.returnedOrnamentNetGrams > 0
                                    ? formatGrams(kt.returnedOrnamentNetGrams, 3)
                                    : '—'}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                                  {kt.returnedScrapGrams > 0 ? formatGrams(kt.returnedScrapGrams, 3) : '—'}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                                  {kt.ghatLossGrams > 0 ? formatGrams(kt.ghatLossGrams, 3) : '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{ir.totalTaken}</span>
                    <div className="flex items-center gap-3 font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
                      <span>{formatGrams(karigarTotals.ornamentsNet, 3)}</span>
                      <span className="text-slate-600 dark:text-slate-400">+ {formatGrams(karigarTotals.scrapGrams, 3)}</span>
                      <span className="text-amber-700 dark:text-amber-400">+ {formatGrams(karigarTotals.ghatLoss, 3)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODE B2: INDIVIDUAL KARIGAR — CHRONOLOGICAL PASSBOOK */}
            {selectedKarigarId !== 'ALL' && individualLayout === 'passbook' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{ir.chronologicalStatement}</h3>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {karigarTransactions.length} {ui.recordsCount}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="px-4 py-3">{ui.date}</th>
                        <th className="px-4 py-3">{ir.itemOrDetails}</th>
                        <th className="px-4 py-3 text-center">{ui.purity}</th>
                        <th className="px-4 py-3 text-right">{ir.goldGiven}</th>
                        <th className="px-4 py-3 text-right">{ir.ornamentsTaken}</th>
                        <th className="px-4 py-3 text-right">{ir.scrapTaken}</th>
                        <th className="px-4 py-3 text-right">{ir.ghatSettled}</th>
                        {showRupees && <th className="px-4 py-3 text-right">{ui.karigarCashPaid}</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {karigarTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={showRupees ? 8 : 7} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                            {ui.noRecordsFound}
                          </td>
                        </tr>
                      ) : (
                        karigarTransactions.map((kt) => (
                          <tr key={kt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{kt.date}</div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">{kt.refNo}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900 dark:text-slate-100">{kt.categoryLabel}</div>
                              {kt.notes && <div className="text-[11px] text-slate-500 dark:text-slate-400">{kt.notes}</div>}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-slate-700 dark:text-slate-300">{kt.purity}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                              {kt.issuedNetGrams > 0 ? formatGrams(kt.issuedNetGrams, 3) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                              {kt.returnedOrnamentNetGrams > 0
                                ? formatGrams(kt.returnedOrnamentNetGrams, 3)
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {kt.returnedScrapGrams > 0 ? formatGrams(kt.returnedScrapGrams, 3) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                              {kt.ghatLossGrams > 0 ? formatGrams(kt.ghatLossGrams, 3) : '—'}
                            </td>
                            {showRupees && (
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                {kt.cashPaidINR !== 0 ? formatINR(kt.cashPaidINR) : '—'}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            REPORT 4: GOLD IN & OUT (+ FULL GOLD LEDGER OPTION)
           ========================================================= */}
        {selectedReport === 'gold_in_out' && (
          <div className="space-y-4">
            {/* Single-Elevation Divided Summary Strip */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.periodGoldIn}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                  +{formatGrams(periodTotals.goldInFine, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  {ui.netWt}: {formatGrams(periodTotals.goldInNet, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.periodGoldOut}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 mt-1">
                  -{formatGrams(periodTotals.goldOutFine, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  {ui.netWt}: {formatGrams(periodTotals.goldOutNet, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.periodNetMovement}</div>
                <div
                  className={`text-lg font-bold font-mono tabular-nums mt-1 ${
                    periodTotals.netGoldFine >= 0 ? 'text-[#9A7426] dark:text-[#E5C158]' : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {periodTotals.netGoldFine >= 0 ? '+' : ''}
                  {formatGrams(periodTotals.netGoldFine, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  999.9 {t.fineGold}
                </div>
              </div>
            </div>

            {/* Clean Table Card with Inline Filter Controls */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 self-start">
                  {(
                    [
                      { id: 'ALL', label: ui.all },
                      { id: 'IN', label: `↓ ${ui.goldInLabel}` },
                      { id: 'OUT', label: `↑ ${ui.goldOutLabel}` },
                      { id: 'LEDGER', label: ui.tabLedgerReport },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setIoDirectionFilter(opt.id)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        ioDirectionFilter === opt.id
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{ui.purity}:</span>
                  <select
                    value={ioPurityFilter}
                    onChange={(e) => setIoPurityFilter(e.target.value as any)}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                  >
                    <option value="ALL">{ui.all}</option>
                    <option value="24K">24K (999.9)</option>
                    <option value="22K">22K (916)</option>
                    <option value="18K">18K (750)</option>
                    <option value="14K">14K (585)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="px-4 py-3">{ui.date}</th>
                      <th className="px-4 py-3">{ui.partyOrKarigar}</th>
                      <th className="px-4 py-3">{ui.movementDirection}</th>
                      <th className="px-4 py-3 text-center">{ui.purity}</th>
                      <th className="px-4 py-3 text-right">{ui.netWt}</th>
                      <th className="px-4 py-3 text-right">{ui.fineWt}</th>
                      {showRupees && <th className="px-4 py-3 text-right">{ui.amountInr}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {goldInOutEntries.length === 0 ? (
                      <tr>
                        <td colSpan={showRupees ? 7 : 6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                          {ui.noRecordsFound}
                        </td>
                      </tr>
                    ) : (
                      goldInOutEntries.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200 font-medium">
                              {e.date.split('T')[0]}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                              {e.transactionNo}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {e.counterpartyName ||
                                `${formatReadableCode(e.sourceAccount)} → ${formatReadableCode(
                                  e.destinationAccount
                                )}`}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {formatReadableCode(e.type)}
                              {e.notes ? ` · ${e.notes}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold whitespace-nowrap">
                            {e.ioDirection === 'IN' ? (
                              <span className="text-emerald-700 dark:text-emerald-400">↓ {ui.goldInLabel}</span>
                            ) : e.ioDirection === 'OUT' ? (
                              <span className="text-rose-700 dark:text-rose-400">↑ {ui.goldOutLabel}</span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400">⇄ {ui.internalMovement}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-slate-700 dark:text-slate-300 font-medium">
                            {e.purity}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatGrams(e.netWeightGrams, 3)}
                            </div>
                            {e.grossWeightGrams !== e.netWeightGrams && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                {t.grossWeight}: {formatGrams(e.grossWeightGrams, 3)}
                              </div>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono tabular-nums font-bold ${
                              e.ioDirection === 'IN'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : e.ioDirection === 'OUT'
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-[#9A7426] dark:text-[#E5C158]'
                            }`}
                          >
                            {e.ioDirection === 'IN' ? '+' : e.ioDirection === 'OUT' ? '-' : ''}
                            {formatGrams(e.fineGoldWeightGrams, 3)}
                          </td>
                          {showRupees && (
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                              {e.valuationINR ? formatINR(e.valuationINR) : '—'}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            REPORT 5: MELTING & REFINING REPORT
           ========================================================= */}
        {selectedReport === 'melting' && (
          <div className="space-y-4">
            {/* Single-Elevation Divided Summary Strip */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.totalInputGross}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                  {formatGrams(meltingTotals.inputGross, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  {filteredMeltingBatches.length} {ui.recordsCount}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.totalInputFine}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158] mt-1">
                  {formatGrams(meltingTotals.inputFine, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.totalOutputFine}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                  {formatGrams(meltingTotals.outputFine, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  {ui.totalOutputGross}: {formatGrams(meltingTotals.outputGross, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.totalMeltingLoss}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 mt-1">
                  {formatGrams(meltingTotals.lossGross, 3)}
                </div>
              </div>
            </div>

            {/* Clean 6-Column Melting Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{ui.meltingBatchesTitle}</h2>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {filteredMeltingBatches.length} {ui.recordsCount}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="px-4 py-3">{ui.batchNo}</th>
                      <th className="px-4 py-3">{ui.operatorRefiner}</th>
                      <th className="px-4 py-3 text-right">{ui.totalInputGross}</th>
                      <th className="px-4 py-3 text-center">{ui.targetPurity}</th>
                      <th className="px-4 py-3 text-right">{ui.totalOutputGross}</th>
                      <th className="px-4 py-3 text-right">{ui.periodMeltingLoss}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMeltingBatches.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                          {ui.noRecordsFound}
                        </td>
                      </tr>
                    ) : (
                      filteredMeltingBatches.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">{b.batchNo}</div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                              {(b.completedDate || b.sentDate).split('T')[0]}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{b.operatorOrRefiner}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {b.explanationNotes ||
                                (b.inputs || []).map((i) => `${i.weightGrams}g ${i.purity}`).join(', ')}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatGrams(b.totalInputGrossGrams, 3)}
                            </div>
                            <div className="text-[11px] text-[#9A7426] dark:text-[#E5C158]">
                              {t.fineGold}: {formatGrams(b.totalInputFineGoldGrams, 3)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-slate-700 dark:text-slate-300 font-medium">
                            {b.outputPurity ? `${b.outputPurity} · ${b.outputFineness}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {b.outputGrossGrams !== undefined ? formatGrams(b.outputGrossGrams, 3) : '—'}
                            </div>
                            {b.outputFineGoldGrams !== undefined && (
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                {t.fineGold}: {formatGrams(b.outputFineGoldGrams, 3)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                            {b.weightLossGrams !== undefined ? formatGrams(b.weightLossGrams, 3) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            REPORT 6: PURITY STOCK SUMMARY
           ========================================================= */}
        {selectedReport === 'stock' && (
          <div className="space-y-4">
            {/* Single-Elevation Divided Summary Strip */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.businessFineGold}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158] mt-1">
                  {formatGrams(stockSummary?.totalFineGoldGrams || 0, 3)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                  {ui.grossWt}: {formatGrams(stockSummary?.totalPhysicalGrams || 0, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{t.finishedJewellery}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                  {formatGrams(stockSummary?.accountBalances?.FINISHED_GOODS?.netWeight || 0, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.customerCustodyGold}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                  {formatGrams(stockSummary?.accountBalances?.CUSTOMER_OWNED?.netWeight || 0, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.goldWithKarigars}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                  {formatGrams(stockSummary?.accountBalances?.KARIGAR_HELD?.netWeight || 0, 3)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Purity Breakdown Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{ui.purityStockBreakdown}</h2>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="px-4 py-3">{ui.purity}</th>
                      <th className="px-4 py-3">{t.fineness}</th>
                      <th className="px-4 py-3 text-right">{ui.netWt}</th>
                      <th className="px-4 py-3 text-right">{ui.fineWt}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(stockSummary?.purityBalances || []).map((pb: any) => (
                      <tr key={pb.purity} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{pb.purity}</td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {pb.purity === '24K'
                            ? '999.9'
                            : pb.purity === '22K'
                            ? '916.0'
                            : pb.purity === '18K'
                            ? '750.0'
                            : '585.0'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {formatGrams(pb.netWeight, 3)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">
                          {formatGrams(pb.fineGoldWeight, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Account Custody Breakdown Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.businessGold}</h2>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="px-4 py-3">{ui.sourceAccount}</th>
                      <th className="px-4 py-3 text-right">{ui.netWt}</th>
                      <th className="px-4 py-3 text-right">{ui.fineWt}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[
                      { label: t.businessGold, acc: stockSummary?.accountBalances?.BUSINESS_OWNED },
                      { label: t.finishedJewellery, acc: stockSummary?.accountBalances?.FINISHED_GOODS },
                      { label: ui.customerCustodyGold, acc: stockSummary?.accountBalances?.CUSTOMER_OWNED },
                      { label: ui.goldWithKarigars, acc: stockSummary?.accountBalances?.KARIGAR_HELD },
                      { label: ui.karigarScrapRecovered, acc: stockSummary?.accountBalances?.SCRAP_REFINING },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{row.label}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {formatGrams(row.acc?.netWeight || 0, 3)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">
                          {formatGrams(row.acc?.fineGoldWeight || 0, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            REPORT 7: GST BILLS
           ========================================================= */}
        {selectedReport === 'gst' && (
          <div className="space-y-4">
            {/* Single-Elevation Divided Summary Strip */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.recordsCount}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                  {filteredInvoices.length}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.netWt}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158] mt-1">
                  {formatGrams(gstTotals.netGold, 3)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.gstAmount}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-slate-800 dark:text-slate-200 mt-1">
                  {formatINR(gstTotals.gst)}
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">{ui.grandTotal}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                  {formatINR(gstTotals.grandTotal)}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{ui.tabGstReport}</h2>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {filteredInvoices.length} {ui.recordsCount}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <tr>
                      <th className="px-4 py-3">{ui.billNo}</th>
                      <th className="px-4 py-3">{ui.customerName}</th>
                      <th className="px-4 py-3 text-right">{ui.netWt}</th>
                      <th className="px-4 py-3 text-right">{ui.grandTotal}</th>
                      <th className="px-4 py-3 text-right">{payT.paidNow}</th>
                      <th className="px-4 py-3 text-right">{payT.balanceDue}</th>
                      <th className="px-4 py-3">{payT.paymentOption}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                          {ui.noRecordsFound}
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const status = inv.paymentStatus || 'PAID';
                        const statusColor =
                          status === 'UNPAID'
                            ? 'text-rose-700'
                            : status === 'PARTIAL'
                            ? 'text-amber-700'
                            : 'text-emerald-700';
                        const settled = (inv.paidAmountINR || 0) + (inv.goldExchangeValueINR || 0);
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158]">
                                {inv.invoiceNo}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">{inv.date}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{inv.customerName}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                              {formatGrams(inv.totalNetGoldWeightGrams, 3)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                              {formatINR(inv.grandTotalINR || 0)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                              {formatINR(settled)}
                              {(inv.goldExchangeGrams || 0) > 0 && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {payT.gold}: {formatGrams(inv.goldExchangeGrams || 0)}
                                </div>
                              )}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-mono tabular-nums font-bold ${
                                (inv.balanceAmountINR || 0) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {(inv.balanceAmountINR || 0) > 0 ? formatINR(inv.balanceAmountINR) : '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
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
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
