import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { GoldPurityCode, IndianLanguage, JobCard, Staff, UserRole } from '../types';
import { getUI } from '../i18n/uiTranslations';
import { getIndividualReportUI } from '../i18n/individualReportTranslations';
import { formatGrams, formatINR, PURITY_STANDARDS } from '../utils/goldMath';

interface StaffViewProps {
  staffList: Staff[];
  jobCards?: JobCard[];
  activeLanguage: IndianLanguage;
  showRupees?: boolean;
  onAddStaff: (staff: any) => void;
  onIssueGoldToKarigar?: (job: any) => Promise<void>;
  onPayKarigarAdvance?: (staffId: string, amountINR: number, notes?: string) => Promise<void>;
  onOpenKarigarReport?: (karigarId: string) => void;
}

function formatRoleLabel(role?: string): string {
  switch (role) {
    case 'KARIGAR':
      return 'Karigar';
    case 'PRODUCTION_MANAGER':
      return 'Supervisor';
    case 'INVENTORY_MANAGER':
      return 'Vault Manager';
    default:
      if (!role) return 'Karigar';
      return role
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
}

export const StaffView: React.FC<StaffViewProps> = ({
  staffList,
  jobCards = [],
  activeLanguage,
  showRupees = false,
  onAddStaff,
  onIssueGoldToKarigar,
  onPayKarigarAdvance,
  onOpenKarigarReport,
}) => {
  const ui = getUI(activeLanguage);
  const ir = getIndividualReportUI(activeLanguage);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedKarigar, setSelectedKarigar] = useState<Staff | null>(null);
  const [modalTab, setModalTab] = useState<'JOBS' | 'ISSUE_GOLD' | 'ADVANCE'>('JOBS');

  // New staff form state
  const [name, setName] = useState('');
  const [regionalName, setRegionalName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('KARIGAR');
  const [skillCategory, setSkillCategory] = useState('Antique Jewellery & Filigree');
  const [baseSalary, setBaseSalary] = useState('');

  // Quick Issue Gold Form state
  const [issueJewelleryType, setIssueJewelleryType] = useState('22K Bangles');
  const [issuePurity, setIssuePurity] = useState<GoldPurityCode>('22K');
  const [issueWeight, setIssueWeight] = useState('25.000');
  const [issueWastage, setIssueWastage] = useState('2.5');
  const [issueLabourRate, setIssueLabourRate] = useState('450');
  const [issueDueDate, setIssueDueDate] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [issueNotes, setIssueNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Advance Payment Form state
  const [advanceAmount, setAdvanceAmount] = useState('2000');
  const [advanceNote, setAdvanceNote] = useState('Weekly wage advance');

  const filteredStaff = staffList.filter((s) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.regionalName && s.regionalName.toLowerCase().includes(q)) ||
      s.phone.includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.skillCategory && s.skillCategory.toLowerCase().includes(q))
    );
  });

  const totalGoldHeld = staffList.reduce((sum, s) => sum + (s.currentGoldHoldingGrams || 0), 0);
  const totalOpenJobs = staffList.reduce((sum, s) => sum + (s.activeJobsCount || 0), 0);

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    onAddStaff({
      name,
      regionalName: regionalName || undefined,
      phone,
      role,
      skillCategory,
      baseSalaryINR: baseSalary ? parseFloat(baseSalary) : undefined,
      currentGoldHoldingGrams: 0,
      activeJobsCount: 0,
      completedJobsCount: 0,
      unreconciledLossGrams: 0,
      advanceBalanceINR: 0,
      joiningDate: new Date().toISOString().split('T')[0],
      status: 'ACTIVE',
    });

    setShowAddModal(false);
    setName('');
    setRegionalName('');
    setPhone('');
    setBaseSalary('');
  };

  const handleQuickIssueGold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKarigar || !onIssueGoldToKarigar) return;
    const w = parseFloat(issueWeight) || 0;
    if (w <= 0) return;

    setIsSubmitting(true);
    try {
      await onIssueGoldToKarigar({
        branchId: selectedKarigar.branchId || 'main',
        karigarId: selectedKarigar.id,
        karigarName: selectedKarigar.name,
        jewelleryType: issueJewelleryType,
        purity: issuePurity,
        fineness: PURITY_STANDARDS[issuePurity]?.fineness || 916.0,
        issuedGrossWeightGrams: w,
        issuedNetWeightGrams: w,
        agreedWastagePercent: parseFloat(issueWastage) || 2.5,
        labourRatePerGram: showRupees ? parseFloat(issueLabourRate) || 450 : 0,
        labourTotalINR: showRupees ? w * (parseFloat(issueLabourRate) || 450) : 0,
        dueDate: issueDueDate,
        instructions: issueNotes || `Issued gold to ${selectedKarigar.name} for ${issueJewelleryType}`,
      });
      setModalTab('JOBS');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickPayAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKarigar || !onPayKarigarAdvance) return;
    const amt = parseFloat(advanceAmount) || 0;
    if (amt <= 0) return;

    setIsSubmitting(true);
    try {
      await onPayKarigarAdvance(selectedKarigar.id, amt, advanceNote);
      setModalTab('JOBS');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const karigarJobs = selectedKarigar
    ? jobCards.filter((j) => j.karigarId === selectedKarigar.id || j.karigarName === selectedKarigar.name)
    : [];

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {ui.staffTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ui.staffSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{ui.addKarigarStaff}</span>
        </button>
      </div>

      {/* Single-Elevation Summary Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.recordsCount}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {staffList.length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.goldWithKarigars}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#9A7426] dark:text-[#E5C158]">
            {formatGrams(totalGoldHeld)}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">{ui.openJobs}</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {totalOpenJobs}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Scannable Karigars Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{ui.partyOrKarigar}</th>
                <th className="px-4 py-3">{ui.phoneNo}</th>
                <th className="px-4 py-3 text-right">{ui.goldInHand}</th>
                <th className="px-4 py-3 text-center">{ui.openJobs}</th>
                <th className="px-4 py-3 text-right">{ui.actualLoss}</th>
                {showRupees && (
                  <th className="px-4 py-3 text-right">{ui.cashAdvanceBalance}</th>
                )}
                <th className="px-4 py-3 text-right">{ui.action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={showRupees ? 7 : 6} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500">
                    {ui.noRecordsFound}
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{staff.name}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono">{staff.code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRoleLabel(staff.role)}</span>
                        {staff.skillCategory && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate max-w-[160px]">{staff.skillCategory}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {staff.phone}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-[#9A7426] dark:text-[#E5C158] whitespace-nowrap">
                      {formatGrams(staff.currentGoldHoldingGrams)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{staff.activeJobsCount}</span>
                      <span className="text-slate-400 dark:text-slate-500"> / {staff.completedJobsCount}</span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        (staff.unreconciledLossGrams || 0) > 0.5
                          ? 'text-rose-700 dark:text-rose-400 font-semibold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {formatGrams(staff.unreconciledLossGrams || 0)}
                    </td>
                    {showRupees && (
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {formatINR(staff.advanceBalanceINR || 0)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedKarigar(staff);
                            setModalTab('ISSUE_GOLD');
                          }}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {ui.posKarigarGiveTitle}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedKarigar(staff);
                            setModalTab('JOBS');
                          }}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {ui.openJobs}
                        </button>
                        {onOpenKarigarReport && (
                          <button
                            type="button"
                            onClick={() => onOpenKarigarReport(staff.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{ir.viewIndividualReport}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Karigar Details, Issue Gold & Advance Modal */}
      {selectedKarigar && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-xl space-y-5 my-8 text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{selectedKarigar.name}</h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono">{selectedKarigar.code}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{selectedKarigar.phone}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {ui.goldInHand}: <strong className="text-[#9A7426] dark:text-[#E5C158] font-mono">{formatGrams(selectedKarigar.currentGoldHoldingGrams)}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKarigar(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clean Underline Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setModalTab('JOBS')}
                className={`pb-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  modalTab === 'JOBS'
                    ? 'border-slate-900 text-slate-900 dark:text-slate-100 font-semibold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {ui.openJobs} ({karigarJobs.length})
              </button>
              <button
                type="button"
                onClick={() => setModalTab('ISSUE_GOLD')}
                className={`pb-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  modalTab === 'ISSUE_GOLD'
                    ? 'border-slate-900 text-slate-900 dark:text-slate-100 font-semibold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {ui.posKarigarGiveTitle}
              </button>
              {showRupees && (
                <button
                  type="button"
                  onClick={() => setModalTab('ADVANCE')}
                  className={`pb-2.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    modalTab === 'ADVANCE'
                      ? 'border-slate-900 text-slate-900 dark:text-slate-100 font-semibold'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {ui.cashAdvanceBalance}
                </button>
              )}
            </div>

            {/* Tab 1: Work Orders */}
            {modalTab === 'JOBS' && (
              <div>
                {karigarJobs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                    {ui.noRecordsFound}
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setModalTab('ISSUE_GOLD')}
                        className="text-slate-900 dark:text-slate-100 font-semibold underline cursor-pointer"
                      >
                        {ui.posKarigarGiveTitle}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {karigarJobs.map((job) => (
                      <div key={job.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {job.jewelleryType}{' '}
                            <span className="font-mono font-normal text-slate-400 dark:text-slate-500 ml-1">
                              {job.jobNo}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                            {formatGrams(job.issuedNetWeightGrams)} ({job.purity}) · Allow {job.agreedWastagePercent}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`font-semibold ${
                              job.status === 'COMPLETED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {job.status === 'COMPLETED' ? ui.completedJobs : ui.openJobs}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tabular-nums mt-0.5">
                            {job.dueDate || '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Issue Gold */}
            {modalTab === 'ISSUE_GOLD' && (
              <form onSubmit={handleQuickIssueGold} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                    {ui.returnedOrnament} *
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['Necklace', 'Bangles', 'Ring', 'Chain', 'Earrings', 'Kada'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setIssueJewelleryType(item)}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                          issueJewelleryType === item
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
                    value={issueJewelleryType}
                    onChange={(e) => setIssueJewelleryType(e.target.value)}
                    placeholder="Ornament type"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      {ui.purity}
                    </label>
                    <select
                      value={issuePurity}
                      onChange={(e) => setIssuePurity(e.target.value as GoldPurityCode)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                    >
                      <option value="22K">22K (916)</option>
                      <option value="24K">24K (999.9)</option>
                      <option value="20K">20K (833)</option>
                      <option value="18K">18K (750)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      {ui.issuedGold} (g) *
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={issueWeight}
                      onChange={(e) => setIssueWeight(e.target.value)}
                      placeholder="0.000"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      {ui.agreedWastage} (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={issueWastage}
                      onChange={(e) => setIssueWastage(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={issueDueDate}
                      onChange={(e) => setIssueDueDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                    />
                  </div>
                </div>

                {showRupees && (
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      {ui.makingCharges} (₹/g)
                    </label>
                    <input
                      type="number"
                      value={issueLabourRate}
                      onChange={(e) => setIssueLabourRate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    {ui.notes}
                  </label>
                  <input
                    type="text"
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                    placeholder={ui.notes}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTab('JOBS')}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    {ui.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? '...' : ui.save}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 3: Pay Advance */}
            {modalTab === 'ADVANCE' && (
              <form onSubmit={handleQuickPayAdvance} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    {ui.amountInr} *
                  </label>
                  <input
                    type="number"
                    step="50"
                    required
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    {ui.notes}
                  </label>
                  <input
                    type="text"
                    value={advanceNote}
                    onChange={(e) => setAdvanceNote(e.target.value)}
                    placeholder={ui.notes}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTab('JOBS')}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    {ui.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-slate-900 dark:bg-[#C9A24A] hover:bg-slate-800 dark:hover:bg-[#E5C158] text-white dark:text-slate-950 font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? '...' : ui.save}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Karigar / Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{ui.addKarigarStaff}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.partyOrKarigar} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Shanmugam Achari"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {ui.activeLanguageLabel}
                </label>
                <input
                  type="text"
                  value={regionalName}
                  onChange={(e) => setRegionalName(e.target.value)}
                  placeholder="षन्मुगम आचारी"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {ui.phoneNo} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98410 55432"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono tabular-nums focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                  >
                    <option value="KARIGAR">Karigar</option>
                    <option value="PRODUCTION_MANAGER">Supervisor</option>
                    <option value="INVENTORY_MANAGER">Vault Manager</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Specialization
                </label>
                <input
                  type="text"
                  value={skillCategory}
                  onChange={(e) => setSkillCategory(e.target.value)}
                  placeholder="Filigree, Casting, Stone Setting"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-[#E5C158]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
    </div>
  );
};
