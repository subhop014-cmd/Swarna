/**
 * Domain types for SwarnaERP - Multilingual Goldsmith & Jewellery ERP SaaS
 */

export type IndianLanguage =
  | 'en' // English
  | 'hi' // Hindi (हिन्दी)
  | 'ta' // Tamil (தமிழ்)
  | 'te' // Telugu (తెలుగు)
  | 'kn' // Kannada (ಕನ್ನಡ)
  | 'ml' // Malayalam (മലയാളം)
  | 'mr' // Marathi (मराठी)
  | 'bn' // Bengali (বাংলা)
  | 'gu' // Gujarati (ગુજરાતી)
  | 'pa'; // Punjabi (ਪੰਜਾਬੀ)

export type UserRole =
  | 'OWNER'
  | 'MANAGER'
  | 'ACCOUNTANT'
  | 'INVENTORY_MANAGER'
  | 'PRODUCTION_MANAGER'
  | 'SALESPERSON'
  | 'KARIGAR'
  | 'PLATFORM_ADMIN';

export type GoldPurityCode = '24K' | '22K' | '20K' | '18K' | '14K' | '9K';

export interface PurityStandard {
  code: GoldPurityCode;
  name: string;
  fineness: number; // e.g. 999.9, 916.0, 833.0, 750.0, 585.0, 375.0
  hallmarkSymbol: string;
  description: string;
}

export type GoldAccountType =
  | 'BUSINESS_OWNED' // Bullion / Stock owned by the business (Main Vault)
  | 'CUSTOMER_OWNED' // Gold deposited by customer for remaking or safe-keeping
  | 'KARIGAR_HELD' // Gold currently issued to and held by karigars for job-work
  | 'OUTSIDE_PARTY' // Gold issued to outside refiners, hallmarkers, external artisans
  | 'MELTING_IN_PROCESS' // Gold currently in melting furnace or assay
  | 'BRANCH_IN_TRANSIT' // Gold in transfer between company branches
  | 'SCRAP_REFINING' // Recoverable scrap, filings, polishing dust
  | 'FINISHED_GOODS'; // Ready jewellery in showroom / stock

export type GoldLedgerTransactionType =
  | 'OPENING_BALANCE'
  | 'BULLION_PURCHASE'
  | 'GOLD_SALE'
  | 'CUSTOMER_OLD_GOLD'
  | 'CUSTOMER_DEPOSIT'
  | 'CUSTOMER_WITHDRAWAL'
  | 'ISSUE_TO_KARIGAR'
  | 'RETURN_FROM_KARIGAR'
  | 'ISSUE_TO_PARTY'
  | 'RETURN_FROM_PARTY'
  | 'SEND_TO_MELTING'
  | 'RECEIVE_FROM_MELTING'
  | 'FINISHED_JEWELLERY_RECEIPT'
  | 'MELTING_CONVERSION'
  | 'SALE_DELIVERY'
  | 'SCRAP_RECOVERY'
  | 'BRANCH_TRANSFER'
  | 'SUPPLIER_SETTLEMENT'
  | 'PHYSICAL_STOCK_ADJUSTMENT'
  | 'MISC_TRANSACTION';

export interface GoldRate {
  purity: GoldPurityCode;
  fineness: number;
  ratePerGram: number; // In INR
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  legalName: string;
  businessType: 'RETAILER' | 'MANUFACTURER' | 'WHOLESALER' | 'KARIGAR_WORKSHOP' | 'BULLION_TRADER';
  gstin?: string;
  pan?: string;
  hallmarkLicenseNo?: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  phone: string;
  email: string;
  defaultLanguage: IndianLanguage;
  timezone: string;
  currency: string;
  subscriptionPlanId: string;
  subscriptionStatus: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';
  trialEndsAt?: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address: string;
  city: string;
  isMainBranch: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  preferredLanguage: IndianLanguage;
  activeTenantId: string;
  isPlatformAdmin?: boolean;
}

export interface Membership {
  id: string;
  userId: string;
  tenantId: string;
  role: UserRole;
  branchId?: string;
  joinedAt: string;
}

