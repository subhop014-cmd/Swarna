import { Router, Request, Response } from 'express';
import { db } from './db';
import { calculateInvoiceItem, calculateMeltingConversion, formatINR } from '../utils/goldMath';
import { runAllAutomatedTests } from '../tests/run-all-tests';
import { GoldPurityCode } from '../types';

export const apiRouter = Router();

// Middleware: Extract tenant context from headers or query (fallback to default tenant_101)
apiRouter.use((req: Request, _res: Response, next) => {
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || 'tenant_101';
  const userId = (req.headers['x-user-id'] as string) || 'user_owner_101';
  (req as any).tenantId = tenantId;
  (req as any).userId = userId;
  next();
});

// Helper: Ensure tenant exists and isolation check
function getTenantId(req: Request): string {
  return (req as any).tenantId;
}

// 1. Current Session & Tenants
apiRouter.get('/auth/me', (req, res) => {
  const tenantId = getTenantId(req);
  const tenant = db.getTenant(tenantId);
  const user = db.users.find((u) => u.activeTenantId === tenantId) || db.users[0];
  const membership = db.memberships.find((m) => m.userId === user.id && m.tenantId === tenantId);
  const branches = db.getTenantBranches(tenantId);
  const notifications = db.getTenantNotifications(tenantId);

  res.json({
    user,
    tenant,
    membership,
    branches,
    notifications,
    allTenants: db.tenants.map((t) => ({ id: t.id, name: t.name, businessType: t.businessType, city: t.city })),
  });
});

