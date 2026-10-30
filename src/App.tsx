import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { GoldLedgerView } from './components/GoldLedgerView';
import { JobCardsView } from './components/JobCardsView';
import { MeltingView } from './components/MeltingView';
import { InvoicesView } from './components/InvoicesView';
import { CustomersView } from './components/CustomersView';
import { StaffView } from './components/StaffView';
import { CashBookView } from './components/CashBookView';
import { ReportsView } from './components/ReportsView';
import { MeltingModal } from './components/MeltingModal';
import { POSTransactionCenter } from './components/POSTransactionCenter';
import { AdminView } from './components/AdminView';
import { SettingsView } from './components/SettingsView';

const LazyTestRunnerView = lazy(() =>
  import('./components/TestRunnerView').then((mod) => ({
    default: mod.TestRunnerView,
  }))
);
import {
  loadPrinterSettings,
  PrinterSettings,
  savePrinterSettings,
} from './utils/printerSettings';
import {
  Branch,
  BranchTransfer,
  CashBankTransaction,
  Customer,
  GoldLedgerEntry,
  GoldPurityCode,
  GoldRate,
  IndianLanguage,
  Invoice,
  JobCard,
  MeltingBatch,
  OutsidePartyTransaction,
  Staff,
  SubscriptionPlan,
  Tenant,
} from './types';

const VALID_INDIAN_LANGUAGES: ReadonlySet<IndianLanguage> = new Set([
  'en',
  'hi',
  'mr',
  'gu',
  'bn',
  'ta',
  'te',
  'kn',
  'ml',
  'pa',
]);

function isValidIndianLanguage(val: unknown): val is IndianLanguage {
  return typeof val === 'string' && VALID_INDIAN_LANGUAGES.has(val as IndianLanguage);
}