export interface GoldLedgerEntry {
  id: string;
  tenantId: string;
  branchId: string;
  transactionNo: string;
  date: string;
  type: GoldLedgerTransactionType;
  sourceAccount: GoldAccountType;
  destinationAccount: GoldAccountType;
  counterpartyId?: string;
  counterpartyName?: string;
  counterpartyType?: 'CUSTOMER' | 'KARIGAR' | 'SUPPLIER' | 'INTERNAL';
  jobCardId?: string;
  invoiceId?: string;
  grossWeightGrams: number;
  nonGoldWeightGrams: number;
  netWeightGrams: number;
  purity: GoldPurityCode;
  fineness: number; // e.g., 916
  fineGoldWeightGrams: number; // Net weight * fineness / 1000
  ratePerGram?: number;
  valuationINR?: number;
  enteredBy: string;
  approvedBy?: string;
  notes?: string;
}

export type JobCardStatus =
  | 'DRAFT'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'QUALITY_CHECK'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface JobCard {
  id: string;
  tenantId: string;
  branchId: string;
  jobNo: string;
  orderRef?: string;
  customerId?: string;
  customerName?: string;
  karigarId: string;
  karigarName: string;
  jewelleryType: string; // e.g. "Kada", "Necklace", "Earrings", "Chain", "Ring"
  designCode?: string;
  designImageUrl?: string;
  purity: GoldPurityCode;
  fineness: number;
  
  // Gold Issued
  issuedGrossWeightGrams: number;
  issuedNetWeightGrams: number;
  issuedFineGoldWeightGrams: number;
  issueDate: string;
  dueDate: string;
  submittedDate?: string;
  
  // Work terms
  agreedWastagePercent: number; // e.g. 2.5%
  labourRatePerGram: number; // In INR
  fixedLabourCharge?: number;
  
  // Gold Returned / Reconciled
  returnedJewelleryGrossWeight: number;
  returnedJewelleryNetWeight: number;
  returnedScrapWeightGrams: number;
  
  // Mathematical reconciliation
  actualLossGrams: number; // Issued Net - (Returned Jewellery Net + Returned Scrap)
  allowedWastageGrams: number; // (Issued Net * agreedWastagePercent) / 100
  excessLossGrams: number; // actualLoss - allowedWastage (if positive, excess loss)
  isReconciled: boolean;
  
  labourTotalINR: number;
  labourPaidINR: number;
  status: JobCardStatus;
  qcPassed: boolean;
  qcRemarks?: string;
  notes?: string;
  createdAt: string;
}

export type InvoiceType =
  | 'RETAIL_TAX_INVOICE'
  | 'ESTIMATE'
  | 'WHOLESALE_INVOICE'
  | 'JOB_WORK_BILL'
  | 'PURCHASE_VOUCHER'
  | 'CREDIT_NOTE';

