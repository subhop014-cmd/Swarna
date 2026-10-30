import React, { useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  Edit3,
  Globe,
  Menu,
  Moon,
  Sun,
} from 'lucide-react';
import { GoldPurityCode, GoldRate, IndianLanguage, Tenant } from '../types';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';
import { getUI } from '../i18n/uiTranslations';

interface HeaderProps {
  currentTenant: Tenant | null;
  allTenants: Array<{ id: string; name: string; businessType: string; city: string }>;
  activeLanguage: IndianLanguage;
  onLanguageChange: (lang: IndianLanguage) => void;
  onTenantSwitch: (tenantId: string) => void;
  onOpenOnboarding?: () => void;
  goldRates: GoldRate[];
  onUpdateGoldRate: (purity: GoldPurityCode, rate: number) => void;
  notifications: any[];
  userRole?: string;
  onSearch?: (query: string) => void;
  onToggleMobileMenu?: () => void;
  showRupees?: boolean;
  onToggleRupees?: (val: boolean) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: (next?: 'light' | 'dark') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTenant,
  allTenants,
  activeLanguage,
  onLanguageChange,
  onTenantSwitch,
  goldRates,
  onUpdateGoldRate,
  notifications,
  onToggleMobileMenu,
  showRupees = false,
  onToggleRupees,
  theme = 'light',
  onToggleTheme,
}) => {
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showTenantMenu, setShowTenantMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showRateMenu, setShowRateMenu] = useState(false);
  const [edit24K, setEdit24K] = useState('');
  const [edit22K, setEdit22K] = useState('');

  const ui = getUI(activeLanguage);
  const currentLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === activeLanguage);
  const unreadNotifs = notifications.filter((n) => !n.isRead);

  const rate24K = goldRates.find((r) => r.purity === '24K')?.ratePerGram || 7650;
  const rate22K = goldRates.find((r) => r.purity === '22K')?.ratePerGram || 7010;

  const closeAllMenus = () => {
    setShowLangMenu(false);
    setShowTenantMenu(false);
    setShowNotifMenu(false);
    setShowRateMenu(false);
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between gap-6 sticky top-0 z-30 select-none transition-colors duration-150">
      {/* Zone 1: Mobile Menu + Single-Line Brand / Shop Switcher */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => {
              const next = !showTenantMenu;
              closeAllMenus();
              setShowTenantMenu(next);
            }}
            className="flex items-center gap-2 py-1.5 px-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-w-0"
          >
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[300px] whitespace-nowrap">
              {currentTenant?.name || 'SwarnaERP'}
            </span>
            {allTenants.length > 1 && (
              <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            )}
          </button>

          {showTenantMenu && allTenants.length > 0 && (
            <div className="absolute left-0 mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 z-50">
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                {ui.SwitchWorkshop}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {allTenants.map((ten) => (
                  <button
                    key={ten.id}
                    type="button"
                    onClick={() => {
                      onTenantSwitch(ten.id);
                      setShowTenantMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs cursor-pointer ${
                      currentTenant?.id === ten.id
                        ? 'bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate">{ten.name}</div>
                      {ten.city && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {ten.city}
                        </div>
                      )}
                    </div>
                    {currentTenant?.id === ten.id && (
                      <Check className="w-4 h-4 text-[#9A7426] dark:text-[#E5C158] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone 2: Live Gold Rate Editor (shown cleanly when ₹ mode is active) */}
      <div className="hidden lg:flex items-center justify-center">
        {showRupees && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const next = !showRateMenu;
                closeAllMenus();
                setEdit24K(String(rate24K));
                setEdit22K(String(rate22K));
                setShowRateMenu(next);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="font-semibold text-slate-500 dark:text-slate-400">24K</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                ₹{rate24K.toLocaleString('en-IN')}/g
              </span>
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
              <span className="font-semibold text-slate-500 dark:text-slate-400">22K</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                ₹{rate22K.toLocaleString('en-IN')}/g
              </span>
              <Edit3 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-0.5" />
            </button>

            {showRateMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3.5 z-50 space-y-3">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
                  {ui.updateRate} (₹/g)
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      24K (999.9)
                    </label>
                    <input
                      type="number"
                      value={edit24K}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEdit24K(v);
                        const num = parseFloat(v);
                        if (!isNaN(num) && num > 0) {
                          setEdit22K(String(Math.round((num * 916) / 1000)));
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-[#C9A24A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      22K (916)
                    </label>
                    <input
                      type="number"
                      value={edit22K}
                      onChange={(e) => setEdit22K(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-[#C9A24A]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const r24 = parseFloat(edit24K);
                    const r22 = parseFloat(edit22K);
                    if (!isNaN(r24) && r24 > 0) onUpdateGoldRate('24K', r24);
                    if (!isNaN(r22) && r22 > 0) onUpdateGoldRate('22K', r22);
                    setShowRateMenu(false);
                  }}
                  className="w-full bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#B38F3B] text-white dark:text-slate-950 font-semibold py-2 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  {ui.save}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zone 3: Mode Switch (Grams / ₹), Language Selector, Light/Dark Toggle, Alerts */}
      <div className="flex items-center gap-2 shrink-0">
        {onToggleRupees && (
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => onToggleRupees(false)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showRupees
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              ₹ {ui.rupeesVisible}
            </button>
          </div>
        )}

        {/* 10 Indian Languages Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const next = !showLangMenu;
              closeAllMenus();
              setShowLangMenu(next);
            }}
            className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{currentLangMeta?.nativeName || 'English'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          </button>

          {showLangMenu && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 z-50">
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                {ui.languagePreference}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      onLanguageChange(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs cursor-pointer ${
                      activeLanguage === lang.code
                        ? 'bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <span>{lang.nativeName}</span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1.5">
                        ({lang.name})
                      </span>
                    </div>
                    {activeLanguage === lang.code && (
                      <Check className="w-3.5 h-3.5 text-[#9A7426] dark:text-[#E5C158]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Light / Dark Theme Toggle */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={() => {
              closeAllMenus();
              onToggleTheme();
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#E5C158] shrink-0" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>
        )}

        {/* Workshop Alerts */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const next = !showNotifMenu;
              closeAllMenus();
              setShowNotifMenu(next);
            }}
            className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifs.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-amber-500 text-white text-[10px] font-bold font-mono tabular-nums rounded-full flex items-center justify-center">
                {unreadNotifs.length}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-1.5 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <span>Alerts ({notifications.length})</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 mt-1">
                {notifications.length === 0 ? (
                  <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                    {ui.noRecordsFound}
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="py-2.5 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {n.type === 'OVERDUE_JOB' ? 'Overdue Job Card' : 'Notice'}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {n.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
