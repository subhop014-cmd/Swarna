import { GoldLedgerEntry, GoldRate, Invoice, JobCard, Staff } from '../types';
import { formatGrams, formatINR } from './goldMath';

/**
 * Escape a string for RFC 4180 CSV format
 */
export function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Triggers a browser download of a CSV file with UTF-8 BOM for Excel compatibility
 */
export function downloadCSV(filename: string, rows: (string | number)[][]): void {
  const csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel properly displays Unicode and special symbols
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Gold Ledger transactions to CSV for accounting/audit
 */
export function generateLedgerCSV(
  entries: GoldLedgerEntry[],
  tenantName = 'SwarnaERP'
): (string | number)[][] {
  const headers = [
    'Transaction No',
    'Date',
    'Time (UTC)',
    'Type',
    'Source Account',
    'Destination Account',
    'Counterparty Type',
    'Counterparty Name',
    'Purity Standard',
    'BIS Fineness (‰)',
    'Gross Weight (g)',
    'Non-Gold/Stones (g)',
    'Net Gold Weight (g)',
    'Fine Gold Equivalent 999.9 (g)',
    'Rate Per Gram (INR)',
    'Valuation (INR)',
    'Job Card / Invoice Ref',
    'Entered By',
    'Notes / Remarks',
  ];

  const rows: (string | number)[][] = [
    [`# Business: ${tenantName} - Official Gold Stock Ledger`],
    [`# Generated: ${new Date().toISOString()}`],
    headers,
  ];

  for (const e of entries) {
    const dateParts = e.date.split('T');
    rows.push([
      e.transactionNo,
      dateParts[0] || e.date,
      dateParts[1] ? dateParts[1].replace('Z', '') : '',
      e.type,
      e.sourceAccount,
      e.destinationAccount,
      e.counterpartyType || 'INTERNAL',
      e.counterpartyName || '',
      e.purity,
      e.fineness,
      e.grossWeightGrams.toFixed(3),
      e.nonGoldWeightGrams.toFixed(3),
      e.netWeightGrams.toFixed(3),
      e.fineGoldWeightGrams.toFixed(4),
      e.ratePerGram || '',
      e.valuationINR || '',
      e.jobCardId || e.invoiceId || '',
      e.enteredBy,
      e.notes || '',
    ]);
  }

  return rows;
}

/**
 * Export Invoices and GST Register to CSV for GSTR-1, GSTR-3B & Tally accounting
 */
export function generateInvoicesCSV(
  invoices: Invoice[],
  tenantName = 'SwarnaERP'
): (string | number)[][] {
  const headers = [
    'Invoice No',
    'Invoice Date',
    'Invoice Type',
    'Customer Name',
    'Customer Phone',
    'Customer GSTIN',
    'Interstate Supply (IGST)',
    'HSN Code',
    'Items Summary',
    'Total Gross Weight (g)',
    'Total Net Gold Weight (g)',
    'Total Fine Gold Weight (g)',
    'Taxable Value (INR)',
    'CGST Amount (1.5%)',
    'SGST Amount (1.5%)',
    'IGST Amount (3.0%)',
    'Total GST (3.0%)',
    'Round Off (INR)',
    'Grand Total (INR)',
    'Paid Amount (INR)',
    'Balance Due (INR)',
    'Payment Method',
    'Payment Status',
    'BIS Hallmarking HUID',
    'Hallmark Center',
    'Created By',
  ];

  const rows: (string | number)[][] = [
    [`# Business: ${tenantName} - GST Sales & Tax Invoice Register (HSN 7113)`],
    [`# Generated: ${new Date().toISOString()}`],
    headers,
  ];

  for (const inv of invoices) {
    const itemDescriptions = inv.items
      .map((it) => `${it.description} [${it.purity}, ${it.netGoldWeightGrams}g${it.wastagePercent ? `, VA ${it.wastagePercent}%` : ''}]`)
      .join('; ');
    rows.push([
      inv.invoiceNo,
      inv.date,
      inv.type,
      inv.customerName,
      inv.customerPhone || '',
      inv.customerGstin || 'Unregistered / B2C',
      inv.isInterstate ? 'YES (IGST)' : 'NO (CGST+SGST)',
      '7113',
      itemDescriptions,
      inv.totalGrossWeightGrams.toFixed(3),
      inv.totalNetGoldWeightGrams.toFixed(3),
      inv.totalFineGoldWeightGrams.toFixed(4),
      inv.taxableAmountINR.toFixed(2),
      inv.cgstINR.toFixed(2),
      inv.sgstINR.toFixed(2),
      inv.igstINR.toFixed(2),
      inv.totalGstINR.toFixed(2),
      inv.roundOffINR ? inv.roundOffINR.toFixed(2) : '0.00',
      inv.grandTotalINR.toFixed(2),
      inv.paidAmountINR.toFixed(2),
      inv.balanceAmountINR.toFixed(2),
      inv.paymentMethod,
      inv.paymentStatus,
      inv.hallmarkingDetails?.huidCode || 'N/A',
      inv.hallmarkingDetails?.centerName || '',
      inv.createdBy,
    ]);
  }

  return rows;
}

/**
 * Export Stock Inventory & Fine Gold Balance to CSV
 */
export function generateStockSummaryCSV(
  stockSummary: any,
  goldRates: GoldRate[] = [],
  tenantName = 'SwarnaERP'
): (string | number)[][] {
  const headers = [
    'Category / Standard',
    'Classification Type',
    'Fineness (‰)',
    'Physical Net Weight (g)',
    'Fine Gold Equivalent 999.9 (g)',
    'Benchmark Rate (INR/g)',
    'Estimated Valuation (INR)',
    'Accounting Treatment',
  ];

  const rows: (string | number)[][] = [
    [`# Business: ${tenantName} - Stock Inventory & Purity Valuation Report`],
    [`# Generated: ${new Date().toISOString()}`],
    headers,
  ];

  const rate24K = goldRates.find((r) => r.purity === '24K')?.ratePerGram || 7450;
  const rate22K = goldRates.find((r) => r.purity === '22K')?.ratePerGram || 6825;

  // 1. Account balances
  const acc = stockSummary?.accountBalances || {};
  rows.push([
    'Business Stock (Vault/Bullion)',
    'ACCOUNT_BALANCE',
    '999.9',
    (acc.BUSINESS_OWNED?.netWeight || 0).toFixed(3),
    (acc.BUSINESS_OWNED?.fineGoldWeight || 0).toFixed(4),
    rate24K,
    Math.round((acc.BUSINESS_OWNED?.fineGoldWeight || 0) * rate24K),
    'Business Asset (Trading Stock)',
  ]);
  rows.push([
    'Finished Goods (Showroom Display)',
    'ACCOUNT_BALANCE',
    '916.0',
    (acc.FINISHED_GOODS?.netWeight || 0).toFixed(3),
    (acc.FINISHED_GOODS?.fineGoldWeight || 0).toFixed(4),
    rate22K,
    Math.round((acc.FINISHED_GOODS?.fineGoldWeight || 0) * rate24K),
    'Business Asset (Finished Ornaments)',
  ]);
  rows.push([
    'Customer Deposited Gold',
    'ACCOUNT_BALANCE',
    '916.0',
    (acc.CUSTOMER_OWNED?.netWeight || 0).toFixed(3),
    (acc.CUSTOMER_OWNED?.fineGoldWeight || 0).toFixed(4),
    rate22K,
    Math.round((acc.CUSTOMER_OWNED?.fineGoldWeight || 0) * rate24K),
    'Fiduciary Liability (Held in Trust - NOT Business Stock)',
  ]);
  rows.push([
    'Karigar Held Gold (Work in Progress)',
    'ACCOUNT_BALANCE',
    '916.0',
    (acc.KARIGAR_HELD?.netWeight || 0).toFixed(3),
    (acc.KARIGAR_HELD?.fineGoldWeight || 0).toFixed(4),
    rate22K,
    Math.round((acc.KARIGAR_HELD?.fineGoldWeight || 0) * rate24K),
    'Work in Progress (Artisan Hand Balance)',
  ]);
  rows.push([
    'Scrap & Refining Pool (Morcha/Dust)',
    'ACCOUNT_BALANCE',
    'Variable',
    (acc.SCRAP_REFINING?.netWeight || 0).toFixed(3),
    (acc.SCRAP_REFINING?.fineGoldWeight || 0).toFixed(4),
    rate24K,
    Math.round((acc.SCRAP_REFINING?.fineGoldWeight || 0) * rate24K),
    'Recoverable Material Asset',
  ]);

  // Blank separator
  rows.push(['---', '---', '---', '---', '---', '---', '---', '---']);
  rows.push(['# PURITY BREAKDOWN', '', '', '', '', '', '', '']);

  for (const pb of stockSummary?.purityBalances || []) {
    const matchedRate = goldRates.find((r) => r.purity === pb.purity)?.ratePerGram || 0;
    rows.push([
      pb.purity,
      'PURITY_BREAKDOWN',
      pb.purity === '24K' ? '999.9' : pb.purity === '22K' ? '916.0' : pb.purity === '18K' ? '750.0' : 'Alloy',
      pb.netWeight.toFixed(3),
      pb.fineGoldWeight.toFixed(4),
      matchedRate,
      Math.round(pb.netWeight * matchedRate),
      `Standard Fineness ${pb.purity}`,
    ]);
  }

  // Totals
  rows.push(['---', '---', '---', '---', '---', '---', '---', '---']);
  rows.push([
    'TOTAL AGGREGATE PHYSICAL',
    'TOTAL',
    'Combined',
    (stockSummary?.totalPhysicalGrams || 0).toFixed(3),
    (stockSummary?.totalFineGoldGrams || 0).toFixed(4),
    rate24K,
    Math.round((stockSummary?.totalFineGoldGrams || 0) * rate24K),
    'Aggregate Metal Vault Audit Balance',
  ]);

  return rows;
}

/**
 * Export Wastage & Production Loss reconciliation to CSV
 */
export function generateWastageAuditCSV(
  jobCards: JobCard[],
  tenantName = 'SwarnaERP'
): (string | number)[][] {
  const headers = [
    'Job Card No',
    'Order Ref',
    'Customer',
    'Artisan / Karigar',
    'Jewellery Ornament Type',
    'Design Code',
    'Purity',
    'Issue Date',
    'Due Date',
    'Completion Date',
    'Status',
    'Issued Net Weight (g)',
    'Issued Fine Gold (g)',
    'Returned Finished Net Wt (g)',
    'Returned Scrap & Morcha Wt (g)',
    'Total Accounted Weight (g)',
    'Actual Process Loss (g)',
    'Agreed Wastage % (Ghat)',
    'Allowed Wastage (g)',
    'Excess Loss Discrepancy (g)',
    'Wastage Compliance Status',
    'Labour Rate / Gram (INR)',
    'Total Labour Charges (INR)',
    'Labour Paid (INR)',
    'QC Inspection Signoff',
  ];

  const rows: (string | number)[][] = [
    [`# Business: ${tenantName} - Production Wastage & Karigar Loss Reconciliation`],
    [`# Generated: ${new Date().toISOString()}`],
    headers,
  ];

  for (const j of jobCards) {
    const totalAccounted = (j.returnedJewelleryNetWeight || 0) + (j.returnedScrapWeightGrams || 0);
    const complianceStatus = !j.isReconciled
      ? 'WORK_IN_PROGRESS'
      : j.excessLossGrams > 0
      ? 'EXCESS_LOSS_DISCREPANCY'
      : 'COMPLIANT_WITHIN_GHAT';

    rows.push([
      j.jobNo,
      j.orderRef || '',
      j.customerName || 'Stock Production',
      j.karigarName,
      j.jewelleryType,
      j.designCode || '',
      j.purity,
      j.issueDate,
      j.dueDate,
      j.submittedDate ? j.submittedDate.split('T')[0] : '',
      j.status,
      j.issuedNetWeightGrams.toFixed(3),
      j.issuedFineGoldWeightGrams.toFixed(4),
      j.returnedJewelleryNetWeight.toFixed(3),
      j.returnedScrapWeightGrams.toFixed(3),
      totalAccounted.toFixed(3),
      j.actualLossGrams.toFixed(3),
      j.agreedWastagePercent.toFixed(1) + '%',
      j.allowedWastageGrams.toFixed(3),
      j.excessLossGrams.toFixed(3),
      complianceStatus,
      j.labourRatePerGram,
      j.labourTotalINR,
      j.labourPaidINR,
      j.qcRemarks || (j.qcPassed ? 'PASSED' : 'PENDING'),
    ]);
  }

  return rows;
}

export interface UnifiedTransactionRow {
  id: string;
  date: string;
  refNo: string;
  module: string;
  direction: 'IN' | 'OUT' | 'CONVERSION';
  typeLabel: string;
  partyName: string;
  purity: string;
  grossGrams: number;
  netGrams: number;
  fineGrams: number;
  lossGrams: number;
  amountINR: number;
  notes: string;
}

/**
 * Export All Workshop Transactions for a selected period (Date / Month / Year)
 */
export function generateAllTransactionsCSV(
  rowsData: UnifiedTransactionRow[],
  periodLabel: string,
  tenantName = 'SwarnaERP'
): (string | number)[][] {
  const headers = [
    'Date',
    'Voucher / Ref No',
    'Module',
    'Direction',
    'Transaction Type',
    'Karigar / Party / Customer',
    'Purity',
    'Gross Wt (g)',
    'Net Wt (g)',
    'Fine 999.9 Wt (g)',
    'Loss / Ghat (g)',
    'Amount (INR)',
    'Notes / Remarks',
  ];

  const totalInFine = rowsData.filter((r) => r.direction === 'IN').reduce((s, r) => s + r.fineGrams, 0);
  const totalOutFine = rowsData.filter((r) => r.direction === 'OUT').reduce((s, r) => s + r.fineGrams, 0);
  const totalLoss = rowsData.reduce((s, r) => s + r.lossGrams, 0);
  const totalAmount = rowsData.reduce((s, r) => s + r.amountINR, 0);

  const rows: (string | number)[][] = [
    [`# Business: ${tenantName} - Complete Workshop Transactions Statement`],
    [`# Period: ${periodLabel} | Generated: ${new Date().toISOString()}`],
    headers,
    ...rowsData.map((r) => [
      r.date,
      r.refNo,
      r.module,
      r.direction,
      r.typeLabel,
      r.partyName,
      r.purity,
      r.grossGrams ? r.grossGrams.toFixed(3) : '0.000',
      r.netGrams ? r.netGrams.toFixed(3) : '0.000',
      r.fineGrams ? r.fineGrams.toFixed(4) : '0.0000',
      r.lossGrams ? r.lossGrams.toFixed(3) : '0.000',
      r.amountINR ? r.amountINR.toFixed(2) : '0.00',
      r.notes,
    ]),
    ['---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---'],
    [
      'PERIOD TOTALS',
      `${rowsData.length} Entries`,
      '',
      `IN: ${totalInFine.toFixed(4)}g | OUT: ${totalOutFine.toFixed(4)}g`,
      `Net Gold: ${(totalInFine - totalOutFine).toFixed(4)}g`,
      '',
      '',
      '',
      '',
      (totalInFine - totalOutFine).toFixed(4),
      totalLoss.toFixed(3),
      totalAmount.toFixed(2),
      '',
    ],
  ];

  return rows;
}

export interface KarigarTransactionRow {
  id: string;
  date: string;
  refNo: string;
  karigarId?: string;
  karigarName: string;
  category: 'GOLD_ISSUED' | 'ORNAMENT_RETURNED' | 'SCRAP_RETURNED' | 'JOB_RECONCILED' | 'CASH_ADVANCE';
  categoryLabel: string;
  purity: string;
  issuedNetGrams: number;
  issuedFineGrams: number;
  returnedOrnamentNetGrams: number;
  returnedScrapGrams: number;
  ghatLossGrams: number;
  cashPaidINR: number;
  notes: string;
}

/**
 * Export Complete Karigar Transactions & Custody Statement to CSV
 */
export function generateKarigarTransactionsCSV(
  karigarTxs: KarigarTransactionRow[],
  karigars: Staff[],
  periodLabel: string,
  selectedKarigarName: string,
  tenantName = 'SwarnaERP'
): (string | number)[][] {
  const givenTxs = karigarTxs.filter((r) => r.issuedNetGrams > 0 || r.cashPaidINR > 0);
  const takenTxs = karigarTxs.filter(
    (r) => r.returnedOrnamentNetGrams > 0 || r.returnedScrapGrams > 0 || r.ghatLossGrams > 0
  );

  const totGivenFine = karigarTxs.reduce((s, r) => s + r.issuedFineGrams, 0);
  const totGivenNet = karigarTxs.reduce((s, r) => s + r.issuedNetGrams, 0);
  const totOrn = karigarTxs.reduce((s, r) => s + r.returnedOrnamentNetGrams, 0);
  const totScrap = karigarTxs.reduce((s, r) => s + r.returnedScrapGrams, 0);
  const totLoss = karigarTxs.reduce((s, r) => s + r.ghatLossGrams, 0);
  const totCash = karigarTxs.reduce((s, r) => s + r.cashPaidINR, 0);

  const rows: (string | number)[][] = [
    [`# Business: ${tenantName} - Karigar Individual Given & Taken Report`],
    [`# Karigar: ${selectedKarigarName} | Period: ${periodLabel} | Generated: ${new Date().toISOString()}`],
    [],
    ['# SECTION 1: GIVEN TO KARIGAR (GOLD ISSUED & CASH / MAZDOORI PAID)'],
    ['Date', 'Voucher / Job No', 'Karigar Name', 'Given Type', 'Purity', 'Gold Given Net (g)', 'Gold Given Fine 999.9 (g)', 'Cash / Wage Given (INR)', 'Remarks'],
    ...givenTxs.map((r) => [
      r.date,
      r.refNo,
      r.karigarName,
      r.categoryLabel,
      r.purity,
      r.issuedNetGrams.toFixed(3),
      r.issuedFineGrams.toFixed(4),
      r.cashPaidINR.toFixed(2),
      r.notes,
    ]),
    ['TOTAL GIVEN', `${givenTxs.length} Entries`, selectedKarigarName, '', '', totGivenNet.toFixed(3), totGivenFine.toFixed(4), totCash.toFixed(2), ''],
    [],
    ['# SECTION 2: TAKEN FROM KARIGAR (ORNAMENTS RECEIVED, SCRAP & GHAT)'],
    ['Date', 'Voucher / Job No', 'Karigar Name', 'Taken Type', 'Purity', 'Ornament Taken Net (g)', 'Scrap / Morcha Taken (g)', 'Actual Ghat / Loss (g)', 'Remarks'],
    ...takenTxs.map((r) => [
      r.date,
      r.refNo,
      r.karigarName,
      r.categoryLabel,
      r.purity,
      r.returnedOrnamentNetGrams.toFixed(3),
      r.returnedScrapGrams.toFixed(3),
      r.ghatLossGrams.toFixed(3),
      r.notes,
    ]),
    ['TOTAL TAKEN', `${takenTxs.length} Entries`, selectedKarigarName, '', '', totOrn.toFixed(3), totScrap.toFixed(3), totLoss.toFixed(3), ''],
    [],
    ['# SECTION 3: INDIVIDUAL KARIGAR CUSTODY BALANCES'],
    ['Code', 'Karigar Name', 'Phone', 'Skill', 'Gold In Hand (g)', 'Active Jobs', 'Completed Jobs', 'Wage Advance Balance (INR)', 'Unreconciled Loss (g)'],
    ...karigars.map((k) => [
      k.code,
      k.name,
      k.phone,
      k.skillCategory || 'Goldsmith',
      k.currentGoldHoldingGrams.toFixed(3),
      k.activeJobsCount,
      k.completedJobsCount,
      k.advanceBalanceINR.toFixed(2),
      k.unreconciledLossGrams.toFixed(3),
    ]),
  ];

  return rows;
}

/**
 * Export Gold IN & OUT Movement Statement to CSV
 */
export function generateGoldInOutCSV(
  entries: Array<GoldLedgerEntry & { ioDirection: 'IN' | 'OUT' }>,
  periodLabel: string,
  tenantName = 'SwarnaERP'
): (string | number)[][] {
  const headers = [
    'Date',
    'Voucher No',
    'Direction (IN / OUT)',
    'Movement Type',
    'Party / Karigar / Customer',
    'Purity',
    'Fineness (‰)',
    'Gross Weight (g)',
    'Stone / Non-Gold (g)',
    'Net Gold Weight (g)',
    'Fine 999.9 Gold (g)',
    'Remarks',
  ];

  const inFine = entries.filter((e) => e.ioDirection === 'IN').reduce((s, e) => s + e.fineGoldWeightGrams, 0);
  const outFine = entries.filter((e) => e.ioDirection === 'OUT').reduce((s, e) => s + e.fineGoldWeightGrams, 0);
  const inNet = entries.filter((e) => e.ioDirection === 'IN').reduce((s, e) => s + e.netWeightGrams, 0);
  const outNet = entries.filter((e) => e.ioDirection === 'OUT').reduce((s, e) => s + e.netWeightGrams, 0);

  return [
    [`# Business: ${tenantName} - Gold IN & OUT Statement`],
    [`# Period: ${periodLabel} | Generated: ${new Date().toISOString()}`],
    headers,
    ...entries.map((e) => [
      e.date.split('T')[0],
      e.transactionNo,
      e.ioDirection,
      e.type.replace(/_/g, ' '),
      e.counterpartyName || e.destinationAccount,
      e.purity,
      e.fineness,
      e.grossWeightGrams.toFixed(3),
      e.nonGoldWeightGrams.toFixed(3),
      e.netWeightGrams.toFixed(3),
      e.fineGoldWeightGrams.toFixed(4),
      e.notes || '',
    ]),
    ['---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---'],
    ['TOTAL GOLD IN', '', 'IN', '', '', '', '', '', '', inNet.toFixed(3), inFine.toFixed(4), ''],
    ['TOTAL GOLD OUT', '', 'OUT', '', '', '', '', '', '', outNet.toFixed(3), outFine.toFixed(4), ''],
    ['NET MOVEMENT (IN - OUT)', '', 'NET', '', '', '', '', '', '', (inNet - outNet).toFixed(3), (inFine - outFine).toFixed(4), ''],
  ];
}

/**
 * Export Melting & Refining Batches Report to CSV
 */
export function generateMeltingReportCSV(
  batches: any[],
  periodLabel: string,
  tenantName = 'SwarnaERP'
): (string | number)[][] {
  const headers = [
    'Batch No',
    'Date',
    'Status',
    'Melter / Refiner',
    'Input Details',
    'Input Gross Wt (g)',
    'Input Fine 999.9 (g)',
    'Output Gross Wt (g)',
    'Output Purity',
    'Output Fineness (‰)',
    'Output Fine 999.9 (g)',
    'Scrap Recovered (g)',
    'Gross Melting Loss (g)',
    'Fine Gold Diff (g)',
    'Refining Charges (INR)',
    'Notes',
  ];

  const totInGross = batches.reduce((s, b) => s + (b.totalInputGrossGrams || 0), 0);
  const totInFine = batches.reduce((s, b) => s + (b.totalInputFineGoldGrams || 0), 0);
  const totOutGross = batches.reduce((s, b) => s + (b.outputGrossGrams || 0), 0);
  const totOutFine = batches.reduce((s, b) => s + (b.outputFineGoldGrams || 0), 0);
  const totLoss = batches.reduce((s, b) => s + (b.weightLossGrams || 0), 0);

  return [
    [`# Business: ${tenantName} - Furnace Melting & Refining Report`],
    [`# Period: ${periodLabel} | Generated: ${new Date().toISOString()}`],
    headers,
    ...batches.map((b) => [
      b.batchNo,
      (b.completedDate || b.sentDate || '').split('T')[0],
      b.status,
      b.operatorOrRefiner,
      (b.inputs || []).map((i: any) => `${i.description} (${i.weightGrams}g ${i.purity})`).join('; '),
      (b.totalInputGrossGrams || 0).toFixed(3),
      (b.totalInputFineGoldGrams || 0).toFixed(4),
      (b.outputGrossGrams || 0).toFixed(3),
      b.outputPurity || '-',
      b.outputFineness || '-',
      (b.outputFineGoldGrams || 0).toFixed(4),
      (b.recoveredScrapGrams || 0).toFixed(3),
      (b.weightLossGrams || 0).toFixed(3),
      (b.fineGoldLossOrGainGrams || 0).toFixed(4),
      (b.refiningChargesINR || 0).toFixed(2),
      b.explanationNotes || '',
    ]),
    ['---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---'],
    [
      'PERIOD TOTALS',
      `${batches.length} Batches`,
      '',
      '',
      '',
      totInGross.toFixed(3),
      totInFine.toFixed(4),
      totOutGross.toFixed(3),
      '',
      '',
      totOutFine.toFixed(4),
      '',
      totLoss.toFixed(3),
      (totOutFine - totInFine).toFixed(4),
      '',
      '',
    ],
  ];
}

export interface CustomerGivenTakenRow {
  id: string;
  date: string;
  refNo: string;
  customerId?: string;
  customerName: string;
  side: 'GIVEN' | 'TAKEN';
  categoryLabel: string;
  itemDetails: string;
  purity: string;
  netGrams: number;
  fineGrams: number;
  amountINR: number;
  notes: string;
}

export interface CustomerSummaryMetric {
  id: string;
  accountCode: string;
  name: string;
  phone: string;
  city?: string;
  givenNetGrams: number;
  givenFineGrams: number;
  givenCashINR: number;
  takenNetGrams: number;
  takenFineGrams: number;
  takenAmountINR: number;
  custodyGoldGrams: number;
  monetaryBalanceINR: number;
  txCount: number;
}

/**
 * Export Individual Customer (or All Customers) Given & Taken Report to CSV
 */
export function generateCustomerGivenTakenCSV(
  entries: CustomerGivenTakenRow[],
  customerSummaries: CustomerSummaryMetric[],
  periodLabel: string,
  selectedCustomerLabel: string,
  tenantName = 'SwarnaERP'
): (string | number)[][] {
  const givenRows = entries.filter((e) => e.side === 'GIVEN');
  const takenRows = entries.filter((e) => e.side === 'TAKEN');

  const totGivenNet = givenRows.reduce((s, r) => s + r.netGrams, 0);
  const totGivenFine = givenRows.reduce((s, r) => s + r.fineGrams, 0);
  const totGivenCash = givenRows.reduce((s, r) => s + r.amountINR, 0);

  const totTakenNet = takenRows.reduce((s, r) => s + r.netGrams, 0);
  const totTakenFine = takenRows.reduce((s, r) => s + r.fineGrams, 0);
  const totTakenCash = takenRows.reduce((s, r) => s + r.amountINR, 0);

  const rows: (string | number)[][] = [
    [`# Business: ${tenantName} - Customer Individual Given & Taken Statement`],
    [`# Customer: ${selectedCustomerLabel} | Period: ${periodLabel} | Generated: ${new Date().toISOString()}`],
    [],
    ['# SECTION 1: GIVEN BY CUSTOMER (GOLD & CASH RECEIVED BY SHOP)'],
    ['Date', 'Ref / Voucher No', 'Customer Name', 'Entry Type', 'Particulars', 'Purity', 'Given Net Wt (g)', 'Given Fine 999.9 (g)', 'Cash Paid (INR)', 'Remarks'],
    ...givenRows.map((r) => [
      r.date,
      r.refNo,
      r.customerName,
      r.categoryLabel,
      r.itemDetails,
      r.purity,
      r.netGrams.toFixed(3),
      r.fineGrams.toFixed(4),
      r.amountINR.toFixed(2),
      r.notes,
    ]),
    ['TOTAL GIVEN', `${givenRows.length} Entries`, '', '', '', '', totGivenNet.toFixed(3), totGivenFine.toFixed(4), totGivenCash.toFixed(2), ''],
    [],
    ['# SECTION 2: TAKEN BY CUSTOMER (ORNAMENTS, GOLD & BILLS DELIVERED)'],
    ['Date', 'Bill / Ref No', 'Customer Name', 'Entry Type', 'Ornament / Particulars', 'Purity', 'Taken Net Wt (g)', 'Taken Fine 999.9 (g)', 'Bill / Cash Amount (INR)', 'Remarks'],
    ...takenRows.map((r) => [
      r.date,
      r.refNo,
      r.customerName,
      r.categoryLabel,
      r.itemDetails,
      r.purity,
      r.netGrams.toFixed(3),
      r.fineGrams.toFixed(4),
      r.amountINR.toFixed(2),
      r.notes,
    ]),
    ['TOTAL TAKEN', `${takenRows.length} Entries`, '', '', '', '', totTakenNet.toFixed(3), totTakenFine.toFixed(4), totTakenCash.toFixed(2), ''],
    [],
    ['# SECTION 3: INDIVIDUAL CUSTOMER SUMMARY BALANCES'],
    [
      'Account Code',
      'Customer Name',
      'Phone',
      'Gold Given Net (g)',
      'Gold Given Fine (g)',
      'Cash Given (INR)',
      'Ornaments Taken Net (g)',
      'Ornaments Taken Fine (g)',
      'Total Billed (INR)',
      'Gold Deposit Balance (g)',
      'Cash Balance Due (INR)',
    ],
    ...customerSummaries.map((c) => [
      c.accountCode,
      c.name,
      c.phone,
      c.givenNetGrams.toFixed(3),
      c.givenFineGrams.toFixed(4),
      c.givenCashINR.toFixed(2),
      c.takenNetGrams.toFixed(3),
      c.takenFineGrams.toFixed(4),
      c.takenAmountINR.toFixed(2),
      c.custodyGoldGrams.toFixed(3),
      c.monetaryBalanceINR.toFixed(2),
    ]),
  ];

  return rows;
}


