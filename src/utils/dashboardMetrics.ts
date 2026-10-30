import Decimal from 'decimal.js';
import { Customer, IndianLanguage, Invoice } from '../types';
import { calculateFineGold, PURITY_STANDARDS } from './goldMath';

export interface CustomerGoldDashboardSummary {
  goldWithCustomersDueGrams: number;
  dueCustomersCount: number;
  customerCustodyGrams: number;
  custodyCustomersCount: number;
  netCustomerPositionGrams: number; // positive = net custody held, negative = net due from customers
  dueCustomers: Customer[];
  custodyCustomers: Customer[];
  activeGoldCustomers: Customer[];
}

export interface WastageBillRow {
  invoiceId: string;
  invoiceNo: string;
  date: string;
  createdAt?: string;
  customerName: string;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  primaryPurity: string;
  itemSummary: string;
  netGoldGrams: number;
  wastageGrams: number;
  wastageFineGrams: number;
  wastagePct: number;
  wastageValueINR: number;
}

export interface WastagePeriodStats {
  wastageGrams: number;
  wastageFineGrams: number;
  wastageValueINR: number;
  netGoldSoldGrams: number;
  avgWastagePct: number;
  totalBillCount: number;
  wastageBillCount: number;
  rows: WastageBillRow[];
}

export interface WastageDashboardSummary {
  todayDateStr: string;
  today: WastagePeriodStats;
  allTime: WastagePeriodStats;
}

