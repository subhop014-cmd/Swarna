import React from 'react';
import {
  BarChart3,
  Building,
  Coins,
  FileText,
  Flame,
  Hammer,
  LayoutDashboard,
  Receipt,
  Settings as SettingsIcon,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { IndianLanguage } from '../types';

export type ActiveTab =
  | 'posTransactions'
  | 'dashboard'
  | 'customers'
  | 'invoices'
  | 'goldLedger'
  | 'jobCards'
  | 'karigars'
  | 'melting'
  | 'reports'
  | 'cashBook'
  | 'subscription'
  | 'settings'
  | 'automatedTests';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  activeLanguage: IndianLanguage;
  overdueJobsCount: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_LABELS: Record<IndianLanguage, Record<string, string>> = {
  en: {
    posTransactions: 'Quick Counter',
    dashboard: 'Dashboard',
    invoices: 'Sales Bills',
    jobCards: 'Job Cards',
    goldLedger: 'Gold Stock',
    melting: 'Melting',
    cashBook: 'Cash Book',
    customers: 'Customers',
    karigars: 'Karigars',
    reports: 'Reports',
    settings: 'Settings',
  },
  hi: {
    posTransactions: 'क्विक काउंटर (POS)',
    dashboard: 'डैशबोर्ड',
    invoices: 'बिक्री बिल',
    jobCards: 'जॉब कार्ड',
    goldLedger: 'सोना स्टॉक',
    melting: 'गलना (घलाई)',
    cashBook: 'रोकड़ बही',
    customers: 'ग्राहक',
    karigars: 'कारीगर',
    reports: 'रिपोर्ट',
    settings: 'सेटिंग्स',
  },
  mr: {
    posTransactions: 'क्विक काउंटर (POS)',
    dashboard: 'डॅशबोर्ड',
    invoices: 'विक्री बिले',
    jobCards: 'जॉब कार्ड',
    goldLedger: 'सुवर्ण साठा',
    melting: 'गाळणी व टंच',
    cashBook: 'रोकड वही',
    customers: 'ग्राहक',
    karigars: 'कारीगर',
    reports: 'अहवाल',
    settings: 'सेटिंग्ज',
  },
  gu: {
    posTransactions: 'ક્વિક કાઉન્ટર (POS)',
    dashboard: 'ડેશબોર્ડ',
    invoices: 'વેચાણ બિલ',
    jobCards: 'જોબ કાર્ડ',
    goldLedger: 'સોનાનો સ્ટોક',
    melting: 'ગાળણ અને ટંચ',
    cashBook: 'રોકડ મેળ',
    customers: 'ગ્રાહકો',
    karigars: 'કારીગરો',
    reports: 'રિપોર્ટ્સ',
    settings: 'સેटिंग્સ',
  },
  bn: {
    posTransactions: 'কুইক কাউন্টার (POS)',
    dashboard: 'ড্যাশবোর্ড',
    invoices: 'বিক্রয় বিল',
    jobCards: 'জব কার্ড',
    goldLedger: 'সোনার স্টক',
    melting: 'গলানো (ঘলাই)',
    cashBook: 'ক্যাশ বুক',
    customers: 'গ্রাহক',
    karigars: 'কারিগর',
    reports: 'রিপোর্ট',
    settings: 'সেটিংস',
  },
  ta: {
    posTransactions: 'விரைவு கவுண்டர் (POS)',
    dashboard: 'டாஷ்போர்டு',
    invoices: 'விற்பனை பில்கள்',
    jobCards: 'பணி அட்டைகள்',
    goldLedger: 'தங்க இருப்பு',
    melting: 'உருகுதல்',
    cashBook: 'ரொக்க ஏடு',
    customers: 'வாடிக்கையாளர்கள்',
    karigars: 'காரிகர்கள்',
    reports: 'அறிக்கைகள்',
    settings: 'அமைப்புகள்',
  },
  te: {
    posTransactions: 'క్విక్ కౌంటర్ (POS)',
    dashboard: 'డాష్‌బోర్డ్',
    invoices: 'అమ్మకాల బిల్లులు',
    jobCards: 'జాబ్ కార్డులు',
    goldLedger: 'బంగారు స్టాక్',
    melting: 'కరగడం (మెల్టింగ్)',
    cashBook: 'నగదు పుస్తకం',
    customers: 'కస్టమర్లు',
    karigars: 'కారిగర్లు',
    reports: 'రిపోర్ట్‌లు',
    settings: 'సెట్టింగ్‌లు',
  },
  kn: {
    posTransactions: 'ಕ್ವಿಕ್ ಕೌಂಟರ್ (POS)',
    dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    invoices: 'ಮಾರಾಟ ಬಿಲ್‌ಗಳು',
    jobCards: 'ಜಾಬ್ ಕಾರ್ಡ್‌ಗಳು',
    goldLedger: 'ಚಿನ್ನದ ಸ್ಟಾಕ್',
    melting: 'ಕರಗಿಸುವಿಕೆ',
    cashBook: 'ನಗದು ಪುಸ್ತಕ',
    customers: 'ಗ್ರಾಹಕರು',
    karigars: 'ಕಾರಿಗಾರರು',
    reports: 'ವರದಿಗಳು',
    settings: 'ಸೆಟ್ಟಿಂಗ್ಸ್',
  },
  ml: {
    posTransactions: 'ക്വിക്ക് കൗണ്ടർ (POS)',
    dashboard: 'ഡാഷ്‌ബോർഡ്',
    invoices: 'വിൽപ്പന ബില്ലുകൾ',
    jobCards: 'ജോബ് കാർഡുകൾ',
    goldLedger: 'സ്വർണ്ണ സ്റ്റോക്ക്',
    melting: 'ഉരുക്കൽ',
    cashBook: 'ക്യാഷ് ബുക്ക്',
    customers: 'ഉപഭോക്താക്കൾ',
    karigars: 'കാരിഗർമാർ',
    reports: 'റിപ്പോർട്ടുകൾ',
    settings: 'ക്രമീകരണങ്ങൾ',
  },
  pa: {
    posTransactions: 'ਕੁਇੱਕ ਕਾਊਂਟਰ (POS)',
    dashboard: 'ਡੈਸ਼ਬੋਰਡ',
    invoices: 'ਵਿਕਰੀ ਬਿੱਲ',
    jobCards: 'ਜਾਬ ਕਾਰਡ',
    goldLedger: 'ਸੋਨਾ ਸਟਾਕ',
    melting: 'ਗਾਲਣਾ (ਮੈਲਟਿੰਗ)',
    cashBook: 'ਰੋਕੜ ਵਹੀ',
    customers: 'ਗਾਹਕ',
    karigars: 'ਕਾਰੀਗਰ',
    reports: 'ਰਿਪੋਰਟਾਂ',
    settings: 'ਸੈਟਿੰਗਾਂ',
  },
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  activeLanguage,
  overdueJobsCount,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const labels = NAV_LABELS[activeLanguage] || NAV_LABELS.en;

  const navGroups: Array<
    Array<{
      id: ActiveTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      count?: number;
    }>
  > = [
    [
      { id: 'posTransactions', label: labels.posTransactions, icon: Receipt },
      { id: 'dashboard', label: labels.dashboard, icon: LayoutDashboard },
    ],
    [
      { id: 'invoices', label: labels.invoices, icon: FileText },
      {
        id: 'jobCards',
        label: labels.jobCards,
        icon: Hammer,
        count: overdueJobsCount > 0 ? overdueJobsCount : undefined,
      },
      { id: 'goldLedger', label: labels.goldLedger, icon: Coins },
      { id: 'melting', label: labels.melting, icon: Flame },
      { id: 'cashBook', label: labels.cashBook, icon: Wallet },
    ],
    [
      { id: 'customers', label: labels.customers, icon: Building },
      { id: 'karigars', label: labels.karigars, icon: Users },
      { id: 'reports', label: labels.reports, icon: BarChart3 },
      { id: 'settings', label: labels.settings, icon: SettingsIcon },
    ],
  ];

  const renderNavContent = (isMobile = false) => (
    <div className="p-3 space-y-3">
      {navGroups.map((group, groupIdx) => (
        <div
          key={groupIdx}
          className={
            groupIdx > 0
              ? 'pt-3 border-t border-slate-100 dark:border-slate-800 space-y-0.5'
              : 'space-y-0.5'
          }
        >
          {group.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  if (isMobile && onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-slate-900 dark:bg-[#C9A24A]/15 text-white dark:text-[#E5C158] font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#E5C158]' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </div>

                {item.count !== undefined && (
                  <span
                    className={`text-xs font-mono tabular-nums shrink-0 ${
                      isActive
                        ? 'text-amber-300 font-semibold'
                        : 'text-rose-600 dark:text-rose-400 font-semibold'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 select-none overflow-y-auto transition-colors duration-150">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-64 max-w-[82vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full flex flex-col overflow-y-auto z-10 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">SwarnaERP</span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderNavContent(true)}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-1.5 px-2 transition-colors duration-150">
        {[
          { id: 'posTransactions' as ActiveTab, label: 'POS', icon: Receipt },
          { id: 'dashboard' as ActiveTab, label: labels.dashboard.split(' ')[0], icon: LayoutDashboard },
          { id: 'invoices' as ActiveTab, label: labels.invoices.split(' ')[0], icon: FileText },
          { id: 'jobCards' as ActiveTab, label: labels.jobCards.split(' ')[0], icon: Hammer },
          { id: 'reports' as ActiveTab, label: labels.reports.split(' ')[0], icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center py-1 px-2.5 rounded-lg transition-colors cursor-pointer min-w-0 ${
                isActive
                  ? 'text-slate-900 dark:text-[#E5C158] font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-[#9A7426] dark:text-[#E5C158]' : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <span className="text-[10px] mt-0.5 truncate max-w-[60px] whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