export default function App() {
  // Default to Jewellery Manufacturer tenant (Kanakdhara Gold Ornaments - Mumbai)
  const [currentTenantId, setCurrentTenantId] = useState<string>('tenant_102');
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<IndianLanguage>(() => {
    try {
      const saved = localStorage.getItem('swarna_erp_language');
      if (isValidIndianLanguage(saved)) return saved;
    } catch {}
    return 'hi';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('posTransactions');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Theme Mode: Light / Dark persisted in localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('swarna_erp_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    try {
      localStorage.setItem('swarna_erp_theme', theme);
    } catch {}
  }, [theme]);

  const handleToggleTheme = (next?: 'light' | 'dark') => {
    setTheme((prev) => (next ? next : prev === 'dark' ? 'light' : 'dark'));
  };

  // Rupees (₹) Currency Option in Transactions: Disabled (false) by default until activated in Settings
  const [showRupees, setShowRupees] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('swarna_erp_show_rupees');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleRupees = (enabled: boolean) => {
    setShowRupees(enabled);
    try {
      localStorage.setItem('swarna_erp_show_rupees', enabled ? 'true' : 'false');
    } catch {}
  };

  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(() =>
    loadPrinterSettings()
  );

  const handleUpdatePrinterSettings = (next: PrinterSettings) => {
    setPrinterSettings(next);
    savePrinterSettings(next);
  };

  const handleLanguageChange = (lang: IndianLanguage) => {
    setActiveLanguage(lang);
    try {
      localStorage.setItem('swarna_erp_language', lang);
    } catch {}
  };

  // Business state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [stockSummary, setStockSummary] = useState<any>(null);
  const [ledgerEntries, setLedgerEntries] = useState<GoldLedgerEntry[]>([]);
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashBankTransaction[]>([]);
  const [meltingBatches, setMeltingBatches] = useState<MeltingBatch[]>([]);
  const [outsidePartyTransactions, setOutsidePartyTransactions] = useState<OutsidePartyTransaction[]>([]);
  const [branchTransfers, setBranchTransfers] = useState<BranchTransfer[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Modals & navigation focus state
  const [showMeltingModal, setShowMeltingModal] = useState(false);
  const [reportFocus, setReportFocus] = useState<{ tab: 'customer' | 'karigar'; entityId: string; ts: number } | null>(null);

  // Common headers for multi-tenant isolation
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-tenant-id': currentTenantId,
  });

  // Fetch all business records for current tenant
  const loadTenantData = async (tenantId: string) => {
    const safeFetchJson = async (url: string, fallback: any = {}) => {
      try {
        const res = await fetch(url, { headers: { 'x-tenant-id': tenantId } });
        if (!res.ok) return fallback;
        return await res.json();
      } catch {
        return fallback;
      }
    };

    try {
      const [
        authData,
        ratesData,
        stockData,
        ledgerData,
        jobsData,
        invData,
        custData,
        staffData,
        cashData,
        meltData,
        partyTxData,
        branchTxData,
      ] = await Promise.all([
        safeFetchJson(`/api/auth/me?tenantId=${tenantId}`, {}),
        safeFetchJson('/api/gold-rates', { rates: [] }),
        safeFetchJson('/api/inventory/summary', null),
        safeFetchJson('/api/inventory/ledger', { entries: [] }),
        safeFetchJson('/api/job-cards', { jobCards: [] }),
        safeFetchJson('/api/invoices', { invoices: [] }),
        safeFetchJson('/api/customers', { customers: [] }),
        safeFetchJson('/api/staff', { staff: [] }),
        safeFetchJson('/api/cash-bank/transactions', { transactions: [] }),
        safeFetchJson('/api/pos/melting/batches', { batches: [] }),
        safeFetchJson('/api/pos/parties/transactions', { transactions: [] }),
        safeFetchJson('/api/pos/branch-transfers', { transfers: [] }),
      ]);

      if (authData?.tenant) {
        setCurrentTenant(authData.tenant);
      }
      setAllTenants(Array.isArray(authData?.allTenants) ? authData.allTenants : []);
      setBranches(Array.isArray(authData?.branches) ? authData.branches : []);
      setNotifications(Array.isArray(authData?.notifications) ? authData.notifications : []);

      // Only set language from tenant if user has not explicitly set a valid preference
      try {
        const savedLang = localStorage.getItem('swarna_erp_language');
        if (!isValidIndianLanguage(savedLang) && isValidIndianLanguage(authData?.tenant?.defaultLanguage)) {
          setActiveLanguage(authData.tenant.defaultLanguage);
        }
      } catch {}

      setGoldRates(Array.isArray(ratesData?.rates) ? ratesData.rates : []);
      if (stockData) setStockSummary(stockData);
      setLedgerEntries(Array.isArray(ledgerData?.entries) ? ledgerData.entries : []);
      setJobCards(Array.isArray(jobsData?.jobCards) ? jobsData.jobCards : []);
      setInvoices(Array.isArray(invData?.invoices) ? invData.invoices : []);
      setCustomers(Array.isArray(custData?.customers) ? custData.customers : []);
      setStaffList(Array.isArray(staffData?.staff) ? staffData.staff : []);
      setCashTransactions(Array.isArray(cashData?.transactions) ? cashData.transactions : []);
      setMeltingBatches(Array.isArray(meltData?.batches) ? meltData.batches : []);
      setOutsidePartyTransactions(Array.isArray(partyTxData?.transactions) ? partyTxData.transactions : []);
      setBranchTransfers(Array.isArray(branchTxData?.transfers) ? branchTxData.transfers : []);
    } catch (err) {
      console.error('Error fetching workshop data:', err);
    }
  };

  useEffect(() => {
    loadTenantData(currentTenantId);
  }, [currentTenantId]);

  // Switch active workshop unit
  const handleTenantSwitch = (newTenantId: string) => {
    setReportFocus(null);
    setCurrentTenantId(newTenantId);
  };

  // Update Daily Bullion Standard
  const handleUpdateGoldRate = async (purity: GoldPurityCode, ratePerGramINR: number) => {
    try {
      const res = await fetch('/api/gold-rates', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ purity, ratePerGram: ratePerGramINR, ratePerGramINR }),
      });
      const data = await res.json();
      if (data.success) {
        setGoldRates((prev) =>
          prev.map((r) => (r.purity === purity ? { ...r, ratePerGram: ratePerGramINR, updatedAt: new Date().toISOString() } : r))
        );
      }
    } catch (err) {
      console.error('Error updating bullion rate:', err);
    }
  };

  // Record Vault Stock Movement
  const handleNewStockMovement = async (entry: any) => {
    try {
      const res = await fetch('/api/inventory/movement', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(entry),
      });
      const newRecord = await res.json();
      if (newRecord.id) {
        setLedgerEntries((prev) => [newRecord, ...prev]);
        loadTenantData(currentTenantId);
      }
      return newRecord;
    } catch (err) {
      console.error('Error adding stock movement:', err);
      return null;
    }
  };

  // Commit melting & refining batch
  const handleMeltingBatch = async (batch: any) => {
    try {
      const res = await fetch('/api/inventory/melting-conversion', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(batch),
      });
      const data = await res.json();
      if (data.success) {
        loadTenantData(currentTenantId);
      }
    } catch (err) {
      console.error('Error recording melting batch:', err);
    }
  };

  // Create Karigar Job Card
  const handleNewJobCard = async (job: any) => {
    try {
      const res = await fetch('/api/job-cards', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(job),
      });
      const newJob = await res.json();
      if (newJob.id) {
        setJobCards((prev) => [newJob, ...prev]);
        loadTenantData(currentTenantId);
      }
      return newJob;
    } catch (err) {
      console.error('Error creating job card:', err);
      return null;
    }
  };

  // Return & Reconcile Job Card
  const handleReturnAndReconcile = async (
    jobId: string,
    returnedJewelleryGross: number,
    returnedJewelleryNet: number,
    scrapWeight: number,
    qcRemarks?: string
  ) => {
    try {
      const res = await fetch(`/api/job-cards/${jobId}/return`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          returnedJewelleryGrossWeight: returnedJewelleryGross,
          returnedJewelleryNetWeight: returnedJewelleryNet,
          returnedScrapWeightGrams: scrapWeight,
          qcRemarks,
        }),
      });
      const reconciled = await res.json();
      if (reconciled.id) {
        setJobCards((prev) => prev.map((j) => (j.id === jobId ? reconciled : j)));
        loadTenantData(currentTenantId);
      }
    } catch (err) {
      console.error('Error reconciling job card:', err);
    }
  };

  // Create Tax Invoice / Delivery Challan
  const handleCreateInvoice = async (inv: any) => {
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(inv),
      });
      const newInv = await res.json();
      if (!res.ok) {
        throw new Error(newInv.error || 'Failed to create invoice');
      }
      if (newInv.id) {
        setInvoices((prev) => [newInv, ...prev]);
        loadTenantData(currentTenantId);
      }
      return newInv;
    } catch (err) {
      console.error('Error creating challan/invoice:', err);
      throw err;
    }
  };

  // Register New B2B Client
  const handleAddCustomer = async (cust: any) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(cust),
      });
      const newCust = await res.json();
      if (newCust.id) {
        setCustomers((prev) => [newCust, ...prev]);
      }
      return newCust;
    } catch (err) {
      console.error('Error adding client:', err);
      return null;
    }
  };

  // Deposit Client Gold
  const handleDepositCustomerGold = async (
    customerId: string,
    grossWeight: number,
    nonGoldWeight: number,
    purity: GoldPurityCode,
    notes?: string,
    fineness?: number
  ) => {
    try {
      const res = await fetch(`/api/customers/${customerId}/deposit-gold`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          grossWeightGrams: grossWeight,
          nonGoldWeightGrams: nonGoldWeight,
          purity,
          fineness,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deposit customer gold');
      }
      if (data.success) {
        loadTenantData(currentTenantId);
      }
    } catch (err) {
      console.error('Error depositing client gold:', err);
      throw err;
    }
  };

  // Withdraw / Return Client Custody Gold
  const handleWithdrawCustomerGold = async (
    customerId: string,
    netWeight: number,
    purity: GoldPurityCode,
    notes?: string,
    fineness?: number
  ) => {
    try {
      const res = await fetch(`/api/customers/${customerId}/withdraw-gold`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          netWeightGrams: netWeight,
          purity,
          fineness,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to withdraw customer gold');
      }
      if (data.success) {
        loadTenantData(currentTenantId);
      }
    } catch (err) {
      console.error('Error withdrawing client gold:', err);
      throw err;
    }
  };

  // Add Karigar / Workshop Staff
  const handleAddStaff = async (staffData: any) => {
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(staffData),
      });
      const newStaff = await res.json();
      if (newStaff.id) {
        setStaffList((prev) => [newStaff, ...prev]);
        loadTenantData(currentTenantId);
      }
    } catch (err) {
      console.error('Error adding artisan:', err);
    }
  };

  // Pay Karigar Wage / Labour Advance
  const handlePayKarigarAdvance = async (staffId: string, amountINR: number, notes?: string) => {
    try {
      const res = await fetch(`/api/staff/${staffId}/advance`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amountINR, notes }),
      });
      const data = await res.json();
      if (data.success) {
        loadTenantData(currentTenantId);
      }
    } catch (err) {
      console.error('Error paying karigar advance:', err);
    }
  };

  // Record Workshop Voucher Transaction
  const handleAddCashTransaction = async (txData: any) => {
    try {
      const res = await fetch('/api/cash-bank/transactions', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(txData),
      });
      const newTx = await res.json();
      if (newTx.id) {
        setCashTransactions((prev) => [newTx, ...prev]);
        loadTenantData(currentTenantId);
      }
    } catch (err) {
      console.error('Error recording voucher:', err);
    }
  };

  // Clear All Operational Data
  const handleClearAllData = async () => {
    const res = await fetch('/api/data/clear', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ scope: 'ALL' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to clear workspace data');
    }
    setReportFocus(null);
    await loadTenantData(currentTenantId);
  };

  const today = new Date().toISOString().split('T')[0];
  const overdueJobsCount = jobCards.filter(
    (j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED' && j.dueDate && j.dueDate < today
  ).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* Global Header */}
      <Header
        currentTenant={currentTenant}
        allTenants={allTenants}
        activeLanguage={activeLanguage}
        onLanguageChange={handleLanguageChange}
        onTenantSwitch={handleTenantSwitch}
        goldRates={goldRates}
        onUpdateGoldRate={handleUpdateGoldRate}
        notifications={notifications}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        showRupees={showRupees}
        onToggleRupees={handleToggleRupees}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Body */}
      <div className="flex flex-1 pb-16 md:pb-0">
        {/* Navigation Sidebar (Exclusively Manufacturer Modules) */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setIsMobileMenuOpen(false);
          }}
          activeLanguage={activeLanguage}
          overdueJobsCount={overdueJobsCount}
          mobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Workspace Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {activeTab === 'posTransactions' && (
            <POSTransactionCenter
              tenant={currentTenant}
              branches={branches}
              stockSummary={stockSummary}
              goldRates={goldRates}
              ledgerEntries={ledgerEntries}
              jobCards={jobCards}
              invoices={invoices}
              customers={customers}
              staffList={staffList}
              cashTransactions={cashTransactions}
              activeLanguage={activeLanguage}
              showRupees={showRupees}
              onToggleRupees={handleToggleRupees}
              printerSettings={printerSettings}
              onUpdatePrinterSettings={handleUpdatePrinterSettings}
              onRefresh={() => loadTenantData(currentTenantId)}
              onNewLedgerEntry={handleNewStockMovement}
              onCreateInvoice={handleCreateInvoice}
              onCreateJobCard={handleNewJobCard}
              onReturnJobCard={handleReturnAndReconcile}
              onAddCashTransaction={handleAddCashTransaction}
              onAddCustomer={handleAddCustomer}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              currentTenant={currentTenant}
              stockSummary={stockSummary}
              ledgerEntries={ledgerEntries}
              jobCards={jobCards}
              invoices={invoices}
              customers={customers}
              activeLanguage={activeLanguage}
              goldRates={goldRates}
              showRupees={showRupees}
              onNavigate={setActiveTab}
              onOpenIssueModal={() => setActiveTab('jobCards')}
              onOpenInvoiceModal={() => setActiveTab('posTransactions')}
              onOpenCustomerDepositModal={() => setActiveTab('customers')}
              onOpenMeltingModal={() => setActiveTab('melting')}
            />
          )}

          {activeTab === 'jobCards' && (
            <JobCardsView
              jobCards={jobCards}
              staff={staffList}
              currentTenant={currentTenant}
              activeLanguage={activeLanguage}
              showRupees={showRupees}
              printerSettings={printerSettings}
              onUpdatePrinterSettings={handleUpdatePrinterSettings}
              onNewJobCard={handleNewJobCard}
              onReturnAndReconcile={handleReturnAndReconcile}
            />
          )}

          {activeTab === 'goldLedger' && (
            <GoldLedgerView
              ledgerEntries={ledgerEntries}
              activeLanguage={activeLanguage}
              showRupees={showRupees}
              onNewTransaction={handleNewStockMovement}
              onOpenMeltingModal={() => setActiveTab('melting')}
            />
          )}

          {activeTab === 'karigars' && (
            <StaffView
              staffList={staffList}
              jobCards={jobCards}
              activeLanguage={activeLanguage}
              showRupees={showRupees}
              onAddStaff={handleAddStaff}
              onIssueGoldToKarigar={handleNewJobCard}
              onPayKarigarAdvance={handlePayKarigarAdvance}
              onOpenKarigarReport={(karigarId) => {
                setReportFocus({ tab: 'karigar', entityId: karigarId, ts: Date.now() });
                setActiveTab('reports');
              }}
            />
          )}

          {activeTab === 'melting' && (
            <MeltingView
              activeLanguage={activeLanguage}
              meltingBatches={meltingBatches}
              onSubmitBatch={handleMeltingBatch}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesView
              invoices={invoices}
              customers={customers}
              goldRates={goldRates}
              currentTenant={currentTenant}
              activeLanguage={activeLanguage}
              showRupees={showRupees}
              printerSettings={printerSettings}
              onUpdatePrinterSettings={handleUpdatePrinterSettings}
              onCreateInvoice={handleCreateInvoice}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              customers={customers}
              activeLanguage={activeLanguage}
              showRupees={showRupees}
              onAddCustomer={handleAddCustomer}
              onDepositCustomerGold={handleDepositCustomerGold}
              onWithdrawCustomerGold={handleWithdrawCustomerGold}
              onOpenCustomerReport={(customerId) => {
                setReportFocus({ tab: 'customer', entityId: customerId, ts: Date.now() });
                setActiveTab('reports');
              }}
            />
          )}

          {activeTab === 'cashBook' && (
            <CashBookView
              transactions={cashTransactions}
              activeLanguage={activeLanguage}
              onAddTransaction={handleAddCashTransaction}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              stockSummary={stockSummary}
              ledgerEntries={ledgerEntries}
              jobCards={jobCards}
              staff={staffList}
              customers={customers}
              invoices={invoices}
              cashTransactions={cashTransactions}
              meltingBatches={meltingBatches}
              outsidePartyTransactions={outsidePartyTransactions}
              branchTransfers={branchTransfers}
              currentTenant={currentTenant}
              activeLanguage={activeLanguage}
              goldRates={goldRates}
              showRupees={showRupees}
              initialFocus={reportFocus}
            />
          )}

          {activeTab === 'subscription' && (
            <AdminView
              tenants={allTenants as any}
              currentTenant={currentTenant}
              plans={[
                {
                  id: 'silver_artisan',
                  name: 'Silver Artisan',
                  code: 'BASIC',
                  priceINRMonth: 1999,
                  priceINRYar: 19990,
                  maxUsers: 3,
                  maxBranches: 1,
                  maxMonthlyTransactions: 500,
                  features: ['Core Gold Ledger', 'Job Cards', 'Fast POS', 'Basic Reports'],
                },
                {
                  id: 'gold_workshop',
                  name: 'Gold Workshop',
                  code: 'PROFESSIONAL',
                  priceINRMonth: 4999,
                  priceINRYar: 49990,
                  maxUsers: 10,
                  maxBranches: 2,
                  maxMonthlyTransactions: 2500,
                  features: ['Outside Party Challans', 'Melting & Refining Module', 'Ghat Wastage Audit', 'GST Invoices', '10 Indian Languages'],
                },
                {
                  id: 'master_jeweller',
                  name: 'Master Jeweller',
                  code: 'ENTERPRISE_MULTI_BRANCH',
                  priceINRMonth: 9999,
                  priceINRYar: 99990,
                  maxUsers: 50,
                  maxBranches: 5,
                  maxMonthlyTransactions: 10000,
                  features: ['Universal Gold Ledger', 'Multi-tenant Isolation', 'Automated Fire Assay & Tunch', 'Custom ERP Export', 'Dedicated Account Manager'],
                },
              ]}
              auditLogs={[]}
              activeLanguage={activeLanguage}
              onUpgradePlan={async (planId) => {
                try {
                  const res = await fetch('/api/subscriptions/upgrade', {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ planId }),
                  });
                  const data = await res.json();
                  if (data.success && data.tenant) {
                    setCurrentTenant(data.tenant);
                  }
                } catch (e) {
                  console.error('Failed to upgrade plan', e);
                }
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              currentTenant={currentTenant}
              activeLanguage={activeLanguage}
              showRupees={showRupees}
              onToggleRupees={handleToggleRupees}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              printerSettings={printerSettings}
              onUpdatePrinterSettings={handleUpdatePrinterSettings}
              onClearAllData={handleClearAllData}
              onSaveTenant={(updated) => {
                if (currentTenant) {
                  setCurrentTenant({ ...currentTenant, ...updated });
                }
              }}
            />
          )}

          {activeTab === 'automatedTests' && (
            <Suspense
              fallback={
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Loading Automated Test Suite...
                </div>
              }
            >
              <LazyTestRunnerView activeLanguage={activeLanguage} />
            </Suspense>
          )}
        </main>
      </div>

      {/* Global Modals */}
      <MeltingModal
        isOpen={showMeltingModal}
        onClose={() => setShowMeltingModal(false)}
        onSubmit={handleMeltingBatch}
        activeLanguage={activeLanguage}
      />
    </div>
  );
}
