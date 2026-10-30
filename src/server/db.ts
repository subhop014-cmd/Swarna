import { Decimal } from 'decimal.js';
import {
  AuditLog,
  Branch,
  CashBankTransaction,
  Customer,
  GoldAccountType,
  GoldLedgerEntry,
  GoldLedgerTransactionType,
  GoldPurityCode,
  GoldRate,
  Invoice,
  JobCard,
  Membership,
  NotificationItem,
  Staff,
  SubscriptionPlan,
  Supplier,
  Tenant,
  User,
  BranchTransfer,
  MeltingBatch,
  OutsideParty,
  OutsidePartyTransaction,
  POSBillDraft,
  StockReconciliationRecord,
  UnifiedDashboardMetrics,
} from '../types';
import {
  calculateFineGold,
  calculateInvoiceItem,
  calculateWastageReconciliation,
  PURITY_STANDARDS,
} from '../utils/goldMath';

class GoldsmithDatabase {
  public tenants: Tenant[] = [];
  public branches: Branch[] = [];
  public users: User[] = [];
  public memberships: Membership[] = [];
  public subscriptionPlans: SubscriptionPlan[] = [];
  public goldRates: Record<string, GoldRate[]> = {}; // tenantId -> rates
  public goldLedger: GoldLedgerEntry[] = [];
  public jobCards: JobCard[] = [];
  public invoices: Invoice[] = [];
  public customers: Customer[] = [];
  public suppliers: Supplier[] = [];
  public staff: Staff[] = [];
  public cashBankTransactions: CashBankTransaction[] = [];
  public auditLogs: AuditLog[] = [];
  public notifications: NotificationItem[] = [];
  public outsideParties: OutsideParty[] = [];
  public outsidePartyTransactions: OutsidePartyTransaction[] = [];
  public meltingBatches: MeltingBatch[] = [];
  public branchTransfers: BranchTransfer[] = [];
  public posDrafts: POSBillDraft[] = [];
  public stockReconciliations: StockReconciliationRecord[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // 1. Subscription Plans
    this.subscriptionPlans = [
      {
        id: 'plan_trial',
        name: 'Free 14-Day Trial',
        code: 'FREE_TRIAL',
        priceINRMonth: 0,
        priceINRYar: 0,
        maxUsers: 2,
        maxBranches: 1,
        maxMonthlyTransactions: 50,
        features: ['Basic Gold Ledger', 'Job Cards (up to 20)', 'Estimates & Invoicing', 'Single Branch'],
      },
      {
        id: 'plan_basic',
        name: 'Goldsmith Basic',
        code: 'BASIC',
        priceINRMonth: 1499,
        priceINRYar: 14990,
        maxUsers: 5,
        maxBranches: 1,
        maxMonthlyTransactions: 250,
        features: ['Fine Gold Tracking', 'Karigar Work Register', 'GST Invoicing', 'Wastage Audits'],
      },
      {
        id: 'plan_pro',
        name: 'Jeweller Professional',
        code: 'PROFESSIONAL',
        priceINRMonth: 2999,
        priceINRYar: 29990,
        maxUsers: 15,
        maxBranches: 2,
        maxMonthlyTransactions: 1000,
        features: ['Full Accounting & Cash Book', 'Barcode & HUID Hallmarking', 'Regional Language UI', 'Customer Gold CRM', 'Automated Overdue Alerts'],
      },
      {
        id: 'plan_enterprise',
        name: 'Business Multi-Branch',
        code: 'ENTERPRISE_MULTI_BRANCH',
        priceINRMonth: 5999,
        priceINRYar: 59990,
        maxUsers: 100,
        maxBranches: 10,
        maxMonthlyTransactions: 100000,
        features: ['Unlimited Branches', 'Inter-Branch Stock Transfers', 'Melting & Refining Batch Accounting', 'Priority Dedicated Support', 'Custom Tax & Export Formats'],
      },
    ];

    // 2. Tenants (Independent jewellery businesses in India)
    const t1: Tenant = {
      id: 'tenant_101',
      name: 'Sri Mahalakshmi Jewellers',
      legalName: 'Sri Mahalakshmi Jewellery Works Pvt Ltd',
      businessType: 'RETAILER',
      gstin: '33AABCS1429B1Z8',
      pan: 'AABCS1429B',
      hallmarkLicenseNo: 'HM/TN/2022/91672',
      address: '42 South Usman Road, T. Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pinCode: '600017',
      phone: '+91 98401 22345',
      email: 'care@mahalakshmijewellers.in',
      defaultLanguage: 'ta',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      subscriptionPlanId: 'plan_pro',
      subscriptionStatus: 'ACTIVE',
      createdAt: '2026-01-10T10:00:00Z',
    };

    const t2: Tenant = {
      id: 'tenant_102',
      name: 'Kanakdhara Gold Ornaments',
      legalName: 'Kanakdhara Ornaments & Manufacturing LLP',
      businessType: 'MANUFACTURER',
      gstin: '27AAGCK7821C1Z3',
      pan: 'AAGCK7821C',
      hallmarkLicenseNo: 'HM/MH/2021/44120',
      address: '118 Zaveri Bazaar, Kalbadevi',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400002',
      phone: '+91 98200 45678',
      email: 'ops@kanakdhara.co.in',
      defaultLanguage: 'mr',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      subscriptionPlanId: 'plan_enterprise',
      subscriptionStatus: 'ACTIVE',
      createdAt: '2026-02-01T09:30:00Z',
    };

    const t3: Tenant = {
      id: 'tenant_103',
      name: 'Swarnanjali Karigar Kendra',
      legalName: 'Swarnanjali Handcrafted Jewellers',
      businessType: 'KARIGAR_WORKSHOP',
      gstin: '19AAFFS9901D1ZP',
      pan: 'AAFFS9901D',
      address: '15 Bowbazar Goldsmith Lane',
      city: 'Kolkata',
      state: 'West Bengal',
      pinCode: '700012',
      phone: '+91 98310 11223',
      email: 'kendra@swarnanjali.org',
      defaultLanguage: 'bn',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      subscriptionPlanId: 'plan_basic',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: '2026-11-01T23:59:59Z',
      createdAt: '2026-03-15T11:15:00Z',
    };

    this.tenants = [t1, t2, t3];

    // 3. Branches
    this.branches = [
      {
        id: 'branch_101_1',
        tenantId: 'tenant_101',
        name: 'T. Nagar Main Showroom & Workshop',
        code: 'TNG-01',
        address: '42 South Usman Road, T. Nagar',
        city: 'Chennai',
        isMainBranch: true,
      },
      {
        id: 'branch_101_2',
        tenantId: 'tenant_101',
        name: 'Coimbatore Cross Cut Branch',
        code: 'CBE-02',
        address: '88 Cross Cut Road, Gandhipuram',
        city: 'Coimbatore',
        isMainBranch: false,
      },
      {
        id: 'branch_102_1',
        tenantId: 'tenant_102',
        name: 'Zaveri Bazaar Manufacturing Unit',
        code: 'ZVB-MUM',
        address: '118 Zaveri Bazaar',
        city: 'Mumbai',
        isMainBranch: true,
      },
      {
        id: 'branch_103_1',
        tenantId: 'tenant_103',
        name: 'Bowbazar Artisan Guild',
        code: 'BW-KOL',
        address: '15 Bowbazar Lane',
        city: 'Kolkata',
        isMainBranch: true,
      },
    ];

    // 4. Users & Memberships
    this.users = [
      {
        id: 'user_owner_101',
        name: 'M. S. Sundararajan',
        email: 'sundar@mahalakshmijewellers.in',
        phone: '+91 98401 22345',
        preferredLanguage: 'ta',
        activeTenantId: 'tenant_101',
      },
      {
        id: 'user_manager_101',
        name: 'K. Ramesh',
        email: 'ramesh@mahalakshmijewellers.in',
        phone: '+91 98401 99887',
        preferredLanguage: 'en',
        activeTenantId: 'tenant_101',
      },
      {
        id: 'user_owner_102',
        name: 'Rajendra Joshi',
        email: 'r.joshi@kanakdhara.co.in',
        phone: '+91 98200 45678',
        preferredLanguage: 'mr',
        activeTenantId: 'tenant_102',
      },
      {
        id: 'user_admin_saas',
        name: 'Platform Super Admin',
        email: 'admin@swarnaerp.com',
        phone: '+91 99000 00000',
        preferredLanguage: 'en',
        activeTenantId: 'tenant_101',
        isPlatformAdmin: true,
      },
    ];

    this.memberships = [
      {
        id: 'mem_1',
        userId: 'user_owner_101',
        tenantId: 'tenant_101',
        role: 'OWNER',
        branchId: 'branch_101_1',
        joinedAt: '2026-01-10T10:00:00Z',
      },
      {
        id: 'mem_2',
        userId: 'user_manager_101',
        tenantId: 'tenant_101',
        role: 'MANAGER',
        branchId: 'branch_101_1',
        joinedAt: '2026-01-15T10:00:00Z',
      },
      {
        id: 'mem_3',
        userId: 'user_owner_102',
        tenantId: 'tenant_102',
        role: 'OWNER',
        branchId: 'branch_102_1',
        joinedAt: '2026-02-01T09:30:00Z',
      },
    ];

    // 5. Gold Rates (Live benchmark rates per gram in INR)
    const seedRates = (tenantId: string) => [
      { purity: '24K' as GoldPurityCode, fineness: 999.9, ratePerGram: 7450, updatedAt: '2026-10-14T09:00:00Z' },
      { purity: '22K' as GoldPurityCode, fineness: 916.0, ratePerGram: 6825, updatedAt: '2026-10-14T09:00:00Z' },
      { purity: '20K' as GoldPurityCode, fineness: 833.0, ratePerGram: 6205, updatedAt: '2026-10-14T09:00:00Z' },
      { purity: '18K' as GoldPurityCode, fineness: 750.0, ratePerGram: 5588, updatedAt: '2026-10-14T09:00:00Z' },
      { purity: '14K' as GoldPurityCode, fineness: 585.0, ratePerGram: 4358, updatedAt: '2026-10-14T09:00:00Z' },
      { purity: '9K' as GoldPurityCode, fineness: 375.0, ratePerGram: 2794, updatedAt: '2026-10-14T09:00:00Z' },
    ];

    this.goldRates['tenant_101'] = seedRates('tenant_101');
    this.goldRates['tenant_102'] = seedRates('tenant_102');
    this.goldRates['tenant_103'] = seedRates('tenant_103');

    // 6. Start with clean, empty operational & transactional collections
    this.staff = [];
    this.customers = [];
    this.suppliers = [];
    this.goldLedger = [];

    this.jobCards = [];
    this.invoices = [];
    this.cashBankTransactions = [];
    this.auditLogs = [];
    this.notifications = [];
    this.outsideParties = [];
    this.outsidePartyTransactions = [];
    this.meltingBatches = [];
    this.branchTransfers = [];
    this.posDrafts = [];
    this.stockReconciliations = [];
  }

  // --- Multi-Tenant Security & Scoped Queries ---

