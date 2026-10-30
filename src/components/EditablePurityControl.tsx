import React, { useEffect, useState } from 'react';
import { GoldPurityCode, GoldRate } from '../types';
import { PURITY_STANDARDS } from '../utils/goldMath';

const ALL_KARATS: GoldPurityCode[] = ['24K', '22K', '20K', '18K', '14K', '9K'];
const DEFAULT_PRESET_BUTTONS: GoldPurityCode[] = ['22K', '24K', '18K', '14K'];
export const MELTING_TOUCH_PRESETS: GoldPurityCode[] = ['22K', '20K', '18K', '14K', '9K'];

export function finenessToPurityCode(fineness: number): GoldPurityCode {
  for (const k of ALL_KARATS) {
    if (Math.abs(PURITY_STANDARDS[k].fineness - fineness) <= 0.6) {
      return k;
    }
  }
  if (fineness >= 958) return '24K';
  if (fineness >= 875) return '22K';
  if (fineness >= 792) return '20K';
  if (fineness >= 667) return '18K';
  if (fineness >= 480) return '14K';
  return '9K';
}

export function resolveAllowedPurityCode(
  fineness: number,
  allowedPresets?: GoldPurityCode[]
): GoldPurityCode {
  const code = finenessToPurityCode(fineness);
  if (!allowedPresets || allowedPresets.length === 0 || allowedPresets.includes(code)) {
    return code;
  }
  // Map to closest allowed preset by standard fineness
  let closest = allowedPresets[0];
  let bestDelta = Math.abs(PURITY_STANDARDS[closest].fineness - fineness);
  for (const p of allowedPresets) {
    const delta = Math.abs(PURITY_STANDARDS[p].fineness - fineness);
    if (delta < bestDelta) {
      bestDelta = delta;
      closest = p;
    }
  }
  return closest;
}

export function isExactPresetFineness(purity: GoldPurityCode, fineness: number): boolean {
  const std = PURITY_STANDARDS[purity]?.fineness;
  if (!std) return false;
  if (purity === '24K' && (Math.abs(fineness - 999.9) <= 0.6 || Math.abs(fineness - 999.0) <= 0.6)) {
    return true;
  }
  return Math.abs(std - fineness) <= 0.5;
}

export function parsePurityInputToFineness(
  raw: string,
  unit: 'PERCENT' | 'FINENESS'
): number | null {
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  if (unit === 'PERCENT') {
    if (parsed > 100 && parsed <= 1000) {
      return Number(parsed.toFixed(1));
    }
    const clampedPct = Math.min(100, Math.max(0, parsed));
    return Number((clampedPct * 10).toFixed(1));
  }

  const clampedFineness = Math.min(1000, Math.max(0, parsed));
  return Number(clampedFineness.toFixed(1));
}

export function computeRateForFineness(
  fineness: number,
  goldRates: GoldRate[],
  purityCode?: GoldPurityCode
): number {
  const matchedCode = purityCode || finenessToPurityCode(fineness);
  if (isExactPresetFineness(matchedCode, fineness)) {
    const exactRate = goldRates.find((r) => r.purity === matchedCode)?.ratePerGram;
    if (exactRate && exactRate > 0) return exactRate;
  }
  const rate24k = goldRates.find((r) => r.purity === '24K')?.ratePerGram || 7450;
  return Math.round((rate24k * Math.min(999.9, Math.max(0, fineness))) / 999.9);
}

export function formatFinenessDisplay(fineness: number, unit: 'PERCENT' | 'FINENESS'): string {
  if (unit === 'PERCENT') {
    return Number((fineness / 10).toFixed(2)).toString();
  }
  return Number(fineness.toFixed(1)).toString();
}

interface EditablePurityControlProps {
  purity: GoldPurityCode;
  fineness: number;
  onChange: (nextPurity: GoldPurityCode, nextFineness: number) => void;
  presets?: GoldPurityCode[];
  variant?: 'presets' | 'inline';
  className?: string;
}

