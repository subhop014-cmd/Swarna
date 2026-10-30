import { IndianLanguage, Tenant } from '../types';
import { getPrinterStrings } from '../i18n/printerTranslations';

export type PrinterPaperSize = 'A4' | 'A5' | 'THERMAL_80' | 'THERMAL_58';
export type PrintCopyCount = 1 | 2 | 3;

export interface PrinterSettings {
  paperSize: PrinterPaperSize;
  copies: PrintCopyCount;
  autoPrintOnSave: boolean;
  showShopHeader: boolean;
  showTaxHallmarkInfo: boolean;
  showSignatures: boolean;
  footerNote: string;
}

const STORAGE_KEY = 'swarna_erp_printer_settings';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paperSize: 'A4',
  copies: 1,
  autoPrintOnSave: false,
  showShopHeader: true,
  showTaxHallmarkInfo: true,
  showSignatures: true,
  footerNote: 'BIS Hallmarked 916 Jewellery. Subject to local jurisdiction.',
};

export function loadPrinterSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINTER_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      paperSize:
        parsed.paperSize === 'A5' ||
        parsed.paperSize === 'THERMAL_80' ||
        parsed.paperSize === 'THERMAL_58'
          ? parsed.paperSize
          : 'A4',
      copies: parsed.copies === 2 || parsed.copies === 3 ? parsed.copies : 1,
      autoPrintOnSave: Boolean(parsed.autoPrintOnSave),
      showShopHeader: parsed.showShopHeader !== undefined ? Boolean(parsed.showShopHeader) : true,
      showTaxHallmarkInfo:
        parsed.showTaxHallmarkInfo !== undefined ? Boolean(parsed.showTaxHallmarkInfo) : true,
      showSignatures: parsed.showSignatures !== undefined ? Boolean(parsed.showSignatures) : true,
      footerNote:
        typeof parsed.footerNote === 'string'
          ? parsed.footerNote
          : DEFAULT_PRINTER_SETTINGS.footerNote,
    };
  } catch {
    return { ...DEFAULT_PRINTER_SETTINGS };
  }
}

