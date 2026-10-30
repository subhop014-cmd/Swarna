import React, { useState } from 'react';
import { Flame, Plus, Scale, Trash2, X } from 'lucide-react';
import { GoldPurityCode, IndianLanguage } from '../types';
import { getUI } from '../i18n/uiTranslations';
import {
  calculateMeltingConversion,
  formatGrams,
  PURITY_STANDARDS,
} from '../utils/goldMath';
import { EditablePurityControl } from './EditablePurityControl';

interface MeltingModalProps {
  isOpen: boolean;
  activeLanguage?: IndianLanguage;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const MeltingModal: React.FC<MeltingModalProps> = ({
  isOpen,
  activeLanguage = 'en',
  onClose,
  onSubmit,
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

  if (!isOpen) return null;

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validInputs = inputs.filter((i) => i.weightGrams > 0);
    if (validInputs.length === 0 || outGrossNum <= 0) return;

    onSubmit({
      sourceAccount: 'SCRAP_REFINING',
      inputs: validInputs,
      outputGrossGrams: outGrossNum,
      outputFineness,
      outputPurity,
      alloyAddedGrams: 0,
      operatorName: operatorName.trim() || 'Workshop Melter',
      notes,
    });

    setInputs([{ weightGrams: 0, fineness: PURITY_STANDARDS['22K'].fineness, purity: '22K' }]);
    setOutputGross('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl p-6 shadow-xl my-8 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FAF5E8] dark:bg-[#C9A24A]/15 text-[#C9A24A] flex items-center justify-center border border-[#C9A24A]/30">
              <Flame className="w-4 h-4 text-[#C9A24A]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-cinzel">
                {ui.meltingTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ui.meltingSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Input Lots */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>{ui.newMeltingBatch}</span>
              <button
                type="button"
                onClick={handleAddInput}
                className="text-[#9A7426] dark:text-[#E5C158] hover:underline flex items-center space-x-1 font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ {ui.sourcePurity}</span>
              </button>
            </div>

            <div className="space-y-2">
              {inputs.map((inp, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <div className="w-full sm:w-44 shrink-0">
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

                  <div className="flex-1 min-w-[100px]">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={inp.weightGrams || ''}
                      onChange={(e) => {
                        const updated = [...inputs];
                        updated[idx].weightGrams = parseFloat(e.target.value) || 0;
                        setInputs(updated);
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold focus:outline-none focus:border-[#C9A24A]"
                      placeholder="0.000 g"
                    />
                  </div>

                  <div className="w-24 text-right font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-400 shrink-0">
                    {formatGrams((inp.weightGrams * inp.fineness) / 1000, 3)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveInput(idx)}
                    disabled={inputs.length <= 1}
                    className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-rose-400 disabled:opacity-30 p-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Output Lot */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {ui.outputWeightGrams} *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.000"
                  value={outputGross}
                  onChange={(e) => setOutputGross(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums font-bold focus:outline-none focus:border-[#C9A24A]"
                />
              </div>
            </div>
          </div>

          {/* Conservation Reconciliation Box */}
          <div className="p-3.5 bg-[#FAF5E8] dark:bg-[#C9A24A]/10 rounded-lg border border-[#C9A24A]/30 text-xs space-y-1.5">
            <div className="font-bold text-[#9A7426] dark:text-[#E5C158] flex items-center justify-between">
              <span>{ui.fineLossGain}</span>
              <Scale className="w-3.5 h-3.5 text-[#C9A24A]" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300 font-mono tabular-nums text-[11px]">
              <div>
                {ui.totalInputGross}:{' '}
                <span className="text-slate-900 dark:text-slate-100 font-bold">
                  {formatGrams(reconciliation.totalInputNetGrams.toNumber())}
                </span>
              </div>
              <div>
                {ui.totalInputFine}:{' '}
                <span className="text-slate-900 dark:text-slate-100 font-bold">
                  {formatGrams(reconciliation.totalInputFineGrams.toNumber(), 3)}
                </span>
              </div>
              <div>
                {ui.totalOutputFine}:{' '}
                <span className="text-slate-900 dark:text-slate-100 font-bold">
                  {formatGrams(reconciliation.outputFineGrams.toNumber(), 3)}
                </span>
              </div>
              <div
                className={
                  reconciliation.fineGoldLossGrams.abs().toNumber() > 0.05
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-emerald-700 dark:text-emerald-400 font-bold'
                }
              >
                {ui.totalMeltingLoss}:{' '}
                {formatGrams(reconciliation.fineGoldLossGrams.toNumber(), 3)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {ui.operatorRefiner}
              </label>
              <input
                type="text"
                placeholder="Workshop Melter"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {ui.notes}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={ui.notes}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C9A24A]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              {ui.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#C9A24A] hover:bg-[#B38F3B] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition cursor-pointer whitespace-nowrap"
            >
              {ui.recordMelting}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