export const EditablePurityControl: React.FC<EditablePurityControlProps> = ({
  purity,
  fineness,
  onChange,
  presets,
  variant = 'presets',
  className = '',
}) => {
  const [unit, setUnit] = useState<'PERCENT' | 'FINENESS'>('PERCENT');
  const [isFocused, setIsFocused] = useState(false);
  const [inputText, setInputText] = useState<string>(() =>
    (fineness / 10).toFixed(2)
  );

  useEffect(() => {
    if (!isFocused) {
      setInputText(
        unit === 'PERCENT' ? (fineness / 10).toFixed(2) : fineness.toFixed(1)
      );
    }
  }, [fineness, unit, isFocused]);

  const handleSelectPreset = (p: GoldPurityCode) => {
    const nextFineness = PURITY_STANDARDS[p].fineness;
    setInputText(
      unit === 'PERCENT' ? (nextFineness / 10).toFixed(2) : nextFineness.toFixed(1)
    );
    onChange(p, nextFineness);
  };

  const handleInputChange = (raw: string) => {
    setInputText(raw);
    const nextFineness = parsePurityInputToFineness(raw, unit);
    if (nextFineness === null) return;
    const nextPurity = resolveAllowedPurityCode(nextFineness, presets);
    onChange(nextPurity, nextFineness);
  };

  const handleToggleUnit = () => {
    const nextUnit = unit === 'PERCENT' ? 'FINENESS' : 'PERCENT';
    setUnit(nextUnit);
    setInputText(
      nextUnit === 'PERCENT' ? (fineness / 10).toFixed(2) : fineness.toFixed(1)
    );
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parsePurityInputToFineness(inputText, unit);
    const validFineness = parsed !== null && parsed > 0 ? parsed : fineness || 916;
    setInputText(
      unit === 'PERCENT' ? (validFineness / 10).toFixed(2) : validFineness.toFixed(1)
    );
    onChange(resolveAllowedPurityCode(validFineness, presets), validFineness);
  };

  if (variant === 'inline') {
    const inlineOptions = presets && presets.length > 0 ? presets : ALL_KARATS;
    const selectValue = inlineOptions.includes(purity) ? purity : inlineOptions[0];

    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <select
          aria-label="Karat Preset"
          value={selectValue}
          onChange={(e) => handleSelectPreset(e.target.value as GoldPurityCode)}
          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 text-xs font-mono tabular-nums font-bold text-slate-800 dark:text-slate-100 focus:border-[#C9A24A] focus:outline-none shrink-0"
        >
          {inlineOptions.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[96px]">
          <input
            type="number"
            step={unit === 'PERCENT' ? '0.01' : '0.1'}
            min="0"
            max="1000"
            aria-label="Editable Purity"
            value={inputText}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={unit === 'PERCENT' ? '91.60' : '916.0'}
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-9 py-2 text-xs font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158] focus:border-[#C9A24A] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleToggleUnit}
            title="Switch between % (Tunch) and ‰ (Per 1000 Fineness)"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 transition cursor-pointer whitespace-nowrap"
          >
            {unit === 'PERCENT' ? '%' : '‰'}
          </button>
        </div>
      </div>
    );
  }

  const buttonPresets = presets && presets.length > 0 ? presets : DEFAULT_PRESET_BUTTONS;

  const gridColsClass =
    buttonPresets.length === 2
      ? 'grid-cols-2'
      : buttonPresets.length === 3
      ? 'grid-cols-3'
      : buttonPresets.length === 5
      ? 'grid-cols-5'
      : buttonPresets.length === 6
      ? 'grid-cols-6'
      : 'grid-cols-4';

  return (
    <div className={`flex flex-wrap sm:flex-nowrap items-center gap-1.5 ${className}`}>
      <div className={`grid ${gridColsClass} gap-1 flex-1 min-w-[160px]`}>
        {buttonPresets.map((p) => {
          const isMatched = purity === p && isExactPresetFineness(p, fineness);
          return (
            <button
              key={p}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={`py-2 px-1.5 rounded-lg text-xs font-bold font-mono tabular-nums border transition cursor-pointer whitespace-nowrap shrink-0 ${
                isMatched
                  ? 'bg-[#101C32] dark:bg-[#C9A24A]/20 text-[#C9A24A] dark:text-[#E5C158] border-[#101C32] dark:border-[#C9A24A]'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div className="relative w-full sm:w-28 shrink-0">
        <input
          type="number"
          step={unit === 'PERCENT' ? '0.01' : '0.1'}
          min="0"
          max="1000"
          aria-label="Editable Purity"
          value={inputText}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={unit === 'PERCENT' ? '91.60' : '916.0'}
          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-9 py-2 text-xs font-mono tabular-nums font-bold text-[#9A7426] dark:text-[#E5C158] focus:border-[#C9A24A] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleToggleUnit}
          title="Switch between % (Tunch) and ‰ (Per 1000 Fineness)"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 transition cursor-pointer whitespace-nowrap"
        >
          {unit === 'PERCENT' ? '%' : '‰'}
        </button>
      </div>
    </div>
  );
};