export function savePrinterSettings(settings: PrinterSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function isThermalPaper(paperSize: PrinterPaperSize): boolean {
  return paperSize === 'THERMAL_80' || paperSize === 'THERMAL_58';
}

export function getPaperSizeDimensionsCss(paperSize: PrinterPaperSize): {
  pageRule: string;
  containerCss: string;
  baseFontPx: number;
} {
  switch (paperSize) {
    case 'A5':
      return {
        pageRule: '@page { size: A5 portrait; margin: 7mm; }',
        containerCss: 'max-width: 134mm; margin: 0 auto; padding: 8px;',
        baseFontPx: 10.5,
      };
    case 'THERMAL_80':
      return {
        pageRule: '@page { size: 80mm auto; margin: 3mm; }',
        containerCss: 'width: 72mm; max-width: 72mm; margin: 0 auto; padding: 4px;',
        baseFontPx: 10,
      };
    case 'THERMAL_58':
      return {
        pageRule: '@page { size: 58mm auto; margin: 2mm; }',
        containerCss: 'width: 52mm; max-width: 52mm; margin: 0 auto; padding: 2px;',
        baseFontPx: 9,
      };
    case 'A4':
    default:
      return {
        pageRule: '@page { size: A4 portrait; margin: 10mm; }',
        containerCss: 'max-width: 190mm; margin: 0 auto; padding: 12px;',
        baseFontPx: 11,
      };
  }
}

export function printHtmlWithSettings(
  innerHtml: string,
  documentTitle: string,
  settings: PrinterSettings = DEFAULT_PRINTER_SETTINGS,
  lang: IndianLanguage = 'en'
): void {
  if (typeof document === 'undefined') return;

  const pStrings = getPrinterStrings(lang);
  const { pageRule, containerCss, baseFontPx } = getPaperSizeDimensionsCss(settings.paperSize);
  const thermal = isThermalPaper(settings.paperSize);

  const copyLabels = [pStrings.originalCopy, pStrings.duplicateCopy, pStrings.triplicateCopy];
  const copiesCount = settings.copies || 1;

  const renderedCopies = Array.from({ length: copiesCount })
    .map((_, idx) => {
      const copyHeader =
        copiesCount > 1
          ? `<div style="text-align:right;font-size:${baseFontPx - 1}px;font-weight:700;color:#475569;margin-bottom:4px;text-transform:uppercase;">${copyLabels[idx] || `Copy ${idx + 1}`}</div>`
          : '';
      const separator =
        idx < copiesCount - 1
          ? thermal
            ? `<div style="border-bottom:1px dashed #64748b;margin:14px 0;"></div>`
            : `<div style="page-break-after:always;margin-bottom:16px;"></div>`
          : '';
      return `<div class="print-copy-wrap">${copyHeader}${innerHtml}</div>${separator}`;
    })
    .join('');

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${documentTitle}</title>
          <style>
            ${pageRule}
            * { box-sizing: border-box; }
            body {
              font-family: ${thermal ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'system-ui, -apple-system, sans-serif'};
              font-size: ${baseFontPx}px;
              color: #0f172a;
              margin: 0;
              ${containerCss}
            }
            table { width: 100%; border-collapse: collapse; font-size: ${Math.max(8.5, baseFontPx - 0.5)}px; }
            th, td { border: 1px solid #cbd5e1; padding: ${thermal ? '3px 4px' : '6px'}; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold, .font-semibold { font-weight: 700; }
            .font-black { font-weight: 800; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
            .font-sans { font-family: system-ui, -apple-system, sans-serif; }
            .uppercase { text-transform: uppercase; }
            .border-b { border-bottom: 1px solid #cbd5e1; }
            .border-b-2 { border-bottom: 2px solid #0f172a; }
            .border-t { border-top: 1px solid #cbd5e1; }
            .border { border: 1px solid #cbd5e1; }
            .border-dashed { border-style: dashed; }
            .rounded, .rounded-lg { border-radius: 4px; }
            .p-2 { padding: 5px; }
            .p-2\\.5 { padding: 6px; }
            .p-3, .p-6 { padding: ${thermal ? '6px' : '10px'}; }
            .pt-1 { padding-top: 4px; }
            .pt-2 { padding-top: 6px; }
            .pt-4, .pt-5, .pt-6 { padding-top: 14px; }
            .pb-1 { padding-bottom: 4px; }
            .pb-2, .pb-3 { padding-bottom: 8px; }
            .py-0\\.5, .py-1 { padding-top: 2px; padding-bottom: 2px; }
            .mt-0\\.5, .mt-1, .mt-1\\.5, .mt-2 { margin-top: 4px; }
            .space-y-0\\.5 > * + *, .space-y-1 > * + * { margin-top: 4px; }
            .space-y-2 > * + *, .space-y-2\\.5 > * + * { margin-top: 7px; }
            .space-y-4 > * + *, .space-y-5 > * + * { margin-top: 12px; }
            .grid, .grid-cols-2 {
              display: grid;
              grid-template-columns: ${thermal ? '1fr' : '1fr 1fr'};
              gap: ${thermal ? '4px' : '12px'};
            }
            .flex { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
            .justify-between { justify-content: space-between; }
            .items-start { align-items: flex-start; }
            .items-end { align-items: flex-end; }
            .text-xs { font-size: ${baseFontPx}px; }
            .text-sm { font-size: ${baseFontPx + 1.5}px; }
            .text-lg, .text-xl { font-size: ${thermal ? baseFontPx + 2 : baseFontPx + 4}px; }
            .text-\\[9\\.5px\\], .text-\\[10px\\], .text-\\[10\\.5px\\], .text-\\[11px\\] { font-size: ${Math.max(8.5, baseFontPx - 1)}px; }
            .text-slate-500, .text-slate-600, .text-slate-700 { color: #475569; }
            .text-\\[#9A7426\\] { color: #9A7426; }
            .text-emerald-700, .text-emerald-800 { color: #047857; }
            .text-rose-700 { color: #be123c; }
            .bg-slate-50, .bg-slate-100 { background-color: #f8fafc; }
            .h-8 { height: 26px; }
          </style>
        </head>
        <body>
          ${renderedCopies}
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  } catch {
    window.print();
  }
}

export function printTestSlip(
  settings: PrinterSettings,
  tenant: Partial<Tenant> | null,
  showRupees: boolean,
  lang: IndianLanguage = 'en'
): void {
  const shopName = tenant?.name || 'Kanakdhara Gold Ornaments';
  const addressLine = [tenant?.address, tenant?.city, tenant?.state].filter(Boolean).join(', ');
  const phoneLine = tenant?.phone ? `Tel: ${tenant.phone}` : '';
  const gstinLine = tenant?.gstin || '27AAGCK7821C1Z3';
  const hallmarkLine = tenant?.hallmarkLicenseNo || 'HM/MH/2021/44120';
  const paperLabel =
    settings.paperSize === 'A4'
      ? 'A4 Full Page'
      : settings.paperSize === 'A5'
      ? 'A5 Half Bill'
      : settings.paperSize === 'THERMAL_80'
      ? '80mm Thermal'
      : '58mm Thermal';

  const sampleItemsHtml = showRupees
    ? `
      <div class="flex font-bold border-b pb-1">
        <span>22K Gold Ring (HUID)</span>
        <span class="font-mono">₹36,420</span>
      </div>
      <div class="flex text-slate-600">
        <span>Net: 5.000g + VA 0.250g (5%)</span>
        <span class="font-mono">Fine: 4.580g</span>
      </div>
    `
    : `
      <div class="flex font-bold border-b pb-1">
        <span>22K Gold Ring (HUID)</span>
        <span class="font-mono">5.000 g</span>
      </div>
      <div class="flex text-slate-600">
        <span>Wastage (5%): +0.250 g</span>
        <span class="font-mono">Fine 999.9: 4.580 g</span>
      </div>
    `;

  const html = `
    <div class="space-y-4">
      <div class="text-center border-b-2 pb-3">
        <div class="text-lg font-black uppercase">${shopName}</div>
        ${
          settings.showShopHeader && (addressLine || phoneLine)
            ? `<div class="text-slate-600 mt-1">${addressLine}${addressLine && phoneLine ? ' · ' : ''}${phoneLine}</div>`
            : ''
        }
        ${
          settings.showTaxHallmarkInfo
            ? `<div class="text-slate-600 mt-1 font-mono">GSTIN: ${gstinLine} · BIS: ${hallmarkLine}</div>`
            : ''
        }
        <div class="font-bold uppercase mt-2">PRINTER TEST SLIP (${paperLabel})</div>
      </div>

      <div class="flex text-slate-600 font-mono">
        <span>Date: ${new Date().toLocaleString('en-IN')}</span>
        <span>Copies: ${settings.copies}</span>
      </div>

      <div class="border rounded p-3 bg-slate-50 space-y-1">
        ${sampleItemsHtml}
      </div>

      ${
        settings.footerNote.trim()
          ? `<div class="text-slate-600 pt-1">${settings.footerNote.trim()}</div>`
          : ''
      }

      ${
        settings.showSignatures
          ? `
        <div class="grid-cols-2 pt-6 border-t text-center text-slate-600">
          <div>
            <div class="h-8"></div>
            <div class="border-t pt-1">Customer Signature</div>
          </div>
          <div>
            <div class="h-8"></div>
            <div class="border-t pt-1 font-bold">For ${shopName}</div>
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;

  printHtmlWithSettings(html, `Printer Test - ${shopName}`, settings, lang);
}
