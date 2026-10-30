import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Printer, X } from 'lucide-react';
import { Customer, IndianLanguage, Tenant } from '../types';
import { formatGrams, formatINR } from '../utils/goldMath';
import { getUI } from '../i18n/uiTranslations';
import { getPrinterStrings } from '../i18n/printerTranslations';
import {
  formatInvoicePaymentMethodLabel,
  formatInvoiceStatusLabel,
  getPaymentStrings,
} from '../i18n/paymentTranslations';
import {
  DEFAULT_PRINTER_SETTINGS,
  isThermalPaper,
  PrintCopyCount,
  PrinterPaperSize,
  PrinterSettings,
  printHtmlWithSettings,
} from '../utils/printerSettings';

export type PrintPreviewDocType =
  | 'INVOICE'
  | 'TAX_INVOICE'
  | 'THERMAL_RECEIPT'
  | 'GOLD_ISSUE_SLIP'
  | 'GOLD_RECEIPT_SLIP'
  | 'DELIVERY_CHALLAN'
  | 'MELTING_SLIP'
  | 'JOB_CARD_CHALLAN';

export interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: PrintPreviewDocType;
  data: any;
  tenant: Partial<Tenant> | null;
  customers?: Customer[];
  activeLanguage: IndianLanguage;
  showRupees: boolean;
  printerSettings?: PrinterSettings;
  onUpdatePrinterSettings?: (next: PrinterSettings) => void;
  autoTriggerPrint?: boolean;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  docType,
  data,
  tenant,
  customers = [],
  activeLanguage,
  showRupees,
  printerSettings = DEFAULT_PRINTER_SETTINGS,
  onUpdatePrinterSettings,
  autoTriggerPrint = false,
}) => {
  const ui = getUI(activeLanguage);
  const printerT = getPrinterStrings(activeLanguage);
  const payT = getPaymentStrings(activeLanguage);

  const [previewSettings, setPreviewSettings] = useState<PrinterSettings>(printerSettings);
  const [copied, setCopied] = useState(false);
  const singleCopyRef = useRef<HTMLDivElement | null>(null);
  const hasAutoPrintedRef = useRef(false);

  // Sync with incoming printerSettings whenever modal opens on a new document
  useEffect(() => {
    if (isOpen) {
      const initialPaper: PrinterPaperSize =
        docType === 'THERMAL_RECEIPT' && !isThermalPaper(printerSettings.paperSize)
          ? 'THERMAL_80'
          : printerSettings.paperSize;
      setPreviewSettings({
        ...printerSettings,
        paperSize: initialPaper,
      });
      hasAutoPrintedRef.current = false;
    }
  }, [isOpen, data, docType, printerSettings]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const updateSetting = (patch: Partial<PrinterSettings>) => {
    const next = { ...previewSettings, ...patch };
    setPreviewSettings(next);
    onUpdatePrinterSettings?.(next);
  };

  const isInvoiceDoc =
    docType === 'INVOICE' || docType === 'TAX_INVOICE' || docType === 'THERMAL_RECEIPT';
  const thermal = isThermalPaper(previewSettings.paperSize);

  const docNumber =
    data?.invoiceNo ||
    data?.jobNo ||
    data?.challanNo ||
    data?.batchNo ||
    data?.transactionNo ||
    'DOC-2026-001';

  const handleTriggerPrint = () => {
    if (!singleCopyRef.current) {
      window.print();
      return;
    }
    const shopTitle = tenant?.name || 'Kanakdhara Gold Ornaments';
    printHtmlWithSettings(
      singleCopyRef.current.innerHTML,
      `${docNumber} - ${shopTitle}`,
      previewSettings,
      activeLanguage
    );
  };

  // Optional auto-print on open when requested (e.g. autoPrintOnSave)
  useEffect(() => {
    if (isOpen && autoTriggerPrint && data && !hasAutoPrintedRef.current) {
      hasAutoPrintedRef.current = true;
      const timer = setTimeout(() => {
        if (singleCopyRef.current) {
          const shopTitle = tenant?.name || 'Kanakdhara Gold Ornaments';
          printHtmlWithSettings(
            singleCopyRef.current.innerHTML,
            `${docNumber} - ${shopTitle}`,
            previewSettings,
            activeLanguage
          );
        }
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoTriggerPrint, data, docNumber, tenant?.name, previewSettings, activeLanguage]);

  if (!isOpen || !data) return null;

  const handleCopyText = () => {
    if (!singleCopyRef.current) return;
    navigator.clipboard?.writeText(singleCopyRef.current.innerText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Shop / Tenant metadata
  const shopName = tenant?.name || 'Kanakdhara Gold Ornaments';
  const shopAddress = [tenant?.address, tenant?.city, tenant?.pinCode]
    .filter(Boolean)
    .join(', ');
  const shopPhone = tenant?.phone || '';
  const shopGstin = tenant?.gstin || '27AAGCK7821C1Z3';
  const shopHallmark = tenant?.hallmarkLicenseNo || 'HM/MH/2021/44120';

  // Document date & party details
  const rawDate = data.date || data.issueDate || data.createdAt || new Date().toISOString();
  const formattedDate = typeof rawDate === 'string' ? rawDate.split('T')[0] : '';

  const matchedCustomer = data.customerId
    ? customers.find((c) => c.id === data.customerId)
    : undefined;
  const partyName =
    data.customerName ||
    matchedCustomer?.name ||
    data.karigarName ||
    data.partyName ||
    data.counterpartyName ||
    'Walk-in Customer';
  const partyPhone = data.customerPhone || matchedCustomer?.phone || '';
  const partyGstin = data.customerGstin || matchedCustomer?.gstin || '';

  // Document heading label
  const documentHeading = isInvoiceDoc
    ? thermal
      ? showRupees
        ? 'POS TAX RECEIPT'
        : 'POS GOLD CHALLAN'
      : showRupees
      ? 'GST TAX INVOICE'
      : 'GOLD DELIVERY CHALLAN'
    : docType === 'JOB_CARD_CHALLAN'
    ? data.isReconciled
      ? 'KARIGAR RECONCILIATION CHALLAN'
      : 'KARIGAR GOLD ISSUE CHALLAN'
    : docType === 'GOLD_ISSUE_SLIP'
    ? 'WORKSHOP GOLD ISSUE SLIP'
    : docType === 'GOLD_RECEIPT_SLIP'
    ? 'GOLD RECEIPT & GHAT SLIP'
    : docType === 'MELTING_SLIP'
    ? 'MELTING & REFINING SLIP'
    : 'DELIVERY CHALLAN';

  // Invoice item calculations
  const invoiceItems: any[] = Array.isArray(data.items) ? data.items : [];
  const totalNetGold =
    data.totalNetGoldWeightGrams ??
    invoiceItems.reduce((s, it) => s + (it.netGoldWeightGrams || 0), 0);
  const totalGrossGold =
    data.totalGrossWeightGrams ??
    invoiceItems.reduce((s, it) => s + (it.grossWeightGrams || it.netGoldWeightGrams || 0), 0);
  const totalFineGold =
    data.totalFineGoldWeightGrams ??
    invoiceItems.reduce((s, it) => s + (it.fineGoldWeightGrams || 0), 0);
  const totalWastageGrams = invoiceItems.reduce((s, it) => {
    const w =
      it.wastageWeightGrams !== undefined
        ? it.wastageWeightGrams
        : Number((((it.netGoldWeightGrams || 0) * (it.wastagePercent || 0)) / 100).toFixed(3));
    return s + w;
  }, 0);
  const exchGrams = data.goldExchangeGrams || 0;
  const computedGoldDue =
    data.goldBalanceDueGrams !== undefined
      ? data.goldBalanceDueGrams
      : data.paymentStatus === 'PAID'
      ? 0
      : Math.max(0, Number((totalNetGold + totalWastageGrams - exchGrams).toFixed(3)));

  // Non-invoice challan weights (Job card / Issue / Receipt / Party / Melting)
  const challanGross =
    data.issuedGrossWeightGrams ??
    data.grossWeightGrams ??
    data.totalInputGrossGrams ??
    data.issuedNetWeightGrams ??
    data.netWeightGrams ??
    0;
  const challanNet =
    data.issuedNetWeightGrams ??
    data.netWeightGrams ??
    data.returnedJewelleryNet ??
    data.totalInputGrossGrams ??
    0;
  const challanFine =
    data.issuedFineGoldGrams ??
    data.fineGoldWeightGrams ??
    data.totalInputFineGoldGrams ??
    0;
  const challanPurity = data.purity || data.outputPurity || '22K';
  const footerText =
    data.termsAndConditions ||
    data.instructions ||
    data.notes ||
    previewSettings.footerNote;

  const copyHeaders = [
    printerT.originalCopy,
    printerT.duplicateCopy,
    printerT.triplicateCopy,
  ];
  const copiesArray = Array.from({ length: previewSettings.copies || 1 });

  const paperDimensionsText =
    previewSettings.paperSize === 'A4'
      ? '210 × 297 mm (A4)'
      : previewSettings.paperSize === 'A5'
      ? '148 × 210 mm (A5)'
      : previewSettings.paperSize === 'THERMAL_80'
      ? '80 mm POS Roll'
      : '58 mm Compact Roll';

  // Render a single copy's inner markup (either Thermal Receipt or A4/A5 Formal Sheet)
  const renderDocumentBody = () => {
    if (thermal) {
      // ============================================================
      // THERMAL RECEIPT LAYOUT (80mm / 58mm Roll)
      // ============================================================
      const compact58 = previewSettings.paperSize === 'THERMAL_58';
      return (
        <div
          className={`font-mono tabular-nums text-slate-900 space-y-2.5 ${
            compact58 ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          {/* Centered Receipt Header */}
          <div className="text-center pb-2 border-b border-dashed border-slate-400">
            <div className={`font-black uppercase tracking-tight ${compact58 ? 'text-xs' : 'text-sm'}`}>
              {shopName}
            </div>
            {previewSettings.showShopHeader && (shopAddress || shopPhone) && (
              <div className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                {shopAddress}
                {shopAddress && shopPhone ? ' · ' : ''}
                {shopPhone}
              </div>
            )}
            {previewSettings.showTaxHallmarkInfo && (
              <div className="text-[9.5px] text-slate-600 mt-0.5 leading-snug">
                GSTIN: {shopGstin}
                {shopHallmark ? ` · BIS: ${shopHallmark}` : ''}
              </div>
            )}
            <div className="font-bold uppercase mt-1.5 text-slate-900">
              {documentHeading}
            </div>
          </div>

          {/* Receipt Meta */}
          <div className="space-y-0.5 pb-2 border-b border-dashed border-slate-400 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-600">No:</span>
              <span className="font-bold">{docNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Date:</span>
              <span>{formattedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Party:</span>
              <span className="font-bold text-right truncate max-w-[160px]">{partyName}</span>
            </div>
            {partyPhone && (
              <div className="flex justify-between">
                <span className="text-slate-600">Tel:</span>
                <span>{partyPhone}</span>
              </div>
            )}
            {isInvoiceDoc && (
              <div className="flex justify-between">
                <span className="text-slate-600">{payT.paymentOption}:</span>
                <span className="font-bold text-right">
                  {formatInvoicePaymentMethodLabel(data, activeLanguage)} ·{' '}
                  {formatInvoiceStatusLabel(data.paymentStatus, activeLanguage)}
                </span>
              </div>
            )}
          </div>

          {/* Receipt Line Items or Challan Details */}
          {isInvoiceDoc ? (
            <div className="space-y-2 pb-2 border-b border-dashed border-slate-400">
              <div className="flex justify-between font-bold text-[10px] text-slate-700 border-b border-slate-300 pb-1">
                <span>Item / Wt</span>
                <span>{showRupees ? 'Amt (₹)' : 'Fine (g)'}</span>
              </div>
              {invoiceItems.map((it, idx) => {
                const vaWt =
                  it.wastageWeightGrams !== undefined
                    ? it.wastageWeightGrams
                    : Number(
                        (((it.netGoldWeightGrams || 0) * (it.wastagePercent || 0)) / 100).toFixed(3)
                      );
                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-bold">
                      <span className="font-sans">
                        {idx + 1}. {it.description} ({it.purity})
                      </span>
                      <span>
                        {showRupees
                          ? `₹${(it.lineTotalINR || it.taxableAmountINR || 0).toLocaleString('en-IN')}`
                          : formatGrams(it.fineGoldWeightGrams || 0)}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-slate-600 flex justify-between">
                      <span>
                        Net {formatGrams(it.netGoldWeightGrams)}
                        {vaWt > 0 ? ` + VA ${formatGrams(vaWt)} (${it.wastagePercent}%)` : ''}
                      </span>
                      {showRupees && it.goldRatePerGram ? (
                        <span>@₹{it.goldRatePerGram.toLocaleString('en-IN')}/g</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1 pb-2 border-b border-dashed border-slate-400">
              {(data.jewelleryType || data.description) && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Item:</span>
                  <span className="font-bold font-sans">
                    {data.jewelleryType || data.description}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Purity:</span>
                <span className="font-bold">{challanPurity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Wt:</span>
                <span>{formatGrams(challanGross)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Net Gold Wt:</span>
                <span>{formatGrams(challanNet)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Fine Gold (24K):</span>
                <span className="font-bold">{formatGrams(challanFine)}</span>
              </div>
              {data.agreedWastagePercent !== undefined && (
                <div className="flex justify-between text-slate-600">
                  <span>Agreed Wastage:</span>
                  <span>{data.agreedWastagePercent}%</span>
                </div>
              )}
              {(data.returnedJewelleryNetWeight !== undefined ||
                data.returnedJewelleryNet !== undefined) && (
                <div className="flex justify-between text-emerald-700 pt-1 border-t border-dashed border-slate-300">
                  <span>Returned Net:</span>
                  <span className="font-bold">
                    {formatGrams(
                      data.returnedJewelleryNetWeight ?? data.returnedJewelleryNet ?? 0
                    )}
                  </span>
                </div>
              )}
              {(data.actualLossGrams !== undefined || data.actualLoss !== undefined) && (
                <div className="flex justify-between text-slate-700">
                  <span>Process Loss (Ghat):</span>
                  <span>{formatGrams(data.actualLossGrams ?? data.actualLoss ?? 0)}</span>
                </div>
              )}
              {data.outputWeightGrams !== undefined && (
                <div className="flex justify-between text-emerald-700 pt-1 border-t border-dashed border-slate-300">
                  <span>Output ({data.outputPurity || '24K'}):</span>
                  <span className="font-bold">{formatGrams(data.outputWeightGrams)}</span>
                </div>
              )}
            </div>
          )}

          {/* Totals Summary for Invoices */}
          {isInvoiceDoc && (
            <div className="space-y-1 pb-2 border-b border-dashed border-slate-400">
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>Total Net Gold:</span>
                <span className="font-bold text-slate-900">{formatGrams(totalNetGold)}</span>
              </div>
              {totalWastageGrams > 0 && (
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>Total Wastage:</span>
                  <span>+{formatGrams(totalWastageGrams)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>Fine 999.9 Eqv:</span>
                <span className="font-bold text-slate-900">{formatGrams(totalFineGold)}</span>
              </div>

              {showRupees ? (
                <>
                  {(data.totalGstINR || 0) > 0 && (
                    <div className="flex justify-between text-[10px] text-slate-600 pt-1 border-t border-slate-200">
                      <span>GST (3%):</span>
                      <span>{formatINR(data.totalGstINR || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                    <span>{ui.grandTotal}:</span>
                    <span>{formatINR(data.grandTotalINR || 0)}</span>
                  </div>
                  {(data.goldExchangeValueINR || 0) > 0 && (
                    <div className="flex justify-between text-[10px] text-emerald-700">
                      <span>
                        {payT.gold} ({formatGrams(exchGrams)}):
                      </span>
                      <span>−{formatINR(data.goldExchangeValueINR || 0)}</span>
                    </div>
                  )}
                  {(data.paidAmountINR || 0) > 0 && (
                    <div className="flex justify-between text-[10px] text-emerald-700">
                      <span>{payT.paidNow}:</span>
                      <span>−{formatINR(data.paidAmountINR || 0)}</span>
                    </div>
                  )}
                  <div
                    className={`flex justify-between font-bold pt-1 border-t border-slate-300 ${
                      (data.balanceAmountINR || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    <span>{payT.balanceDue}:</span>
                    <span>{formatINR(data.balanceAmountINR || 0)}</span>
                  </div>
                </>
              ) : (
                <>
                  {exchGrams > 0 && (
                    <div className="flex justify-between text-[10px] text-emerald-700">
                      <span>
                        {payT.gold} ({data.goldExchangePurity || '22K'}):
                      </span>
                      <span>−{formatGrams(exchGrams)}</span>
                    </div>
                  )}
                  {(data.paidAmountINR || 0) > 0 && (
                    <div className="flex justify-between text-[10px] text-emerald-700">
                      <span>{payT.cash}:</span>
                      <span>{formatINR(data.paidAmountINR || 0)}</span>
                    </div>
                  )}
                  <div
                    className={`flex justify-between font-bold pt-1 border-t border-slate-300 ${
                      computedGoldDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    <span>{payT.goldDue}:</span>
                    <span>{formatGrams(computedGoldDue)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footer & Compact Signature */}
          {footerText && (
            <div className="text-[9.5px] text-slate-600 text-center font-sans leading-snug">
              {footerText}
            </div>
          )}

          {previewSettings.showSignatures && (
            <div className="pt-5 text-center text-[9.5px] text-slate-600">
              <div className="border-t border-dashed border-slate-400 pt-1">
                For {shopName}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ============================================================
    // A4 / A5 FORMAL SHEET DOCUMENT LAYOUT
    // ============================================================
    return (
      <div className="font-sans text-xs text-slate-900 space-y-5">
        {/* Formal Sheet Letterhead */}
        <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start gap-4">
          <div>
            <div className="text-lg font-black tracking-tight uppercase text-slate-950">
              {shopName}
            </div>
            {previewSettings.showShopHeader && (shopAddress || shopPhone) && (
              <div className="text-[11px] text-slate-600 mt-0.5">
                {shopAddress}
                {shopAddress && shopPhone ? ` · Tel: ${shopPhone}` : shopPhone}
              </div>
            )}
            {previewSettings.showTaxHallmarkInfo && (
              <div className="text-[10.5px] text-slate-500 mt-0.5 font-mono tabular-nums">
                GSTIN: {shopGstin}
                {shopHallmark ? ` · BIS Hallmark Reg: ${shopHallmark}` : ''}
              </div>
            )}
          </div>

          <div className="text-right font-mono tabular-nums shrink-0">
            <div className="text-xs font-bold text-[#9A7426] uppercase">
              {documentHeading}
            </div>
            <div className="text-[11px] font-bold text-slate-900 mt-1">
              No: {docNumber}
            </div>
            <div className="text-[10.5px] text-slate-500">
              Date: {formattedDate}
            </div>
          </div>
        </div>

        {/* Party & Status Info Block */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">
              {isInvoiceDoc ? 'Customer / Party' : 'Artisan / Counterparty'}
            </div>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{partyName}</div>
            {partyPhone && (
              <div className="text-[11px] text-slate-600 font-mono tabular-nums mt-0.5">
                {partyPhone}
              </div>
            )}
            {partyGstin && (
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                GSTIN: {partyGstin}
              </div>
            )}
          </div>

          <div className="text-right">
            {isInvoiceDoc ? (
              <>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {payT.paymentOption}
                </div>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                  {formatInvoicePaymentMethodLabel(data, activeLanguage)} ·{' '}
                  {formatInvoiceStatusLabel(data.paymentStatus, activeLanguage)}
                </div>
                {data.dueDate && (
                  <div className="text-[10.5px] text-rose-700 font-mono tabular-nums mt-0.5">
                    Due Date: {data.dueDate}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  Purity & Reference
                </div>
                <div className="text-xs font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {challanPurity}
                </div>
                {data.dueDate && (
                  <div className="text-[10.5px] text-slate-600 font-mono tabular-nums mt-0.5">
                    Due Date: {data.dueDate}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Main Item Table (Invoices) OR Challan Schedule */}
        {isInvoiceDoc ? (
          <>
            <table className="w-full text-left text-xs border border-slate-200 border-collapse font-mono tabular-nums">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-[10px] uppercase border-b border-slate-200 font-sans">
                  <th className="p-2 border-r border-slate-200">#</th>
                  <th className="p-2 border-r border-slate-200">Ornament</th>
                  <th className="p-2 border-r border-slate-200">Purity</th>
                  <th className="p-2 border-r border-slate-200 text-right">Gross (g)</th>
                  <th className="p-2 border-r border-slate-200 text-right">Net (g)</th>
                  <th className="p-2 border-r border-slate-200 text-right">Wastage</th>
                  {showRupees ? (
                    <>
                      <th className="p-2 border-r border-slate-200 text-right">Rate (₹/g)</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                    </>
                  ) : (
                    <th className="p-2 text-right">Fine 999.9 (g)</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoiceItems.map((item, idx) => {
                  const vaWt =
                    item.wastageWeightGrams !== undefined
                      ? item.wastageWeightGrams
                      : Number(
                          (((item.netGoldWeightGrams || 0) * (item.wastagePercent || 0)) / 100).toFixed(3)
                        );
                  return (
                    <tr key={idx}>
                      <td className="p-2 border-r border-slate-200">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-200 font-sans font-semibold">
                        {item.description}
                        {item.huid ? (
                          <span className="text-[10px] text-slate-500 font-mono ml-1">
                            [HUID: {item.huid}]
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2 border-r border-slate-200">{item.purity}</td>
                      <td className="p-2 border-r border-slate-200 text-right">
                        {formatGrams(item.grossWeightGrams || item.netGoldWeightGrams)}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-bold">
                        {formatGrams(item.netGoldWeightGrams)}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right text-[#9A7426]">
                        {vaWt > 0 ? `+${formatGrams(vaWt)} (${item.wastagePercent}%)` : '—'}
                      </td>
                      {showRupees ? (
                        <>
                          <td className="p-2 border-r border-slate-200 text-right">
                            ₹{(item.goldRatePerGram || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-2 text-right font-bold">
                            {formatINR(item.lineTotalINR || item.taxableAmountINR || 0)}
                          </td>
                        </>
                      ) : (
                        <td className="p-2 text-right font-bold">
                          {formatGrams(item.fineGoldWeightGrams || 0)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 gap-6 pt-1 font-mono tabular-nums">
              <div className="border border-slate-200 rounded-lg p-3 space-y-1 bg-slate-50 text-[11px]">
                <div className="flex justify-between">
                  <span className="font-sans text-slate-600">Total Gross Weight:</span>
                  <span>{formatGrams(totalGrossGold)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-slate-700 font-medium">Total Net Gold:</span>
                  <span className="font-bold text-slate-900">{formatGrams(totalNetGold)}</span>
                </div>
                {totalWastageGrams > 0 && (
                  <div className="flex justify-between text-[#9A7426]">
                    <span className="font-sans">Total Wastage (VA):</span>
                    <span className="font-bold">+{formatGrams(totalWastageGrams)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700">
                  <span className="font-sans">Total Fine Gold (999.9):</span>
                  <span className="font-bold text-[#9A7426]">{formatGrams(totalFineGold)}</span>
                </div>
                {exchGrams > 0 && (
                  <div className="flex justify-between text-emerald-700 border-t border-slate-200 pt-1">
                    <span className="font-sans">
                      {payT.gold} ({data.goldExchangePurity || '22K'}):
                    </span>
                    <span className="font-bold">−{formatGrams(exchGrams)}</span>
                  </div>
                )}
                {!showRupees && (
                  <div
                    className={`flex justify-between font-bold border-t border-slate-200 pt-1 ${
                      computedGoldDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    <span className="font-sans">{payT.goldDue}:</span>
                    <span>{formatGrams(computedGoldDue)}</span>
                  </div>
                )}
                {!showRupees && (data.paidAmountINR || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700 border-t border-slate-200 pt-1">
                    <span className="font-sans">{payT.cash}:</span>
                    <span className="font-bold">{formatINR(data.paidAmountINR || 0)}</span>
                  </div>
                )}
              </div>

              {showRupees ? (
                <div className="space-y-1 text-xs text-slate-700 text-right">
                  <div className="flex justify-between">
                    <span className="font-sans">Taxable Value:</span>
                    <span className="font-bold">{formatINR(data.taxableAmountINR || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans">CGST + SGST (3%):</span>
                    <span>
                      {formatINR(
                        data.totalGstINR ?? (data.cgstINR || 0) + (data.sgstINR || 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-950 border-t border-slate-300 pt-1">
                    <span className="font-sans">{ui.grandTotal}:</span>
                    <span>{formatINR(data.grandTotalINR || 0)}</span>
                  </div>
                  {(data.goldExchangeValueINR || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span className="font-sans">
                        {payT.gold} ({formatGrams(exchGrams)}):
                      </span>
                      <span className="font-bold">
                        −{formatINR(data.goldExchangeValueINR || 0)}
                      </span>
                    </div>
                  )}
                  {(data.paidAmountINR || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span className="font-sans">{payT.paidNow}:</span>
                      <span className="font-bold">−{formatINR(data.paidAmountINR || 0)}</span>
                    </div>
                  )}
                  <div
                    className={`flex justify-between text-sm font-bold border-t border-slate-200 pt-1 ${
                      (data.balanceAmountINR || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    <span className="font-sans">{payT.balanceDue}:</span>
                    <span>{formatINR(data.balanceAmountINR || 0)}</span>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-[11px] flex flex-col justify-center space-y-1">
                  <div className="font-sans font-semibold text-slate-700">
                    Pure Weight Settlement Summary
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans">Metal Payable (Net + VA):</span>
                    <span className="font-bold text-slate-900">
                      {formatGrams(totalNetGold + totalWastageGrams)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans">Metal Received:</span>
                    <span className="font-bold text-emerald-700">{formatGrams(exchGrams)}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Non-Invoice Formal Challan Table */
          <table className="w-full text-left text-xs border border-slate-200 border-collapse font-mono tabular-nums">
            <thead>
              <tr className="bg-slate-100 text-slate-800 text-[10px] uppercase border-b border-slate-200 font-sans">
                <th className="p-2.5 border-r border-slate-200">Particulars / Description</th>
                <th className="p-2.5 border-r border-slate-200 text-center">Purity</th>
                <th className="p-2.5 border-r border-slate-200 text-right">Gross (g)</th>
                <th className="p-2.5 border-r border-slate-200 text-right">Net Gold (g)</th>
                <th className="p-2.5 text-right">Fine 999.9 (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2.5 border-r border-slate-200 font-sans">
                  <div className="font-semibold text-slate-900">
                    {data.jewelleryType || data.description || documentHeading}
                  </div>
                  {data.designCode && (
                    <div className="text-[10.5px] text-slate-500">Design: {data.designCode}</div>
                  )}
                  {data.agreedWastagePercent !== undefined && (
                    <div className="text-[10.5px] text-slate-500">
                      Allowed Wastage: {data.agreedWastagePercent}%
                    </div>
                  )}
                </td>
                <td className="p-2.5 border-r border-slate-200 text-center font-bold">
                  {challanPurity}
                </td>
                <td className="p-2.5 border-r border-slate-200 text-right">
                  {formatGrams(challanGross)}
                </td>
                <td className="p-2.5 border-r border-slate-200 text-right font-bold">
                  {formatGrams(challanNet)}
                </td>
                <td className="p-2.5 text-right font-bold text-[#9A7426]">
                  {formatGrams(challanFine)}
                </td>
              </tr>
              {(data.returnedJewelleryNetWeight !== undefined ||
                data.returnedJewelleryNet !== undefined) && (
                <tr className="bg-slate-50">
                  <td className="p-2.5 border-r border-slate-200 font-sans font-medium text-emerald-800">
                    Returned Finished Ornament & Reconciliation
                    {(data.actualLossGrams !== undefined || data.actualLoss !== undefined) && (
                      <span className="block text-[10.5px] text-slate-500">
                        Scrap: {formatGrams(data.returnedScrapWeightGrams || 0)} · Actual Ghat Loss:{' '}
                        {formatGrams(data.actualLossGrams ?? data.actualLoss ?? 0)}
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-center">{challanPurity}</td>
                  <td className="p-2.5 border-r border-slate-200 text-right">
                    {formatGrams(
                      data.returnedJewelleryGrossWeight ??
                        data.returnedJewelleryNetWeight ??
                        data.returnedJewelleryNet ??
                        0
                    )}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-right font-bold text-emerald-700">
                    {formatGrams(
                      data.returnedJewelleryNetWeight ?? data.returnedJewelleryNet ?? 0
                    )}
                  </td>
                  <td className="p-2.5 text-right text-slate-500">—</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Terms / Footer Note */}
        {footerText && (
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            {footerText}
          </div>
        )}

        {/* Dual Signatures */}
        {previewSettings.showSignatures && (
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-center text-[11px] text-slate-500">
            <div>
              <div className="h-8" />
              <div className="border-t border-dashed border-slate-300 pt-1">
                {isInvoiceDoc ? 'Customer / Party Signature' : 'Receiver / Karigar Signature'}
              </div>
            </div>
            <div>
              <div className="h-8" />
              <div className="border-t border-dashed border-slate-300 pt-1 font-semibold text-slate-900">
                For {shopName}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const paperOptions: { key: PrinterPaperSize; label: string }[] = [
    { key: 'A4', label: printerT.paperA4 },
    { key: 'A5', label: printerT.paperA5 },
    { key: 'THERMAL_80', label: printerT.paperThermal80 },
    { key: 'THERMAL_58', label: printerT.paperThermal58 },
  ];

  const copyOptions: { count: PrintCopyCount; label: string }[] = [
    { count: 1, label: '1x' },
    { count: 2, label: '2x' },
    { count: 3, label: '3x' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${printerT.printPreviewTitle} - ${docNumber}`}
      className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Top Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <Printer className="w-5 h-5 text-[#9A7426] dark:text-[#E5C158] shrink-0" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {printerT.printPreviewTitle} · <span className="font-mono">{docNumber}</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {paperDimensionsText} · {previewSettings.copies}{' '}
                {previewSettings.copies > 1 ? 'Copies' : 'Copy'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerPrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#101C32] dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-[#E5C158] dark:text-slate-950 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>{printerT.printNow}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={ui.close}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Format & Layout Control Bar */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Paper Format + Copies */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg">
              {paperOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => updateSetting({ paperSize: opt.key })}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    previewSettings.paperSize === opt.key
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg font-mono tabular-nums">
              {copyOptions.map((c) => (
                <button
                  key={c.count}
                  type="button"
                  onClick={() => updateSetting({ copies: c.count })}
                  className={`px-2 py-1 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    previewSettings.copies === c.count
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Header / Tax / Signature Checkboxes */}
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-700 dark:text-slate-300">
            <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={previewSettings.showShopHeader}
                onChange={(e) => updateSetting({ showShopHeader: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-slate-900 cursor-pointer"
              />
              <span>Address & Phone</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={previewSettings.showTaxHallmarkInfo}
                onChange={(e) => updateSetting({ showTaxHallmarkInfo: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-slate-900 cursor-pointer"
              />
              <span>GSTIN & BIS</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={previewSettings.showSignatures}
                onChange={(e) => updateSetting({ showSignatures: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-slate-900 cursor-pointer"
              />
              <span>Signatures</span>
            </label>
          </div>
        </div>

        {/* WYSIWYG Paper Preview Stage */}
        <div className="flex-1 overflow-y-auto bg-slate-200/75 dark:bg-slate-950 p-4 sm:p-8 flex flex-col items-center gap-6">
          {/* Hidden/Reference single copy for exact 1:1 print extraction */}
          {copiesArray.map((_, copyIdx) => {
            const sheetWidthClass =
              previewSettings.paperSize === 'THERMAL_58'
                ? 'w-[232px] p-3.5'
                : previewSettings.paperSize === 'THERMAL_80'
                ? 'w-[312px] p-4'
                : previewSettings.paperSize === 'A5'
                ? 'w-full max-w-[540px] min-h-[380px] p-6'
                : 'w-full max-w-[740px] min-h-[480px] p-7 sm:p-8';

            return (
              <div
                key={copyIdx}
                className={`bg-white text-slate-900 border border-slate-300 shadow-md transition-all ${
                  thermal ? 'rounded-xs' : 'rounded-sm'
                } ${sheetWidthClass}`}
              >
                {previewSettings.copies > 1 && (
                  <div className="text-right text-[10px] font-bold uppercase text-slate-500 mb-2 font-mono">
                    {copyHeaders[copyIdx] || `Copy ${copyIdx + 1}`}
                  </div>
                )}

                <div ref={copyIdx === 0 ? singleCopyRef : undefined}>
                  {renderDocumentBody()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
