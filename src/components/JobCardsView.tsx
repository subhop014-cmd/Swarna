import React, { useState } from 'react';
import {
  Plus,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { GoldPurityCode, IndianLanguage, JobCard, Staff, Tenant } from '../types';
import { getUI } from '../i18n/uiTranslations';
import { getPrinterStrings } from '../i18n/printerTranslations';
import {
  calculateFineGold,
  calculateWastageReconciliation,
  formatGrams,
  PURITY_STANDARDS,
} from '../utils/goldMath';
import { DEFAULT_PRINTER_SETTINGS, PrinterSettings } from '../utils/printerSettings';
import { PrintPreviewModal } from './PrintPreviewModal';
import { EditablePurityControl, isExactPresetFineness } from './EditablePurityControl';

interface JobCardsViewProps {
  jobCards: JobCard[];
  staff: Staff[];
  currentTenant?: Tenant | null;
  activeLanguage: IndianLanguage;
  showRupees?: boolean;
  printerSettings?: PrinterSettings;
  onUpdatePrinterSettings?: (next: PrinterSettings) => void;
  onNewJobCard: (card: any) => void;
  onReturnAndReconcile: (
    jobCardId: string,
    returnedGrossGrams: number,
    returnedNetGrams: number,
    returnedScrapGrams: number,
    qcRemarks: string
  ) => void;
}

export const JobCardsView: React.FC<JobCardsViewProps> = ({
  jobCards,
  staff,
  currentTenant = null,
  activeLanguage,
  showRupees = false,
  printerSettings = DEFAULT_PRINTER_SETTINGS,
  onUpdatePrinterSettings,
  onNewJobCard,
  onReturnAndReconcile,
}) => {
  const ui = getUI(activeLanguage);
  const printerT = getPrinterStrings(activeLanguage);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'COMPLETED'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reconcileJob, setReconcileJob] = useState<JobCard | null>(null);
  const [previewJob, setPreviewJob] = useState<JobCard | null>(null);

  // New Job Card Form
  const [jewelleryType, setJewelleryType] = useState('');
  const [designCode, setDesignCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedKarigarId, setSelectedKarigarId] = useState(staff[0]?.id || '');
  const [purity, setPurity] = useState<GoldPurityCode>('22K');
  const [fineness, setFineness] = useState<number>(PURITY_STANDARDS['22K'].fineness);
  const [issuedNetWeight, setIssuedNetWeight] = useState('');
  const [agreedWastage, setAgreedWastage] = useState('2.5');
  const [makingCharges, setMakingCharges] = useState('500');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');

  // Reconciliation form state
  const [returnedGross, setReturnedGross] = useState('');
  const [returnedNet, setReturnedNet] = useState('');
  const [returnedScrap, setReturnedScrap] = useState('0.500');
  const [qcRemarks, setQcRemarks] = useState('Hallmarked & checked');

  const today = new Date().toISOString().split('T')[0];

  const openJobs = jobCards.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const completedJobs = jobCards.filter((j) => j.status === 'COMPLETED');
  const activeGoldWithKarigars = openJobs.reduce((sum, j) => sum + (j.issuedNetWeightGrams || 0), 0);

  const filteredJobs = jobCards.filter((job) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      job.jobNo.toLowerCase().includes(q) ||
      job.jewelleryType.toLowerCase().includes(q) ||
      job.karigarName.toLowerCase().includes(q) ||
      (job.customerName && job.customerName.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'COMPLETED'
        ? job.status === 'COMPLETED'
        : job.status !== 'COMPLETED' && job.status !== 'CANCELLED';

    return matchesSearch && matchesStatus;
  });

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    const net = parseFloat(issuedNetWeight);
    if (isNaN(net) || net <= 0) return;

    const karigar = staff.find((s) => s.id === selectedKarigarId) || staff[0];
    const fineGold = calculateFineGold(net, fineness);

    onNewJobCard({
      branchId: 'main',
      orderReference: `ORD-${Date.now().toString().slice(-4)}`,
      customerName: customerName || undefined,
      jewelleryType,
      designCode: designCode || undefined,
      karigarId: karigar?.id || selectedKarigarId,
      karigarName: karigar ? karigar.name : 'Karigar',
      purity,
      fineness,
      issuedGrossWeightGrams: net,
      issuedNetWeightGrams: net,
      issuedFineGoldGrams: fineGold.toNumber(),
      agreedWastagePercent: parseFloat(agreedWastage) || 0,
      agreedMakingRateINR: showRupees ? parseFloat(makingCharges) || 0 : 0,
      dueDate,
      instructions: notes || undefined,
    });

    setShowCreateModal(false);
    setJewelleryType('');
    setDesignCode('');
    setCustomerName('');
    setIssuedNetWeight('');
    setNotes('');
  };

  const handleOpenReconcile = (job: JobCard) => {
    setReconcileJob(job);
    setReturnedNet((job.issuedNetWeightGrams * 0.97).toFixed(3));
    setReturnedGross((job.issuedNetWeightGrams * 0.99).toFixed(3));
    setReturnedScrap((job.issuedNetWeightGrams * 0.015).toFixed(3));
  };

  const liveWastageCalculation = reconcileJob
    ? calculateWastageReconciliation(
        reconcileJob.issuedNetWeightGrams,
        parseFloat(returnedNet) || 0,
        parseFloat(returnedScrap) || 0,
        reconcileJob.agreedWastagePercent
      )
    : null;

  const handleSubmitReconciliation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcileJob) return;

    onReturnAndReconcile(
      reconcileJob.id,
      parseFloat(returnedGross) || parseFloat(returnedNet),
      parseFloat(returnedNet) || 0,
      parseFloat(returnedScrap) || 0,
      qcRemarks
    );

    setReconcileJob(null);
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {ui.jobCardsTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ui.jobCardsSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!selectedKarigarId && staff[0]?.id) {
              setSelectedKarigarId(staff[0].id);
            }
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{ui.issueNewJobCard}</span>
        </button>
      </div>

      {/* Single-Elevation Summary Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.recordsCount}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {jobCards.length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.openJobs}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
            {openJobs.length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.goldWithKarigars}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158]">
            {formatGrams(activeGoldWithKarigars)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.completedJobs}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {completedJobs.length}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-full sm:w-auto">
          {(
            [
              { id: 'ALL', label: ui.all },
              { id: 'OPEN', label: ui.openJobs },
              { id: 'COMPLETED', label: ui.completedJobs },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`flex-1 sm:flex-initial px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === f.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Job Cards Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{ui.jobCardsTitle}</th>
                <th className="px-4 py-3">{ui.partyOrKarigar}</th>
                <th className="px-4 py-3">{ui.returnedOrnament}</th>
                <th className="px-4 py-3 text-center">{ui.purity}</th>
                <th className="px-4 py-3 text-right">{ui.issuedGold}</th>
                <th className="px-4 py-3 text-right">{ui.actualLoss}</th>
                <th className="px-4 py-3">{ui.date}</th>
                <th className="px-4 py-3">{ui.status}</th>
                <th className="px-4 py-3 text-right">{ui.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    {ui.noRecordsFound}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const isCompleted = job.status === 'COMPLETED';
                  const isOverdue = !isCompleted && job.dueDate && job.dueDate < today;

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-2.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {job.jobNo}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{job.karigarName}</div>
                        {job.customerName && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">{job.customerName}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{job.jewelleryType}</div>
                        {job.designCode && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{job.designCode}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {isExactPresetFineness(job.purity, job.fineness)
                          ? job.purity
                          : `${(job.fineness / 10).toFixed(2)}% (${job.purity})`}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatGrams(job.issuedNetWeightGrams)}
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                          Allow {job.agreedWastagePercent}%
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {job.isReconciled ? (
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {formatGrams(job.returnedJewelleryNetWeight || 0)}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              Loss: {formatGrams(job.actualLossGrams || 0)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums whitespace-nowrap">
                        <span className={isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-600 dark:text-slate-400'}>
                          {job.dueDate || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            isCompleted
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : isOverdue
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {isCompleted ? ui.completedJobs : isOverdue ? 'Overdue' : ui.openJobs}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewJob(job)}
                            title={printerT.printPreviewTitle}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                            <span>{printerT.printPreviewTitle}</span>
                          </button>
                          {!isCompleted ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReconcile(job)}
                              className="px-3 py-1.5 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              {ui.reconcileReturn}
                            </button>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] px-1">Settled</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Job Card Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-xl my-8 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{ui.issueNewJobCard}</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.partyOrKarigar} *
                </label>
                <select
                  value={selectedKarigarId}
                  onChange={(e) => setSelectedKarigarId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) · {formatGrams(s.currentGoldHoldingGrams)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.returnedOrnament} *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['Necklace', 'Bangles', 'Ring', 'Chain', 'Earrings', 'Kada'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setJewelleryType(item)}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                        jewelleryType === item
                          ? 'bg-slate-900 dark:bg-[#C9A24A] text-white dark:text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={jewelleryType}
                  onChange={(e) => setJewelleryType(e.target.value)}
                  placeholder="Ornament name (e.g. 22K Necklace)"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.purity}
                  </label>
                  <EditablePurityControl
                    variant="inline"
                    purity={purity}
                    fineness={fineness}
                    onChange={(nextPurity, nextFineness) => {
                      setPurity(nextPurity);
                      setFineness(nextFineness);
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.issuedGold} (g) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={issuedNetWeight}
                    onChange={(e) => setIssuedNetWeight(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.agreedWastage} (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={agreedWastage}
                    onChange={(e) => setAgreedWastage(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
              </div>

              {showRupees && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.makingCharges} (₹/g)
                  </label>
                  <input
                    type="number"
                    value={makingCharges}
                    onChange={(e) => setMakingCharges(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.notes}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={ui.notes}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                >
                  {ui.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  {ui.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive & Reconcile Return Modal */}
      {reconcileJob && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-xl my-8 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{ui.reconcileReturn}</h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {reconcileJob.jobNo} · {reconcileJob.karigarName} · {formatGrams(reconcileJob.issuedNetWeightGrams)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReconcileJob(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReconciliation} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Finished Net Wt (g) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={returnedNet}
                    onChange={(e) => setReturnedNet(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums font-semibold focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Finished Gross Wt (g)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={returnedGross}
                    onChange={(e) => setReturnedGross(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Scrap / Dust Returned (g) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={returnedScrap}
                  onChange={(e) => setReturnedScrap(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              {liveWastageCalculation && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs font-mono tabular-nums">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Accounted Gold:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatGrams(liveWastageCalculation.totalAccountedWeight.toNumber())}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Actual Loss:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatGrams(liveWastageCalculation.actualLoss.toNumber())}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Allowed ({reconcileJob.agreedWastagePercent}%):</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatGrams(liveWastageCalculation.allowedWastage.toNumber())}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-sans text-slate-600 dark:text-slate-400">Audit Status:</span>
                    <span
                      className={`font-sans font-semibold ${
                        liveWastageCalculation.isExcessLoss ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {liveWastageCalculation.isExcessLoss
                        ? `Excess Loss (${formatGrams(liveWastageCalculation.excessLoss.toNumber())})`
                        : 'Within Allowance'}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.notes}
                </label>
                <input
                  type="text"
                  value={qcRemarks}
                  onChange={(e) => setQcRemarks(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReconcileJob(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                >
                  {ui.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  {ui.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Karigar Challan Print Preview Modal */}
      <PrintPreviewModal
        isOpen={Boolean(previewJob)}
        onClose={() => setPreviewJob(null)}
        docType="JOB_CARD_CHALLAN"
        data={previewJob}
        tenant={currentTenant}
        activeLanguage={activeLanguage}
        showRupees={showRupees}
        printerSettings={printerSettings}
        onUpdatePrinterSettings={onUpdatePrinterSettings}
      />
    </div>
  );
};
