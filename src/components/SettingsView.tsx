import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Moon,
  Printer,
  RotateCcw,
  Save,
  Sun,
  Trash2,
} from 'lucide-react';
import { IndianLanguage, Tenant } from '../types';
import { getUI } from '../i18n/uiTranslations';
import { getPrinterStrings } from '../i18n/printerTranslations';
import {
  DEFAULT_PRINTER_SETTINGS,
  PrintCopyCount,
  PrinterPaperSize,
  PrinterSettings,
  printTestSlip,
} from '../utils/printerSettings';
import { PrintPreviewModal } from './PrintPreviewModal';

interface SettingsViewProps {
  currentTenant: Tenant | null;
  activeLanguage: IndianLanguage;
  showRupees: boolean;
  onToggleRupees: (enabled: boolean) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: (next?: 'light' | 'dark') => void;
  printerSettings?: PrinterSettings;
  onUpdatePrinterSettings?: (next: PrinterSettings) => void;
  onClearAllData?: () => Promise<void>;
  onSaveTenant?: (updated: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentTenant,
  activeLanguage,
  showRupees,
  onToggleRupees,
  theme = 'light',
  onToggleTheme,
  printerSettings = DEFAULT_PRINTER_SETTINGS,
  onUpdatePrinterSettings,
  onClearAllData,
  onSaveTenant,
}) => {
  const ui = getUI(activeLanguage);
  const printerT = getPrinterStrings(activeLanguage);

  const [name, setName] = useState(currentTenant?.name || 'Kanakdhara Gold Ornaments');
  const [legalName, setLegalName] = useState(
    currentTenant?.legalName || 'Kanakdhara Ornaments & Manufacturing LLP'
  );
  const [gstin, setGstin] = useState(currentTenant?.gstin || '27AAGCK7821C1Z3');
  const [pan, setPan] = useState(currentTenant?.pan || 'AAGCK7821C');
  const [hallmarkLic, setHallmarkLic] = useState(
    currentTenant?.hallmarkLicenseNo || 'HM/MH/2021/44120'
  );
  const [address, setAddress] = useState(
    currentTenant?.address || '118 Zaveri Bazaar, Kalbadevi'
  );
  const [city, setCity] = useState(currentTenant?.city || 'Mumbai');
  const [state, setState] = useState(currentTenant?.state || 'Maharashtra');
  const [phone, setPhone] = useState(currentTenant?.phone || '+91 98200 45678');
  const [email, setEmail] = useState(currentTenant?.email || 'ops@kanakdhara.co.in');

  // Workshop tolerances
  const [standardGhatPercent, setStandardGhatPercent] = useState('1.20');
  const [castingLossAllowance, setCastingLossAllowance] = useState('0.80');
  const [filigreeWastageAllowance, setFiligreeWastageAllowance] = useState('2.50');
  const [defaultMakingPerGram, setDefaultMakingPerGram] = useState('420');
  const [huidMandatory, setHuidMandatory] = useState(true);

  const [localPrinter, setLocalPrinter] = useState<PrinterSettings>(printerSettings);
  const activePrinter = onUpdatePrinterSettings ? printerSettings : localPrinter;

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showSamplePreview, setShowSamplePreview] = useState(false);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);

  const handleConfirmClearAll = async () => {
    if (!onClearAllData) return;
    setIsClearingData(true);
    try {
      await onClearAllData();
      setConfirmClearData(false);
      setStatusMessage(
        'All operational records, stock ledgers, bills, customers, and karigar entries have been cleared.'
      );
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setStatusMessage(err?.message || 'Unable to clear data.');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } finally {
      setIsClearingData(false);
    }
  };

  const updatePrinter = (patch: Partial<PrinterSettings>) => {
    const next: PrinterSettings = { ...activePrinter, ...patch };
    setLocalPrinter(next);
    onUpdatePrinterSettings?.(next);
  };

  const handleResetPrinterDefaults = () => {
    const defaults = { ...DEFAULT_PRINTER_SETTINGS };
    setLocalPrinter(defaults);
    onUpdatePrinterSettings?.(defaults);
    setStatusMessage(ui.rateSaved);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTestPrint = () => {
    printTestSlip(
      activePrinter,
      {
        name,
        address,
        city,
        state,
        phone,
        gstin,
        hallmarkLicenseNo: hallmarkLic,
      },
      showRupees,
      activeLanguage
    );
    setStatusMessage(printerT.testPrintTriggered);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(ui.rateSaved);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    onUpdatePrinterSettings?.(activePrinter);
    onSaveTenant?.({
      name,
      legalName,
      gstin,
      pan,
      hallmarkLicenseNo: hallmarkLic,
      address,
      city,
      state,
      phone,
      email,
    });
  };

  const paperOptions: { key: PrinterPaperSize; label: string }[] = [
    { key: 'A4', label: printerT.paperA4 },
    { key: 'A5', label: printerT.paperA5 },
    { key: 'THERMAL_80', label: printerT.paperThermal80 },
    { key: 'THERMAL_58', label: printerT.paperThermal58 },
  ];

  const copyOptions: { count: PrintCopyCount; label: string }[] = [
    { count: 1, label: printerT.copy1 },
    { count: 2, label: printerT.copy2 },
    { count: 3, label: printerT.copy3 },
  ];

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {ui.settingsTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ui.settingsSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#B38F3B] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{ui.saveSettings}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{statusMessage || ui.rateSaved}</span>
        </div>
      )}

      {/* Appearance & Display Mode Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme Mode Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Appearance Theme
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Switch between crisp Light mode and low-glare Dark mode for workshop counters.
            </p>
          </div>

          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => onToggleTheme?.('light')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                theme === 'light'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5 shrink-0" />
              <span>Light Mode</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleTheme?.('dark')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                theme === 'dark'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-[#E5C158] font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Moon className="w-3.5 h-3.5 shrink-0" />
              <span>Dark Mode</span>
            </button>
          </div>
        </div>

        {/* Currency & Display Mode Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Billing & Display Mode
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {showRupees
                ? 'Rupees (₹) + Gold Weight mode is active across Sales Bills, POS, Ledgers, and Reports.'
                : 'Pure Gold Weight mode is active. Only grams and 999.9 fine gold weights are shown.'}
            </p>
          </div>

          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => onToggleRupees(false)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                !showRupees
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {ui.pureWeightMode}
            </button>
            <button
              type="button"
              onClick={() => onToggleRupees(true)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showRupees
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              ₹ {ui.rupeesVisible}
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Printer Settings Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {printerT.printerSettingsTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {printerT.printerSettingsDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetPrinterDefaults}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>{printerT.resetDefaults}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSamplePreview(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-slate-100 border border-transparent dark:border-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{printerT.previewSampleBill}</span>
            </button>
            <button
              type="button"
              onClick={handleTestPrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C9A24A] hover:bg-[#B38F3B] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{printerT.testPrint}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: Paper Size, Copies, Footer Note */}
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {printerT.paperSizeLabel}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {paperOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => updatePrinter({ paperSize: opt.key })}
                    className={`px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap truncate ${
                      activePrinter.paperSize === opt.key
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {printerT.copiesLabel}
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {copyOptions.map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => updatePrinter({ copies: opt.count })}
                    className={`px-3 py-2 rounded-md text-xs font-medium tabular-nums transition-colors cursor-pointer whitespace-nowrap truncate ${
                      activePrinter.copies === opt.count
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {printerT.footerNoteLabel}
              </label>
              <input
                type="text"
                value={activePrinter.footerNote}
                placeholder={printerT.footerNotePlaceholder}
                onChange={(e) => updatePrinter({ footerNote: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>
          </div>

          {/* Right: Clean Toggle Options */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <label className="flex items-center justify-between py-2.5 first:pt-0 cursor-pointer gap-3">
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-200 block">
                  {printerT.autoPrintLabel}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {printerT.autoPrintHint}
                </span>
              </div>
              <input
                type="checkbox"
                checked={activePrinter.autoPrintOnSave}
                onChange={(e) => updatePrinter({ autoPrintOnSave: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-900 cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-center justify-between py-2.5 cursor-pointer gap-3">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {printerT.showShopHeaderLabel}
              </span>
              <input
                type="checkbox"
                checked={activePrinter.showShopHeader}
                onChange={(e) => updatePrinter({ showShopHeader: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-900 cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-center justify-between py-2.5 cursor-pointer gap-3">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {printerT.showTaxHallmarkLabel}
              </span>
              <input
                type="checkbox"
                checked={activePrinter.showTaxHallmarkInfo}
                onChange={(e) => updatePrinter({ showTaxHallmarkInfo: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-900 cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-center justify-between py-2.5 last:pb-0 cursor-pointer gap-3">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {printerT.showSignaturesLabel}
              </span>
              <input
                type="checkbox"
                checked={activePrinter.showSignatures}
                onChange={(e) => updatePrinter({ showSignatures: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-900 cursor-pointer shrink-0"
              />
            </label>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Card 1: Workshop Profile */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            {ui.workshopProfile}
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Shop / Workshop Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Legal Entity Name
              </label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono uppercase focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  PAN
                </label>
                <input
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono uppercase focus:outline-none focus:border-[#C9A24A]"
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
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.phoneNo}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Hallmark & Wastage Defaults */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
              Hallmark Compliance
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  BIS Hallmark License No.
                </label>
                <input
                  type="text"
                  value={hallmarkLic}
                  onChange={(e) => setHallmarkLic(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-[#C9A24A]"
                />
              </div>

              <label className="flex items-center justify-between py-2 cursor-pointer">
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-200 block">
                    Require 6-Digit HUID Code
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Track hallmark HUID on finished jewellery
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={huidMandatory}
                  onChange={(e) => setHuidMandatory(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {ui.allowedWastagePct} & {ui.makingCharges}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Standard Wastage (%)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={standardGhatPercent}
                  onChange={(e) => setStandardGhatPercent(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-[#C9A24A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Casting Loss (%)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={castingLossAllowance}
                  onChange={(e) => setCastingLossAllowance(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-[#C9A24A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Filigree / Setting (%)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={filigreeWastageAllowance}
                  onChange={(e) => setFiligreeWastageAllowance(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-[#C9A24A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {showRupees ? 'Default Making (₹/g)' : 'Making Rate (₹ Mode Off)'}
                </label>
                <input
                  type="number"
                  disabled={!showRupees}
                  value={defaultMakingPerGram}
                  onChange={(e) => setDefaultMakingPerGram(e.target.value)}
                  className={`w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-[#C9A24A] ${
                    !showRupees
                      ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40'
                      : ''
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Workspace Data Reset Card */}
      {onClearAllData && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Clear All Data
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Permanently wipe all sales bills, gold stock ledger entries, customer accounts, karigars, job cards, melting batches, challans, and cash book vouchers so you can start with a clean register.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!confirmClearData ? (
              <button
                type="button"
                onClick={() => setConfirmClearData(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Data</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isClearingData}
                  onClick={() => setConfirmClearData(false)}
                  className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isClearingData}
                  onClick={handleConfirmClearAll}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isClearingData ? 'Clearing...' : 'Confirm Clear All'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sample Invoice / Thermal Receipt Print Preview Modal */}
      <PrintPreviewModal
        isOpen={showSamplePreview}
        onClose={() => setShowSamplePreview(false)}
        docType="INVOICE"
        data={{
          id: 'sample-preview',
          invoiceNo: 'SAMPLE-INV-001',
          date: new Date().toISOString().split('T')[0],
          customerName: 'Sample Retail Customer',
          type: showRupees ? 'B2C_RETAIL_INVOICE' : 'JOB_WORK_INVOICE',
          items: [
            {
              id: 'sample-item-1',
              description: '22K (916) Gold Necklace',
              hsnCode: '7113',
              purity: '22K',
              huidCode: '8K4M92',
              grossWeightGrams: 12.5,
              stoneWeightGrams: 0,
              netWeightGrams: 12.5,
              wastagePercent: 2.0,
              wastageGrams: 0.25,
              chargeableWeightGrams: 12.75,
              fineGoldGrams: 11.683,
              ratePerGramINR: 6850,
              goldValueINR: 87337.5,
              makingChargesINR: 5250,
              stoneChargesINR: 0,
              totalBeforeTaxINR: 92587.5,
            },
          ],
          totalNetWeightGrams: 12.5,
          totalWastageGrams: 0.25,
          totalFineGoldGrams: 11.683,
          subTotalINR: 92587.5,
          cgstINR: 1388.81,
          sgstINR: 1388.81,
          igstINR: 0,
          grandTotalINR: 95365,
          paidAmountINR: 95365,
          balanceDueINR: 0,
          paidFineGoldGrams: 11.683,
          balanceFineGoldGrams: 0,
          paymentMethod: 'CASH',
          status: 'PAID',
        }}
        tenant={{
          name,
          legalName,
          address,
          city,
          state,
          phone,
          gstin,
          hallmarkLicenseNo: hallmarkLic,
        }}
        activeLanguage={activeLanguage}
        showRupees={showRupees}
        printerSettings={activePrinter}
        onUpdatePrinterSettings={updatePrinter}
      />
    </div>
  );
};