  public getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.find((t) => t.id === tenantId);
  }

  public getTenantBranches(tenantId: string): Branch[] {
    return this.branches.filter((b) => b.tenantId === tenantId);
  }

  public getTenantGoldRates(tenantId: string): GoldRate[] {
    return this.goldRates[tenantId] || this.goldRates['tenant_101'] || [];
  }

  public updateTenantGoldRate(tenantId: string, purity: GoldPurityCode, ratePerGram: number): GoldRate {
    if (!this.goldRates[tenantId]) {
      this.goldRates[tenantId] = [
        { purity: '24K', fineness: 999.9, ratePerGram: 7450, updatedAt: new Date().toISOString() },
        { purity: '22K', fineness: 916.0, ratePerGram: 6825, updatedAt: new Date().toISOString() },
        { purity: '20K', fineness: 833.0, ratePerGram: 6205, updatedAt: new Date().toISOString() },
        { purity: '18K', fineness: 750.0, ratePerGram: 5588, updatedAt: new Date().toISOString() },
        { purity: '14K', fineness: 585.0, ratePerGram: 4358, updatedAt: new Date().toISOString() },
        { purity: '9K', fineness: 375.0, ratePerGram: 2794, updatedAt: new Date().toISOString() },
      ];
    }
    const idx = this.goldRates[tenantId].findIndex((r) => r.purity === purity);
    const standard = PURITY_STANDARDS[purity];
    const newEntry: GoldRate = {
      purity,
      fineness: standard.fineness,
      ratePerGram,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) {
      this.goldRates[tenantId][idx] = newEntry;
    } else {
      this.goldRates[tenantId].push(newEntry);
    }
    return newEntry;
  }

  public getTenantGoldLedger(tenantId: string, branchId?: string): GoldLedgerEntry[] {
    return this.goldLedger.filter(
      (e) => e.tenantId === tenantId && (!branchId || e.branchId === branchId)
    );
  }

  public addGoldLedgerEntry(
    entry: Omit<GoldLedgerEntry, 'id' | 'transactionNo'>,
    options?: { skipCustomerSync?: boolean }
  ): GoldLedgerEntry {
    const net = new Decimal(entry.netWeightGrams || 0).toDecimalPlaces(3);
    const fineness = new Decimal(entry.fineness || PURITY_STANDARDS[entry.purity]?.fineness || 916);

    let effectiveEntry: Omit<GoldLedgerEntry, 'id' | 'transactionNo'> = {
      ...entry,
      netWeightGrams: net.toNumber(),
    };

    // Synchronize direct customer gold deposit / withdrawal movements with customer account balances
    if (
      !options?.skipCustomerSync &&
      net.gt(0) &&
      (entry.type === 'CUSTOMER_DEPOSIT' || entry.type === 'CUSTOMER_WITHDRAWAL')
    ) {
      const rawName = (entry.counterpartyName || '').trim();
      let resolvedCustomer =
        (entry.counterpartyId
          ? this.customers.find((c) => c.id === entry.counterpartyId && c.tenantId === entry.tenantId)
          : undefined) ||
        (rawName
          ? this.customers.find(
              (c) => c.tenantId === entry.tenantId && c.name.toLowerCase() === rawName.toLowerCase()
            )
          : undefined);

      if (!resolvedCustomer) {
        const fallbackName = rawName || 'Customer Custody Account';
        resolvedCustomer = this.addCustomer({
          tenantId: entry.tenantId,
          name: fallbackName,
          phone: '+91 90000 00000',
          city: this.getTenant(entry.tenantId)?.city || 'Local',
          state: this.getTenant(entry.tenantId)?.state || 'India',
          preferredLanguage: this.getTenant(entry.tenantId)?.defaultLanguage || 'en',
          customerGoldBalanceGrams: 0,
          monetaryBalanceINR: 0,
          creditLimitINR: 100000,
        });
      }

      const prevBal = new Decimal(resolvedCustomer.customerGoldBalanceGrams || 0);
      const targetVaultAccount: GoldAccountType =
        entry.purity === '24K' ? 'BUSINESS_OWNED' : 'SCRAP_REFINING';

      if (entry.type === 'CUSTOMER_DEPOSIT') {
        resolvedCustomer.customerGoldBalanceGrams = prevBal.plus(net).toDecimalPlaces(3).toNumber();
        const debtSettled = prevBal.lt(0)
          ? Decimal.min(net, prevBal.abs()).toDecimalPlaces(3)
          : new Decimal(0);
        const custodyPortion = net.minus(debtSettled).toDecimalPlaces(3);

        if (debtSettled.gt(0) && custodyPortion.gt(0)) {
          this.addGoldLedgerEntry(
            {
              ...entry,
              type: 'CUSTOMER_OLD_GOLD',
              sourceAccount: targetVaultAccount,
              destinationAccount: targetVaultAccount,
              counterpartyId: resolvedCustomer.id,
              counterpartyName: resolvedCustomer.name,
              counterpartyType: 'CUSTOMER',
              grossWeightGrams: debtSettled.toNumber(),
              nonGoldWeightGrams: 0,
              netWeightGrams: debtSettled.toNumber(),
              fineGoldWeightGrams: calculateFineGold(debtSettled, fineness).toNumber(),
              notes: `${entry.notes || 'Customer Gold In'} (Gold Due settled)`,
            },
            { skipCustomerSync: true }
          );
          effectiveEntry = {
            ...entry,
            type: 'CUSTOMER_DEPOSIT',
            sourceAccount: 'CUSTOMER_OWNED',
            destinationAccount: 'CUSTOMER_OWNED',
            counterpartyId: resolvedCustomer.id,
            counterpartyName: resolvedCustomer.name,
            counterpartyType: 'CUSTOMER',
            grossWeightGrams: custodyPortion.toNumber(),
            nonGoldWeightGrams: 0,
            netWeightGrams: custodyPortion.toNumber(),
          };
        } else if (debtSettled.gt(0) && custodyPortion.eq(0)) {
          effectiveEntry = {
            ...entry,
            type: 'CUSTOMER_OLD_GOLD',
            sourceAccount: targetVaultAccount,
            destinationAccount: targetVaultAccount,
            counterpartyId: resolvedCustomer.id,
            counterpartyName: resolvedCustomer.name,
            counterpartyType: 'CUSTOMER',
            notes: `${entry.notes || 'Customer Gold In'} (Gold Due settled)`,
          };
        } else {
          effectiveEntry = {
            ...entry,
            type: 'CUSTOMER_DEPOSIT',
            sourceAccount: 'CUSTOMER_OWNED',
            destinationAccount: 'CUSTOMER_OWNED',
            counterpartyId: resolvedCustomer.id,
            counterpartyName: resolvedCustomer.name,
            counterpartyType: 'CUSTOMER',
          };
        }
      } else {
        // CUSTOMER_WITHDRAWAL
        const custodyUsed = prevBal.gt(0)
          ? Decimal.min(net, prevBal).toDecimalPlaces(3)
          : new Decimal(0);
        const loanFromShop = net.minus(custodyUsed).toDecimalPlaces(3);
        resolvedCustomer.customerGoldBalanceGrams = prevBal.minus(net).toDecimalPlaces(3).toNumber();

        if (custodyUsed.gt(0) && loanFromShop.gt(0)) {
          this.addGoldLedgerEntry(
            {
              ...entry,
              type: 'GOLD_SALE',
              sourceAccount: 'BUSINESS_OWNED',
              destinationAccount: 'BUSINESS_OWNED',
              counterpartyId: resolvedCustomer.id,
              counterpartyName: resolvedCustomer.name,
              counterpartyType: 'CUSTOMER',
              grossWeightGrams: loanFromShop.toNumber(),
              nonGoldWeightGrams: 0,
              netWeightGrams: loanFromShop.toNumber(),
              fineGoldWeightGrams: calculateFineGold(loanFromShop, fineness).toNumber(),
              notes: `${entry.notes || 'Customer Gold Out'} (Gold Due receivable)`,
            },
            { skipCustomerSync: true }
          );
          effectiveEntry = {
            ...entry,
            type: 'CUSTOMER_WITHDRAWAL',
            sourceAccount: 'CUSTOMER_OWNED',
            destinationAccount: 'CUSTOMER_OWNED',
            counterpartyId: resolvedCustomer.id,
            counterpartyName: resolvedCustomer.name,
            counterpartyType: 'CUSTOMER',
            grossWeightGrams: custodyUsed.toNumber(),
            nonGoldWeightGrams: 0,
            netWeightGrams: custodyUsed.toNumber(),
          };
        } else if (loanFromShop.gt(0) && custodyUsed.eq(0)) {
          effectiveEntry = {
            ...entry,
            type: 'GOLD_SALE',
            sourceAccount: 'BUSINESS_OWNED',
            destinationAccount: 'BUSINESS_OWNED',
            counterpartyId: resolvedCustomer.id,
            counterpartyName: resolvedCustomer.name,
            counterpartyType: 'CUSTOMER',
          };
        } else {
          effectiveEntry = {
            ...entry,
            type: 'CUSTOMER_WITHDRAWAL',
            sourceAccount: 'CUSTOMER_OWNED',
            destinationAccount: 'CUSTOMER_OWNED',
            counterpartyId: resolvedCustomer.id,
            counterpartyName: resolvedCustomer.name,
            counterpartyType: 'CUSTOMER',
          };
        }
      }
    }

    const count = this.goldLedger.filter((e) => e.tenantId === effectiveEntry.tenantId).length + 1;
    const year = new Date().getFullYear();
    const transactionNo = `GL-${year}-${String(count).padStart(4, '0')}`;
    const id = `gl_${effectiveEntry.tenantId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Calculate exact fine gold equivalent
    const effectiveNet = new Decimal(effectiveEntry.netWeightGrams || 0);
    const fineGold = calculateFineGold(effectiveNet, fineness).toNumber();

    const newRecord: GoldLedgerEntry = {
      ...effectiveEntry,
      id,
      transactionNo,
      fineGoldWeightGrams: fineGold,
    };

    this.goldLedger.unshift(newRecord);

    // Write audit log
    this.addAuditLog({
      tenantId: effectiveEntry.tenantId,
      userId: effectiveEntry.enteredBy,
      userName: effectiveEntry.enteredBy,
      action: 'GOLD_LEDGER_TRANSACTION',
      entity: 'GoldLedgerEntry',
      entityId: id,
      details: `${effectiveEntry.type}: ${effectiveEntry.netWeightGrams}g ${effectiveEntry.purity} (${effectiveEntry.sourceAccount} -> ${effectiveEntry.destinationAccount})`,
    });

    return newRecord;
  }

  public getTenantStockSummary(tenantId: string) {
    const entries = this.getTenantGoldLedger(tenantId);

    // Sum balances across accounts
    // For every entry, if destination is account X, we add. If source is account X, we subtract.
    const accountBalances: Record<GoldAccountType, { netWeight: Decimal; fineGoldWeight: Decimal }> = {
      BUSINESS_OWNED: { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      CUSTOMER_OWNED: { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      KARIGAR_HELD: { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      OUTSIDE_PARTY: { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      MELTING_IN_PROCESS: { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      BRANCH_IN_TRANSIT: { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      SCRAP_REFINING: { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      FINISHED_GOODS: { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
    };

    const purityBalances: Record<GoldPurityCode, { netWeight: Decimal; fineGoldWeight: Decimal }> = {
      '24K': { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      '22K': { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      '20K': { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      '18K': { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      '14K': { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
      '9K': { netWeight: new Decimal(0), fineGoldWeight: new Decimal(0) },
    };

    for (const entry of entries) {
      const net = new Decimal(entry.netWeightGrams || 0);
      const fine = new Decimal(entry.fineGoldWeightGrams || 0);

      if (entry.sourceAccount !== entry.destinationAccount) {
        if (accountBalances[entry.sourceAccount]) {
          accountBalances[entry.sourceAccount].netWeight = accountBalances[entry.sourceAccount].netWeight.minus(net);
          accountBalances[entry.sourceAccount].fineGoldWeight = accountBalances[entry.sourceAccount].fineGoldWeight.minus(fine);
        }
        if (accountBalances[entry.destinationAccount]) {
          accountBalances[entry.destinationAccount].netWeight = accountBalances[entry.destinationAccount].netWeight.plus(net);
          accountBalances[entry.destinationAccount].fineGoldWeight = accountBalances[entry.destinationAccount].fineGoldWeight.plus(fine);
        }
        // Melting transforms purity (e.g. 24K Pure -> 22K Gold or Scrap -> 24K Pure)
        if (entry.destinationAccount === 'MELTING_IN_PROCESS' && purityBalances[entry.purity]) {
          purityBalances[entry.purity].netWeight = purityBalances[entry.purity].netWeight.minus(net);
          purityBalances[entry.purity].fineGoldWeight = purityBalances[entry.purity].fineGoldWeight.minus(fine);
        }
        if (entry.sourceAccount === 'MELTING_IN_PROCESS' && purityBalances[entry.purity]) {
          purityBalances[entry.purity].netWeight = purityBalances[entry.purity].netWeight.plus(net);
          purityBalances[entry.purity].fineGoldWeight = purityBalances[entry.purity].fineGoldWeight.plus(fine);
        }
      } else {
        const inwardSameAccountTypes = [
          'OPENING_BALANCE',
          'CUSTOMER_DEPOSIT',
          'BULLION_PURCHASE',
          'CUSTOMER_OLD_GOLD',
          'FINISHED_JEWELLERY_RECEIPT',
          'SCRAP_RECOVERY',
          'RECEIVE_FROM_MELTING',
        ];
        const outwardSameAccountTypes = [
          'GOLD_SALE',
          'SALE_DELIVERY',
          'CUSTOMER_WITHDRAWAL',
          'SUPPLIER_SETTLEMENT',
          'SEND_TO_MELTING',
        ];

        if (inwardSameAccountTypes.includes(entry.type)) {
          if (accountBalances[entry.destinationAccount]) {
            accountBalances[entry.destinationAccount].netWeight = accountBalances[entry.destinationAccount].netWeight.plus(net);
            accountBalances[entry.destinationAccount].fineGoldWeight = accountBalances[entry.destinationAccount].fineGoldWeight.plus(fine);
          }
          if (purityBalances[entry.purity]) {
            purityBalances[entry.purity].netWeight = purityBalances[entry.purity].netWeight.plus(net);
            purityBalances[entry.purity].fineGoldWeight = purityBalances[entry.purity].fineGoldWeight.plus(fine);
          }
        } else if (outwardSameAccountTypes.includes(entry.type)) {
          if (accountBalances[entry.sourceAccount]) {
            accountBalances[entry.sourceAccount].netWeight = accountBalances[entry.sourceAccount].netWeight.minus(net);
            accountBalances[entry.sourceAccount].fineGoldWeight = accountBalances[entry.sourceAccount].fineGoldWeight.minus(fine);
          }
          if (purityBalances[entry.purity]) {
            purityBalances[entry.purity].netWeight = purityBalances[entry.purity].netWeight.minus(net);
            purityBalances[entry.purity].fineGoldWeight = purityBalances[entry.purity].fineGoldWeight.minus(fine);
          }
        } else if (entry.type === 'PHYSICAL_STOCK_ADJUSTMENT') {
          const isPositive = (entry.notes || '').includes('+');
          if (isPositive) {
            if (accountBalances[entry.destinationAccount]) {
              accountBalances[entry.destinationAccount].netWeight = accountBalances[entry.destinationAccount].netWeight.plus(net);
              accountBalances[entry.destinationAccount].fineGoldWeight = accountBalances[entry.destinationAccount].fineGoldWeight.plus(fine);
            }
            if (purityBalances[entry.purity]) {
              purityBalances[entry.purity].netWeight = purityBalances[entry.purity].netWeight.plus(net);
              purityBalances[entry.purity].fineGoldWeight = purityBalances[entry.purity].fineGoldWeight.plus(fine);
            }
          } else {
            if (accountBalances[entry.sourceAccount]) {
              accountBalances[entry.sourceAccount].netWeight = accountBalances[entry.sourceAccount].netWeight.minus(net);
              accountBalances[entry.sourceAccount].fineGoldWeight = accountBalances[entry.sourceAccount].fineGoldWeight.minus(fine);
            }
            if (purityBalances[entry.purity]) {
              purityBalances[entry.purity].netWeight = purityBalances[entry.purity].netWeight.minus(net);
              purityBalances[entry.purity].fineGoldWeight = purityBalances[entry.purity].fineGoldWeight.minus(fine);
            }
          }
        }
      }
    }

    // Active furnace batches only: completed batches have no residual alloy/loss left in MELTING_IN_PROCESS
    const activeMeltingBatches = this.meltingBatches.filter(
      (m) => m.tenantId === tenantId && m.status === 'IN_PROCESS'
    );
    accountBalances.MELTING_IN_PROCESS = {
      netWeight: activeMeltingBatches.reduce(
        (acc, m) => acc.plus(m.totalInputGrossGrams || 0),
        new Decimal(0)
      ),
      fineGoldWeight: activeMeltingBatches.reduce(
        (acc, m) => acc.plus(m.totalInputFineGoldGrams || 0),
        new Decimal(0)
      ),
    };

    let totalPhysicalGrams = new Decimal(0);
    let totalFineGoldGrams = new Decimal(0);

    for (const key of Object.keys(accountBalances) as GoldAccountType[]) {
      totalPhysicalGrams = totalPhysicalGrams.plus(accountBalances[key].netWeight);
      totalFineGoldGrams = totalFineGoldGrams.plus(accountBalances[key].fineGoldWeight);
    }

    // Work in progress: active job cards
    const activeJobs = this.jobCards.filter((j) => j.tenantId === tenantId && j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
    const workInProgressGrams = activeJobs.reduce((sum, j) => sum + (j.issuedNetWeightGrams || 0), 0);

    // Unreconciled loss from completed jobs + melting
    const completedJobs = this.jobCards.filter((j) => j.tenantId === tenantId && j.isReconciled);
    const unreconciledJobLoss = completedJobs.reduce((sum, j) => sum + (j.excessLossGrams || 0), 0);

    // Today's metrics
    const today = new Date().toISOString().split('T')[0];
    const todayInvoices = this.invoices.filter((i) => i.tenantId === tenantId && (i.date?.startsWith(today) || i.createdAt?.startsWith(today)));
    const todaySalesINR = todayInvoices.reduce((sum, i) => sum + (i.grandTotalINR || 0), 0);

    const todayCashReceipts = this.cashBankTransactions.filter(
      (c) => c.tenantId === tenantId && c.type === 'RECEIPT' && c.date?.startsWith(today)
    );
    const todayCollectionsINR = todayCashReceipts.reduce((sum, c) => sum + (c.amountINR || 0), 0);

    // Pending approvals & overdue
    const pendingMelting = this.meltingBatches.filter((m) => m.tenantId === tenantId && m.status === 'IN_PROCESS').length;
    const pendingApprovalsCount = pendingMelting;

    const overdueJobs = activeJobs.filter((j) => j.dueDate && j.dueDate < today).length;
    const overdueParties = this.outsidePartyTransactions.filter(
      (p) => p.tenantId === tenantId && p.direction === 'ISSUE' && p.expectedReturnDate && p.expectedReturnDate < today
    ).length;
    const overdueTransactionsCount = overdueJobs + overdueParties;

    return {
      totalPhysicalGrams: Math.max(0, totalPhysicalGrams.toNumber()),
      totalFineGoldGrams: Math.max(0, totalFineGoldGrams.toNumber()),
      mainVaultGrams: Math.max(0, accountBalances.BUSINESS_OWNED.netWeight.toNumber()),
      karigarHeldGrams: Math.max(0, accountBalances.KARIGAR_HELD.netWeight.toNumber()),
      partyHeldGrams: Math.max(0, accountBalances.OUTSIDE_PARTY.netWeight.toNumber()),
      meltingInProcessGrams: Math.max(0, accountBalances.MELTING_IN_PROCESS.netWeight.toNumber()),
      workInProgressGrams,
      finishedJewelleryGrams: Math.max(0, accountBalances.FINISHED_GOODS.netWeight.toNumber()),
      recoverableScrapGrams: Math.max(0, accountBalances.SCRAP_REFINING.netWeight.toNumber()),
      unreconciledLossGrams: Number(unreconciledJobLoss.toFixed(3)),
      todaySalesINR,
      todayCollectionsINR,
      pendingApprovalsCount,
      overdueTransactionsCount,
      accountBalances: {
        BUSINESS_OWNED: {
          netWeight: Math.max(0, accountBalances.BUSINESS_OWNED.netWeight.toNumber()),
          fineGoldWeight: Math.max(0, accountBalances.BUSINESS_OWNED.fineGoldWeight.toNumber()),
        },
        CUSTOMER_OWNED: {
          netWeight: Math.max(0, accountBalances.CUSTOMER_OWNED.netWeight.toNumber()),
          fineGoldWeight: Math.max(0, accountBalances.CUSTOMER_OWNED.fineGoldWeight.toNumber()),
        },
        KARIGAR_HELD: {
          netWeight: Math.max(0, accountBalances.KARIGAR_HELD.netWeight.toNumber()),
          fineGoldWeight: Math.max(0, accountBalances.KARIGAR_HELD.fineGoldWeight.toNumber()),
        },
        OUTSIDE_PARTY: {
          netWeight: Math.max(0, accountBalances.OUTSIDE_PARTY.netWeight.toNumber()),
          fineGoldWeight: Math.max(0, accountBalances.OUTSIDE_PARTY.fineGoldWeight.toNumber()),
        },
        MELTING_IN_PROCESS: {
          netWeight: Math.max(0, accountBalances.MELTING_IN_PROCESS.netWeight.toNumber()),
          fineGoldWeight: Math.max(0, accountBalances.MELTING_IN_PROCESS.fineGoldWeight.toNumber()),
        },
        BRANCH_IN_TRANSIT: {
          netWeight: Math.max(0, accountBalances.BRANCH_IN_TRANSIT.netWeight.toNumber()),
          fineGoldWeight: Math.max(0, accountBalances.BRANCH_IN_TRANSIT.fineGoldWeight.toNumber()),
        },
        SCRAP_REFINING: {
          netWeight: Math.max(0, accountBalances.SCRAP_REFINING.netWeight.toNumber()),
          fineGoldWeight: Math.max(0, accountBalances.SCRAP_REFINING.fineGoldWeight.toNumber()),
        },
        FINISHED_GOODS: {
          netWeight: Math.max(0, accountBalances.FINISHED_GOODS.netWeight.toNumber()),
          fineGoldWeight: Math.max(0, accountBalances.FINISHED_GOODS.fineGoldWeight.toNumber()),
        },
      },
      purityBalances: Object.entries(purityBalances).map(([purity, val]) => ({
        purity: purity as GoldPurityCode,
        netWeight: Math.max(0, val.netWeight.toNumber()),
        fineGoldWeight: Math.max(0, val.fineGoldWeight.toNumber()),
      })),
    };
  }

  public getTenantJobCards(tenantId: string): JobCard[] {
    return this.jobCards.filter((jc) => jc.tenantId === tenantId);
  }

  public createJobCard(params: Omit<JobCard, 'id' | 'jobNo' | 'createdAt' | 'isReconciled' | 'actualLossGrams' | 'allowedWastageGrams' | 'excessLossGrams'>): JobCard {
    const count = this.jobCards.filter((jc) => jc.tenantId === params.tenantId).length + 1;
    const year = new Date().getFullYear();
    const jobNo = `JC-${year}-${String(count).padStart(3, '0')}`;
    const id = `job_${params.tenantId}_${Date.now()}`;

    const issuedNet = new Decimal(params.issuedNetWeightGrams || 0);
    const fineness = new Decimal(params.fineness || 916);
    const issuedFine = calculateFineGold(issuedNet, fineness).toNumber();
    const allowedWastage = issuedNet.mul(new Decimal(params.agreedWastagePercent || 0)).div(100).toDecimalPlaces(3).toNumber();

    const newJob: JobCard = {
      ...params,
      id,
      jobNo,
      issuedFineGoldWeightGrams: issuedFine,
      returnedJewelleryGrossWeight: 0,
      returnedJewelleryNetWeight: 0,
      returnedScrapWeightGrams: 0,
      actualLossGrams: 0,
      allowedWastageGrams: allowedWastage,
      excessLossGrams: 0,
      isReconciled: false,
      createdAt: new Date().toISOString(),
    };

    this.jobCards.unshift(newJob);

    // Atomically create gold ledger entry issuing gold from BUSINESS_OWNED to KARIGAR_HELD
    this.addGoldLedgerEntry({
      tenantId: params.tenantId,
      branchId: params.branchId,
      date: new Date().toISOString(),
      type: 'ISSUE_TO_KARIGAR',
      sourceAccount: 'BUSINESS_OWNED',
      destinationAccount: 'KARIGAR_HELD',
      counterpartyId: params.karigarId,
      counterpartyName: params.karigarName,
      counterpartyType: 'KARIGAR',
      jobCardId: id,
      grossWeightGrams: params.issuedGrossWeightGrams,
      nonGoldWeightGrams: params.issuedGrossWeightGrams - params.issuedNetWeightGrams,
      netWeightGrams: params.issuedNetWeightGrams,
      purity: params.purity,
      fineness: params.fineness,
      fineGoldWeightGrams: issuedFine,
      enteredBy: 'System/Manager',
      notes: `Gold issued for Job ${jobNo} (${params.jewelleryType})`,
    });

    // Update staff active jobs and holding
    const staffMember = this.staff.find((s) => s.id === params.karigarId && s.tenantId === params.tenantId);
    if (staffMember) {
      staffMember.currentGoldHoldingGrams = new Decimal(staffMember.currentGoldHoldingGrams)
        .plus(params.issuedNetWeightGrams)
        .toNumber();
      staffMember.activeJobsCount += 1;
    }

    return newJob;
  }

  public returnAndReconcileJobCard(
    tenantId: string,
    jobCardId: string,
    returnedJewelleryGrossWeight: number,
    returnedJewelleryNetWeight: number,
    returnedScrapWeightGrams: number,
    qcRemarks?: string
  ): JobCard {
    const job = this.jobCards.find((j) => j.id === jobCardId && j.tenantId === tenantId);
    if (!job) {
      throw new Error(`Job card not found for tenant: ${jobCardId}`);
    }

    const wastageResult = calculateWastageReconciliation(
      job.issuedNetWeightGrams,
      returnedJewelleryNetWeight,
      returnedScrapWeightGrams,
      job.agreedWastagePercent
    );

    job.returnedJewelleryGrossWeight = returnedJewelleryGrossWeight;
    job.returnedJewelleryNetWeight = returnedJewelleryNetWeight;
    job.returnedScrapWeightGrams = returnedScrapWeightGrams;
    job.actualLossGrams = wastageResult.actualLoss.toNumber();
    job.allowedWastageGrams = wastageResult.allowedWastage.toNumber();
    job.excessLossGrams = wastageResult.excessLoss.toNumber();
    job.isReconciled = true;
    job.status = 'COMPLETED';
    job.submittedDate = new Date().toISOString();
    job.qcPassed = true;
    if (qcRemarks) job.qcRemarks = qcRemarks;

    // Post return of finished ornaments to FINISHED_GOODS
    if (returnedJewelleryNetWeight > 0) {
      this.addGoldLedgerEntry({
        tenantId,
        branchId: job.branchId,
        date: new Date().toISOString(),
        type: 'RETURN_FROM_KARIGAR',
        sourceAccount: 'KARIGAR_HELD',
        destinationAccount: 'FINISHED_GOODS',
        counterpartyId: job.karigarId,
        counterpartyName: job.karigarName,
        counterpartyType: 'KARIGAR',
        jobCardId: job.id,
        grossWeightGrams: returnedJewelleryGrossWeight,
        nonGoldWeightGrams: returnedJewelleryGrossWeight - returnedJewelleryNetWeight,
        netWeightGrams: returnedJewelleryNetWeight,
        purity: job.purity,
        fineness: job.fineness,
        fineGoldWeightGrams: calculateFineGold(returnedJewelleryNetWeight, job.fineness).toNumber(),
        enteredBy: 'Quality Inspector',
        notes: `Returned finished ${job.jewelleryType} from Job ${job.jobNo}`,
      });
    }

    // Post return of scrap/filings to SCRAP_REFINING
    if (returnedScrapWeightGrams > 0) {
      this.addGoldLedgerEntry({
        tenantId,
        branchId: job.branchId,
        date: new Date().toISOString(),
        type: 'SCRAP_RECOVERY',
        sourceAccount: 'KARIGAR_HELD',
        destinationAccount: 'SCRAP_REFINING',
        counterpartyId: job.karigarId,
        counterpartyName: job.karigarName,
        counterpartyType: 'KARIGAR',
        jobCardId: job.id,
        grossWeightGrams: returnedScrapWeightGrams,
        nonGoldWeightGrams: 0,
        netWeightGrams: returnedScrapWeightGrams,
        purity: job.purity,
        fineness: job.fineness,
        fineGoldWeightGrams: calculateFineGold(returnedScrapWeightGrams, job.fineness).toNumber(),
        enteredBy: 'Quality Inspector',
        notes: `Scrap & Morcha recovered from Job ${job.jobNo}`,
      });
    }

    // Update staff holding and stats
    const staffMember = this.staff.find((s) => s.id === job.karigarId && s.tenantId === tenantId);
    if (staffMember) {
      staffMember.currentGoldHoldingGrams = Math.max(
        0,
        new Decimal(staffMember.currentGoldHoldingGrams)
          .minus(job.issuedNetWeightGrams)
          .toNumber()
      );
      staffMember.activeJobsCount = Math.max(0, staffMember.activeJobsCount - 1);
      staffMember.completedJobsCount += 1;
      if (job.excessLossGrams > 0) {
        staffMember.unreconciledLossGrams = new Decimal(staffMember.unreconciledLossGrams)
          .plus(job.excessLossGrams)
          .toNumber();
      }
    }

    // Audit log
    this.addAuditLog({
      tenantId,
      userId: 'system',
      userName: 'QC Inspector',
      action: 'JOB_CARD_RECONCILED',
      entity: 'JobCard',
      entityId: job.id,
      details: `Reconciled ${job.jobNo}: Finished ${returnedJewelleryNetWeight}g, Scrap ${returnedScrapWeightGrams}g, Loss ${job.actualLossGrams}g (Allowed: ${job.allowedWastageGrams}g, Excess: ${job.excessLossGrams}g)`,
    });

    return job;
  }

  public getTenantInvoices(tenantId: string): Invoice[] {
    return this.invoices.filter((inv) => inv.tenantId === tenantId);
  }

  public createInvoice(invoice: Omit<Invoice, 'id' | 'invoiceNo' | 'createdAt'>): Invoice {
    const count = this.invoices.filter((inv) => inv.tenantId === invoice.tenantId).length + 1;
    const year = new Date().getFullYear();
    const invoiceNo = `INV-${year}-${String(count).padStart(4, '0')}`;
    const id = `inv_${invoice.tenantId}_${Date.now()}`;

    const newInvoice: Invoice = {
      ...invoice,
      id,
      invoiceNo,
      createdAt: new Date().toISOString(),
    };

    // Resolve or auto-create named customer when invoice impacts customer balances
    const trimmedCustName = (newInvoice.customerName || '').trim();
    const isNamedCustomer =
      trimmedCustName.length > 0 && trimmedCustName.toLowerCase() !== 'walk-in customer';

    let matchedCustomer =
      (newInvoice.customerId
        ? this.customers.find((c) => c.id === newInvoice.customerId && c.tenantId === invoice.tenantId)
        : undefined) ||
      (isNamedCustomer
        ? this.customers.find(
            (c) =>
              c.tenantId === invoice.tenantId &&
              c.name.toLowerCase() === trimmedCustName.toLowerCase()
          )
        : undefined);

    const totalChargeableGrams = newInvoice.items.reduce((acc, it) => {
      const net = new Decimal(it.netGoldWeightGrams || 0);
      const wast =
        it.wastageWeightGrams !== undefined
          ? new Decimal(it.wastageWeightGrams)
          : net.mul(it.wastagePercent || 0).div(100);
      return acc.plus(net).plus(wast);
    }, new Decimal(0)).toDecimalPlaces(3);

    const computedImplicitExcess =
      newInvoice.grandTotalINR === 0 && (newInvoice.goldExchangeGrams || 0) > 0
        ? Decimal.max(
            0,
            new Decimal(newInvoice.goldExchangeGrams || 0)
              .plus(newInvoice.goldUsedFromDepositGrams || 0)
              .minus(totalChargeableGrams)
          ).toDecimalPlaces(3)
        : new Decimal(0);

    const effectiveExcessGoldGrams =
      newInvoice.goldExcessCreditGrams !== undefined
        ? new Decimal(newInvoice.goldExcessCreditGrams || 0).toDecimalPlaces(3)
        : computedImplicitExcess;

    const needsCustomerAccount =
      (newInvoice.balanceAmountINR || 0) > 0 ||
      (newInvoice.goldBalanceDueGrams || 0) > 0 ||
      effectiveExcessGoldGrams.gt(0) ||
      (newInvoice.goldUsedFromDepositGrams || 0) > 0;

    if (!matchedCustomer && isNamedCustomer && needsCustomerAccount) {
      matchedCustomer = this.addCustomer({
        tenantId: invoice.tenantId,
        name: trimmedCustName,
        phone: newInvoice.customerPhone || '+91 90000 00000',
        address: newInvoice.customerAddress,
        city: this.getTenant(invoice.tenantId)?.city || 'Local',
        state: this.getTenant(invoice.tenantId)?.state || 'India',
        gstin: newInvoice.customerGstin,
        preferredLanguage: this.getTenant(invoice.tenantId)?.defaultLanguage || 'en',
        customerGoldBalanceGrams: 0,
        monetaryBalanceINR: 0,
        creditLimitINR: 100000,
      });
    }

    if (matchedCustomer && !newInvoice.customerId) {
      newInvoice.customerId = matchedCustomer.id;
    }

    this.invoices.unshift(newInvoice);

    // 1. Deduct finished goods stock for sold/dispatched items (FINISHED_GOODS -> SALE_DELIVERY)
    for (const item of newInvoice.items) {
      this.addGoldLedgerEntry(
        {
          tenantId: invoice.tenantId,
          branchId: invoice.branchId,
          date: newInvoice.date,
          type: 'SALE_DELIVERY',
          sourceAccount: 'FINISHED_GOODS',
          destinationAccount: 'FINISHED_GOODS',
          counterpartyId: newInvoice.customerId,
          counterpartyName: newInvoice.customerName,
          counterpartyType: 'CUSTOMER',
          invoiceId: id,
          grossWeightGrams: item.grossWeightGrams,
          nonGoldWeightGrams: item.stoneWeightGrams,
          netWeightGrams: item.netGoldWeightGrams,
          purity: item.purity,
          fineness: item.fineness,
          fineGoldWeightGrams: item.fineGoldWeightGrams,
          ratePerGram: item.goldRatePerGram,
          valuationINR: item.lineTotalINR,
          enteredBy: newInvoice.createdBy,
          notes: `Billed in Tax Invoice ${invoiceNo}: ${item.description}`,
        },
        { skipCustomerSync: true }
      );
    }

    const primaryPurity: GoldPurityCode =
      newInvoice.goldExchangePurity || newInvoice.items[0]?.purity || '22K';
    const primaryStandard = PURITY_STANDARDS[primaryPurity] || PURITY_STANDARDS['22K'];

    // 2. Apply existing Customer Custody Gold Deposit if requested on this invoice
    if (matchedCustomer && (newInvoice.goldUsedFromDepositGrams || 0) > 0) {
      const availCustody = Decimal.max(
        0,
        new Decimal(matchedCustomer.customerGoldBalanceGrams || 0)
      );
      const depositUsed = Decimal.min(
        new Decimal(newInvoice.goldUsedFromDepositGrams || 0),
        availCustody
      ).toDecimalPlaces(3);

      if (depositUsed.gt(0)) {
        matchedCustomer.customerGoldBalanceGrams = availCustody
          .minus(depositUsed)
          .toDecimalPlaces(3)
          .toNumber();
        newInvoice.goldUsedFromDepositGrams = depositUsed.toNumber();

        this.addGoldLedgerEntry(
          {
            tenantId: invoice.tenantId,
            branchId: invoice.branchId,
            date: newInvoice.date,
            type: 'MISC_TRANSACTION',
            sourceAccount: 'CUSTOMER_OWNED',
            destinationAccount: 'BUSINESS_OWNED',
            counterpartyId: matchedCustomer.id,
            counterpartyName: matchedCustomer.name,
            counterpartyType: 'CUSTOMER',
            invoiceId: id,
            grossWeightGrams: depositUsed.toNumber(),
            nonGoldWeightGrams: 0,
            netWeightGrams: depositUsed.toNumber(),
            purity: primaryPurity,
            fineness: primaryStandard.fineness,
            fineGoldWeightGrams: calculateFineGold(depositUsed, primaryStandard.fineness).toNumber(),
            enteredBy: newInvoice.createdBy,
            notes: `Adjusted from customer custody deposit for Bill ${invoiceNo}`,
          },
          { skipCustomerSync: true }
        );
      } else {
        newInvoice.goldUsedFromDepositGrams = undefined;
      }
    }

    // 3. Record fresh physical Gold / Old Gold received against the sales bill
    if (newInvoice.goldExchangeGrams && newInvoice.goldExchangeGrams > 0) {
      const exchPurity = newInvoice.goldExchangePurity || '22K';
      const exchStandard = PURITY_STANDARDS[exchPurity] || PURITY_STANDARDS['22K'];
      const exchFineness =
        newInvoice.goldExchangeFineness && newInvoice.goldExchangeFineness > 0
          ? newInvoice.goldExchangeFineness
          : exchStandard.fineness;
      const targetVaultAccount: GoldAccountType =
        exchPurity === '24K' ? 'BUSINESS_OWNED' : 'SCRAP_REFINING';
      const exchGrams = new Decimal(newInvoice.goldExchangeGrams).toDecimalPlaces(3);

      if (newInvoice.grandTotalINR === 0 && matchedCustomer && effectiveExcessGoldGrams.gt(0)) {
        newInvoice.goldExcessCreditGrams = effectiveExcessGoldGrams.toNumber();
        const curBal = new Decimal(matchedCustomer.customerGoldBalanceGrams || 0);
        const debtOffset = curBal.lt(0)
          ? Decimal.min(effectiveExcessGoldGrams, curBal.abs()).toDecimalPlaces(3)
          : new Decimal(0);
        const newCustodyPortion = effectiveExcessGoldGrams.minus(debtOffset).toDecimalPlaces(3);
        const shopPortion = Decimal.max(0, exchGrams.minus(newCustodyPortion)).toDecimalPlaces(3);

        matchedCustomer.customerGoldBalanceGrams = curBal
          .plus(effectiveExcessGoldGrams)
          .toDecimalPlaces(3)
          .toNumber();

        if (shopPortion.gt(0)) {
          this.addGoldLedgerEntry(
            {
              tenantId: invoice.tenantId,
              branchId: invoice.branchId,
              date: newInvoice.date,
              type: 'CUSTOMER_OLD_GOLD',
              sourceAccount: targetVaultAccount,
              destinationAccount: targetVaultAccount,
              counterpartyId: matchedCustomer.id,
              counterpartyName: matchedCustomer.name,
              counterpartyType: 'CUSTOMER',
              invoiceId: id,
              grossWeightGrams: shopPortion.toNumber(),
              nonGoldWeightGrams: 0,
              netWeightGrams: shopPortion.toNumber(),
              purity: exchPurity,
              fineness: exchFineness,
              fineGoldWeightGrams: calculateFineGold(shopPortion, exchFineness).toNumber(),
              enteredBy: newInvoice.createdBy,
              notes: `Gold received against Sales Bill ${invoiceNo}`,
            },
            { skipCustomerSync: true }
          );
        }

        if (newCustodyPortion.gt(0)) {
          this.addGoldLedgerEntry(
            {
              tenantId: invoice.tenantId,
              branchId: invoice.branchId,
              date: newInvoice.date,
              type: 'CUSTOMER_DEPOSIT',
              sourceAccount: 'CUSTOMER_OWNED',
              destinationAccount: 'CUSTOMER_OWNED',
              counterpartyId: matchedCustomer.id,
              counterpartyName: matchedCustomer.name,
              counterpartyType: 'CUSTOMER',
              invoiceId: id,
              grossWeightGrams: newCustodyPortion.toNumber(),
              nonGoldWeightGrams: 0,
              netWeightGrams: newCustodyPortion.toNumber(),
              purity: exchPurity,
              fineness: exchFineness,
              fineGoldWeightGrams: calculateFineGold(
                newCustodyPortion,
                exchFineness
              ).toNumber(),
              enteredBy: newInvoice.createdBy,
              notes: `Excess gold credited to customer custody from Bill ${invoiceNo}`,
            },
            { skipCustomerSync: true }
          );
        }
      } else {
        const exchFine = calculateFineGold(exchGrams, exchFineness).toNumber();
        this.addGoldLedgerEntry(
          {
            tenantId: invoice.tenantId,
            branchId: invoice.branchId,
            date: newInvoice.date,
            type: 'CUSTOMER_OLD_GOLD',
            sourceAccount: targetVaultAccount,
            destinationAccount: targetVaultAccount,
            counterpartyId: newInvoice.customerId,
            counterpartyName: newInvoice.customerName,
            counterpartyType: 'CUSTOMER',
            invoiceId: id,
            grossWeightGrams: exchGrams.toNumber(),
            nonGoldWeightGrams: 0,
            netWeightGrams: exchGrams.toNumber(),
            purity: exchPurity,
            fineness: exchFineness,
            fineGoldWeightGrams: exchFine,
            ratePerGram: newInvoice.goldExchangeRatePerGram,
            valuationINR: newInvoice.goldExchangeValueINR || 0,
            enteredBy: newInvoice.createdBy,
            notes: `Gold received against Sales Bill ${invoiceNo}`,
          },
          { skipCustomerSync: true }
        );
      }
    }

    // 4. Cash / Bank book entry for cash/UPI/bank payment received
    if (newInvoice.paidAmountINR > 0) {
      const effectiveChannel = newInvoice.cashPaymentChannel || newInvoice.paymentMethod;
      this.cashBankTransactions.unshift({
        id: `cbt_${Date.now()}`,
        tenantId: newInvoice.tenantId,
        branchId: newInvoice.branchId,
        date: newInvoice.date,
        type: 'RECEIPT',
        accountType: effectiveChannel === 'CASH' ? 'CASH' : 'BANK',
        referenceNo: invoiceNo,
        partyType: 'CUSTOMER',
        partyName: newInvoice.customerName,
        category: 'SALES_COLLECTION',
        amountINR: newInvoice.paidAmountINR,
        notes: `Payment for Invoice ${invoiceNo} (${newInvoice.paymentMethod})`,
        enteredBy: newInvoice.createdBy,
      });
    }

    // 5. Update customer monetary balance or gold due receivable
    if (matchedCustomer) {
      const curMonetary = new Decimal(matchedCustomer.monetaryBalanceINR || 0);
      if (newInvoice.balanceAmountINR > 0) {
        matchedCustomer.monetaryBalanceINR = curMonetary
          .plus(newInvoice.balanceAmountINR)
          .toDecimalPlaces(2)
          .toNumber();
      } else if (newInvoice.grandTotalINR > 0) {
        const totalSettledINR =
          (newInvoice.paidAmountINR || 0) + (newInvoice.goldExchangeValueINR || 0);
        if (totalSettledINR > newInvoice.grandTotalINR) {
          const excessINR = totalSettledINR - newInvoice.grandTotalINR;
          matchedCustomer.monetaryBalanceINR = curMonetary
            .minus(excessINR)
            .toDecimalPlaces(2)
            .toNumber();
        }
      }

      if (
        newInvoice.grandTotalINR === 0 &&
        newInvoice.goldBalanceDueGrams &&
        newInvoice.goldBalanceDueGrams > 0
      ) {
        const curGoldBal = new Decimal(matchedCustomer.customerGoldBalanceGrams || 0);
        const dueGrams = new Decimal(newInvoice.goldBalanceDueGrams).toDecimalPlaces(3);
        const custodyAutoOffset = curGoldBal.gt(0)
          ? Decimal.min(dueGrams, curGoldBal).toDecimalPlaces(3)
          : new Decimal(0);

        matchedCustomer.customerGoldBalanceGrams = curGoldBal
          .minus(dueGrams)
          .toDecimalPlaces(3)
          .toNumber();

        if (custodyAutoOffset.gt(0)) {
          this.addGoldLedgerEntry(
            {
              tenantId: invoice.tenantId,
              branchId: invoice.branchId,
              date: newInvoice.date,
              type: 'MISC_TRANSACTION',
              sourceAccount: 'CUSTOMER_OWNED',
              destinationAccount: 'BUSINESS_OWNED',
              counterpartyId: matchedCustomer.id,
              counterpartyName: matchedCustomer.name,
              counterpartyType: 'CUSTOMER',
              invoiceId: id,
              grossWeightGrams: custodyAutoOffset.toNumber(),
              nonGoldWeightGrams: 0,
              netWeightGrams: custodyAutoOffset.toNumber(),
              purity: primaryPurity,
              fineness: primaryStandard.fineness,
              fineGoldWeightGrams: calculateFineGold(
                custodyAutoOffset,
                primaryStandard.fineness
              ).toNumber(),
              enteredBy: newInvoice.createdBy,
              notes: `Auto-adjusted customer custody gold against Bill ${invoiceNo}`,
            },
            { skipCustomerSync: true }
          );
        }
      }
    }

    return newInvoice;
  }

  public getTenantCustomers(tenantId: string): Customer[] {
    return this.customers.filter((c) => c.tenantId === tenantId);
  }

  public addCustomer(customer: Omit<Customer, 'id' | 'accountCode' | 'createdAt'>): Customer {
    const count = this.customers.filter((c) => c.tenantId === customer.tenantId).length + 1;
    const accountCode = `CUST-${String(count).padStart(3, '0')}`;
    const id = `cust_${customer.tenantId}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

    const initialGoldBalance = new Decimal(customer.customerGoldBalanceGrams || 0)
      .toDecimalPlaces(3)
      .toNumber();
    const initialMonetaryBalance = new Decimal(customer.monetaryBalanceINR || 0)
      .toDecimalPlaces(2)
      .toNumber();

    const newCustomer: Customer = {
      ...customer,
      id,
      accountCode,
      customerGoldBalanceGrams: initialGoldBalance,
      monetaryBalanceINR: initialMonetaryBalance,
      creditLimitINR: customer.creditLimitINR ?? 100000,
      createdAt: new Date().toISOString(),
    };

    this.customers.push(newCustomer);

    if (initialGoldBalance > 0) {
      const branch = this.getTenantBranches(customer.tenantId)[0];
      const std = PURITY_STANDARDS['22K'];
      this.addGoldLedgerEntry(
        {
          tenantId: customer.tenantId,
          branchId: branch ? branch.id : 'main',
          date: newCustomer.createdAt,
          type: 'CUSTOMER_DEPOSIT',
          sourceAccount: 'CUSTOMER_OWNED',
          destinationAccount: 'CUSTOMER_OWNED',
          counterpartyId: newCustomer.id,
          counterpartyName: newCustomer.name,
          counterpartyType: 'CUSTOMER',
          grossWeightGrams: initialGoldBalance,
          nonGoldWeightGrams: 0,
          netWeightGrams: initialGoldBalance,
          purity: '22K',
          fineness: std.fineness,
          fineGoldWeightGrams: calculateFineGold(initialGoldBalance, std.fineness).toNumber(),
          enteredBy: 'System',
          notes: `Opening customer gold custody for ${newCustomer.name}`,
        },
        { skipCustomerSync: true }
      );
    }

    return newCustomer;
  }

  public recordCustomerGoldDeposit(
    tenantId: string,
    customerId: string,
    grossWeightGrams: number,
    nonGoldWeightGrams: number,
    purity: GoldPurityCode,
    enteredBy: string,
    notes?: string,
    customFineness?: number
  ) {
    const customer = this.customers.find((c) => c.id === customerId && c.tenantId === tenantId);
    if (!customer) throw new Error('Customer not found');

    const standard = PURITY_STANDARDS[purity] || PURITY_STANDARDS['22K'];
    const effectiveFineness =
      customFineness && customFineness > 0 ? customFineness : standard.fineness;
    const netDec = Decimal.max(
      0,
      new Decimal(grossWeightGrams || 0).minus(nonGoldWeightGrams || 0)
    ).toDecimalPlaces(3);
    if (netDec.lte(0)) {
      throw new Error('Net gold weight must be greater than 0g');
    }

    const prevBal = new Decimal(customer.customerGoldBalanceGrams || 0);
    customer.customerGoldBalanceGrams = prevBal.plus(netDec).toDecimalPlaces(3).toNumber();

    const debtSettled = prevBal.lt(0)
      ? Decimal.min(netDec, prevBal.abs()).toDecimalPlaces(3)
      : new Decimal(0);
    const custodyPortion = netDec.minus(debtSettled).toDecimalPlaces(3);
    const targetVaultAccount: GoldAccountType =
      purity === '24K' ? 'BUSINESS_OWNED' : 'SCRAP_REFINING';
    const branch = this.getTenantBranches(tenantId)[0];
    const nowIso = new Date().toISOString();

    if (debtSettled.gt(0)) {
      this.addGoldLedgerEntry(
        {
          tenantId,
          branchId: branch ? branch.id : 'main',
          date: nowIso,
          type: 'CUSTOMER_OLD_GOLD',
          sourceAccount: targetVaultAccount,
          destinationAccount: targetVaultAccount,
          counterpartyId: customer.id,
          counterpartyName: customer.name,
          counterpartyType: 'CUSTOMER',
          grossWeightGrams: custodyPortion.eq(0) ? grossWeightGrams : debtSettled.toNumber(),
          nonGoldWeightGrams: custodyPortion.eq(0) ? nonGoldWeightGrams : 0,
          netWeightGrams: debtSettled.toNumber(),
          purity,
          fineness: effectiveFineness,
          fineGoldWeightGrams: calculateFineGold(debtSettled, effectiveFineness).toNumber(),
          enteredBy,
          notes: notes || `Gold due settled by ${customer.name}`,
        },
        { skipCustomerSync: true }
      );
    }

    if (custodyPortion.gt(0)) {
      this.addGoldLedgerEntry(
        {
          tenantId,
          branchId: branch ? branch.id : 'main',
          date: nowIso,
          type: 'CUSTOMER_DEPOSIT',
          sourceAccount: 'CUSTOMER_OWNED',
          destinationAccount: 'CUSTOMER_OWNED',
          counterpartyId: customer.id,
          counterpartyName: customer.name,
          counterpartyType: 'CUSTOMER',
          grossWeightGrams: debtSettled.eq(0) ? grossWeightGrams : custodyPortion.toNumber(),
          nonGoldWeightGrams: debtSettled.eq(0) ? nonGoldWeightGrams : 0,
          netWeightGrams: custodyPortion.toNumber(),
          purity,
          fineness: effectiveFineness,
          fineGoldWeightGrams: calculateFineGold(custodyPortion, effectiveFineness).toNumber(),
          enteredBy,
          notes: notes || `Customer gold deposit by ${customer.name}`,
        },
        { skipCustomerSync: true }
      );
    }

    return customer;
  }

  public recordCustomerGoldWithdrawal(
    tenantId: string,
    customerId: string,
    netWeightGrams: number,
    purity: GoldPurityCode,
    enteredBy: string,
    notes?: string,
    customFineness?: number
  ) {
    const customer = this.customers.find((c) => c.id === customerId && c.tenantId === tenantId);
    if (!customer) throw new Error('Customer not found');

    const netDec = new Decimal(netWeightGrams || 0).toDecimalPlaces(3);
    if (netDec.lte(0)) {
      throw new Error('Withdrawal weight must be greater than 0g');
    }

    const prevBal = new Decimal(customer.customerGoldBalanceGrams || 0).toDecimalPlaces(3);
    if (prevBal.lte(0)) {
      throw new Error('Customer has no custody gold balance available to withdraw');
    }
    if (netDec.gt(prevBal)) {
      throw new Error(
        `Withdrawal weight (${netDec.toFixed(3)}g) exceeds customer custody balance (${prevBal.toFixed(3)}g)`
      );
    }

    const standard = PURITY_STANDARDS[purity] || PURITY_STANDARDS['22K'];
    const effectiveFineness =
      customFineness && customFineness > 0 ? customFineness : standard.fineness;
    customer.customerGoldBalanceGrams = prevBal.minus(netDec).toDecimalPlaces(3).toNumber();

    const branch = this.getTenantBranches(tenantId)[0];
    this.addGoldLedgerEntry(
      {
        tenantId,
        branchId: branch ? branch.id : 'main',
        date: new Date().toISOString(),
        type: 'CUSTOMER_WITHDRAWAL',
        sourceAccount: 'CUSTOMER_OWNED',
        destinationAccount: 'CUSTOMER_OWNED',
        counterpartyId: customer.id,
        counterpartyName: customer.name,
        counterpartyType: 'CUSTOMER',
        grossWeightGrams: netDec.toNumber(),
        nonGoldWeightGrams: 0,
        netWeightGrams: netDec.toNumber(),
        purity,
        fineness: effectiveFineness,
        fineGoldWeightGrams: calculateFineGold(netDec, effectiveFineness).toNumber(),
        enteredBy,
        notes: notes || `Customer custody gold returned to ${customer.name}`,
      },
      { skipCustomerSync: true }
    );

    return customer;
  }

  public getTenantStaff(tenantId: string): Staff[] {
    return this.staff.filter((s) => s.tenantId === tenantId);
  }

  public clearTenantData(tenantId?: string) {
    if (!tenantId || tenantId === 'ALL') {
      this.staff = [];
      this.customers = [];
      this.suppliers = [];
      this.goldLedger = [];
      this.jobCards = [];
      this.invoices = [];
      this.cashBankTransactions = [];
      this.auditLogs = [];
      this.notifications = [];
      this.outsideParties = [];
      this.outsidePartyTransactions = [];
      this.meltingBatches = [];
      this.branchTransfers = [];
      this.posDrafts = [];
      this.stockReconciliations = [];
      return;
    }

    this.staff = this.staff.filter((s) => s.tenantId !== tenantId);
    this.customers = this.customers.filter((c) => c.tenantId !== tenantId);
    this.suppliers = this.suppliers.filter((s) => s.tenantId !== tenantId);
    this.goldLedger = this.goldLedger.filter((e) => e.tenantId !== tenantId);
    this.jobCards = this.jobCards.filter((j) => j.tenantId !== tenantId);
    this.invoices = this.invoices.filter((i) => i.tenantId !== tenantId);
    this.cashBankTransactions = this.cashBankTransactions.filter((c) => c.tenantId !== tenantId);
    this.auditLogs = this.auditLogs.filter((a) => a.tenantId !== tenantId);
    this.notifications = this.notifications.filter((n) => n.tenantId !== tenantId);
    this.outsideParties = this.outsideParties.filter((p) => p.tenantId !== tenantId);
    this.outsidePartyTransactions = this.outsidePartyTransactions.filter((p) => p.tenantId !== tenantId);
    this.meltingBatches = this.meltingBatches.filter((m) => m.tenantId !== tenantId);
    this.branchTransfers = this.branchTransfers.filter((b) => b.tenantId !== tenantId);
    this.posDrafts = this.posDrafts.filter((d) => d.tenantId !== tenantId);
    this.stockReconciliations = this.stockReconciliations.filter((s) => s.tenantId !== tenantId);
  }

  public recordKarigarAdvance(tenantId: string, staffId: string, amountINR: number, notes?: string): Staff {
    const member = this.staff.find((s) => s.id === staffId && s.tenantId === tenantId);
    if (!member) throw new Error('Artisan not found');

    member.advanceBalanceINR = (member.advanceBalanceINR || 0) + amountINR;

    // Record cash payment
    this.addCashBankTransaction({
      tenantId,
      branchId: member.branchId || 'main',
      date: new Date().toISOString().split('T')[0],
      type: 'PAYMENT',
      accountType: 'CASH',
      partyType: 'KARIGAR',
      partyName: member.name,
      category: 'STAFF_ADVANCE',
      amountINR,
      notes: notes || `Wages / Labour advance to ${member.name}`,
      enteredBy: 'Manager',
    });

    return member;
  }

  public addStaff(staffMember: Omit<Staff, 'id' | 'code' | 'currentGoldHoldingGrams' | 'activeJobsCount' | 'completedJobsCount' | 'unreconciledLossGrams'>): Staff {
    const count = this.staff.filter((s) => s.tenantId === staffMember.tenantId).length + 1;
    const code = staffMember.role === 'KARIGAR' ? `KAR-${String(count).padStart(2, '0')}` : `STF-${String(count).padStart(2, '0')}`;
    const id = `staff_${staffMember.tenantId}_${Date.now()}`;

    const newStaff: Staff = {
      ...staffMember,
      id,
      code,
      currentGoldHoldingGrams: 0,
      activeJobsCount: 0,
      completedJobsCount: 0,
      unreconciledLossGrams: 0,
    };

    this.staff.push(newStaff);
    return newStaff;
  }

  public getTenantCashBank(tenantId: string): CashBankTransaction[] {
    return this.cashBankTransactions.filter((c) => c.tenantId === tenantId);
  }

  public addCashBankTransaction(tx: Omit<CashBankTransaction, 'id'>): CashBankTransaction {
    const id = `cbt_${Date.now()}`;
    const record: CashBankTransaction = { ...tx, id };
    this.cashBankTransactions.unshift(record);
    return record;
  }

  public getTenantAuditLogs(tenantId: string): AuditLog[] {
    return this.auditLogs.filter((a) => a.tenantId === tenantId);
  }

  public addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    this.auditLogs.unshift({
      ...log,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    });
  }

  public getTenantNotifications(tenantId: string): NotificationItem[] {
    return this.notifications.filter((n) => n.tenantId === tenantId);
  }

  // --- Onboarding a new Jewellery Business ---
  public onboardTenant(data: {
    name: string;
    legalName: string;
    businessType: Tenant['businessType'];
    address: string;
    city: string;
    state: string;
    pinCode: string;
    phone: string;
    email: string;
    gstin?: string;
    defaultLanguage: Tenant['defaultLanguage'];
    initialGoldStockGrams?: number;
    initialCashBalanceINR?: number;
  }): { tenant: Tenant; branch: Branch; user: User } {
    const tenantId = `tenant_${Date.now().toString(36)}`;
    const branchId = `branch_${tenantId}_main`;
    const userId = `user_${tenantId}_owner`;

    const tenant: Tenant = {
      id: tenantId,
      name: data.name,
      legalName: data.legalName,
      businessType: data.businessType,
      gstin: data.gstin,
      address: data.address,
      city: data.city,
      state: data.state,
      pinCode: data.pinCode,
      phone: data.phone,
      email: data.email,
      defaultLanguage: data.defaultLanguage,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      subscriptionPlanId: 'plan_trial',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    const branch: Branch = {
      id: branchId,
      tenantId,
      name: `${data.name} - Main Branch`,
      code: 'HQ-01',
      address: data.address,
      city: data.city,
      isMainBranch: true,
    };

    const user: User = {
      id: userId,
      name: `${data.name} Owner`,
      email: data.email,
      phone: data.phone,
      preferredLanguage: data.defaultLanguage,
      activeTenantId: tenantId,
    };

    const membership: Membership = {
      id: `mem_${tenantId}_owner`,
      userId,
      tenantId,
      role: 'OWNER',
      branchId,
      joinedAt: new Date().toISOString(),
    };

    this.tenants.push(tenant);
    this.branches.push(branch);
    this.users.push(user);
    this.memberships.push(membership);

    // Initialize gold rates for the new tenant
    this.goldRates[tenantId] = [
      { purity: '24K', fineness: 999.9, ratePerGram: 7450, updatedAt: new Date().toISOString() },
      { purity: '22K', fineness: 916.0, ratePerGram: 6825, updatedAt: new Date().toISOString() },
      { purity: '20K', fineness: 833.0, ratePerGram: 6205, updatedAt: new Date().toISOString() },
      { purity: '18K', fineness: 750.0, ratePerGram: 5588, updatedAt: new Date().toISOString() },
      { purity: '14K', fineness: 585.0, ratePerGram: 4358, updatedAt: new Date().toISOString() },
      { purity: '9K', fineness: 375.0, ratePerGram: 2794, updatedAt: new Date().toISOString() },
    ];

    // Post opening gold stock if provided
    if (data.initialGoldStockGrams && data.initialGoldStockGrams > 0) {
      this.addGoldLedgerEntry({
        tenantId,
        branchId,
        date: new Date().toISOString(),
        type: 'OPENING_BALANCE',
        sourceAccount: 'BUSINESS_OWNED',
        destinationAccount: 'BUSINESS_OWNED',
        grossWeightGrams: data.initialGoldStockGrams,
        nonGoldWeightGrams: 0,
        netWeightGrams: data.initialGoldStockGrams,
        purity: '24K',
        fineness: 999.9,
        fineGoldWeightGrams: calculateFineGold(data.initialGoldStockGrams, 999.9).toNumber(),
        ratePerGram: 7450,
        valuationINR: data.initialGoldStockGrams * 7450,
        enteredBy: user.name,
        notes: 'Initial opening stock ledger entry configured via Onboarding Wizard',
      });
    }

    if (data.initialCashBalanceINR && data.initialCashBalanceINR > 0) {
      this.addCashBankTransaction({
        tenantId,
        branchId,
        date: new Date().toISOString().split('T')[0],
        type: 'RECEIPT',
        accountType: 'CASH',
        category: 'SALES_COLLECTION',
        amountINR: data.initialCashBalanceINR,
        notes: 'Opening cash balance',
        enteredBy: user.name,
      });
    }

    return { tenant, branch, user };
  }

  // --- POS & Unified Gold Transaction Center Operations ---

  // 1. Outside Parties Management
  public getTenantOutsideParties(tenantId: string): OutsideParty[] {
    return this.outsideParties.filter((p) => p.tenantId === tenantId);
  }

  public addOutsideParty(party: Omit<OutsideParty, 'id' | 'code' | 'createdAt' | 'currentGoldHoldingGrams'>): OutsideParty {
    const count = this.outsideParties.filter((p) => p.tenantId === party.tenantId).length + 1;
    const code = `PRT-${party.partyType.substring(0, 3)}-${String(count).padStart(2, '0')}`;
    const id = `party_${party.tenantId}_${Date.now()}`;

    const newParty: OutsideParty = {
      ...party,
      id,
      code,
      currentGoldHoldingGrams: 0,
      createdAt: new Date().toISOString(),
    };

    this.outsideParties.push(newParty);
    return newParty;
  }

  public getTenantOutsidePartyTransactions(tenantId: string): OutsidePartyTransaction[] {
    return this.outsidePartyTransactions.filter((p) => p.tenantId === tenantId);
  }

  public createOutsidePartyTransaction(params: Omit<OutsidePartyTransaction, 'id' | 'challanNo' | 'createdAt' | 'fineGoldWeightGrams'>): OutsidePartyTransaction {
    const count = this.outsidePartyTransactions.filter((p) => p.tenantId === params.tenantId).length + 1;
    const year = new Date().getFullYear();
    const challanNo = `CHL-${year}-${String(count).padStart(4, '0')}`;
    const id = `opt_${params.tenantId}_${Date.now()}`;

    const net = new Decimal(params.netWeightGrams || 0);
    const fineness = new Decimal(params.fineness || 916);
    const fineGold = calculateFineGold(net, fineness).toNumber();

    const newChallan: OutsidePartyTransaction = {
      ...params,
      id,
      challanNo,
      fineGoldWeightGrams: fineGold,
      createdAt: new Date().toISOString(),
    };

    this.outsidePartyTransactions.unshift(newChallan);

    // Update outside party holding
    const party = this.outsideParties.find((p) => p.id === params.partyId && p.tenantId === params.tenantId);
    if (party) {
      if (params.direction === 'ISSUE') {
        party.currentGoldHoldingGrams = new Decimal(party.currentGoldHoldingGrams).plus(params.netWeightGrams).toNumber();
      } else {
        party.currentGoldHoldingGrams = Math.max(0, new Decimal(party.currentGoldHoldingGrams).minus(params.netWeightGrams).toNumber());
      }
    }

    // Ledger entry
    this.addGoldLedgerEntry({
      tenantId: params.tenantId,
      branchId: params.branchId,
      date: params.date,
      type: params.direction === 'ISSUE' ? 'ISSUE_TO_PARTY' : 'RETURN_FROM_PARTY',
      sourceAccount: params.direction === 'ISSUE' ? 'BUSINESS_OWNED' : 'OUTSIDE_PARTY',
      destinationAccount: params.direction === 'ISSUE' ? 'OUTSIDE_PARTY' : 'BUSINESS_OWNED',
      counterpartyId: params.partyId,
      counterpartyName: params.partyName,
      counterpartyType: 'INTERNAL',
      grossWeightGrams: params.grossWeightGrams,
      nonGoldWeightGrams: params.nonGoldWeightGrams || 0,
      netWeightGrams: params.netWeightGrams,
      purity: params.purity,
      fineness: params.fineness,
      fineGoldWeightGrams: fineGold,
      enteredBy: params.createdBy,
      notes: `${params.direction} Challan ${challanNo} (${params.purpose}): ${params.notes || ''}`,
    });

    return newChallan;
  }

  // 2. Melting & Refining Center
  public getTenantMeltingBatches(tenantId: string): MeltingBatch[] {
    return this.meltingBatches.filter((m) => m.tenantId === tenantId);
  }

  public createMeltingBatch(params: Omit<MeltingBatch, 'id' | 'batchNo' | 'status' | 'totalInputGrossGrams' | 'totalInputFineGoldGrams'>): MeltingBatch {
    const count = this.meltingBatches.filter((m) => m.tenantId === params.tenantId).length + 1;
    const year = new Date().getFullYear();
    const batchNo = `MB-${year}-${String(count).padStart(3, '0')}`;
    const id = `melt_${params.tenantId}_${Date.now()}`;

    let totalGross = 0;
    let totalFine = 0;

    for (const inp of params.inputs) {
      totalGross += inp.weightGrams;
      totalFine += inp.fineGoldWeightGrams;

      // Deduct each input from source account into MELTING_IN_PROCESS
      this.addGoldLedgerEntry({
        tenantId: params.tenantId,
        branchId: params.branchId,
        date: params.sentDate,
        type: 'SEND_TO_MELTING',
        sourceAccount: params.sourceAccount || 'SCRAP_REFINING',
        destinationAccount: 'MELTING_IN_PROCESS',
        counterpartyName: params.operatorOrRefiner,
        grossWeightGrams: inp.weightGrams,
        nonGoldWeightGrams: 0,
        netWeightGrams: inp.weightGrams,
        purity: inp.purity,
        fineness: inp.fineness,
        fineGoldWeightGrams: inp.fineGoldWeightGrams,
        enteredBy: params.createdBy,
        notes: `Input for Melting Batch ${batchNo}: ${inp.description}`,
      });
    }

    const newBatch: MeltingBatch = {
      ...params,
      id,
      batchNo,
      status: 'IN_PROCESS',
      totalInputGrossGrams: Number(totalGross.toFixed(3)),
      totalInputFineGoldGrams: Number(totalFine.toFixed(3)),
    };

    this.meltingBatches.unshift(newBatch);
    return newBatch;
  }

  public completeMeltingBatch(
    tenantId: string,
    batchId: string,
    outputData: {
      outputGrossGrams: number;
      outputPurity: GoldPurityCode;
      outputFineness: number;
      alloyAddedGrams?: number;
      recoveredScrapGrams?: number;
      refiningChargesINR?: number;
      explanationNotes?: string;
      approvedBy: string;
    }
  ): MeltingBatch {
    const batch = this.meltingBatches.find((m) => m.id === batchId && m.tenantId === tenantId);
    if (!batch) throw new Error('Melting batch not found');

    const outGross = new Decimal(outputData.outputGrossGrams || 0);
    const outFineness = new Decimal(outputData.outputFineness || 999.0);
    const outFine = calculateFineGold(outGross, outFineness).toNumber();

    const weightLoss = new Decimal(batch.totalInputGrossGrams)
      .plus(outputData.alloyAddedGrams || 0)
      .minus(outGross)
      .minus(outputData.recoveredScrapGrams || 0)
      .toNumber();

    const fineGoldDifference = new Decimal(outFine)
      .minus(batch.totalInputFineGoldGrams)
      .toNumber();

    batch.status = 'COMPLETED';
    batch.completedDate = new Date().toISOString();
    batch.outputGrossGrams = outputData.outputGrossGrams;
    batch.outputPurity = outputData.outputPurity;
    batch.outputFineness = outputData.outputFineness;
    batch.outputFineGoldGrams = outFine;
    batch.alloyAddedGrams = outputData.alloyAddedGrams || 0;
    batch.recoveredScrapGrams = outputData.recoveredScrapGrams || 0;
    batch.refiningChargesINR = outputData.refiningChargesINR || 0;
    batch.weightLossGrams = Number(weightLoss.toFixed(3));
    batch.fineGoldLossOrGainGrams = Number(fineGoldDifference.toFixed(3));
    batch.explanationNotes = outputData.explanationNotes;
    batch.approvalStatus = 'APPROVED';
    batch.approvedBy = outputData.approvedBy;

    // Post refined gold output from MELTING_IN_PROCESS to BUSINESS_OWNED
    this.addGoldLedgerEntry({
      tenantId,
      branchId: batch.branchId,
      date: batch.completedDate,
      type: 'RECEIVE_FROM_MELTING',
      sourceAccount: 'MELTING_IN_PROCESS',
      destinationAccount: 'BUSINESS_OWNED',
      counterpartyName: batch.operatorOrRefiner,
      grossWeightGrams: outputData.outputGrossGrams,
      nonGoldWeightGrams: 0,
      netWeightGrams: outputData.outputGrossGrams,
      purity: outputData.outputPurity,
      fineness: outputData.outputFineness,
      fineGoldWeightGrams: outFine,
      enteredBy: outputData.approvedBy,
      notes:
        (outputData.alloyAddedGrams || 0) > 0
          ? `Converted Pure to ${outputData.outputPurity} (${(outputData.outputFineness / 10).toFixed(2)}%) from Batch ${batch.batchNo} (+${Number(outputData.alloyAddedGrams).toFixed(3)}g alloy)`
          : `Refined output from Batch ${batch.batchNo}. Pure diff: ${fineGoldDifference > 0 ? '+' : ''}${fineGoldDifference.toFixed(3)}g`,
    });

    // If scrap recovered, deposit back to SCRAP_REFINING
    if (outputData.recoveredScrapGrams && outputData.recoveredScrapGrams > 0) {
      this.addGoldLedgerEntry({
        tenantId,
        branchId: batch.branchId,
        date: batch.completedDate,
        type: 'SCRAP_RECOVERY',
        sourceAccount: 'MELTING_IN_PROCESS',
        destinationAccount: 'SCRAP_REFINING',
        grossWeightGrams: outputData.recoveredScrapGrams,
        nonGoldWeightGrams: 0,
        netWeightGrams: outputData.recoveredScrapGrams,
        purity: outputData.outputPurity,
        fineness: outputData.outputFineness,
        fineGoldWeightGrams: calculateFineGold(outputData.recoveredScrapGrams, outputData.outputFineness).toNumber(),
        enteredBy: outputData.approvedBy,
        notes: `Recovered pot scrap & filings from Batch ${batch.batchNo}`,
      });
    }

    return batch;
  }

  // 3. Branch Transfers
  public getTenantBranchTransfers(tenantId: string): BranchTransfer[] {
    return this.branchTransfers.filter((b) => b.tenantId === tenantId);
  }

  public createBranchTransfer(params: Omit<BranchTransfer, 'id' | 'transferNo' | 'createdAt' | 'status' | 'fineGoldWeightGrams'>): BranchTransfer {
    const count = this.branchTransfers.filter((b) => b.tenantId === params.tenantId).length + 1;
    const year = new Date().getFullYear();
    const transferNo = `TR-${year}-${String(count).padStart(3, '0')}`;
    const id = `bt_${params.tenantId}_${Date.now()}`;

    const fine = calculateFineGold(params.netWeightGrams, params.fineness).toNumber();

    const transfer: BranchTransfer = {
      ...params,
      id,
      transferNo,
      status: 'IN_TRANSIT',
      fineGoldWeightGrams: fine,
      createdAt: new Date().toISOString(),
    };

    this.branchTransfers.unshift(transfer);

    // Ledger move: BUSINESS_OWNED at source -> BRANCH_IN_TRANSIT
    this.addGoldLedgerEntry({
      tenantId: params.tenantId,
      branchId: params.sourceBranchId,
      date: params.date,
      type: 'BRANCH_TRANSFER',
      sourceAccount: 'BUSINESS_OWNED',
      destinationAccount: 'BRANCH_IN_TRANSIT',
      counterpartyName: `${params.sourceBranchName} -> ${params.destinationBranchName}`,
      grossWeightGrams: params.grossWeightGrams,
      nonGoldWeightGrams: 0,
      netWeightGrams: params.netWeightGrams,
      purity: params.purity,
      fineness: params.fineness,
      fineGoldWeightGrams: fine,
      enteredBy: params.sentBy,
      notes: `Dispatched to ${params.destinationBranchName} via ${params.carrierName} (${transferNo})`,
    });

    return transfer;
  }

  public receiveBranchTransfer(tenantId: string, transferId: string, receivedBy: string): BranchTransfer {
    const transfer = this.branchTransfers.find((b) => b.id === transferId && b.tenantId === tenantId);
    if (!transfer) throw new Error('Transfer not found');

    transfer.status = 'RECEIVED';
    transfer.receivedBy = receivedBy;
    transfer.receivedDate = new Date().toISOString();

    // Ledger move: BRANCH_IN_TRANSIT -> BUSINESS_OWNED at destination
    this.addGoldLedgerEntry({
      tenantId,
      branchId: transfer.destinationBranchId,
      date: transfer.receivedDate,
      type: 'BRANCH_TRANSFER',
      sourceAccount: 'BRANCH_IN_TRANSIT',
      destinationAccount: 'BUSINESS_OWNED',
      counterpartyName: `${transfer.sourceBranchName} Received`,
      grossWeightGrams: transfer.grossWeightGrams,
      nonGoldWeightGrams: 0,
      netWeightGrams: transfer.netWeightGrams,
      purity: transfer.purity,
      fineness: transfer.fineness,
      fineGoldWeightGrams: transfer.fineGoldWeightGrams,
      enteredBy: receivedBy,
      notes: `Received at ${transfer.destinationBranchName} from Transfer ${transfer.transferNo}`,
    });

    return transfer;
  }

  // 4. POS Drafts
  public getTenantPOSDrafts(tenantId: string): POSBillDraft[] {
    return this.posDrafts.filter((d) => d.tenantId === tenantId);
  }

  public savePOSDraft(draft: Omit<POSBillDraft, 'id' | 'draftNo' | 'savedAt'>): POSBillDraft {
    const count = this.posDrafts.filter((d) => d.tenantId === draft.tenantId).length + 1;
    const draftNo = `DFT-${String(count).padStart(3, '0')}`;
    const id = `draft_${draft.tenantId}_${Date.now()}`;

    const newDraft: POSBillDraft = {
      ...draft,
      id,
      draftNo,
      savedAt: new Date().toISOString(),
    };

    this.posDrafts.unshift(newDraft);
    return newDraft;
  }

  public deletePOSDraft(tenantId: string, draftId: string): boolean {
    const index = this.posDrafts.findIndex((d) => d.id === draftId && d.tenantId === tenantId);
    if (index >= 0) {
      this.posDrafts.splice(index, 1);
      return true;
    }
    return false;
  }

  // 5. Stock Reconciliations
  public getTenantStockReconciliations(tenantId: string): StockReconciliationRecord[] {
    return this.stockReconciliations.filter((s) => s.tenantId === tenantId);
  }

  public addStockReconciliation(record: Omit<StockReconciliationRecord, 'id' | 'createdAt'>): StockReconciliationRecord {
    const id = `rec_${record.tenantId}_${Date.now()}`;
    const newRecord: StockReconciliationRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };

    this.stockReconciliations.unshift(newRecord);

    // If adjusted, create a physical stock adjustment ledger entry
    if (record.status === 'ADJUSTED' && record.differenceGrams !== 0) {
      const standard = PURITY_STANDARDS[record.purity];
      const diff = Math.abs(record.differenceGrams);
      const isPositive = record.differenceGrams > 0;

      this.addGoldLedgerEntry({
        tenantId: record.tenantId,
        branchId: 'main',
        date: record.date,
        type: 'PHYSICAL_STOCK_ADJUSTMENT',
        sourceAccount: isPositive ? record.account : record.account,
        destinationAccount: isPositive ? record.account : record.account,
        grossWeightGrams: diff,
        nonGoldWeightGrams: 0,
        netWeightGrams: diff,
        purity: record.purity,
        fineness: standard.fineness,
        fineGoldWeightGrams: calculateFineGold(diff, standard.fineness).toNumber(),
        enteredBy: record.verifiedBy,
        notes: `Audit physical variance: ${record.differenceGrams > 0 ? '+' : ''}${record.differenceGrams}g. Reason: ${record.reason || ''}`,
      });
    }

    return newRecord;
  }
}

export const db = new GoldsmithDatabase();
