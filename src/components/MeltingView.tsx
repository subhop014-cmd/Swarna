import React, { useState } from 'react';
import { Flame, Plus, Trash2 } from 'lucide-react';
import { GoldPurityCode, IndianLanguage, MeltingBatch } from '../types';
import { getUI } from '../i18n/uiTranslations';
import {
  calculateMeltingConversion,
  formatGrams,
  PURITY_STANDARDS,
} from '../utils/goldMath';
import { EditablePurityControl, isExactPresetFineness } from './EditablePurityControl';

interface MeltingViewProps {
  activeLanguage: IndianLanguage;
  meltingBatches?: MeltingBatch[];
  onSubmitBatch: (batch: any) => void;
}

export const MeltingView: React.FC<MeltingViewProps> = ({
  activeLanguage,
  meltingBatches = [],
  onSubmitBatch,
}) => {
  const ui = getUI(activeLanguage);

  const [inputs, setInputs] = useState<
    Array<{ weightGrams: number; fineness: number; purity: GoldPurityCode }>
  >([{ weightGrams: 0, fineness: PURITY_STANDARDS['22K'].fineness, purity: '22K' }]);

  const [outputGross, setOutputGross] = useState('');
  const [outputPurity, setOutputPurity] = useState<GoldPurityCode>('22K');
  const [outputFineness, setOutputFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);

  const [operatorName, setOperatorName] = useState('');
  const [notes, setNotes] = useState('');
  const [formMessage, setFormMessage] = useState<string>('');

  const outGrossNum = parseFloat(outputGross) || 0;
  const reconciliation = calculateMeltingConversion(
    inputs.map((i) => ({ weightGrams: i.weightGrams, fineness: i.fineness })),
    outGrossNum,
    outputFineness
  );

  const handleAddInput = () => {
    setInputs([
      ...inputs,
      { weightGrams: 0, fineness: PURITY_STANDARDS['22K'].fineness, purity: '22K' },
    ]);
  };

  const handleRemoveInput = (idx: number) => {
    if (inputs.length <= 1) return;
    setInputs(inputs.filter((_, i) => i !== idx));
  };

  const handleExecuteBatch = (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage('');

    const validInputs = inputs.filter((i) => i.weightGrams > 0);
    if (validInputs.length === 0 || outGrossNum <= 0) return;

    onSubmitBatch({
      sourceAccount: 'SCRAP_REFINING',
      inputs: validInputs,
      outputGrossGrams: outGrossNum,
      outputFineness,
      outputPurity,
      alloyAddedGrams: 0,
      operatorName: operatorName.trim() || 'Furnace Master',
      notes,
    });

    setInputs([{ weightGrams: 0, fineness: PURITY_STANDARDS['22K'].fineness, purity: '22K' }]);
    setOutputGross('');
    setNotes('');
    setFormMessage(
      `Recorded Melting Batch: ${formatGrams(outGrossNum)} (${(outputFineness / 10).toFixed(2)}%)`
    );
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {ui.meltingTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ui.meltingSubtitle}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          <span>{ui.meltingBatchesTitle}</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {meltingBatches.length} {ui.recordsCount}
          </span>
        </div>
      </div>

      {formMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3">
          <span className="font-mono tabular-nums">{formMessage}</span>
          <button
            type="button"
            onClick={() => setFormMessage('')}
            className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Batch Form */}
        <form
          onSubmit={handleExecuteBatch}
          className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {ui.newMeltingBatch}
            </h2>

            <button
              type="button"
              onClick={handleAddInput}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{ui.sourcePurity}</span>
            </button>
          </div>

          {/* Input Lots */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {inputs.map((inp, idx) => (
              <div
                key={idx}
                className="py-3 first:pt-0 last:pb-0 flex flex-wrap sm:flex-nowrap items-end gap-3 text-xs"
              >
                <div className="w-full sm:w-52 shrink-0">
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-medium mb-1">
                    {ui.sourcePurity}
                  </label>
                  <EditablePurityControl
                    variant="inline"
                    presets={['22K', '20K', '18K', '14K', '9K']}
                    purity={inp.purity}
                    fineness={inp.fineness}
                    onChange={(nextPurity, nextFineness) => {
                      const updated = [...inputs];
                      updated[idx] = {
                        ...updated[idx],
                        purity: nextPurity,
                        fineness: nextFineness,
                      };
                      setInputs(updated);
                    }}
                  />
                </div>

                <div className="flex-1 min-w-[110px]">
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-medium mb-1">
                    {ui.meltWeightGrams}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={inp.weightGrams || ''}
                    onChange={(e) => {
                      const updated = [...inputs];
                      updated[idx] = {
                        ...updated[idx],
                        weightGrams: parseFloat(e.target.value) || 0,
                      };
                      setInputs(updated);
                    }}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-[#C9A24A]"
                    placeholder="0.000"
                  />
                </div>

                <div className="w-24 text-right pb-2 shrink-0">
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                    {ui.fineWt}
                  </span>
                  <span className="font-mono tabular-nums text-xs text-[#9A7426] dark:text-[#E5C158] font-semibold">
                    {formatGrams((inp.weightGrams * inp.fineness) / 1000, 3)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveInput(idx)}
                  disabled={inputs.length <= 1}
                  className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30 p-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Target Output */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {ui.targetPurity}
              </label>
              <EditablePurityControl
                variant="inline"
                presets={['22K', '20K', '18K', '14K', '9K']}
                purity={outputPurity}
                fineness={outputFineness}
                onChange={(nextPurity, nextFineness) => {
                  setOutputPurity(nextPurity);
                  setOutputFineness(nextFineness);
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {ui.outputWeightGrams} *
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                required
                value={outputGross}
                onChange={(e) => setOutputGross(e.target.value)}
                placeholder="0.000"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-[#C9A24A]"
              />
            </div>
          </div>

          {/* Operator & Notes */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {ui.operatorRefiner}
              </label>
              <input
                type="text"
                placeholder="Furnace Master"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {ui.notes}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={ui.notes}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#B38F3B] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Flame className="w-4 h-4 text-[#C9A24A] dark:text-slate-950 shrink-0" />
            <span>{ui.recordMelting}</span>
          </button>
        </form>

        {/* Right: Fine Gold Summary + Recent Batches */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              {ui.fineLossGain}
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500 dark:text-slate-400">{ui.totalInputGross}</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {formatGrams(reconciliation.totalInputNetGrams.toNumber())}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500 dark:text-slate-400">{ui.totalInputFine}</span>
                <span className="font-mono tabular-nums font-semibold text-[#9A7426] dark:text-[#E5C158]">
                  {formatGrams(reconciliation.totalInputFineGrams.toNumber(), 3)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-500 dark:text-slate-400">{ui.totalOutputFine}</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatGrams(reconciliation.outputFineGrams.toNumber(), 3)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {ui.totalMeltingLoss}
                </span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    reconciliation.fineGoldLossGrams.toNumber() > 0.05
                      ? 'text-rose-700 dark:text-rose-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {formatGrams(reconciliation.fineGoldLossGrams.toNumber(), 3)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {ui.meltingBatchesTitle}
              </h3>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                {meltingBatches.length}
              </span>
            </div>

            {meltingBatches.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">
                {ui.noRecordsFound}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                {meltingBatches.slice(0, 12).map((b) => {
                  const outLabel =
                    b.outputPurity && b.outputFineness
                      ? isExactPresetFineness(b.outputPurity, b.outputFineness)
                        ? b.outputPurity
                        : `${(b.outputFineness / 10).toFixed(2)}%`
                      : b.outputPurity || '22K';

                  return (
                    <div key={b.id} className="py-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {b.batchNo}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                          {b.sentDate?.split('T')[0]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        <span>
                          {ui.goldInLabel}: {formatGrams(b.totalInputGrossGrams)}
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {ui.goldOutLabel}: {formatGrams(b.outputGrossGrams || 0)} ({outLabel})
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                        <span>{b.operatorOrRefiner}</span>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          Diff: {formatGrams(b.fineGoldLossOrGainGrams || 0, 3)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