export interface InvoiceItem {
  id: string;
  description: string;
  hsnCode: string; // Default 7113 for Jewellery
  grossWeightGrams: number;
  stoneWeightGrams: number;
  netGoldWeightGrams: number;
  purity: GoldPurityCode;
  fineness: number;
  fineGoldWeightGrams: number;
  goldRatePerGram: number;
  goldValueINR: number;
  wastagePercent: number;
  wastageWeightGrams?: number;
  wastageValueINR: number;
  makingChargeType: 'PER_GRAM' | 'PERCENTAGE' | 'FIXED';
  makingChargeRate: number;
  makingChargesINR: number;
  stoneChargesINR: number;
  otherChargesINR: number;
  taxableAmountINR: number;
  gstRatePercent: number; // 3% for jewellery (1.5% CGST + 1.5% SGST or 3% IGST), 5% for job work
  gstAmountINR: number;
  lineTotalINR: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  branchId: string;
  invoiceNo: string;
  type: InvoiceType;
  date: string;
  dueDate?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  isInterstate: boolean;
  items: InvoiceItem[];
  totalGrossWeightGrams: number;
  totalNetGoldWeightGrams: number;
  totalFineGoldWeightGrams: number;
  taxableAmountINR: number;
  cgstINR: number;
  sgstINR: number;
  igstINR: number;
  totalGstINR: number;
  roundOffINR: number;
  grandTotalINR: number;
  paidAmountINR: number;
  balanceAmountINR: number;
  paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OLD_GOLD_EXCHANGE' | 'CREDIT' | 'SPLIT';
  cashPaymentChannel?: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  goldExchangeGrams?: number;
  goldExchangePurity?: GoldPurityCode;
  goldExchangeFineness?: number;
  goldExchangeRatePerGram?: number;
  goldExchangeValueINR?: number;
  goldUsedFromDepositGrams?: number;
  goldBalanceDueGrams?: number;
  goldExcessCreditGrams?: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  hallmarkingDetails?: {
    centerName: string;
    bisNumber: string;
    huidCode: string;
  };
  termsAndConditions?: string;
  createdBy: string;
  status: 'FINAL' | 'CANCELLED';
  creditNoteRefId?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  accountCode: string;
  name: string;
  regionalName?: string; // e.g. in Hindi/Tamil/Bengali
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  pan?: string;
  preferredLanguage: IndianLanguage;
  customerGoldBalanceGrams: number; // Gold deposited with goldsmith
  monetaryBalanceINR: number; // Receivables or advances
  creditLimitINR: number;
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  gstin?: string;
  city?: string;
  goldPayableGrams: number;
  monetaryPayableINR: number;
  createdAt: string;
}

export interface Staff {
  id: string;
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  regionalName?: string;
  phone: string;
  role: UserRole;
  skillCategory?: 'FILIGREE' | 'STONE_SETTING' | 'DIE_STAMPING' | 'POLISHING' | 'CASTING' | 'GENERAL_GOLDSMITH';
  currentGoldHoldingGrams: number;
  activeJobsCount: number;
  completedJobsCount: number;
  unreconciledLossGrams: number;
  advanceBalanceINR: number;
  monthlySalaryINR?: number;
  pieceRateMultiplier?: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  joinedDate: string;
}

export interface CashBankTransaction {
  id: string;
  tenantId: string;
  branchId: string;
  date: string;
  type: 'RECEIPT' | 'PAYMENT' | 'CONTRA';
  accountType: 'CASH' | 'BANK';
  bankName?: string;
  referenceNo?: string;
  partyType?: 'CUSTOMER' | 'KARIGAR' | 'SUPPLIER' | 'EXPENSE' | 'INTERNAL';
  partyName?: string;
  category: 'SALES_COLLECTION' | 'KARIGAR_LABOUR' | 'STAFF_ADVANCE' | 'EXPENSE' | 'GOLD_PURCHASE' | 'CUSTOMER_REFUND';
  amountINR: number;
  notes?: string;
  enteredBy: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: 'FREE_TRIAL' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE_MULTI_BRANCH';
  priceINRMonth: number;
  priceINRYar: number;
  maxUsers: number;
  maxBranches: number;
  maxMonthlyTransactions: number;
  features: string[];
}

export interface AuditLog {
  id: string;
  tenantId: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
}

export interface NotificationItem {
  id: string;
  tenantId: string;
  type: 'OVERDUE_JOB' | 'HIGH_WASTAGE' | 'LOW_STOCK' | 'PAYMENT_DUE' | 'SUBSCRIPTION';
  titleKey: string;
  message: string;
  date: string;
  isRead: boolean;
  link?: string;
}

// -------------------------------------------------------------
// POS & Unified Gold Transaction Center Types
// -------------------------------------------------------------

export interface OutsideParty {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  partyType: 'REFINER' | 'HALLMARK_CENTER' | 'OUTSIDE_KARIGAR' | 'DEALER' | 'CUSTOMER_PARTNER' | 'SUPPLIER';
  contactPerson?: string;
  phone: string;
  city: string;
  gstin?: string;
  currentGoldHoldingGrams: number; // Business-owned gold in custody of outside party
  notes?: string;
  createdAt: string;
}

