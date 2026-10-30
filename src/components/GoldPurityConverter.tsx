import React, { useMemo, useState } from 'react';
import { Check, Copy, RotateCcw, Scale } from 'lucide-react';
import { Decimal } from 'decimal.js';
import { GoldPurityCode, GoldRate, IndianLanguage } from '../types';
import {
  calculateFineGold,
  formatGrams,
  formatINR,
  PURITY_STANDARDS,
} from '../utils/goldMath';

interface ConverterStrings {
  title: string;
  subtitle: string;
  inputWeight: string;
  selectPurity: string;
  tunchPercent: string;
  customPurity: string;
  pureGold24k: string;
  alloyWeight: string;
  finenessPer1000: string;
  estimatedValue: string;
  reset: string;
  copyResult: string;
  copied: string;
}

const CONVERTER_TRANSLATIONS: Record<IndianLanguage, ConverterStrings> = {
  en: {
    title: 'Gold Purity Converter',
    subtitle: 'Enter ornament or bullion weight and purity to calculate 24K pure gold content.',
    inputWeight: 'Gold Weight (g)',
    selectPurity: 'Karat / Purity Standard',
    tunchPercent: 'Purity / Tunch (%)',
    customPurity: 'Custom %',
    pureGold24k: 'Pure Gold Content (24K Eqv.)',
    alloyWeight: 'Alloy / Other Metal',
    finenessPer1000: 'Fineness (per 1000)',
    estimatedValue: 'Est. Pure Gold Value',
    reset: 'Reset',
    copyResult: 'Copy',
    copied: 'Copied',
  },
  hi: {
    title: 'सोना शुद्धता कन्वर्टर (24K कैलकुलेटर)',
    subtitle: 'वजन और कैरेट/टंच डालकर शुद्ध 24K सोने की मात्रा निकालें।',
    inputWeight: 'सोने का वजन (ग्राम)',
    selectPurity: 'कैरेट / शुद्धता मानक',
    tunchPercent: 'शुद्धता / टंच (%)',
    customPurity: 'कस्टम %',
    pureGold24k: 'शुद्ध सोना (24K समतुल्य)',
    alloyWeight: 'अलॉय / अन्य धातु',
    finenessPer1000: 'फाइननेस (प्रति 1000)',
    estimatedValue: 'अनुमानित शुद्ध सोना मूल्य',
    reset: 'रीसेट',
    copyResult: 'कॉपी',
    copied: 'कॉपी हुआ',
  },
  mr: {
    title: 'सोने शुद्धता कन्व्हर्टर (24K कॅल्क्युलेटर)',
    subtitle: 'वजन आणि कॅरेट/टंच टाकून शुद्ध 24K सोन्याचे वजन काढा.',
    inputWeight: 'सोन्याचे वजन (ग्रॅम)',
    selectPurity: 'कॅरेट / शुद्धता',
    tunchPercent: 'शुद्धता / टंच (%)',
    customPurity: 'कस्टम %',
    pureGold24k: 'शुद्ध सोने (24K समतुल्य)',
    alloyWeight: 'मिश्र धातू (Alloy)',
    finenessPer1000: 'फाइननेस (प्रति 1000)',
    estimatedValue: 'अंदाजे शुद्ध सोने मूल्य',
    reset: 'रिसेट',
    copyResult: 'कॉपी',
    copied: 'कॉपी झाले',
  },
  gu: {
    title: 'સોનાની શુદ્ધતા કન્વર્ટર (24K કેલ્ક્યુલેટર)',
    subtitle: 'વજન અને કેરેટ/ટંચ નાખીને શુદ્ધ 24K સોનાનું વજન ગણો.',
    inputWeight: 'સોનાનું વજન (ગ્રામ)',
    selectPurity: 'કેરેટ / શુદ્ધતા ધોરણ',
    tunchPercent: 'શુદ્ધતા / ટંચ (%)',
    customPurity: 'કસ્ટમ %',
    pureGold24k: 'શુદ્ધ સોનું (24K સમકક્ષ)',
    alloyWeight: 'મિશ્ર ધાતુ (Alloy)',
    finenessPer1000: 'ફાઇનનેસ (પ્રતિ 1000)',
    estimatedValue: 'અંદાજિત શુદ્ધ સોનાની કિંમત',
    reset: 'રીસેટ',
    copyResult: 'કોપી',
    copied: 'કોપી થયું',
  },
  bn: {
    title: 'সোনা বিশুদ্ধতা কনভার্টার (24K ক্যালকুলেটর)',
    subtitle: 'ওজন এবং ক্যারেট/টাঞ্চ দিয়ে বিশুদ্ধ ২৪ ক্যারেট সোনার পরিমাণ নির্ণয় করুন।',
    inputWeight: 'সোনার ওজন (গ্রাম)',
    selectPurity: 'ক্যারেট / বিশুদ্ধতা মান',
    tunchPercent: 'বিশুদ্ধতা / টাঞ্চ (%)',
    customPurity: 'কাস্টম %',
    pureGold24k: 'বিশুদ্ধ সোনা (24K সমতুল্য)',
    alloyWeight: 'খাদ / অন্যান্য ধাতু',
    finenessPer1000: 'ফাইননেস (প্রতি ১০০০)',
    estimatedValue: 'আনুমানিক বিশুদ্ধ সোনার মূল্য',
    reset: 'রিসেট',
    copyResult: 'কপি',
    copied: 'কপি হয়েছে',
  },
  ta: {
    title: 'தங்க தூய்மை மாற்றி (24K கணிப்பான்)',
    subtitle: 'எடை மற்றும் கேரட்/டச் உள்ளிட்டு 24K சுத்த தங்க அளவை கணக்கிடுங்கள்.',
    inputWeight: 'தங்க எடை (கிராம்)',
    selectPurity: 'கேரட் / தூய்மை தரம்',
    tunchPercent: 'தூய்மை / டச் (%)',
    customPurity: 'தனிப்பயன் %',
    pureGold24k: 'சுத்த தங்கம் (24K சமம்)',
    alloyWeight: 'கலப்பு உலோகம் (Alloy)',
    finenessPer1000: 'தூய்மை எண் (1000-க்கு)',
    estimatedValue: 'மதிப்பிடப்பட்ட சுத்த தங்க மதிப்பு',
    reset: 'மீட்டமை',
    copyResult: 'நகலெடு',
    copied: 'நகலெடுக்கப்பட்டது',
  },
  te: {
    title: 'బంగారం స్వచ్ఛత కన్వర్టర్ (24K కాలిక్యులేటర్)',
    subtitle: 'బరువు మరియు క్యారెట్/టంచ్ నమోదు చేసి 24K స్వచ్ఛమైన బంగారం బరువు లెక్కించండి.',
    inputWeight: 'బంగారం బరువు (గ్రాములు)',
    selectPurity: 'క్యారెట్ / స్వచ్ఛత ప్రమాణం',
    tunchPercent: 'స్వచ్ఛత / టంచ్ (%)',
    customPurity: 'కస్టమ్ %',
    pureGold24k: 'స్వచ్ఛమైన బంగారం (24K సమానం)',
    alloyWeight: 'మిశ్రమ లోహం (Alloy)',
    finenessPer1000: 'ఫైన్‌నెస్ (1000కి)',
    estimatedValue: 'అంచనా స్వచ్ఛమైన బంగారం విలువ',
    reset: 'రీసెట్',
    copyResult: 'కాపీ',
    copied: 'కాపీ అయింది',
  },
  kn: {
    title: 'ಚಿನ್ನದ ಶುದ್ಧತೆ ಪರಿವರ್ತಕ (24K ಕ್ಯಾಲ್ಕುಲೇಟರ್)',
    subtitle: 'ತೂಕ ಮತ್ತು ಕ್ಯಾರೆಟ್/ಟಂಚ್ ನಮೂದಿಸಿ 24K ಶುದ್ಧ ಚಿನ್ನದ ಪ್ರಮಾಣವನ್ನು ಲೆಕ್ಕಹಾಕಿ.',
    inputWeight: 'ಚಿನ್ನದ ತೂಕ (ಗ್ರಾಂ)',
    selectPurity: 'ಕ್ಯಾರೆಟ್ / ಶುದ್ಧತೆ ಮಾನದಂಡ',
    tunchPercent: 'ಶುದ್ಧತೆ / ಟಂಚ್ (%)',
    customPurity: 'ಕಸ್ಟಮ್ %',
    pureGold24k: 'ಶುದ್ಧ ಚಿನ್ನ (24K ಸಮಾನ)',
    alloyWeight: 'ಮಿಶ್ರಲೋಹ (Alloy)',
    finenessPer1000: 'ಫೈನ್‌ನೆಸ್ (1000ಕ್ಕೆ)',
    estimatedValue: 'ಅಂದಾಜು ಶುದ್ಧ ಚಿನ್ನದ ಮೌಲ್ಯ',
    reset: 'ಮರುಹೊಂದಿಸಿ',
    copyResult: 'ಕಾಪಿ',
    copied: 'ಕಾಪಿ ಆಗಿದೆ',
  },
  ml: {
    title: 'സ്വർണ്ണ പരിശുദ്ധി കൺവെർട്ടർ (24K കാൽക്കുലേറ്റർ)',
    subtitle: 'തൂക്കവും കാരറ്റ്/ടച്ചും നൽകി 24K ശുദ്ധമായ സ്വർണ്ണത്തിന്റെ അളവ് കണക്കാക്കുക.',
    inputWeight: 'സ്വർണ്ണ തൂക്കം (ഗ്രാം)',
    selectPurity: 'കാരറ്റ് / പരിശുദ്ധി നിലവാരം',
    tunchPercent: 'പരിശുദ്ധി / ടച്ച് (%)',
    customPurity: 'കസ്റ്റം %',
    pureGold24k: 'ശുദ്ധ സ്വർണ്ണം (24K തത്തുല്യം)',
    alloyWeight: 'ലോഹസങ്കരം (Alloy)',
    finenessPer1000: 'ഫൈൻനസ് (1000-ൽ)',
    estimatedValue: 'ഏകദേശ ശുദ്ധ സ്വർണ്ണ മൂല്യം',
    reset: 'റീസെറ്റ്',
    copyResult: 'കോപ്പി',
    copied: 'കോപ്പി ചെയ്തു',
  },
  pa: {
    title: 'ਸੋਨਾ ਸ਼ੁੱਧਤਾ ਕਨਵਰਟਰ (24K ਕੈਲਕੁਲੇਟਰ)',
    subtitle: 'ਵਜ਼ਨ ਅਤੇ ਕੈਰੇਟ/ਟੰਚ ਦਰਜ ਕਰਕੇ ਸ਼ੁੱਧ 24K ਸੋਨੇ ਦੀ ਮਾਤਰਾ ਕੱਢੋ।',
    inputWeight: 'ਸੋਨੇ ਦਾ ਵਜ਼ਨ (ਗ੍ਰਾਮ)',
    selectPurity: 'ਕੈਰੇਟ / ਸ਼ੁੱਧਤਾ ਮਿਆਰ',
    tunchPercent: 'ਸ਼ੁੱਧਤਾ / ਟੰਚ (%)',
    customPurity: 'ਕਸਟਮ %',
    pureGold24k: 'ਸ਼ੁੱਧ ਸੋਨਾ (24K ਬਰਾਬਰ)',
    alloyWeight: 'ਮਿਸ਼ਰਤ ਧਾਤੂ (Alloy)',
    finenessPer1000: 'ਫਾਈਨਨੈੱਸ (ਪ੍ਰਤੀ 1000)',
    estimatedValue: 'ਅਨੁਮਾਨਿਤ ਸ਼ੁੱਧ ਸੋਨਾ ਮੁੱਲ',
    reset: 'ਰੀਸੈਟ',
    copyResult: 'ਕਾਪੀ',
    copied: 'ਕਾਪੀ ਹੋਇਆ',
  },
};