export function getLocalTodayDateStr(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isInvoiceOnLocalDate(
  inv: Pick<Invoice, 'date' | 'createdAt'>,
  targetDateStr: string
): boolean {
  const rawDate = (inv.date || '').trim();
  if (rawDate) {
    if (rawDate.length === 10) {
      if (rawDate === targetDateStr) return true;
      // Handle invoices where `date` was auto-filled via UTC `toISOString().split('T')[0]`
      if (inv.createdAt && inv.createdAt.startsWith(rawDate)) {
        const parsedCreated = new Date(inv.createdAt);
        if (!Number.isNaN(parsedCreated.getTime())) {
          return getLocalTodayDateStr(parsedCreated) === targetDateStr;
        }
      }
      return false;
    }
    const parsedDate = new Date(rawDate);
    if (!Number.isNaN(parsedDate.getTime())) {
      return getLocalTodayDateStr(parsedDate) === targetDateStr;
    }
    return rawDate.startsWith(targetDateStr);
  }

  if (inv.createdAt) {
    const parsedCreated = new Date(inv.createdAt);
    if (!Number.isNaN(parsedCreated.getTime())) {
      return getLocalTodayDateStr(parsedCreated) === targetDateStr;
    }
    return inv.createdAt.startsWith(targetDateStr);
  }

  return false;
}

export function computeCustomerGoldSummary(
  customers: Customer[] = [],
  stockSummary?: any
): CustomerGoldDashboardSummary {
  let dueSum = new Decimal(0);
  let custodySum = new Decimal(0);
  const dueCustomers: Customer[] = [];
  const custodyCustomers: Customer[] = [];

  for (const c of customers) {
    const bal = Number(c.customerGoldBalanceGrams || 0);
    if (bal < -0.0004) {
      dueSum = dueSum.plus(Math.abs(bal));
      dueCustomers.push(c);
    } else if (bal > 0.0004) {
      custodySum = custodySum.plus(bal);
      custodyCustomers.push(c);
    }
  }

  dueCustomers.sort(
    (a, b) => Math.abs(b.customerGoldBalanceGrams || 0) - Math.abs(a.customerGoldBalanceGrams || 0)
  );
  custodyCustomers.sort(
    (a, b) => (b.customerGoldBalanceGrams || 0) - (a.customerGoldBalanceGrams || 0)
  );

  const goldWithCustomersDueGrams = dueSum.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const customerListCustodyGrams = custodySum.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const ledgerCustodyGrams = Number(
    Number(stockSummary?.accountBalances?.CUSTOMER_OWNED?.netWeight || 0).toFixed(3)
  );

  const customerCustodyGrams =
    customerListCustodyGrams > 0
      ? customerListCustodyGrams
      : Math.max(0, ledgerCustodyGrams);

  const netCustomerPositionGrams = new Decimal(customerCustodyGrams)
    .minus(goldWithCustomersDueGrams)
    .toDecimalPlaces(3, Decimal.ROUND_HALF_UP)
    .toNumber();

  return {
    goldWithCustomersDueGrams,
    dueCustomersCount: dueCustomers.length,
    customerCustodyGrams,
    custodyCustomersCount: custodyCustomers.length,
    netCustomerPositionGrams,
    dueCustomers,
    custodyCustomers,
    activeGoldCustomers: [...dueCustomers, ...custodyCustomers],
  };
}

function buildWastageRow(inv: Invoice): WastageBillRow {
  let netGold = new Decimal(0);
  let wastageWt = new Decimal(0);
  let wastageFine = new Decimal(0);
  let wastageINR = new Decimal(0);

  const items = Array.isArray(inv.items) ? inv.items : [];
  for (const item of items) {
    const itemNet = new Decimal(item.netGoldWeightGrams || 0);
    const itemWastage =
      item.wastageWeightGrams !== undefined
        ? new Decimal(item.wastageWeightGrams || 0)
        : itemNet.mul(item.wastagePercent || 0).div(100);

    const fineness =
      Number(item.fineness) || PURITY_STANDARDS[item.purity]?.fineness || 916.0;
    const itemFine = calculateFineGold(itemWastage.toNumber(), fineness);

    const itemINR =
      Number(item.wastageValueINR || 0) > 0
        ? new Decimal(item.wastageValueINR || 0)
        : itemWastage.mul(item.goldRatePerGram || 0);

    netGold = netGold.plus(itemNet);
    wastageWt = wastageWt.plus(itemWastage);
    wastageFine = wastageFine.plus(itemFine);
    wastageINR = wastageINR.plus(itemINR);
  }

  const netGoldGrams = netGold.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const wastageGrams = wastageWt.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const wastageFineGrams = wastageFine.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const wastageValueINR = wastageINR.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  const wastagePct =
    netGoldGrams > 0
      ? new Decimal(wastageGrams)
          .div(netGoldGrams)
          .mul(100)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber()
      : 0;

  const firstItem = items[0];
  const primaryPurity = firstItem?.purity || '22K';
  const itemSummary =
    items.length === 0
      ? 'Sales Bill'
      : items.length === 1
      ? `${firstItem.description || 'Ornament'} · ${firstItem.purity}`
      : `${firstItem.description || 'Ornament'} +${items.length - 1} · ${firstItem.purity}`;

  return {
    invoiceId: inv.id,
    invoiceNo: inv.invoiceNo,
    date: (inv.date || inv.createdAt || '').slice(0, 10),
    createdAt: inv.createdAt,
    customerName: inv.customerName || 'Walk-in Customer',
    paymentStatus: inv.paymentStatus || 'PAID',
    primaryPurity,
    itemSummary,
    netGoldGrams,
    wastageGrams,
    wastageFineGrams,
    wastagePct,
    wastageValueINR,
  };
}

function summarizeWastageRows(rows: WastageBillRow[]): WastagePeriodStats {
  let totalWastage = new Decimal(0);
  let totalFine = new Decimal(0);
  let totalINR = new Decimal(0);
  let totalNetGold = new Decimal(0);
  let wastageBillCount = 0;

  for (const r of rows) {
    totalWastage = totalWastage.plus(r.wastageGrams);
    totalFine = totalFine.plus(r.wastageFineGrams);
    totalINR = totalINR.plus(r.wastageValueINR);
    totalNetGold = totalNetGold.plus(r.netGoldGrams);
    if (r.wastageGrams > 0) {
      wastageBillCount += 1;
    }
  }

  const wastageGrams = totalWastage.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const wastageFineGrams = totalFine.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const wastageValueINR = totalINR.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  const netGoldSoldGrams = totalNetGold.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
  const avgWastagePct =
    netGoldSoldGrams > 0
      ? totalWastage
          .div(totalNetGold)
          .mul(100)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber()
      : 0;

  return {
    wastageGrams,
    wastageFineGrams,
    wastageValueINR,
    netGoldSoldGrams,
    avgWastagePct,
    totalBillCount: rows.length,
    wastageBillCount,
    rows,
  };
}

export function computeWastageSummary(
  invoices: Invoice[] = [],
  todayDateStr: string = getLocalTodayDateStr()
): WastageDashboardSummary {
  const validInvoices = (invoices || [])
    .filter((inv) => inv && inv.status !== 'CANCELLED')
    .slice()
    .sort((a, b) => {
      const aTime = a.createdAt || a.date || '';
      const bTime = b.createdAt || b.date || '';
      return bTime.localeCompare(aTime);
    });

  const allRows = validInvoices.map(buildWastageRow);
  const todayRows = validInvoices
    .filter((inv) => isInvoiceOnLocalDate(inv, todayDateStr))
    .map(buildWastageRow);

  return {
    todayDateStr,
    today: summarizeWastageRows(todayRows),
    allTime: summarizeWastageRows(allRows),
  };
}

export interface DashboardExtraStrings {
  goldWithCustomers: string;
  dueFromCustomers: string;
  customerCustody: string;
  dueShort: string;
  custodyShort: string;
  wastageCollectedToday: string;
  wastageReport: string;
  todayTab: string;
  allBillsTab: string;
  wastageWt: string;
  fineEqv24k: string;
  avgWastage: string;
  wastageInr: string;
  billsShort: string;
  dueFromCustomerStatus: string;
  custodyHeldStatus: string;
  noWastageToday: string;
  noWastageAll: string;
  createSalesBill: string;
  noCustomerGoldBalances: string;
  openCustomers: string;
  accountsShort: string;
}

const EN_EXTRA: DashboardExtraStrings = {
  goldWithCustomers: 'Gold With Customers',
  dueFromCustomers: 'With Customers (Due)',
  customerCustody: 'Customer Custody',
  dueShort: 'due',
  custodyShort: 'Custody',
  wastageCollectedToday: 'Wastage Collected Today',
  wastageReport: 'Wastage Report',
  todayTab: 'Today',
  allBillsTab: 'All Bills',
  wastageWt: 'Wastage Wt',
  fineEqv24k: '24K Fine Eqv',
  avgWastage: 'Avg Wastage',
  wastageInr: 'Wastage ₹',
  billsShort: 'bills',
  dueFromCustomerStatus: 'With Customer (Due)',
  custodyHeldStatus: 'Custody Held',
  noWastageToday: 'No sales wastage recorded today.',
  noWastageAll: 'No sales wastage bills recorded yet.',
  createSalesBill: 'New Sales Bill',
  noCustomerGoldBalances: 'No pending customer gold balances.',
  openCustomers: 'Open Customers',
  accountsShort: 'accounts',
};

export const DASHBOARD_EXTRA_UI: Record<IndianLanguage, DashboardExtraStrings> = {
  en: EN_EXTRA,
  hi: {
    goldWithCustomers: 'ग्राहकों के पास सोना',
    dueFromCustomers: 'ग्राहकों पर बाकी सोना',
    customerCustody: 'ग्राहक अमानत सोना',
    dueShort: 'बाकी',
    custodyShort: 'अमानत',
    wastageCollectedToday: 'आज प्राप्त वेस्टेज (Wastage)',
    wastageReport: 'वेस्टेज रिपोर्ट',
    todayTab: 'आज',
    allBillsTab: 'सभी बिल',
    wastageWt: 'वेस्टेज वज़न',
    fineEqv24k: '24K शुद्ध सोना',
    avgWastage: 'औसत वेस्टेज',
    wastageInr: 'वेस्टेज मूल्य',
    billsShort: 'बिल',
    dueFromCustomerStatus: 'ग्राहक पर बाकी',
    custodyHeldStatus: 'अमानत जमा',
    noWastageToday: 'आज कोई वेस्टेज बिल दर्ज नहीं हुआ है।',
    noWastageAll: 'अभी तक कोई वेस्टेज बिल दर्ज नहीं हुआ है।',
    createSalesBill: 'नया बिल बनाएं',
    noCustomerGoldBalances: 'ग्राहकों का कोई सोना बाकी या जमा नहीं है।',
    openCustomers: 'ग्राहक खाता खोलें',
    accountsShort: 'खाते',
  },
  ta: {
    goldWithCustomers: 'வாடிக்கையாளர் தங்க பாக்கி',
    dueFromCustomers: 'வரவேண்டிய தங்கம் (Due)',
    customerCustody: 'வாடிக்கையாளர் வைப்பு',
    dueShort: 'பாக்கி',
    custodyShort: 'வைப்பு',
    wastageCollectedToday: 'இன்று வசூலித்த சேதாரம்',
    wastageReport: 'சேதார அறிக்கை',
    todayTab: 'இன்று',
    allBillsTab: 'அனைத்தும்',
    wastageWt: 'சேதார எடை',
    fineEqv24k: '24K சுத்த தங்கம்',
    avgWastage: 'சராசரி %',
    wastageInr: 'சேதார மதிப்பு',
    billsShort: 'பில்கள்',
    dueFromCustomerStatus: 'தங்க பாக்கி',
    custodyHeldStatus: 'வைப்பு தங்கம்',
    noWastageToday: 'இன்று சேதார பில்கள் எதுவும் இல்லை.',
    noWastageAll: 'சேதார பில்கள் எதுவும் இல்லை.',
    createSalesBill: 'புதிய பில்',
    noCustomerGoldBalances: 'வாடிக்கையாளர் தங்க இருப்பு எதுவும் இல்லை.',
    openCustomers: 'வாடிக்கையாளர்கள்',
    accountsShort: 'கணக்குகள்',
  },
  te: {
    goldWithCustomers: 'కస్టమర్ల వద్ద బంగారం',
    dueFromCustomers: 'రావలసిన బంగారం (Due)',
    customerCustody: 'కస్టమర్ డిపాజిట్',
    dueShort: 'బాకీ',
    custodyShort: 'డిపాజిట్',
    wastageCollectedToday: 'ఈరోజు తరుగు (Wastage)',
    wastageReport: 'తరుగు నివేదిక',
    todayTab: 'ఈరోజు',
    allBillsTab: 'అన్ని బిల్లులు',
    wastageWt: 'తరుగు బరువు',
    fineEqv24k: '24K స్వచ్ఛమైన',
    avgWastage: 'సగటు తరుగు',
    wastageInr: 'తరుగు విలువ',
    billsShort: 'బిల్లులు',
    dueFromCustomerStatus: 'కస్టమర్ బాకీ',
    custodyHeldStatus: 'డిపాజిట్ నిల్వ',
    noWastageToday: 'ఈరోజు తరుగు బిల్లులు నమోదు కాలేదు.',
    noWastageAll: 'తరుగు బిల్లులు ఇంకా నమోదు కాలేదు.',
    createSalesBill: 'కొత్త బిల్లు',
    noCustomerGoldBalances: 'కస్టమర్ బంగారం నిల్వలు లేవు.',
    openCustomers: 'కస్టమర్ ఖాతాలు',
    accountsShort: 'ఖాతాలు',
  },
  kn: {
    goldWithCustomers: 'ಗ್ರಾಹಕರಲ್ಲಿರುವ ಚಿನ್ನ',
    dueFromCustomers: 'ಬಾಕಿ ಚಿನ್ನ (Due)',
    customerCustody: 'ಗ್ರಾಹಕರ ಠೇವಣಿ',
    dueShort: 'ಬಾಕಿ',
    custodyShort: 'ಠೇವಣಿ',
    wastageCollectedToday: 'ಇಂದಿನ ವೇಸ್ಟೇಜ್ ಸಂಗ್ರಹ',
    wastageReport: 'ವೇಸ್ಟೇಜ್ ವರದಿ',
    todayTab: 'ಇಂದು',
    allBillsTab: 'ಎಲ್ಲಾ ಬಿಲ್‌ಗಳು',
    wastageWt: 'ವೇಸ್ಟೇಜ್ ತೂಕ',
    fineEqv24k: '24K ಶುದ್ಧ ಚಿನ್ನ',
    avgWastage: 'ಸರಾಸರಿ %',
    wastageInr: 'ವೇಸ್ಟೇಜ್ ಮೌಲ್ಯ',
    billsShort: 'ಬಿಲ್‌ಗಳು',
    dueFromCustomerStatus: 'ಗ್ರಾಹಕರ ಬಾಕಿ',
    custodyHeldStatus: 'ಠೇವಣಿ ಚಿನ್ನ',
    noWastageToday: 'ಇಂದು ಯಾವುದೇ ವೇಸ್ಟೇಜ್ ಬಿಲ್ ದಾಖಲಾಗಿಲ್ಲ.',
    noWastageAll: 'ಯಾವುದೇ ವೇಸ್ಟೇಜ್ ಬಿಲ್ ದಾಖಲಾಗಿಲ್ಲ.',
    createSalesBill: 'ಹೊಸ ಬಿಲ್',
    noCustomerGoldBalances: 'ಗ್ರಾಹಕರ ಚಿನ್ನದ ಬಾಕಿ ಇಲ್ಲ.',
    openCustomers: 'ಗ್ರಾಹಕರ ಖಾತೆ',
    accountsShort: 'ಖಾತೆಗಳು',
  },
  ml: {
    goldWithCustomers: 'ഉപഭോക്താക്കളുടെ പക്കലുള്ള സ്വർണ്ണം',
    dueFromCustomers: 'ലഭിക്കാനുള്ള സ്വർണ്ണം',
    customerCustody: 'കസ്റ്റമർ നിക്ഷേപം',
    dueShort: 'ബാക്കി',
    custodyShort: 'നിക്ഷേപം',
    wastageCollectedToday: 'ഇന്നത്തെ പണിക്കുറവ് (Wastage)',
    wastageReport: 'പണിക്കുറവ് റിപ്പോർട്ട്',
    todayTab: 'ഇന്ന്',
    allBillsTab: 'എല്ലാ ബില്ലുകളും',
    wastageWt: 'പണിക്കുറവ് തൂക്കം',
    fineEqv24k: '24K തനി സ്വർണ്ണം',
    avgWastage: 'ശരാശരി %',
    wastageInr: 'പണിക്കുറവ് തുക',
    billsShort: 'ബില്ലുകൾ',
    dueFromCustomerStatus: 'ലഭിക്കാനുള്ളത്',
    custodyHeldStatus: 'നിക്ഷേപം',
    noWastageToday: 'ഇന്ന് പണിക്കുറവ് ബില്ലുകൾ രേഖപ്പെടുത്തിയിട്ടില്ല.',
    noWastageAll: 'പണിക്കുറവ് ബില്ലുകൾ ലഭ്യമല്ല.',
    createSalesBill: 'പുതിയ ബിൽ',
    noCustomerGoldBalances: 'ഉപഭോക്തൃ സ്വർണ്ണ ബാക്കി ഇല്ല.',
    openCustomers: 'ഉപഭോക്താക്കൾ',
    accountsShort: 'അക്കൗണ്ടുകൾ',
  },
  mr: {
    goldWithCustomers: 'ग्राहकांकडील सोने',
    dueFromCustomers: 'ग्राहकांकडे येणे सोने',
    customerCustody: 'ग्राहक ठेव सोने',
    dueShort: 'बाकी',
    custodyShort: 'ठेव',
    wastageCollectedToday: 'आज जमा घट / वेस्टेज',
    wastageReport: 'वेस्टेज अहवाल',
    todayTab: 'आज',
    allBillsTab: 'सर्व बिले',
    wastageWt: 'वेस्टेज वजन',
    fineEqv24k: '24K शुद्ध सोने',
    avgWastage: 'सरासरी %',
    wastageInr: 'वेस्टेज रक्कम',
    billsShort: 'बिले',
    dueFromCustomerStatus: 'ग्राहकाकडे बाकी',
    custodyHeldStatus: 'जमा ठेव',
    noWastageToday: 'आज कोणतेही वेस्टेज बिल नोंदवलेले नाही.',
    noWastageAll: 'अद्याप कोणतेही वेस्टेज बिल नाही.',
    createSalesBill: 'नवीन बिल',
    noCustomerGoldBalances: 'ग्राहकांचे सोने शिल्लक नाही.',
    openCustomers: 'ग्राहक खाते',
    accountsShort: 'खाती',
  },
  bn: {
    goldWithCustomers: 'গ্রাহকের কাছে সোনা',
    dueFromCustomers: 'গ্রাহকের বকেয়া সোনা',
    customerCustody: 'গ্রাহক আমানত সোনা',
    dueShort: 'বকেয়া',
    custodyShort: 'আমানত',
    wastageCollectedToday: 'আজ সংগৃহীত ওয়েস্টেজ',
    wastageReport: 'ওয়েস্টেজ রিপোর্ট',
    todayTab: 'আজ',
    allBillsTab: 'সব বিল',
    wastageWt: 'ওয়েস্টেজ ওজন',
    fineEqv24k: '24K খাঁটি সোনা',
    avgWastage: 'গড় %',
    wastageInr: 'ওয়েস্টেজ মূল্য',
    billsShort: 'বিল',
    dueFromCustomerStatus: 'গ্রাহকের বকেয়া',
    custodyHeldStatus: 'আমানত জমা',
    noWastageToday: 'আজ কোনো ওয়েস্টেজ বিল নথিভুক্ত হয়নি।',
    noWastageAll: 'এখনো কোনো ওয়েস্টেজ বিল নেই।',
    createSalesBill: 'নতুন বিল',
    noCustomerGoldBalances: 'গ্রাহকের কোনো সোনার ব্যালেন্স নেই।',
    openCustomers: 'গ্রাহক তালিকা',
    accountsShort: 'অ্যাকাউন্ট',
  },
  gu: {
    goldWithCustomers: 'ગ્રાહક પાસે સોનું',
    dueFromCustomers: 'ગ્રાહક પાસેથી લેણું સોનું',
    customerCustody: 'ગ્રાહક અમાનત સોનું',
    dueShort: 'બાકી',
    custodyShort: 'અમાનત',
    wastageCollectedToday: 'આજની ઘટ / વેસ્ટેજ આવક',
    wastageReport: 'વેસ્ટેજ રિપોર્ટ',
    todayTab: 'આજે',
    allBillsTab: 'બધા બિલ',
    wastageWt: 'વેસ્ટેજ વજન',
    fineEqv24k: '24K શુદ્ધ સોનું',
    avgWastage: 'સરેરાશ %',
    wastageInr: 'વેસ્ટેજ કિંમત',
    billsShort: 'બિલ',
    dueFromCustomerStatus: 'ગ્રાહક પાસે બાકી',
    custodyHeldStatus: 'અમાનત જમા',
    noWastageToday: 'આજે કોઈ વેસ્ટેજ બિલ નોંધાયું નથી.',
    noWastageAll: 'હજુ સુધી કોઈ વેસ્ટેજ બિલ નથી.',
    createSalesBill: 'નવું બિલ',
    noCustomerGoldBalances: 'ગ્રાહકનું કોઈ સોનું બાકી નથી.',
    openCustomers: 'ગ્રાહક ખાતા',
    accountsShort: 'ખાતા',
  },
  pa: {
    goldWithCustomers: 'ਗਾਹਕਾਂ ਕੋਲ ਸੋਨਾ',
    dueFromCustomers: 'ਗਾਹਕਾਂ ਵੱਲ ਬਕਾਇਆ ਸੋਨਾ',
    customerCustody: 'ਗਾਹਕ ਅਮਾਨਤ ਸੋਨਾ',
    dueShort: 'ਬਕਾਇਆ',
    custodyShort: 'ਅਮਾਨਤ',
    wastageCollectedToday: 'ਅੱਜ ਇਕੱਠੀ ਹੋਈ ਵੇਸਟੇਜ',
    wastageReport: 'ਵੇਸਟੇਜ ਰਿਪੋਰਟ',
    todayTab: 'ਅੱਜ',
    allBillsTab: 'ਸਾਰੇ ਬਿੱਲ',
    wastageWt: 'ਵੇਸਟੇਜ ਵਜ਼ਨ',
    fineEqv24k: '24K ਸ਼ੁੱਧ ਸੋਨਾ',
    avgWastage: 'ਔਸਤ %',
    wastageInr: 'ਵੇਸਟੇਜ ਰਕਮ',
    billsShort: 'ਬਿੱਲ',
    dueFromCustomerStatus: 'ਗਾਹਕ ਵੱਲ ਬਕਾਇਆ',
    custodyHeldStatus: 'ਅਮਾਨਤ ਜਮ੍ਹਾਂ',
    noWastageToday: 'ਅੱਜ ਕੋਈ ਵੇਸਟੇਜ ਬਿੱਲ ਦਰਜ ਨਹੀਂ ਹੋਇਆ।',
    noWastageAll: 'ਹਾਲੇ ਕੋਈ ਵੇਸਟੇਜ ਬਿੱਲ ਦਰਜ ਨਹੀਂ ਹੋਇਆ।',
    createSalesBill: 'ਨਵਾਂ ਬਿੱਲ',
    noCustomerGoldBalances: 'ਗਾਹਕਾਂ ਦਾ ਕੋਈ ਸੋਨਾ ਬਕਾਇਆ ਨਹੀਂ ਹੈ।',
    openCustomers: 'ਗਾਹਕ ਖਾਤੇ',
    accountsShort: 'ਖਾਤੇ',
  },
};

export function getDashboardExtraUI(lang: IndianLanguage): DashboardExtraStrings {
  return DASHBOARD_EXTRA_UI[lang] || EN_EXTRA;
}
