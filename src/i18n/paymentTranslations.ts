import { IndianLanguage, Invoice } from '../types';

export interface PaymentStrings {
  paymentOption: string;
  cash: string;
  gold: string;
  due: string;
  partlyPayment: string;
  cashChannel: string;
  upiChannel: string;
  bankChannel: string;
  cashPaidNow: string;
  goldReceivedGrams: string;
  goldRatePerGram: string;
  goldValue: string;
  totalBill: string;
  paidNow: string;
  balanceDue: string;
  goldDue: string;
  dueDateOptional: string;
  matchFullWeight: string;
  fillBalanceCash: string;
  statusPaid: string;
  statusPartial: string;
  statusDue: string;
}

export const PAYMENT_TRANSLATIONS: Record<IndianLanguage, PaymentStrings> = {
  en: {
    paymentOption: 'Payment Option',
    cash: 'Cash',
    gold: 'Gold',
    due: 'Due',
    partlyPayment: 'Partly Payment',
    cashChannel: 'Cash',
    upiChannel: 'UPI',
    bankChannel: 'Bank',
    cashPaidNow: 'Cash / UPI Paid (₹)',
    goldReceivedGrams: 'Gold Received (g)',
    goldRatePerGram: 'Gold Rate (₹/g)',
    goldValue: 'Gold Value',
    totalBill: 'Bill Total',
    paidNow: 'Paid Now',
    balanceDue: 'Balance Due',
    goldDue: 'Gold Due',
    dueDateOptional: 'Due Date (Optional)',
    matchFullWeight: 'Full Wt',
    fillBalanceCash: 'Fill Balance',
    statusPaid: 'Paid',
    statusPartial: 'Partly Paid',
    statusDue: 'Due',
  },
  hi: {
    paymentOption: 'भुगतान विकल्प',
    cash: 'नकद (Cash)',
    gold: 'सोना (Gold)',
    due: 'बाकी (Due)',
    partlyPayment: 'आंशिक भुगतान (Partly)',
    cashChannel: 'नकद',
    upiChannel: 'UPI',
    bankChannel: 'बैंक',
    cashPaidNow: 'नकद / UPI प्राप्त (₹)',
    goldReceivedGrams: 'प्राप्त सोना (g)',
    goldRatePerGram: 'सोने का भाव (₹/g)',
    goldValue: 'सोने का मूल्य',
    totalBill: 'कुल बिल',
    paidNow: 'जमा राशि',
    balanceDue: 'बाकी राशि (Due)',
    goldDue: 'बाकी सोना',
    dueDateOptional: 'देय तिथि (वैकल्पिक)',
    matchFullWeight: 'पूरा वज़न',
    fillBalanceCash: 'बाकी भरें',
    statusPaid: 'भुगतान पूर्ण',
    statusPartial: 'आंशिक भुगतान',
    statusDue: 'बाकी (Due)',
  },
  ta: {
    paymentOption: 'செலுத்தும் முறை',
    cash: 'ரொக்கம் (Cash)',
    gold: 'தங்கம் (Gold)',
    due: 'பாக்கி (Due)',
    partlyPayment: 'பகுதி கட்டணம் (Partly)',
    cashChannel: 'ரொக்கம்',
    upiChannel: 'UPI',
    bankChannel: 'வங்கி',
    cashPaidNow: 'ரொக்கம் / UPI (₹)',
    goldReceivedGrams: 'பெற்ற தங்கம் (g)',
    goldRatePerGram: 'தங்க விலை (₹/g)',
    goldValue: 'தங்க மதிப்பு',
    totalBill: 'மொத்த பில்',
    paidNow: 'செலுத்தியது',
    balanceDue: 'மீதி பாக்கி',
    goldDue: 'தங்க பாக்கி',
    dueDateOptional: 'தவணை தேதி',
    matchFullWeight: 'முழு எடை',
    fillBalanceCash: 'மீதி நிரப்பு',
    statusPaid: 'செலுத்தப்பட்டது',
    statusPartial: 'பகுதி கட்டணம்',
    statusDue: 'பாக்கி',
  },
  te: {
    paymentOption: 'చెల్లింపు విధానం',
    cash: 'నగదు (Cash)',
    gold: 'బంగారం (Gold)',
    due: 'బాకీ (Due)',
    partlyPayment: 'పాక్షిక చెల్లింపు (Partly)',
    cashChannel: 'నగదు',
    upiChannel: 'UPI',
    bankChannel: 'బ్యాంక్',
    cashPaidNow: 'నగదు / UPI చెల్లింపు (₹)',
    goldReceivedGrams: 'స్వీకరించిన బంగారం (g)',
    goldRatePerGram: 'బంగారం ధర (₹/g)',
    goldValue: 'బంగారం విలువ',
    totalBill: 'మొత్తం బిల్లు',
    paidNow: 'చెల్లించినది',
    balanceDue: 'బాకీ మొత్తం',
    goldDue: 'బంగారం బాకీ',
    dueDateOptional: 'గడువు తేదీ',
    matchFullWeight: 'పూర్తి బరువు',
    fillBalanceCash: 'మిగిలినది',
    statusPaid: 'చెల్లించారు',
    statusPartial: 'పాక్షిక చెల్లింపు',
    statusDue: 'బాకీ',
  },
  kn: {
    paymentOption: 'ಪಾವತಿ ಆಯ್ಕೆ',
    cash: 'ನಗದು (Cash)',
    gold: 'ಚಿನ್ನ (Gold)',
    due: 'ಬಾಕಿ (Due)',
    partlyPayment: 'ಭಾಗಶಃ ಪಾವತಿ (Partly)',
    cashChannel: 'ನಗದು',
    upiChannel: 'UPI',
    bankChannel: 'ಬ್ಯಾಂಕ್',
    cashPaidNow: 'ನಗದು / UPI ಪಾವತಿ (₹)',
    goldReceivedGrams: 'ಸ್ವೀಕರಿಸಿದ ಚಿನ್ನ (g)',
    goldRatePerGram: 'ಚಿನ್ನದ ದರ (₹/g)',
    goldValue: 'ಚಿನ್ನದ ಮೌಲ್ಯ',
    totalBill: 'ಒಟ್ಟು ಬಿಲ್',
    paidNow: 'ಪಾವತಿಸಿದ ಮೊತ್ತ',
    balanceDue: 'ಬಾಕಿ ಮೊತ್ತ',
    goldDue: 'ಚಿನ್ನದ ಬಾಕಿ',
    dueDateOptional: 'ಬಾಕಿ ದಿನಾಂಕ',
    matchFullWeight: 'ಪೂರ್ಣ ತೂಕ',
    fillBalanceCash: 'ಬಾಕಿ ತುಂಬಿಸಿ',
    statusPaid: 'ಪಾವತಿಸಲಾಗಿದೆ',
    statusPartial: 'ಭಾಗಶಃ ಪಾವತಿ',
    statusDue: 'ಬಾಕಿ',
  },
  ml: {
    paymentOption: 'പേയ്‌മെന്റ് രീതി',
    cash: 'പണം (Cash)',
    gold: 'സ്വർണ്ണം (Gold)',
    due: 'ബാക്കി (Due)',
    partlyPayment: 'ഭാഗിക പേയ്‌മെന്റ് (Partly)',
    cashChannel: 'പണം',
    upiChannel: 'UPI',
    bankChannel: 'ബാങ്ക്',
    cashPaidNow: 'ലഭിച്ച പണം / UPI (₹)',
    goldReceivedGrams: 'ലഭിച്ച സ്വർണ്ണം (g)',
    goldRatePerGram: 'സ്വർണ്ണ വില (₹/g)',
    goldValue: 'സ്വർണ്ണ മൂല്യം',
    totalBill: 'ആകെ ബിൽ',
    paidNow: 'നൽകിയ തുക',
    balanceDue: 'ബാക്കി തുക',
    goldDue: 'സ്വർണ്ണ ബാക്കി',
    dueDateOptional: 'അവസാന തീയതി',
    matchFullWeight: 'മുഴുവൻ തൂക്കം',
    fillBalanceCash: 'ബാക്കി തുക',
    statusPaid: 'അടച്ചു',
    statusPartial: 'ഭാഗികമായി അടച്ചു',
    statusDue: 'ബാക്കി',
  },
  mr: {
    paymentOption: 'पेमेंट पर्याय',
    cash: 'रोख (Cash)',
    gold: 'सोने (Gold)',
    due: 'बाकी (Due)',
    partlyPayment: 'अंशतः पेमेंट (Partly)',
    cashChannel: 'रोख',
    upiChannel: 'UPI',
    bankChannel: 'बँक',
    cashPaidNow: 'रोख / UPI जमा (₹)',
    goldReceivedGrams: 'मिळालेले सोने (g)',
    goldRatePerGram: 'सोन्याचा भाव (₹/g)',
    goldValue: 'सोन्याची किंमत',
    totalBill: 'एकूण बिल',
    paidNow: 'जमा रक्कम',
    balanceDue: 'येणे बाकी (Due)',
    goldDue: 'सोने बाकी',
    dueDateOptional: 'देय तारीख',
    matchFullWeight: 'पूर्ण वजन',
    fillBalanceCash: 'बाकी भरा',
    statusPaid: 'पूर्ण जमा',
    statusPartial: 'अंशतः जमा',
    statusDue: 'बाकी',
  },
  bn: {
    paymentOption: 'পেমেন্ট বিকল্প',
    cash: 'নগদ (Cash)',
    gold: 'সোনা (Gold)',
    due: 'বাকি (Due)',
    partlyPayment: 'আংশিক পেমেন্ট (Partly)',
    cashChannel: 'নগদ',
    upiChannel: 'UPI',
    bankChannel: 'ব্যাংক',
    cashPaidNow: 'নগদ / UPI জমা (₹)',
    goldReceivedGrams: 'প্রাপ্ত সোনা (g)',
    goldRatePerGram: 'সোনার দর (₹/g)',
    goldValue: 'সোনার মূল্য',
    totalBill: 'মোট বিল',
    paidNow: 'জমা টাকা',
    balanceDue: 'বাকি টাকা',
    goldDue: 'বাকি সোনা',
    dueDateOptional: 'পরিশোধের তারিখ',
    matchFullWeight: 'পুরো ওজন',
    fillBalanceCash: 'বাকি পূরণ',
    statusPaid: 'পরিশোধিত',
    statusPartial: 'আংশিক পরিশোধ',
    statusDue: 'বাকি',
  },
  gu: {
    paymentOption: 'ચુકવણી વિકલ્પ',
    cash: 'રોકડ (Cash)',
    gold: 'સોનું (Gold)',
    due: 'બાકી (Due)',
    partlyPayment: 'અંશતઃ ચુકવણી (Partly)',
    cashChannel: 'રોકડ',
    upiChannel: 'UPI',
    bankChannel: 'બેંક',
    cashPaidNow: 'રોકડ / UPI જમા (₹)',
    goldReceivedGrams: 'મળેલ સોનું (g)',
    goldRatePerGram: 'સોનાનો ભાવ (₹/g)',
    goldValue: 'સોનાની કિંમત',
    totalBill: 'કુલ બિલ',
    paidNow: 'જમા રકમ',
    balanceDue: 'બાકી રકમ (Due)',
    goldDue: 'સોનું બાકી',
    dueDateOptional: 'ચુકવણી તારીખ',
    matchFullWeight: 'પૂરું વજન',
    fillBalanceCash: 'બાકી ભરો',
    statusPaid: 'ચૂકવેલ',
    statusPartial: 'અંશતઃ ચૂકવેલ',
    statusDue: 'બાકી',
  },
  pa: {
    paymentOption: 'ਭੁਗਤਾਨ ਵਿਕਲਪ',
    cash: 'ਨਕਦ (Cash)',
    gold: 'ਸੋਨਾ (Gold)',
    due: 'ਬਾਕੀ (Due)',
    partlyPayment: 'ਅੰਸ਼ਕ ਭੁਗਤਾਨ (Partly)',
    cashChannel: 'ਨਕਦ',
    upiChannel: 'UPI',
    bankChannel: 'ਬੈਂਕ',
    cashPaidNow: 'ਨਕਦ / UPI ਜਮ੍ਹਾਂ (₹)',
    goldReceivedGrams: 'ਪ੍ਰਾਪਤ ਸੋਨਾ (g)',
    goldRatePerGram: 'ਸੋਨੇ ਦਾ ਭਾਅ (₹/g)',
    goldValue: 'ਸੋਨੇ ਦੀ ਕੀਮਤ',
    totalBill: 'ਕੁੱਲ ਬਿੱਲ',
    paidNow: 'ਜਮ੍ਹਾਂ ਰਕਮ',
    balanceDue: 'ਬਾਕੀ ਰਕਮ',
    goldDue: 'ਬਾਕੀ ਸੋਨਾ',
    dueDateOptional: 'ਬਕਾਇਆ ਮਿਤੀ',
    matchFullWeight: 'ਪੂਰਾ ਵਜ਼ਨ',
    fillBalanceCash: 'ਬਾਕੀ ਭਰੋ',
    statusPaid: 'ਭੁਗਤਾਨ ਪੂਰਾ',
    statusPartial: 'ਅੰਸ਼ਕ ਭੁਗਤਾਨ',
    statusDue: 'ਬਾਕੀ',
  },
};