type PurityMode = GoldPurityCode | 'CUSTOM';

const KARAT_PRESETS: GoldPurityCode[] = ['24K', '22K', '20K', '18K', '14K', '9K'];

interface GoldPurityConverterProps {
  activeLanguage: IndianLanguage;
  goldRates?: GoldRate[];
  showRupees?: boolean;
}

export const GoldPurityConverter: React.FC<GoldPurityConverterProps> = ({
  activeLanguage,
  goldRates = [],
  showRupees = false,
}) => {
  const labels = CONVERTER_TRANSLATIONS[activeLanguage] || CONVERTER_TRANSLATIONS.en;

  const [weightInput, setWeightInput] = useState<string>('10.000');
  const [selectedMode, setSelectedMode] = useState<PurityMode>('22K');
  const [purityUnit, setPurityUnit] = useState<'PERCENT' | 'FINENESS' | 'KARAT'>('PERCENT');
  const [purityInput, setPurityInput] = useState<string>('91.60');
  const [finenessPer1000, setFinenessPer1000] = useState<number>(916.0);
  const [copied, setCopied] = useState(false);

  const formatForUnit = (fineness: number, unit: 'PERCENT' | 'FINENESS' | 'KARAT'): string => {
    if (unit === 'PERCENT') return new Decimal(fineness).div(10).toFixed(2);
    if (unit === 'FINENESS') return new Decimal(fineness).toFixed(1);
    const matchedKarat = KARAT_PRESETS.find(
      (k) => Math.abs(PURITY_STANDARDS[k].fineness - fineness) < 0.5
    );
    if (matchedKarat) return matchedKarat.replace('K', '');
    return new Decimal(fineness).mul(24).div(1000).toFixed(2);
  };

  const handleSelectKarat = (karat: GoldPurityCode) => {
    setSelectedMode(karat);
    const std = PURITY_STANDARDS[karat];
    setFinenessPer1000(std.fineness);
    setPurityInput(formatForUnit(std.fineness, purityUnit));
  };

  const handleCustomMode = () => {
    setSelectedMode('CUSTOM');
  };

  const handleChangeUnit = (nextUnit: 'PERCENT' | 'FINENESS' | 'KARAT') => {
    setPurityUnit(nextUnit);
    setPurityInput(formatForUnit(finenessPer1000, nextUnit));
  };

  const handlePurityInputChange = (raw: string) => {
    setPurityInput(raw);
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFinenessPer1000(0);
      setSelectedMode('CUSTOM');
      return;
    }

    let nextFineness = 0;
    if (purityUnit === 'PERCENT') {
      // Smart hallmark entry: typing 916 or 995 (>100 and <=1000) maps to per-1000 fineness
      if (parsed > 100 && parsed <= 1000) {
        nextFineness = parsed;
      } else {
        nextFineness = Math.min(100, Math.max(0, parsed)) * 10;
      }
    } else if (purityUnit === 'FINENESS') {
      nextFineness = Math.min(1000, Math.max(0, parsed));
    } else {
      const clampedK = Math.min(24, Math.max(0, parsed));
      const exactK = KARAT_PRESETS.find((k) => Number(k.replace('K', '')) === clampedK);
      nextFineness = exactK ? PURITY_STANDARDS[exactK].fineness : (clampedK / 24) * 1000;
    }

    const roundedFineness = Number(nextFineness.toFixed(2));
    setFinenessPer1000(roundedFineness);

    const matchedKarat = KARAT_PRESETS.find(
      (k) => Math.abs(PURITY_STANDARDS[k].fineness - roundedFineness) < 0.05
    );
    setSelectedMode(matchedKarat || 'CUSTOM');
  };

  const handleReset = () => {
    setWeightInput('10.000');
    setSelectedMode('22K');
    setPurityUnit('PERCENT');
    setFinenessPer1000(916.0);
    setPurityInput('91.60');
  };

  const conversion = useMemo(() => {
    const parsedWeight = parseFloat(weightInput);
    const safeWeight =
      Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 0;
    const clampedFineness = Math.min(1000, Math.max(0, finenessPer1000));
    const clampedPct = clampedFineness / 10;

    const weightDec = new Decimal(safeWeight);
    const finenessDec = new Decimal(clampedFineness);
    const pureGoldDec = calculateFineGold(weightDec, finenessDec);
    const alloyDec = Decimal.max(0, weightDec.minus(pureGoldDec)).toDecimalPlaces(4);

    const rate24k =
      goldRates.find((r) => r.purity === '24K')?.ratePerGram || 7450;
    const estimatedINR = pureGoldDec.mul(rate24k).toDecimalPlaces(2);

    return {
      inputGrams: weightDec.toNumber(),
      purityPercent: clampedPct,
      fineness: finenessDec.toDecimalPlaces(1).toFixed(1),
      pureGoldGrams: pureGoldDec.toNumber(),
      pureGoldExactFourDec: pureGoldDec.toFixed(4),
      alloyGrams: alloyDec.toNumber(),
      rate24k,
      estimatedINR: estimatedINR.toNumber(),
    };
  }, [weightInput, finenessPer1000, goldRates]);

  const handleCopy = () => {
    const modeLabel =
      selectedMode === 'CUSTOM'
        ? `${conversion.purityPercent.toFixed(2)}% (${conversion.fineness}‰)`
        : `${selectedMode} (${conversion.fineness})`;
    const summary = `${formatGrams(conversion.inputGrams, 3)} @ ${modeLabel} = ${formatGrams(
      conversion.pureGoldGrams,
      3
    )} Pure 24K Gold`;
    navigator.clipboard?.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      aria-label={labels.title}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#9A7426] dark:text-[#E5C158] shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{labels.title}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{labels.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{labels.reset}</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            )}
            <span>{copied ? labels.copied : labels.copyResult}</span>
          </button>
        </div>
      </div>

      {/* Body: Left Inputs | Right 24K Equivalent Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        {/* Inputs (7 cols on desktop) */}
        <div className="lg:col-span-7 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="purity-converter-weight"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                {labels.inputWeight}
              </label>
              <input
                id="purity-converter-weight"
                type="number"
                min="0"
                step="0.001"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder="0.000"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="purity-converter-percent"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 truncate"
                >
                  {labels.tunchPercent}
                </label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-0.5 shrink-0">
                  {(
                    [
                      { id: 'PERCENT', label: '%' },
                      { id: 'FINENESS', label: '‰' },
                      { id: 'KARAT', label: 'K' },
                    ] as const
                  ).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleChangeUnit(u.id)}
                      className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition cursor-pointer whitespace-nowrap ${
                        purityUnit === u.id
                          ? 'bg-white dark:bg-slate-700 text-[#9A7426] dark:text-[#E5C158] shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <input
                  id="purity-converter-percent"
                  type="number"
                  min="0"
                  max={purityUnit === 'KARAT' ? 24 : 1000}
                  step={purityUnit === 'FINENESS' ? '0.1' : '0.01'}
                  value={purityInput}
                  onChange={(e) => handlePurityInputChange(e.target.value)}
                  placeholder={
                    purityUnit === 'PERCENT'
                      ? '91.60'
                      : purityUnit === 'FINENESS'
                      ? '916.0'
                      : '22'
                  }
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-3 pr-9 py-2 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 dark:text-slate-500 pointer-events-none">
                  {purityUnit === 'PERCENT' ? '%' : purityUnit === 'FINENESS' ? '‰' : 'K'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {labels.selectPurity}
            </span>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              {KARAT_PRESETS.map((karat) => {
                const active = selectedMode === karat;
                return (
                  <button
                    key={karat}
                    type="button"
                    onClick={() => handleSelectKarat(karat)}
                    className={`flex-1 min-w-[60px] px-2.5 py-1.5 rounded-md text-xs font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    {karat} ({PURITY_STANDARDS[karat].hallmarkSymbol})
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleCustomMode}
                className={`px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedMode === 'CUSTOM'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                }`}
              >
                {labels.customPurity}
              </button>
            </div>
          </div>
        </div>

        {/* Calculated Output (5 cols on desktop) */}
        <div className="lg:col-span-5 p-4 flex flex-col justify-between bg-slate-50/40 dark:bg-slate-800/40 space-y-4">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {labels.pureGold24k}
            </div>
            <div
              data-testid="pure-gold-output"
              className="text-2xl font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158] mt-1"
            >
              {formatGrams(conversion.pureGoldGrams, 3)}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
              {conversion.pureGoldExactFourDec} g · {formatGrams(conversion.inputGrams, 3)} ×{' '}
              {conversion.purityPercent.toFixed(2)}%
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{labels.alloyWeight}</div>
              <div className="text-sm font-semibold font-mono tabular-nums text-slate-800 dark:text-slate-200 mt-0.5">
                {formatGrams(conversion.alloyGrams, 3)}
              </div>
            </div>

            {showRupees ? (
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{labels.estimatedValue}</div>
                <div className="text-sm font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {formatINR(conversion.estimatedINR)}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{labels.finenessPer1000}</div>
                <div className="text-sm font-semibold font-mono tabular-nums text-slate-800 dark:text-slate-200 mt-0.5">
                  {conversion.fineness} / 1000
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
