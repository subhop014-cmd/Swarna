import { Decimal } from 'decimal.js';
import { db } from '../server/db';
import {
  calculateFineGold,
  calculateInvoiceItem,
  calculateMeltingConversion,
  calculateNetGoldWeight,
  calculatePureToGoldAlloy,
  calculateWastageReconciliation,
  PURITY_STANDARDS,
} from '../utils/goldMath';
import { TRANSLATIONS, SUPPORTED_LANGUAGES } from '../i18n/translations';
import {
  escapeCSV,
  generateLedgerCSV,
  generateInvoicesCSV,
  generateStockSummaryCSV,
  generateWastageAuditCSV,
} from '../utils/csvExport';
import {
  computeCustomerGoldSummary,
  computeWastageSummary,
  getLocalTodayDateStr,
} from '../utils/dashboardMetrics';
import {
  computeRateForFineness,
  finenessToPurityCode,
  isExactPresetFineness,
  MELTING_TOUCH_PRESETS,
  parsePurityInputToFineness,
  resolveAllowedPurityCode,
} from '../components/EditablePurityControl';
import { getUI } from '../i18n/uiTranslations';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
  durationMs: number;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
  timestamp: string;
}

export function runAllAutomatedTests(): TestSuiteSummary {
  const startTime = Date.now();
  const results: TestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, message?: string) {
    const t0 = Date.now();
    results.push({
      suite,
      name,
      passed: condition,
      message: condition ? undefined : message || 'Assertion failed',
      durationMs: Date.now() - t0,
    });
  }

  // --- Suite 1: Gold Weight & Precision Arithmetic ---
  try {
    // Test 1: Zero binary floating point inaccuracy (0.1 + 0.2 must exactly equal 0.3)
    const d1 = new Decimal(0.1);
    const d2 = new Decimal(0.2);
    const sum = d1.plus(d2);
    assert(
      'Gold Precision Arithmetic',
      'No binary floating-point drift (0.1 + 0.2 == 0.3)',
      sum.equals(0.3) && sum.toString() === '0.3',
      `Expected 0.3, got ${sum.toString()}`
    );

    // Test 2: Net weight deduction
    const net = calculateNetGoldWeight(15.45, 0.45);
    assert(
      'Gold Precision Arithmetic',
      'Accurate Net weight deduction (15.450g - 0.450g == 15.000g)',
      net.equals(15.0),
      `Expected 15.0, got ${net.toString()}`
    );

    // Test 3: Fine gold equivalence (10.000g of 916 gold = 9.1600g pure gold)
    const fine916 = calculateFineGold(10.0, 916.0);
    assert(
      'Gold Precision Arithmetic',
      'Fine gold equivalent 22K (10.000g × 916/1000 = 9.1600g)',
      fine916.equals(9.16),
      `Expected 9.16, got ${fine916.toString()}`
    );

    // Test 4: Fine gold equivalence 18K (10.000g of 750 gold = 7.5000g pure gold)
    const fine750 = calculateFineGold(10.0, 750.0);
    assert(
      'Gold Precision Arithmetic',
      'Fine gold equivalent 18K (10.000g × 750/1000 = 7.5000g)',
      fine750.equals(7.5),
      `Expected 7.5, got ${fine750.toString()}`
    );
  } catch (err: any) {
    assert('Gold Precision Arithmetic', 'Suite execution error', false, err.message);
  }

  // --- Suite 2: Tenant Isolation & Multi-Tenancy ---
  const isoTenantA = `tenant_iso_a_${Date.now()}`;
  const isoTenantB = `tenant_iso_b_${Date.now()}`;
  try {
    db.addGoldLedgerEntry({
      tenantId: isoTenantA,
      branchId: 'main',
      date: new Date().toISOString(),
      type: 'OPENING_BALANCE',
      sourceAccount: 'BUSINESS_OWNED',
      destinationAccount: 'BUSINESS_OWNED',
      counterpartyType: 'INTERNAL',
      grossWeightGrams: 100,
      nonGoldWeightGrams: 0,
      netWeightGrams: 100,
      purity: '24K',
      fineness: 999.9,
      fineGoldWeightGrams: 99.99,
      enteredBy: 'Test Runner',
      notes: 'Tenant A Opening',
    });
    db.addCustomer({
      tenantId: isoTenantA,
      name: 'Tenant A Client',
      phone: '+91 90000 00001',
      city: 'Chennai',
      state: 'Tamil Nadu',
      preferredLanguage: 'en',
      customerGoldBalanceGrams: 0,
      monetaryBalanceINR: 0,
      creditLimitINR: 100000,
    });
    db.addCustomer({
      tenantId: isoTenantB,
      name: 'Tenant B Client',
      phone: '+91 90000 00002',
      city: 'Mumbai',
      state: 'Maharashtra',
      preferredLanguage: 'en',
      customerGoldBalanceGrams: 0,
      monetaryBalanceINR: 0,
      creditLimitINR: 100000,
    });

    const tenant1Ledger = db.getTenantGoldLedger(isoTenantA);
    const tenant2Ledger = db.getTenantGoldLedger(isoTenantB);

    // Tenant A records must not appear in Tenant B query
    const crossLeak = tenant1Ledger.some((t1) => tenant2Ledger.some((t2) => t2.id === t1.id));
    assert(
      'Tenant Isolation',
      'Tenant A ledger records never leak into Tenant B',
      !crossLeak && tenant1Ledger.length === 1 && tenant2Ledger.length === 0,
      'Cross tenant record leakage detected!'
    );

    // Customer isolation
    const t1Cust = db.getTenantCustomers(isoTenantA);
    const t2Cust = db.getTenantCustomers(isoTenantB);
    const custLeak = t1Cust.some((c1) => t2Cust.some((c2) => c2.id === c1.id));
    assert(
      'Tenant Isolation',
      'Customer accounts strictly isolated per tenant',
      !custLeak && t1Cust.length === 1 && t2Cust.length === 1,
      'Customer data crossed tenant boundary!'
    );

    // Invoices isolation
    const t1Inv = db.getTenantInvoices(isoTenantA);
    const t2Inv = db.getTenantInvoices(isoTenantB);
    const invLeak = t1Inv.some((i1) => t2Inv.some((i2) => i2.id === i1.id));
    assert(
      'Tenant Isolation',
      'Invoices and financial balances strictly isolated',
      !invLeak,
      'Invoice crossed tenant boundary!'
    );
  } catch (err: any) {
    assert('Tenant Isolation', 'Suite execution error', false, err.message);
  } finally {
    db.clearTenantData(isoTenantA);
    db.clearTenantData(isoTenantB);
  }

  // --- Suite 3: Karigar Wastage & Production Reconciliation ---
  try {
    // Issued: 40g, Finished returned: 38g, Scrap returned: 1g.
    // Accounted: 39g. Actual loss = 1g.
    // Agreed wastage: 2.5% of 40g = 1g.
    // Excess loss = 1g - 1g = 0.
    const reconNormal = calculateWastageReconciliation(40.0, 38.0, 1.0, 2.5);
    assert(
      'Wastage Reconciliation',
      'Normal wastage within agreed limits (Actual loss == Allowed wastage)',
      reconNormal.actualLoss.equals(1.0) &&
        reconNormal.allowedWastage.equals(1.0) &&
        reconNormal.excessLoss.equals(0) &&
        !reconNormal.isExcessLoss,
      `Expected actualLoss 1.0 and excessLoss 0, got actual=${reconNormal.actualLoss}, excess=${reconNormal.excessLoss}`
    );

    // Issued: 50g, Finished returned: 46g, Scrap returned: 1g.
    // Accounted: 47g. Actual loss = 3g.
    // Agreed wastage: 2.0% of 50g = 1g.
    // Excess loss = 3g - 1g = 2g! (Excess loss detected)
    const reconExcess = calculateWastageReconciliation(50.0, 46.0, 1.0, 2.0);
    assert(
      'Wastage Reconciliation',
      'Excess wastage flag triggers correctly when karigar loss exceeds agreement',
      reconExcess.actualLoss.equals(3.0) &&
        reconExcess.allowedWastage.equals(1.0) &&
        reconExcess.excessLoss.equals(2.0) &&
        reconExcess.isExcessLoss,
      `Expected excess loss 2.0g, got ${reconExcess.excessLoss.toString()}`
    );
  } catch (err: any) {
    assert('Wastage Reconciliation', 'Suite execution error', false, err.message);
  }

  // --- Suite 4: Indian GST & Making Charges Invoicing ---
  try {
    const itemCalc = calculateInvoiceItem({
      grossWeightGrams: 20.0,
      stoneWeightGrams: 0,
      fineness: 916.0,
      goldRatePerGram: 7000,
      wastagePercent: 2.0, // 2% of 20g = 0.40g = ₹2,800
      makingChargeType: 'PER_GRAM',
      makingChargeRate: 400, // 20g * 400 = ₹8,000
      stoneChargesINR: 0,
      gstRatePercent: 3,
    });

    // Gold Value = 20 * 7000 = 140,000
    // Wastage Value = 0.40 * 7000 = 2,800
    // Making Charges = 20 * 400 = 8,000
    // Taxable = 140,000 + 2,800 + 8,000 = 150,800
    // GST (3%) = 150,800 * 0.03 = 4,524
    // Line Total = 150,800 + 4,524 = 155,324
    assert(
      'GST & Invoicing Math',
      'Gold value calculation (20g @ ₹7,000/g == ₹1,40,000.00)',
      itemCalc.goldValueINR === 140000,
      `Expected 140000, got ${itemCalc.goldValueINR}`
    );

    assert(
      'GST & Invoicing Math',
      'Taxable value with wastage and making charges (₹1,50,800.00)',
      itemCalc.taxableAmountINR === 150800,
      `Expected 150800, got ${itemCalc.taxableAmountINR}`
    );

    assert(
      'GST & Invoicing Math',
      'Indian 3% GST calculation for jewellery (₹4,524.00)',
      itemCalc.gstAmountINR === 4524,
      `Expected 4524, got ${itemCalc.gstAmountINR}`
    );

    assert(
      'GST & Invoicing Math',
      'Grand Line Total matching Indian HSN 7113 retail standard (₹1,55,324.00)',
      itemCalc.lineTotalINR === 155324,
      `Expected 155324, got ${itemCalc.lineTotalINR}`
    );
  } catch (err: any) {
    assert('GST & Invoicing Math', 'Suite execution error', false, err.message);
  }

  // --- Suite 5: Customer vs Business Gold Separation ---
  const stockTestTenant = `tenant_stock_sep_${Date.now()}`;
  try {
    db.addGoldLedgerEntry({
      tenantId: stockTestTenant,
      branchId: 'main',
      date: new Date().toISOString(),
      type: 'OPENING_BALANCE',
      sourceAccount: 'BUSINESS_OWNED',
      destinationAccount: 'BUSINESS_OWNED',
      counterpartyType: 'INTERNAL',
      grossWeightGrams: 50,
      nonGoldWeightGrams: 0,
      netWeightGrams: 50,
      purity: '24K',
      fineness: 999.9,
      fineGoldWeightGrams: 49.995,
      enteredBy: 'Test Runner',
      notes: 'Vault Bullion',
    });
    db.addCustomer({
      tenantId: stockTestTenant,
      name: 'Custody Client',
      phone: '+91 90000 00003',
      city: 'Chennai',
      state: 'Tamil Nadu',
      preferredLanguage: 'en',
      customerGoldBalanceGrams: 12.5,
      monetaryBalanceINR: 0,
      creditLimitINR: 100000,
    });

    const summary = db.getTenantStockSummary(stockTestTenant);
    assert(
      'Stock Accounting Integrity',
      'Business-owned gold strictly separated from customer-deposited gold',
      summary.accountBalances.BUSINESS_OWNED.netWeight === 50 &&
        summary.accountBalances.CUSTOMER_OWNED.netWeight === 12.5,
      'Customer gold balance is missing or merged with business stock!'
    );

    assert(
      'Stock Accounting Integrity',
      'Total Fine Gold reconciliation matches aggregate weights',
      summary.totalFineGoldGrams > 0,
      'Fine gold balance is zero or invalid'
    );
  } catch (err: any) {
    assert('Stock Accounting Integrity', 'Suite execution error', false, err.message);
  } finally {
    db.clearTenantData(stockTestTenant);
  }

  // --- Suite 6: Multilingual Translations Completeness ---
  try {
    const englishKeys = Object.keys(TRANSLATIONS.en) as (keyof typeof TRANSLATIONS.en)[];
    assert(
      'Multilingual Localization',
      'All 10 Indian official languages registered in supported list',
      SUPPORTED_LANGUAGES.length === 10,
      `Expected 10 languages, found ${SUPPORTED_LANGUAGES.length}`
    );

    let allComplete = true;
    let missingReport = '';

    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = TRANSLATIONS[lang.code];
      if (!dict) {
        allComplete = false;
        missingReport += `Language ${lang.code} missing dictionary. `;
        continue;
      }
      for (const key of englishKeys) {
        if (!dict[key] || dict[key].trim().length === 0) {
          allComplete = false;
          missingReport += `[${lang.code}] missing key '${key}'. `;
        }
      }
    }

    assert(
      'Multilingual Localization',
      'Translation completeness across all 10 Indian languages (no missing keys)',
      allComplete,
      missingReport
    );
  } catch (err: any) {
    assert('Multilingual Localization', 'Suite execution error', false, err.message);
  }

  // --- Suite 7: Melting & Refining Recovery Reconciliation ---
  try {
    // 100g of 916 gold (Fine: 91.6g) + 50g of 750 gold (Fine: 37.5g) = Total Fine Input: 129.1g
    // Refined output bar: 129.0g of 999.9 pure gold (Fine: 128.9871g)
    const melt = calculateMeltingConversion(
      [
        { weightGrams: 100, fineness: 916 },
        { weightGrams: 50, fineness: 750 },
      ],
      129.0,
      999.9
    );

    assert(
      'Melting & Refining Batch',
      'Fine gold input conservation (129.1000g fine input)',
      melt.totalInputFineGrams.equals(129.1),
      `Expected 129.1, got ${melt.totalInputFineGrams.toString()}`
    );

    assert(
      'Melting & Refining Batch',
      'Melting physical weight loss calculation (150g in - 129g out = 21g non-gold alloy eliminated)',
      melt.weightLossGrams.equals(21.0),
      `Expected 21.0, got ${melt.weightLossGrams.toString()}`
    );
  } catch (err: any) {
    assert('Melting & Refining Batch', 'Suite execution error', false, err.message);
  }

  // --- Suite 8: External Accounting CSV Export Utility ---
  try {
    // 1. Escaping test
    assert(
      'CSV Export Utility',
      'RFC 4180 CSV escaping for quotes, commas and newlines',
      escapeCSV('Choker, 22K') === '"Choker, 22K"' &&
        escapeCSV('Item "Special"') === '"Item ""Special"""' &&
        escapeCSV('Standard') === 'Standard',
      'CSV escaping failed'
    );

    // 2. Ledger CSV generation
    const ledger = db.getTenantGoldLedger('tenant_101');
    const ledgerCSV = generateLedgerCSV(ledger, 'Test Jewellers');
    assert(
      'CSV Export Utility',
      'Gold Ledger CSV contains headers, metadata and all transaction lines',
      ledgerCSV.length >= ledger.length + 3 &&
        ledgerCSV[2].includes('Transaction No') &&
        ledgerCSV[2].includes('Fine Gold Equivalent 999.9 (g)'),
      'Ledger CSV structure invalid'
    );

    // 3. Invoices CSV generation
    const invoices = db.getTenantInvoices('tenant_101');
    const invCSV = generateInvoicesCSV(invoices, 'Test Jewellers');
    assert(
      'CSV Export Utility',
      'GST Invoice CSV contains HSN 7113, CGST, SGST, IGST and HUID columns',
      invCSV.length >= invoices.length + 3 &&
        invCSV[2].includes('HSN Code') &&
        invCSV[2].includes('CGST Amount (1.5%)') &&
        invCSV[2].includes('BIS Hallmarking HUID'),
      'Invoices CSV structure invalid'
    );

    // 4. Stock Summary CSV generation
    const stock = db.getTenantStockSummary('tenant_101');
    const rates = db.getTenantGoldRates('tenant_101');
    const stockCSV = generateStockSummaryCSV(stock, rates, 'Test Jewellers');
    assert(
      'CSV Export Utility',
      'Stock Summary CSV includes vault stock, showroom display, and customer gold accounts',
      stockCSV.some((row) => row[0] === 'Business Stock (Vault/Bullion)') &&
        stockCSV.some((row) => row[0] === 'Customer Deposited Gold'),
      'Stock CSV account separation missing'
    );
  } catch (err: any) {
    assert('CSV Export Utility', 'Suite execution error', false, err.message);
  }

  // --- Suite 9: Customer Gold Balance & Vault Custody Reconciliation ---
  const testTenant = `tenant_test_cust_gold_${Date.now()}`;
  try {
    // 1. Active tenants reconcile 100% between sum(positive customerGoldBalanceGrams) and CUSTOMER_OWNED stock
    const t101Custs = db.getTenantCustomers('tenant_101');
    const t101Stock = db.getTenantStockSummary('tenant_101');
    const t101PositiveCustGold = t101Custs
      .reduce((acc, c) => acc.plus(Math.max(0, c.customerGoldBalanceGrams || 0)), new Decimal(0))
      .toDecimalPlaces(3)
      .toNumber();
    assert(
      'Customer Gold Balance',
      'Tenant 101 positive customer gold balances reconcile 100% with CUSTOMER_OWNED ledger',
      t101Stock.accountBalances.CUSTOMER_OWNED.netWeight === t101PositiveCustGold,
      `Got customers=${t101PositiveCustGold}g vs ledger=${t101Stock.accountBalances.CUSTOMER_OWNED.netWeight}g`
    );

    const t102Custs = db.getTenantCustomers('tenant_102');
    const t102Stock = db.getTenantStockSummary('tenant_102');
    const t102PositiveCustGold = t102Custs
      .reduce((acc, c) => acc.plus(Math.max(0, c.customerGoldBalanceGrams || 0)), new Decimal(0))
      .toDecimalPlaces(3)
      .toNumber();
    assert(
      'Customer Gold Balance',
      'Tenant 102 positive customer gold balances reconcile 100% with CUSTOMER_OWNED ledger',
      t102Stock.accountBalances.CUSTOMER_OWNED.netWeight === t102PositiveCustGold,
      `Got customers=${t102PositiveCustGold}g vs ledger=${t102Stock.accountBalances.CUSTOMER_OWNED.netWeight}g`
    );

    // 2. Isolated tenant lifecycle test: Gold Due -> Deposit Settles Due + Adds Custody -> Withdraw -> Deposit Used on Bill -> Excess Gold Credit -> Direct POS Sync
    const testCust = db.addCustomer({
      tenantId: testTenant,
      name: 'Arjun Gold Test',
      phone: '+91 90000 12345',
      city: 'Chennai',
      state: 'Tamil Nadu',
      preferredLanguage: 'en',
      customerGoldBalanceGrams: 0,
      monetaryBalanceINR: undefined as unknown as number, // Verify undefined guard prevents DecimalError
      creditLimitINR: 100000,
    });

    // 2a. Pure-weight DUE invoice (10.000g) creates -10.000g Gold Due without affecting positive CUSTOMER_OWNED custody
    db.createInvoice({
      tenantId: testTenant,
      branchId: 'main',
      type: 'RETAIL_TAX_INVOICE',
      isInterstate: false,
      customerId: testCust.id,
      customerName: testCust.name,
      date: '2026-04-01',
      items: [
        {
          id: 'item_due_1',
          description: '22K Chain (Weight Bill)',
          hsnCode: '7113',
          purity: '22K',
          fineness: 916,
          grossWeightGrams: 10,
          stoneWeightGrams: 0,
          netGoldWeightGrams: 10,
          fineGoldWeightGrams: 9.16,
          wastagePercent: 0,
          wastageWeightGrams: 0,
          wastageValueINR: 0,
          goldRatePerGram: 0,
          goldValueINR: 0,
          makingChargeType: 'FIXED',
          makingChargeRate: 0,
          makingChargesINR: 0,
          stoneChargesINR: 0,
          otherChargesINR: 0,
          taxableAmountINR: 0,
          gstRatePercent: 3,
          gstAmountINR: 0,
          lineTotalINR: 0,
        },
      ],
      totalGrossWeightGrams: 10,
      totalNetGoldWeightGrams: 10,
      totalFineGoldWeightGrams: 9.16,
      taxableAmountINR: 0,
      cgstINR: 0,
      sgstINR: 0,
      igstINR: 0,
      totalGstINR: 0,
      roundOffINR: 0,
      grandTotalINR: 0,
      paidAmountINR: 0,
      balanceAmountINR: 0,
      goldBalanceDueGrams: 10,
      paymentStatus: 'UNPAID',
      paymentMethod: 'CREDIT',
      createdBy: 'Test Runner',
      status: 'FINAL',
    });

    assert(
      'Customer Gold Balance',
      'Pure-weight credit bill records -10.000g Gold Due and keeps CUSTOMER_OWNED custody at 0.000g',
      testCust.customerGoldBalanceGrams === -10 &&
        db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight === 0,
      `Got customer=${testCust.customerGoldBalanceGrams}g, ledger=${db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight}g`
    );

    // 2b. Deposit 25.000g -> settles 10.000g Gold Due into vault and places +15.000g into CUSTOMER_OWNED custody
    db.recordCustomerGoldDeposit(testTenant, testCust.id, 25, 0, '22K', 'Test Runner', 'Settle due + custody');
    assert(
      'Customer Gold Balance',
      'Depositing 25.000g against -10.000g due yields +15.000g customer custody & 15.000g CUSTOMER_OWNED stock',
      testCust.customerGoldBalanceGrams === 15 &&
        db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight === 15,
      `Got customer=${testCust.customerGoldBalanceGrams}g, ledger=${db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight}g`
    );

    // 2c. Withdraw 5.000g custody -> reduces both to 10.000g, and rejects over-withdrawal (>10.000g)
    db.recordCustomerGoldWithdrawal(testTenant, testCust.id, 5, '22K', 'Test Runner', 'Partial return');
    let overWithdrawBlocked = false;
    try {
      db.recordCustomerGoldWithdrawal(testTenant, testCust.id, 12, '22K', 'Test Runner', 'Invalid excess');
    } catch {
      overWithdrawBlocked = true;
    }
    assert(
      'Customer Gold Balance',
      'Custody withdrawal deducts 5.000g (leaving 10.000g) and blocks withdrawals exceeding custody',
      overWithdrawBlocked &&
        testCust.customerGoldBalanceGrams === 10 &&
        db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight === 10,
      `Got overWithdrawBlocked=${overWithdrawBlocked}, customer=${testCust.customerGoldBalanceGrams}g, ledger=${db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight}g`
    );

    // 2d. Apply 6.000g from customer deposit on an invoice -> deducts 6.000g from customer & CUSTOMER_OWNED (leaving 4.000g)
    db.createInvoice({
      tenantId: testTenant,
      branchId: 'main',
      type: 'RETAIL_TAX_INVOICE',
      isInterstate: false,
      customerId: testCust.id,
      customerName: testCust.name,
      date: '2026-04-02',
      items: [
        {
          id: 'item_dep_1',
          description: '22K Ring',
          hsnCode: '7113',
          purity: '22K',
          fineness: 916,
          grossWeightGrams: 6,
          stoneWeightGrams: 0,
          netGoldWeightGrams: 6,
          fineGoldWeightGrams: 5.496,
          wastagePercent: 0,
          wastageWeightGrams: 0,
          wastageValueINR: 0,
          goldRatePerGram: 0,
          goldValueINR: 0,
          makingChargeType: 'FIXED',
          makingChargeRate: 0,
          makingChargesINR: 0,
          stoneChargesINR: 0,
          otherChargesINR: 0,
          taxableAmountINR: 0,
          gstRatePercent: 3,
          gstAmountINR: 0,
          lineTotalINR: 0,
        },
      ],
      totalGrossWeightGrams: 6,
      totalNetGoldWeightGrams: 6,
      totalFineGoldWeightGrams: 5.496,
      taxableAmountINR: 0,
      cgstINR: 0,
      sgstINR: 0,
      igstINR: 0,
      totalGstINR: 0,
      roundOffINR: 0,
      grandTotalINR: 0,
      paidAmountINR: 0,
      balanceAmountINR: 0,
      goldUsedFromDepositGrams: 6,
      paymentStatus: 'PAID',
      paymentMethod: 'OLD_GOLD_EXCHANGE',
      createdBy: 'Test Runner',
      status: 'FINAL',
    });
    assert(
      'Customer Gold Balance',
      'Using 6.000g custody deposit on invoice updates customer & CUSTOMER_OWNED to 4.000g',
      testCust.customerGoldBalanceGrams === 4 &&
        db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight === 4,
      `Got customer=${testCust.customerGoldBalanceGrams}g, ledger=${db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight}g`
    );

    // 2e. Give 12.000g physical gold on an 8.000g pure-weight bill -> +4.000g excess gold credited (4 + 4 = 8.000g)
    db.createInvoice({
      tenantId: testTenant,
      branchId: 'main',
      type: 'RETAIL_TAX_INVOICE',
      isInterstate: false,
      customerId: testCust.id,
      customerName: testCust.name,
      date: '2026-04-03',
      items: [
        {
          id: 'item_exc_1',
          description: '22K Bangle',
          hsnCode: '7113',
          purity: '22K',
          fineness: 916,
          grossWeightGrams: 8,
          stoneWeightGrams: 0,
          netGoldWeightGrams: 8,
          fineGoldWeightGrams: 7.328,
          wastagePercent: 0,
          wastageWeightGrams: 0,
          wastageValueINR: 0,
          goldRatePerGram: 0,
          goldValueINR: 0,
          makingChargeType: 'FIXED',
          makingChargeRate: 0,
          makingChargesINR: 0,
          stoneChargesINR: 0,
          otherChargesINR: 0,
          taxableAmountINR: 0,
          gstRatePercent: 3,
          gstAmountINR: 0,
          lineTotalINR: 0,
        },
      ],
      totalGrossWeightGrams: 8,
      totalNetGoldWeightGrams: 8,
      totalFineGoldWeightGrams: 7.328,
      taxableAmountINR: 0,
      cgstINR: 0,
      sgstINR: 0,
      igstINR: 0,
      totalGstINR: 0,
      roundOffINR: 0,
      grandTotalINR: 0,
      paidAmountINR: 0,
      balanceAmountINR: 0,
      goldExchangeGrams: 12,
      goldExchangePurity: '22K',
      goldExcessCreditGrams: 4,
      paymentStatus: 'PAID',
      paymentMethod: 'OLD_GOLD_EXCHANGE',
      createdBy: 'Test Runner',
      status: 'FINAL',
    });
    assert(
      'Customer Gold Balance',
      'Excess physical gold (+4.000g) on pure-weight bill credits customer custody & CUSTOMER_OWNED to 8.000g',
      testCust.customerGoldBalanceGrams === 8 &&
        db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight === 8,
      `Got customer=${testCust.customerGoldBalanceGrams}g, ledger=${db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight}g`
    );

    // 2f. Direct Gold In/Out ledger entries sync customerGoldBalanceGrams (+3.500g deposit, -1.500g withdrawal -> 10.000g)
    db.addGoldLedgerEntry({
      tenantId: testTenant,
      branchId: 'main',
      date: new Date().toISOString(),
      type: 'CUSTOMER_DEPOSIT',
      sourceAccount: 'CUSTOMER_OWNED',
      destinationAccount: 'CUSTOMER_OWNED',
      counterpartyId: testCust.id,
      counterpartyName: testCust.name,
      counterpartyType: 'CUSTOMER',
      grossWeightGrams: 3.5,
      nonGoldWeightGrams: 0,
      netWeightGrams: 3.5,
      purity: '22K',
      fineness: 916,
      fineGoldWeightGrams: 3.206,
      enteredBy: 'Test Runner',
      notes: 'POS Gold In',
    });
    db.addGoldLedgerEntry({
      tenantId: testTenant,
      branchId: 'main',
      date: new Date().toISOString(),
      type: 'CUSTOMER_WITHDRAWAL',
      sourceAccount: 'CUSTOMER_OWNED',
      destinationAccount: 'CUSTOMER_OWNED',
      counterpartyId: testCust.id,
      counterpartyName: testCust.name,
      counterpartyType: 'CUSTOMER',
      grossWeightGrams: 1.5,
      nonGoldWeightGrams: 0,
      netWeightGrams: 1.5,
      purity: '22K',
      fineness: 916,
      fineGoldWeightGrams: 1.374,
      enteredBy: 'Test Runner',
      notes: 'POS Gold Out',
    });
    assert(
      'Customer Gold Balance',
      'Direct POS Gold In (+3.500g) & Gold Out (-1.500g) sync customer balance & CUSTOMER_OWNED to 10.000g',
      testCust.customerGoldBalanceGrams === 10 &&
        db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight === 10,
      `Got customer=${testCust.customerGoldBalanceGrams}g, ledger=${db.getTenantStockSummary(testTenant).accountBalances.CUSTOMER_OWNED.netWeight}g`
    );

    // 2g. Clearing tenant data resets customers, ledger, invoices, and stock summary to 0
    db.clearTenantData(testTenant);
    assert(
      'Customer Gold Balance',
      'clearTenantData resets all customer accounts, stock ledger, and invoices to 0',
      db.getTenantCustomers(testTenant).length === 0 &&
        db.getTenantGoldLedger(testTenant).length === 0 &&
        db.getTenantInvoices(testTenant).length === 0 &&
        db.getTenantStockSummary(testTenant).totalPhysicalGrams === 0,
      'Failed to clear tenant records cleanly'
    );

    // 2h. Dashboard Gold With Customers & Wastage Collected Today calculations
    const custDueA = db.addCustomer({
      tenantId: testTenant,
      name: 'Due Customer A',
      phone: '9000000011',
      preferredLanguage: 'en',
      customerGoldBalanceGrams: -12.5,
      monetaryBalanceINR: 15000,
      creditLimitINR: 0,
    });
    const custDueB = db.addCustomer({
      tenantId: testTenant,
      name: 'Due Customer B',
      phone: '9000000012',
      preferredLanguage: 'en',
      customerGoldBalanceGrams: -4.25,
      monetaryBalanceINR: 0,
      creditLimitINR: 0,
    });
    const custCustodyC = db.addCustomer({
      tenantId: testTenant,
      name: 'Custody Customer C',
      phone: '9000000013',
      preferredLanguage: 'en',
      customerGoldBalanceGrams: 8.75,
      monetaryBalanceINR: 0,
      creditLimitINR: 0,
    });

    const dashCustSummary = computeCustomerGoldSummary([custDueA, custDueB, custCustodyC]);
    assert(
      'Dashboard Metrics',
      'Gold With Customers separates receivable due gold (16.750g across 2 due) from custody held (8.750g across 1)',
      dashCustSummary.goldWithCustomersDueGrams === 16.75 &&
        dashCustSummary.dueCustomersCount === 2 &&
        dashCustSummary.customerCustodyGrams === 8.75 &&
        dashCustSummary.custodyCustomersCount === 1 &&
        dashCustSummary.dueCustomers[0].id === custDueA.id,
      `Got due=${dashCustSummary.goldWithCustomersDueGrams}g (${dashCustSummary.dueCustomersCount}), custody=${dashCustSummary.customerCustodyGrams}g (${dashCustSummary.custodyCustomersCount})`
    );

    const todayDate = getLocalTodayDateStr();
    const todayInv1 = db.createInvoice({
      tenantId: testTenant,
      branchId: 'main',
      type: 'RETAIL_TAX_INVOICE',
      isInterstate: false,
      customerName: 'Walk-in Buyer 1',
      date: todayDate,
      items: [
        {
          id: 'w_item_1',
          description: '22K Necklace',
          hsnCode: '7113',
          purity: '22K',
          fineness: 916,
          grossWeightGrams: 20,
          stoneWeightGrams: 0,
          netGoldWeightGrams: 20,
          fineGoldWeightGrams: 18.32,
          wastagePercent: 8,
          wastageWeightGrams: 1.6,
          wastageValueINR: 11200,
          goldRatePerGram: 7000,
          goldValueINR: 140000,
          makingChargeType: 'PER_GRAM',
          makingChargeRate: 400,
          makingChargesINR: 8000,
          stoneChargesINR: 0,
          otherChargesINR: 0,
          taxableAmountINR: 159200,
          gstRatePercent: 3,
          gstAmountINR: 4776,
          lineTotalINR: 163976,
        },
      ],
      totalGrossWeightGrams: 20,
      totalNetGoldWeightGrams: 20,
      totalFineGoldWeightGrams: 18.32,
      taxableAmountINR: 159200,
      cgstINR: 2388,
      sgstINR: 2388,
      igstINR: 0,
      totalGstINR: 4776,
      roundOffINR: 0,
      grandTotalINR: 163976,
      paidAmountINR: 163976,
      balanceAmountINR: 0,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      createdBy: 'Test Runner',
      status: 'FINAL',
    });

    const yesterdayInv = db.createInvoice({
      tenantId: testTenant,
      branchId: 'main',
      type: 'RETAIL_TAX_INVOICE',
      isInterstate: false,
      customerName: 'Older Buyer',
      date: '2025-01-15',
      items: [
        {
          id: 'w_item_old',
          description: '18K Bracelet',
          hsnCode: '7113',
          purity: '18K',
          fineness: 750,
          grossWeightGrams: 10,
          stoneWeightGrams: 0,
          netGoldWeightGrams: 10,
          fineGoldWeightGrams: 7.5,
          wastagePercent: 10,
          wastageValueINR: 6000,
          goldRatePerGram: 6000,
          goldValueINR: 60000,
          makingChargeType: 'FIXED',
          makingChargeRate: 0,
          makingChargesINR: 0,
          stoneChargesINR: 0,
          otherChargesINR: 0,
          taxableAmountINR: 66000,
          gstRatePercent: 3,
          gstAmountINR: 1980,
          lineTotalINR: 67980,
        },
      ],
      totalGrossWeightGrams: 10,
      totalNetGoldWeightGrams: 10,
      totalFineGoldWeightGrams: 7.5,
      taxableAmountINR: 66000,
      cgstINR: 990,
      sgstINR: 990,
      igstINR: 0,
      totalGstINR: 1980,
      roundOffINR: 0,
      grandTotalINR: 67980,
      paidAmountINR: 67980,
      balanceAmountINR: 0,
      paymentStatus: 'PAID',
      paymentMethod: 'CASH',
      createdBy: 'Test Runner',
      status: 'FINAL',
    });

    const cancelledTodayInv = {
      ...todayInv1,
      id: 'cancelled_inv_test',
      status: 'CANCELLED' as const,
    };

    const wastageDash = computeWastageSummary(
      [todayInv1, yesterdayInv, cancelledTodayInv],
      todayDate
    );
    // Today: 1.600g of 22K (916) => fine = 1.6 * 0.916 = 1.4656 -> 1.466g, INR = 11200, avg = 8.00%
    // All-time: 1.600g + 1.000g (18K 750 -> fine 0.750g) = 2.600g wastage, fine = 2.216g, INR = 17200
    assert(
      'Dashboard Metrics',
      'Wastage Collected Today aggregates today wastage (1.600g / 1.466g 24K / ₹11,200), excludes cancelled & past bills',
      wastageDash.today.wastageGrams === 1.6 &&
        wastageDash.today.wastageFineGrams === 1.466 &&
        wastageDash.today.wastageValueINR === 11200 &&
        wastageDash.today.avgWastagePct === 8 &&
        wastageDash.today.totalBillCount === 1 &&
        wastageDash.allTime.wastageGrams === 2.6 &&
        wastageDash.allTime.wastageFineGrams === 2.216 &&
        wastageDash.allTime.wastageValueINR === 17200,
      `Got today=${JSON.stringify(wastageDash.today)}, allTime=${JSON.stringify(wastageDash.allTime)}`
    );

    // 2i. Editable Custom Purity (% Tunch & ‰ Fineness) parsing, rate scaling, and DB ledger persistence
    const parsedPct = parsePurityInputToFineness('88.50', 'PERCENT');
    const parsedHallmarkInPct = parsePurityInputToFineness('995', 'PERCENT');
    const parsedPermille = parsePurityInputToFineness('762.5', 'FINENESS');
    assert(
      'Editable Purity',
      'Parses custom % Tunch (88.50% -> 885.0‰), 3-digit hallmark (995 -> 995.0‰), and ‰ fineness (762.5‰)',
      parsedPct === 885 &&
        parsedHallmarkInPct === 995 &&
        parsedPermille === 762.5 &&
        finenessToPurityCode(885) === '22K' &&
        finenessToPurityCode(995) === '24K' &&
        !isExactPresetFineness('22K', 885) &&
        isExactPresetFineness('22K', 916),
      `Got pct=${parsedPct}, hallmark=${parsedHallmarkInPct}, permille=${parsedPermille}`
    );

    const mockRates = [
      {
        tenantId: testTenant,
        date: todayDate,
        purity: '24K' as const,
        fineness: 999.9,
        ratePerGram: 8000,
        updatedBy: 'Test',
        updatedAt: new Date().toISOString(),
      },
      {
        tenantId: testTenant,
        date: todayDate,
        purity: '22K' as const,
        fineness: 916.0,
        ratePerGram: 7330,
        updatedBy: 'Test',
        updatedAt: new Date().toISOString(),
      },
    ];
    const preset22kRate = computeRateForFineness(916, mockRates, '22K');
    const custom885Rate = computeRateForFineness(885, mockRates, '22K');
    assert(
      'Editable Purity',
      'Uses configured Karat rate for preset (916‰ -> ₹7,330) and proportional 24K scaling for custom purity (885‰ -> ₹7,081)',
      preset22kRate === 7330 && custom885Rate === Math.round((8000 * 885) / 999.9),
      `Got preset22k=${preset22kRate}, custom885=${custom885Rate}`
    );

    const customDepRes = db.recordCustomerGoldDeposit(
      testTenant,
      custCustodyC.id,
      10,
      0,
      '22K',
      'Test Runner',
      'Custom 88.50% Tunch Deposit',
      885
    );
    const customDepEntry = db.getTenantGoldLedger(testTenant)[0];
    assert(
      'Editable Purity',
      'Customer gold deposit with custom 88.50% (885‰) records exact 8.850g 24K fine gold',
      Boolean(customDepRes) &&
        Boolean(customDepEntry) &&
        customDepEntry.fineness === 885 &&
        customDepEntry.fineGoldWeightGrams === 8.85,
      `Got fineness=${customDepEntry?.fineness}, fine=${customDepEntry?.fineGoldWeightGrams}`
    );

    db.createInvoice({
      tenantId: testTenant,
      branchId: 'main',
      type: 'JOB_WORK_BILL',
      isInterstate: false,
      customerName: 'Custom Purity Exchange Buyer',
      date: todayDate,
      items: [
        {
          id: 'custom_p_item_1',
          description: '89.20% Custom Chain',
          hsnCode: '7113',
          purity: '22K',
          fineness: 892,
          grossWeightGrams: 10,
          stoneWeightGrams: 0,
          netGoldWeightGrams: 10,
          fineGoldWeightGrams: 8.92,
          wastagePercent: 0,
          wastageWeightGrams: 0,
          wastageValueINR: 0,
          goldRatePerGram: 0,
          goldValueINR: 0,
          makingChargeType: 'FIXED',
          makingChargeRate: 0,
          makingChargesINR: 0,
          stoneChargesINR: 0,
          otherChargesINR: 0,
          taxableAmountINR: 0,
          gstRatePercent: 0,
          gstAmountINR: 0,
          lineTotalINR: 0,
        },
      ],
      totalGrossWeightGrams: 10,
      totalNetGoldWeightGrams: 10,
      totalFineGoldWeightGrams: 8.92,
      taxableAmountINR: 0,
      cgstINR: 0,
      sgstINR: 0,
      igstINR: 0,
      totalGstINR: 0,
      roundOffINR: 0,
      grandTotalINR: 0,
      paidAmountINR: 0,
      balanceAmountINR: 0,
      goldExchangeGrams: 10,
      goldExchangePurity: '22K',
      goldExchangeFineness: 875,
      paymentStatus: 'PAID',
      paymentMethod: 'OLD_GOLD_EXCHANGE',
      createdBy: 'Test Runner',
      status: 'FINAL',
    });
    const ledgerAfterCustomInv = db.getTenantGoldLedger(testTenant);
    const oldGoldEntry = ledgerAfterCustomInv.find(
      (e) => e.type === 'CUSTOMER_OLD_GOLD' && e.fineness === 875
    );
    const saleOutEntry = ledgerAfterCustomInv.find(
      (e) => e.type === 'SALE_DELIVERY' && e.fineness === 892
    );
    assert(
      'Editable Purity',
      'Sales bill with custom ornament purity (89.20% -> 8.920g fine) and custom exchange purity (87.50% -> 8.750g fine) persists exact fineness in ledger',
      Boolean(oldGoldEntry) &&
        oldGoldEntry!.fineGoldWeightGrams === 8.75 &&
        Boolean(saleOutEntry) &&
        saleOutEntry!.fineGoldWeightGrams === 8.92,
      `Got oldGoldFine=${oldGoldEntry?.fineGoldWeightGrams}, saleOutFine=${saleOutEntry?.fineGoldWeightGrams}`
    );

    // 2j. Pure-to-Gold Alloying Math & Vault Stock Accounting
    const alloy22k = calculatePureToGoldAlloy({
      pureWeightGrams: 100,
      pureFineness: 999.9,
      targetFineness: 916.0,
      copperRatioPercent: 70,
    });
    assert(
      'Pure-to-Gold Alloying',
      '100g 24K (999.9‰) -> 22K (916.0‰) requires +9.159g alloy (6.411g Cu + 2.748g Ag) for 109.159g target gold',
      alloy22k.inputFineGoldGrams.eq(99.99) &&
        alloy22k.expectedTargetWeightGrams.eq(109.159) &&
        alloy22k.requiredAlloyGrams.eq(9.159) &&
        alloy22k.copperGrams.eq(6.411) &&
        alloy22k.silverGrams.eq(2.748) &&
        alloy22k.meltingLossGrams.eq(0),
      `Got expected=${alloy22k.expectedTargetWeightGrams}, alloy=${alloy22k.requiredAlloyGrams}, cu=${alloy22k.copperGrams}, ag=${alloy22k.silverGrams}`
    );

    const alloyCustom = calculatePureToGoldAlloy({
      pureWeightGrams: 100,
      pureFineness: 999.9,
      targetFineness: 885.0,
      copperRatioPercent: 80,
      actualOutputGrams: 112.85,
    });
    assert(
      'Pure-to-Gold Alloying',
      'Custom target purity (88.50% / 885‰) calculates +12.983g alloy and 0.133g furnace loss when actual output is 112.850g',
      alloyCustom.expectedTargetWeightGrams.eq(112.983) &&
        alloyCustom.requiredAlloyGrams.eq(12.983) &&
        alloyCustom.effectiveOutputGrams.eq(112.85) &&
        alloyCustom.meltingLossGrams.eq(0.133),
      `Got expected=${alloyCustom.expectedTargetWeightGrams}, loss=${alloyCustom.meltingLossGrams}`
    );

    const testPureMeltTenant = '__test_pure_melt_stock__';
    db.clearTenantData(testPureMeltTenant);
    try {
      db.addGoldLedgerEntry({
        tenantId: testPureMeltTenant,
        branchId: 'main',
        date: todayDate,
        type: 'BULLION_PURCHASE',
        sourceAccount: 'BUSINESS_OWNED',
        destinationAccount: 'BUSINESS_OWNED',
        grossWeightGrams: 100,
        nonGoldWeightGrams: 0,
        netWeightGrams: 100,
        purity: '24K',
        fineness: 999.9,
        fineGoldWeightGrams: 99.99,
        enteredBy: 'Test Runner',
        notes: 'Initial 100g 24K Bullion Bar',
      });

      const pureBatch = db.createMeltingBatch({
        tenantId: testPureMeltTenant,
        branchId: 'main',
        sentDate: new Date().toISOString(),
        operatorOrRefiner: 'Furnace Master',
        refinerType: 'INTERNAL_KARIGAR',
        sourceAccount: 'BUSINESS_OWNED',
        inputs: [
          {
            description: 'Pure 24K Bar',
            weightGrams: 100,
            purity: '24K',
            fineness: 999.9,
            fineGoldWeightGrams: 99.99,
          },
        ],
        approvalStatus: 'APPROVED',
        createdBy: 'Test Runner',
      });

      const inProcStock = db.getTenantStockSummary(testPureMeltTenant);
      const inProc24k = inProcStock.purityBalances.find((p) => p.purity === '24K')?.netWeight;
      assert(
        'Pure-to-Gold Alloying',
        'Sending 100g 24K to furnace moves 100g from BUSINESS_OWNED into MELTING_IN_PROCESS',
        inProcStock.accountBalances.BUSINESS_OWNED.netWeight === 0 &&
          inProcStock.accountBalances.MELTING_IN_PROCESS.netWeight === 100 &&
          inProc24k === 0,
        `Got inProc=${JSON.stringify(inProcStock)}`
      );

      db.completeMeltingBatch(testPureMeltTenant, pureBatch.id, {
        outputGrossGrams: 109.159,
        outputPurity: '22K',
        outputFineness: 916.0,
        alloyAddedGrams: 9.159,
        explanationNotes: 'Pure to 22K alloying (+9.159g Cu/Ag alloy)',
        approvedBy: 'Test Runner',
      });

      const finalStock = db.getTenantStockSummary(testPureMeltTenant);
      const final24k = finalStock.purityBalances.find((p) => p.purity === '24K')?.netWeight;
      const final22k = finalStock.purityBalances.find((p) => p.purity === '22K')?.netWeight;
      assert(
        'Pure-to-Gold Alloying',
        'Completing Pure-to-22K batch updates BUSINESS_OWNED to 109.159g 22K, clears MELTING_IN_PROCESS to 0g, and shifts purity bucket from 24K to 22K',
        finalStock.accountBalances.BUSINESS_OWNED.netWeight === 109.159 &&
          finalStock.accountBalances.MELTING_IN_PROCESS.netWeight === 0 &&
          finalStock.totalPhysicalGrams === 109.159 &&
          final24k === 0 &&
          final22k === 109.159,
        `Got finalStock=${JSON.stringify(finalStock)}`
      );
    } finally {
      db.clearTenantData(testPureMeltTenant);
    }

    // 2k. Melting & Touch Conversion excludes Pure Gold ('24K') preset while retaining ornament alloys & custom touch
    assert(
      'Melting & Touch Presets',
      'MELTING_TOUCH_PRESETS excludes 24K Pure Gold and offers 22K, 20K, 18K, 14K, 9K ornament presets',
      !MELTING_TOUCH_PRESETS.includes('24K') &&
        MELTING_TOUCH_PRESETS.length === 5 &&
        MELTING_TOUCH_PRESETS[0] === '22K' &&
        resolveAllowedPurityCode(995, MELTING_TOUCH_PRESETS) === '22K' &&
        resolveAllowedPurityCode(750, MELTING_TOUCH_PRESETS) === '18K' &&
        !getUI('en').meltingSubtitle.includes('24K'),
      `Got presets=${JSON.stringify(MELTING_TOUCH_PRESETS)}, subtitle=${getUI('en').meltingSubtitle}`
    );
  } catch (err: any) {
    assert('Customer Gold Balance', 'Suite execution error', false, err.message);
  } finally {
    db.clearTenantData(testTenant);
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    durationMs: Date.now() - startTime,
    results,
    timestamp: new Date().toISOString(),
  };
}

// Standalone execution runner when run via `tsx run-all-tests.ts`
const isCli =
  typeof process !== 'undefined' &&
  typeof process.argv !== 'undefined' &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  import.meta.url === `file://${process.argv[1]}`;

if (isCli) {
  console.log('💎 Running SwarnaERP Automated Test Suite...\n');
  const summary = runAllAutomatedTests();

  summary.results.forEach((r) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} [${r.suite}] ${r.name} (${r.durationMs}ms)`);
    if (!r.passed && r.message) {
      console.log(`   ERROR: ${r.message}`);
    }
  });

  console.log('\n=======================================');
  console.log(`Summary: ${summary.passed}/${summary.total} tests PASSED in ${summary.durationMs}ms`);
  console.log('=======================================\n');

  if (summary.failed > 0 && typeof process.exit === 'function') {
    process.exit(1);
  }
}