apiRouter.post('/auth/switch-tenant', (req, res) => {
  const { tenantId } = req.body;
  const tenant = db.getTenant(tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  res.json({ success: true, tenantId });
});

// 2. Onboard new Business
apiRouter.post('/tenants/onboard', (req, res) => {
  try {
    const result = db.onboardTenant(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Gold Rates
apiRouter.get('/gold-rates', (req, res) => {
  const tenantId = getTenantId(req);
  const rates = db.getTenantGoldRates(tenantId);
  res.json({ rates });
});

const handleUpdateRate = (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const { purity, ratePerGram, ratePerGramINR } = req.body;
  const val = Number(ratePerGram ?? ratePerGramINR);
  if (!purity || isNaN(val)) {
    return res.status(400).json({ error: 'purity and ratePerGram required' });
  }
  const updated = db.updateTenantGoldRate(tenantId, purity as GoldPurityCode, val);
  res.json({ success: true, updated });
};

apiRouter.put('/gold-rates', handleUpdateRate);
apiRouter.post('/gold-rates', handleUpdateRate);

// 4. Gold Inventory Ledger & Stock Summary
apiRouter.get('/inventory/summary', (req, res) => {
  const tenantId = getTenantId(req);
  const summary = db.getTenantStockSummary(tenantId);
  res.json(summary);
});

apiRouter.get('/inventory/ledger', (req, res) => {
  const tenantId = getTenantId(req);
  const branchId = req.query.branchId as string | undefined;
  const entries = db.getTenantGoldLedger(tenantId, branchId);
  res.json({ entries });
});

apiRouter.post('/inventory/transaction', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const entry = db.addGoldLedgerEntry({
      ...req.body,
      tenantId,
    });
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/inventory/movement', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const entry = db.addGoldLedgerEntry({
      ...req.body,
      tenantId,
    });
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/inventory/melting-conversion', (req, res) => {
  const tenantId = getTenantId(req);
  const {
    inputs,
    outputGrossGrams,
    outputFineness,
    outputPurity,
    alloyAddedGrams,
    sourceAccount,
    operatorOrRefiner,
    operatorName,
    notes,
  } = req.body;
  try {
    const result = calculateMeltingConversion(inputs, outputGrossGrams, outputFineness);
    const branch = db.getTenantBranches(tenantId)[0];
    const nowIso = new Date().toISOString();
    const resolvedOperator = operatorOrRefiner || operatorName || 'In-House Furnace';
    const userLabel = (req as any).userId || resolvedOperator;

    const createdBatch = db.createMeltingBatch({
      tenantId,
      branchId: branch ? branch.id : 'main',
      sentDate: nowIso,
      operatorOrRefiner: resolvedOperator,
      refinerType: 'INTERNAL_KARIGAR',
      sourceAccount: sourceAccount || 'BUSINESS_OWNED',
      inputs: (inputs || []).map((inp: any) => ({
        description: inp.description || `${inp.purity || '24K'} Melting Input`,
        weightGrams: Number(inp.weightGrams),
        purity: (inp.purity || '24K') as GoldPurityCode,
        fineness: Number(inp.fineness || 999.9),
        fineGoldWeightGrams: Number(
          ((Number(inp.weightGrams) * Number(inp.fineness || 999.9)) / 1000).toFixed(4)
        ),
      })),
      approvalStatus: 'APPROVED',
      createdBy: userLabel,
    });

    const completedBatch = db.completeMeltingBatch(tenantId, createdBatch.id, {
      outputGrossGrams: Number(outputGrossGrams),
      outputPurity: (outputPurity || '22K') as GoldPurityCode,
      outputFineness: Number(outputFineness),
      alloyAddedGrams: alloyAddedGrams ? Number(alloyAddedGrams) : 0,
      explanationNotes:
        notes ||
        (Number(alloyAddedGrams) > 0
          ? `Pure to ${outputPurity || '22K'} alloying (+${Number(alloyAddedGrams).toFixed(3)}g alloy)`
          : 'Workshop melting & touch conversion'),
      approvedBy: userLabel,
    });

    res.json({ success: true, reconciliation: result, batch: completedBatch });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Karigar Job Cards
apiRouter.get('/job-cards', (req, res) => {
  const tenantId = getTenantId(req);
  const jobs = db.getTenantJobCards(tenantId);
  res.json({ jobCards: jobs });
});

apiRouter.post('/job-cards', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const job = db.createJobCard({
      ...req.body,
      tenantId,
    });
    res.status(201).json(job);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/job-cards/:id/return', (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  const { returnedJewelleryGrossWeight, returnedJewelleryNetWeight, returnedScrapWeightGrams, qcRemarks } = req.body;

  try {
    const reconciled = db.returnAndReconcileJobCard(
      tenantId,
      id,
      Number(returnedJewelleryGrossWeight),
      Number(returnedJewelleryNetWeight),
      Number(returnedScrapWeightGrams),
      qcRemarks
    );
    res.json(reconciled);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Invoices & Billing
apiRouter.get('/invoices', (req, res) => {
  const tenantId = getTenantId(req);
  const invoices = db.getTenantInvoices(tenantId);
  res.json({ invoices });
});

apiRouter.post('/invoices/calculate-item', (req, res) => {
  try {
    const calculated = calculateInvoiceItem(req.body);
    res.json(calculated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/invoices', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const invoice = db.createInvoice({
      ...req.body,
      tenantId,
    });
    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Customers & CRM
apiRouter.get('/customers', (req, res) => {
  const tenantId = getTenantId(req);
  const query = (req.query.q as string || '').toLowerCase().trim();
  let customers = db.getTenantCustomers(tenantId);

  if (query) {
    customers = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.regionalName && c.regionalName.includes(query)) ||
        c.phone.includes(query) ||
        c.accountCode.toLowerCase().includes(query)
    );
  }

  res.json({ customers });
});

apiRouter.post('/customers', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const customer = db.addCustomer({
      ...req.body,
      tenantId,
    });
    res.status(201).json(customer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/customers/:id/gold-deposit', (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  const { grossWeightGrams, nonGoldWeightGrams, purity, fineness, notes } = req.body;
  try {
    const customer = db.recordCustomerGoldDeposit(
      tenantId,
      id,
      Number(grossWeightGrams),
      Number(nonGoldWeightGrams || 0),
      purity as GoldPurityCode,
      (req as any).userId || 'Staff',
      notes,
      fineness ? Number(fineness) : undefined
    );
    res.json({ success: true, ...customer, customer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/customers/:id/deposit-gold', (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  const { grossWeightGrams, nonGoldWeightGrams, purity, fineness, notes } = req.body;
  try {
    const customer = db.recordCustomerGoldDeposit(
      tenantId,
      id,
      Number(grossWeightGrams),
      Number(nonGoldWeightGrams || 0),
      purity as GoldPurityCode,
      (req as any).userId || 'Staff',
      notes,
      fineness ? Number(fineness) : undefined
    );
    res.json({ success: true, customer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/customers/:id/withdraw-gold', (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  const { netWeightGrams, purity, fineness, notes } = req.body;
  try {
    const customer = db.recordCustomerGoldWithdrawal(
      tenantId,
      id,
      Number(netWeightGrams),
      (purity || '22K') as GoldPurityCode,
      (req as any).userId || 'Staff',
      notes,
      fineness ? Number(fineness) : undefined
    );
    res.json({ success: true, customer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Staff & Karigars
apiRouter.get('/staff', (req, res) => {
  const tenantId = getTenantId(req);
  const staff = db.getTenantStaff(tenantId);
  res.json({ staff });
});

apiRouter.post('/staff', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const staffMember = db.addStaff({
      ...req.body,
      tenantId,
    });
    res.status(201).json(staffMember);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/staff/:id/advance', (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  const { amountINR, notes } = req.body;
  try {
    const updated = db.recordKarigarAdvance(tenantId, id, Number(amountINR), notes);
    res.json({ success: true, staff: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Accounts & Cash Book
apiRouter.get('/cashbook', (req, res) => {
  const tenantId = getTenantId(req);
  const transactions = db.getTenantCashBank(tenantId);
  res.json({ transactions });
});

apiRouter.get('/cash-bank/transactions', (req, res) => {
  const tenantId = getTenantId(req);
  const transactions = db.getTenantCashBank(tenantId);
  res.json({ transactions });
});

apiRouter.post('/cashbook', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const tx = db.addCashBankTransaction({
      ...req.body,
      tenantId,
    });
    res.status(201).json(tx);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/cash-bank/transactions', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const tx = db.addCashBankTransaction({
      ...req.body,
      tenantId,
    });
    res.status(201).json(tx);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// POS & Unified Gold Transaction Center Endpoints
// -------------------------------------------------------------

// Outside Parties
apiRouter.get('/pos/parties', (req, res) => {
  const tenantId = getTenantId(req);
  const parties = db.getTenantOutsideParties(tenantId);
  res.json({ parties });
});

apiRouter.post('/pos/parties', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const party = db.addOutsideParty({
      ...req.body,
      tenantId,
    });
    res.status(201).json(party);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/pos/parties/transactions', (req, res) => {
  const tenantId = getTenantId(req);
  const transactions = db.getTenantOutsidePartyTransactions(tenantId);
  res.json({ transactions });
});

apiRouter.post('/pos/parties/transactions', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const tx = db.createOutsidePartyTransaction({
      ...req.body,
      tenantId,
    });
    res.status(201).json(tx);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Melting & Refining Batches
apiRouter.get('/pos/melting/batches', (req, res) => {
  const tenantId = getTenantId(req);
  const batches = db.getTenantMeltingBatches(tenantId);
  res.json({ batches });
});

apiRouter.post('/pos/melting/batches', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const batch = db.createMeltingBatch({
      ...req.body,
      tenantId,
    });
    res.status(201).json(batch);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/melting/batches/:id/complete', (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  try {
    const completed = db.completeMeltingBatch(tenantId, id, req.body);
    res.json(completed);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Branch Transfers
apiRouter.get('/pos/branch-transfers', (req, res) => {
  const tenantId = getTenantId(req);
  const transfers = db.getTenantBranchTransfers(tenantId);
  res.json({ transfers });
});

apiRouter.post('/pos/branch-transfers', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const transfer = db.createBranchTransfer({
      ...req.body,
      tenantId,
    });
    res.status(201).json(transfer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/pos/branch-transfers/:id/receive', (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  const { receivedBy } = req.body;
  try {
    const received = db.receiveBranchTransfer(tenantId, id, receivedBy || 'Branch Staff');
    res.json(received);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POS Drafts
apiRouter.get('/pos/drafts', (req, res) => {
  const tenantId = getTenantId(req);
  const drafts = db.getTenantPOSDrafts(tenantId);
  res.json({ drafts });
});

apiRouter.post('/pos/drafts', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const draft = db.savePOSDraft({
      ...req.body,
      tenantId,
    });
    res.status(201).json(draft);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/pos/drafts/:id', (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  const deleted = db.deletePOSDraft(tenantId, id);
  res.json({ success: deleted });
});

// Stock Reconciliations
apiRouter.get('/pos/reconciliations', (req, res) => {
  const tenantId = getTenantId(req);
  const reconciliations = db.getTenantStockReconciliations(tenantId);
  res.json({ reconciliations });
});

apiRouter.post('/pos/reconciliations', (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const rec = db.addStockReconciliation({
      ...req.body,
      tenantId,
    });
    res.status(201).json(rec);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 10. Audit Logs
apiRouter.get('/audit-logs', (req, res) => {
  const tenantId = getTenantId(req);
  const logs = db.getTenantAuditLogs(tenantId);
  res.json({ logs });
});

// 11. Reports Engine
apiRouter.get('/reports/:type', (req, res) => {
  const tenantId = getTenantId(req);
  const { type } = req.params;

  if (type === 'stock-reconciliation') {
    const summary = db.getTenantStockSummary(tenantId);
    const ledger = db.getTenantGoldLedger(tenantId);
    return res.json({ summary, ledger });
  }

  if (type === 'karigar-balances') {
    const staff = db.getTenantStaff(tenantId).filter((s) => s.role === 'KARIGAR');
    const jobs = db.getTenantJobCards(tenantId);
    return res.json({ karigars: staff, jobs });
  }

  if (type === 'wastage-loss') {
    const jobs = db.getTenantJobCards(tenantId).filter((j) => j.isReconciled);
    const totalIssued = jobs.reduce((sum, j) => sum + j.issuedNetWeightGrams, 0);
    const totalActualLoss = jobs.reduce((sum, j) => sum + j.actualLossGrams, 0);
    const totalAllowedWastage = jobs.reduce((sum, j) => sum + j.allowedWastageGrams, 0);
    const totalExcessLoss = jobs.reduce((sum, j) => sum + j.excessLossGrams, 0);

    return res.json({
      reconciledJobs: jobs,
      metrics: {
        totalJobs: jobs.length,
        totalIssuedGrams: totalIssued,
        totalActualLossGrams: totalActualLoss,
        totalAllowedWastageGrams: totalAllowedWastage,
        totalExcessLossGrams: totalExcessLoss,
        overallWastagePercent: totalIssued > 0 ? (totalActualLoss / totalIssued) * 100 : 0,
      },
    });
  }

  if (type === 'gst-summary') {
    const invoices = db.getTenantInvoices(tenantId);
    const totalTaxable = invoices.reduce((s, i) => s + i.taxableAmountINR, 0);
    const totalCGST = invoices.reduce((s, i) => s + i.cgstINR, 0);
    const totalSGST = invoices.reduce((s, i) => s + i.sgstINR, 0);
    const totalIGST = invoices.reduce((s, i) => s + i.igstINR, 0);
    const totalGST = invoices.reduce((s, i) => s + i.totalGstINR, 0);
    const grandTotal = invoices.reduce((s, i) => s + i.grandTotalINR, 0);

    return res.json({
      invoices,
      taxSummary: {
        totalTaxable,
        totalCGST,
        totalSGST,
        totalIGST,
        totalGST,
        grandTotal,
        hsnCode: '7113',
      },
    });
  }

  res.status(404).json({ error: 'Unknown report type' });
});

// 12. Subscriptions
apiRouter.get('/subscriptions', (req, res) => {
  const tenantId = getTenantId(req);
  const tenant = db.getTenant(tenantId);
  res.json({
    plans: db.subscriptionPlans,
    currentPlanId: tenant?.subscriptionPlanId,
    status: tenant?.subscriptionStatus,
  });
});

apiRouter.post('/subscriptions/upgrade', (req, res) => {
  const tenantId = getTenantId(req);
  const { planId } = req.body;
  const tenant = db.getTenant(tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  tenant.subscriptionPlanId = planId;
  tenant.subscriptionStatus = 'ACTIVE';
  res.json({ success: true, tenant });
});

// 13. Platform Admin Summary (SaaS Provider View)
apiRouter.get('/platform/admin/stats', (_req, res) => {
  res.json({
    totalTenants: db.tenants.length,
    activeSubscriptions: db.tenants.filter((t) => t.subscriptionStatus === 'ACTIVE').length,
    trialSubscriptions: db.tenants.filter((t) => t.subscriptionStatus === 'TRIAL').length,
    totalUsers: db.users.length,
    totalGoldTransactions: db.goldLedger.length,
    totalJobCards: db.jobCards.length,
    totalInvoices: db.invoices.length,
    tenants: db.tenants,
  });
});

// 14. Clear Operational Data (Reset Workspace)
apiRouter.post('/data/clear', (req, res) => {
  const scope = req.body?.scope === 'ALL' ? 'ALL' : getTenantId(req);
  db.clearTenantData(scope);
  res.json({ success: true, clearedScope: scope });
});

// 15. Automated Tests Runner
apiRouter.post('/tests/run', (_req, res) => {
  const results = runAllAutomatedTests();
  res.json(results);
});