export function getPaymentStrings(lang: IndianLanguage): PaymentStrings {
  return PAYMENT_TRANSLATIONS[lang] || PAYMENT_TRANSLATIONS.en;
}

export function formatInvoicePaymentMethodLabel(
  inv: Pick<Invoice, 'paymentMethod' | 'paymentStatus' | 'goldExchangeGrams' | 'paidAmountINR' | 'cashPaymentChannel'>,
  lang: IndianLanguage = 'en'
): string {
  const p = getPaymentStrings(lang);
  if (inv.paymentMethod === 'CREDIT' || (inv.paymentStatus === 'UNPAID' && !inv.paidAmountINR && !inv.goldExchangeGrams)) {
    return p.due;
  }
  if (inv.paymentMethod === 'SPLIT') {
    const ch =
      inv.cashPaymentChannel === 'UPI'
        ? p.upiChannel
        : inv.cashPaymentChannel === 'BANK_TRANSFER'
        ? p.bankChannel
        : p.cashChannel;
    return `${ch} + ${p.gold}`;
  }
  if (inv.paymentMethod === 'OLD_GOLD_EXCHANGE') {
    return p.gold;
  }
  if (inv.paymentMethod === 'UPI') {
    return p.upiChannel;
  }
  if (inv.paymentMethod === 'BANK_TRANSFER') {
    return p.bankChannel;
  }
  return p.cashChannel;
}

export function formatInvoiceStatusLabel(
  status: Invoice['paymentStatus'] | undefined,
  lang: IndianLanguage = 'en'
): string {
  const p = getPaymentStrings(lang);
  if (status === 'UNPAID') return p.statusDue;
  if (status === 'PARTIAL') return p.statusPartial;
  return p.statusPaid;
}