export interface OutsidePartyTransaction {
  id: string;
  tenantId: string;
  branchId: string;
  challanNo: string;
  date: string;
  partyId: string;
  partyName: string;
  partyType: string;
  direction: 'ISSUE' | 'RECEIPT';
  purpose: 'JOB_WORK' | 'HALLMARKING' | 'MELTING_ASSAY' | 'TEMPORARY_APPROVAL' | 'RETURN';
  purity: GoldPurityCode;
  fineness: number;
  grossWeightGrams: number;
  nonGoldWeightGrams?: number;
  netWeightGrams: number;
  fineGoldWeightGrams: number;
  expectedReturnDate?: string;
  relatedChallanNo?: string;
  scrapWeightGrams?: number;
  lossGrams?: number;
  acknowledgementReceived: boolean;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface MeltingBatch {
  id: string;
  tenantId: string;
  branchId: string;
  batchNo: string;
  status: 'IN_PROCESS' | 'COMPLETED' | 'CANCELLED';
  sentDate: string;
  completedDate?: string;
  operatorOrRefiner: string;
  refinerType: 'INTERNAL_KARIGAR' | 'OUTSIDE_REFINER' | 'ASSAY_LAB';
  sourceAccount: GoldAccountType;
  inputs: Array<{
    description: string;
    weightGrams: number;
    purity: GoldPurityCode;
    fineness: number;
    fineGoldWeightGrams: number;
  }>;
  totalInputGrossGrams: number;
  totalInputFineGoldGrams: number;
  expectedReturnDate?: string;
  outputGrossGrams?: number;
  outputPurity?: GoldPurityCode;
  outputFineness?: number;
  outputFineGoldGrams?: number;
  alloyAddedGrams?: number;
  recoveredScrapGrams?: number;
  refiningChargesINR?: number;
  weightLossGrams?: number;
  fineGoldLossOrGainGrams?: number;
  explanationNotes?: string;
  approvalStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
  approvedBy?: string;
  createdBy: string;
}

export interface BranchTransfer {
  id: string;
  tenantId: string;
  transferNo: string;
  date: string;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  purity: GoldPurityCode;
  fineness: number;
  grossWeightGrams: number;
  netWeightGrams: number;
  fineGoldWeightGrams: number;
  carrierName: string;
  status: 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  sentBy: string;
  receivedBy?: string;
  receivedDate?: string;
  notes?: string;
  createdAt: string;
}

export interface POSBillDraft {
  id: string;
  tenantId: string;
  draftNo: string;
  savedAt: string;
  customerName: string;
  itemsCount: number;
  totalINR: number;
  items: InvoiceItem[];
  paymentMethod: string;
  notes?: string;
}

export interface StockReconciliationRecord {
  id: string;
  tenantId: string;
  date: string;
  account: GoldAccountType;
  purity: GoldPurityCode;
  bookWeightGrams: number;
  physicalWeightGrams: number;
  differenceGrams: number; // physical - book
  status: 'BALANCED' | 'VARIANCE_DETECTED' | 'ADJUSTED';
  reason?: string;
  verifiedBy: string;
  approvedBy?: string;
  createdAt: string;
}

export interface UnifiedDashboardMetrics {
  totalPhysicalGrams: number;
  totalFineGoldGrams: number;
  mainVaultGrams: number; // BUSINESS_OWNED
  karigarHeldGrams: number; // KARIGAR_HELD
  partyHeldGrams: number; // OUTSIDE_PARTY
  meltingInProcessGrams: number; // MELTING_IN_PROCESS
  workInProgressGrams: number; // Unfinished job cards
  finishedJewelleryGrams: number; // FINISHED_GOODS
  recoverableScrapGrams: number; // SCRAP_REFINING
  unreconciledLossGrams: number;
  todaySalesINR: number;
  todayCollectionsINR: number;
  pendingApprovalsCount: number;
  overdueTransactionsCount: number;
  purityBreakdown: Array<{
    purity: GoldPurityCode;
    fineness: number;
    netWeightGrams: number;
    fineGoldWeightGrams: number;
  }>;
}

