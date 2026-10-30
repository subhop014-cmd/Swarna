import React, { useState } from 'react';
import {
  Building2,
  Check,
  ChevronRight,
  Coins,
  Globe,
  Hammer,
  MapPin,
  X,
} from 'lucide-react';
import { IndianLanguage, Tenant } from '../types';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';
import { getUI } from '../i18n/uiTranslations';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
  activeLanguage: IndianLanguage;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  activeLanguage,
}) => {
  const ui = getUI(activeLanguage);
  const [step, setStep] = useState(1);

  // Wizard fields
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [businessType, setBusinessType] = useState<Tenant['businessType']>('MANUFACTURER');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [pinCode, setPinCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [defaultLang, setDefaultLang] = useState<IndianLanguage>(activeLanguage);
  const [initialGoldStock, setInitialGoldStock] = useState('500');
  const [initialCashBalance, setInitialCashBalance] = useState('100000');

  if (!isOpen) return null;

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !city) return;

    onComplete({
      name,
      legalName: legalName || name,
      businessType,
      address,
      city,
      state,
      pinCode,
      phone,
      email,
      gstin: gstin || undefined,
      defaultLanguage: defaultLang,
      initialGoldStockGrams: parseFloat(initialGoldStock) || 0,
      initialCashBalanceINR: parseFloat(initialCashBalance) || 0,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl p-6 sm:p-8 shadow-2xl my-8 text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FAF5E8] dark:bg-[#C9A24A]/10 text-[#C9A24A] border border-[#C9A24A]/30 flex items-center justify-center font-bold">
              <Hammer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-cinzel">
                {ui.onboardingTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{step} / 3 · {ui.workshopProfile}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between my-5 px-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center space-x-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  step === s
                    ? 'bg-[#C9A24A] text-white dark:text-slate-950 font-bold'
                    : step > s
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/60'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {step > s ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              <span className={`text-xs font-semibold ${step === s ? 'text-[#9A7426] dark:text-[#E5C158]' : 'text-slate-500 dark:text-slate-400'}`}>
                {s === 1 ? ui.workshopProfile : s === 2 ? 'GSTIN' : ui.businessFineGold}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Business Profile */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {ui.workshopProfile} *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Swarna Karigar Workshop"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Operating Unit Model
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-[#C9A24A]"
                >
                  <option value="MANUFACTURER">Jewellery Manufacturer / Karkhana</option>
                  <option value="GOLDSMITH">Independent Master Goldsmith</option>
                  <option value="WHOLESALER">Bullion & Casting Foundry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {ui.languagePreference}
                </label>
                <select
                  value={defaultLang}
                  onChange={(e) => setDefaultLang(e.target.value as IndianLanguage)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-[#C9A24A]"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} ({l.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">City / Jewellery Hub *</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Mumbai / Zaveri Bazaar"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#C9A24A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">State / UT</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={!name || !city}
                onClick={() => setStep(2)}
                className="flex items-center space-x-1.5 px-5 py-2 bg-[#C9A24A] hover:bg-[#B38F3B] dark:hover:bg-[#E5C158] disabled:opacity-50 text-white dark:text-slate-950 font-semibold rounded-lg text-xs shadow-xs transition cursor-pointer"
              >
                <span>Continue to Legal & Tax</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Legal & Tax */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Full Legal Entity Name
              </label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Kanakdhara Ornaments & Manufacturing LLP"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  GSTIN (15-digit code)
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="27AAGCK7821C1Z3"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono placeholder-slate-400 focus:outline-none focus:border-[#C9A24A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Workshop Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98200 45678"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono placeholder-slate-400 focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Workshop Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 118 Zaveri Bazaar, Kalbadevi"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-xs"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center space-x-1.5 px-5 py-2 bg-[#C9A24A] hover:bg-[#B38F3B] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs shadow-xs transition cursor-pointer"
              >
                <span>Continue to Vault Opening</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Vault Opening */}
        {step === 3 && (
          <form onSubmit={handleFinish} className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Setup initial workshop vault bullion and cash drawer balance.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Opening 24K Pure Gold Bullion Stock (Grams)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={initialGoldStock}
                  onChange={(e) => setInitialGoldStock(e.target.value)}
                  placeholder="e.g. 500.000"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-[#9A7426] dark:text-[#E5C158] font-mono font-bold focus:outline-none focus:border-[#C9A24A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Opening Cash Balance (₹ INR)
                </label>
                <input
                  type="number"
                  value={initialCashBalance}
                  onChange={(e) => setInitialCashBalance(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
            </div>

            <div className="p-3 bg-[#FAF5E8] dark:bg-[#C9A24A]/10 rounded-lg border border-[#C9A24A]/30 text-[11px] text-[#9A7426] dark:text-[#E5C158]">
              ✨ An isolated database tenant will be registered with dedicated fine gold vault ledger, Karigar holdings, and Ghat loss reconciliation.
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-xs"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#C9A24A] hover:bg-[#B38F3B] dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition cursor-pointer"
              >
                {ui.save}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
