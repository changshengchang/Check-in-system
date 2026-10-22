import React, { useState } from 'react';
import {
  CombinedAttendeeView,
  EventInfo,
  RegisteredParticipant,
  CheckInRecord
} from '../types';
import { exportToExcel, exportToCsv } from '../utils/excel';
import { FileUploader } from './FileUploader';
import { PrintableView } from './PrintableView';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  Filter,
  CheckCircle,
  Eye,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
  Plus,
  LogOut,
  Lock,
  Hourglass
} from 'lucide-react';

interface DashboardProps {
  eventInfo: EventInfo;
  roster: RegisteredParticipant[];
  checkIns: CheckInRecord[];
  attendees: CombinedAttendeeView[];
  onImportRoster: (participants: RegisteredParticipant[], mode: 'replace' | 'append') => void;
  onAddRosterParticipant: (participant: RegisteredParticipant) => void;
  onDeleteRosterParticipant: (id: string) => void;
  onManualCheckIn: (attendee: CombinedAttendeeView) => void;
  onManualCheckOut: (attendeeId: string) => void;
  onRemoveCheckIn: (checkInId: string) => void;
  onResetAllCheckIns: () => void;
  onToggleHrVerify: (attendeeId: string) => void;
  onNavigateToCheckIn: () => void;
  onNavigateToCheckOut: () => void;
  onLogout?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  eventInfo,
  roster,
  checkIns,
  attendees,
  onImportRoster,
  onAddRosterParticipant,
  onDeleteRosterParticipant,
  onManualCheckIn,
  onManualCheckOut,
  onRemoveCheckIn,
  onResetAllCheckIns,
  onToggleHrVerify,
  onNavigateToCheckIn,
  onNavigateToCheckOut,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'checked_in' | 'not_checked_in' | 'walk_in' | 'checked_out' | 'hr_verified' | 'roster_upload'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [selectedSignature, setSelectedSignature] = useState<{ name: string; url: string; time?: string; title?: string } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [copiedMissing, setCopiedMissing] = useState(false);
  const [showAddAttendeeModal, setShowAddAttendeeModal] = useState(false);
  const [newAttendee, setNewAttendee] = useState({ name: '', title: '', department: '', phone: '' });

  // Calculate statistics
  const totalRosterCount = roster.length;
  const checkedInList = attendees.filter(a => a.status === 'CHECKED_IN');
  const notCheckedInList = attendees.filter(a => a.status === 'NOT_CHECKED_IN');
  const walkInList = attendees.filter(a => a.status === 'WALK_IN');
  const totalCheckedIn = checkedInList.length + walkInList.length;
  const checkedOutList = attendees.filter(a => a.checkOutTime);
  const hrVerifiedList = attendees.filter(a => a.hrVerified);

  const attendanceRate = totalRosterCount > 0 ? Math.round((checkedInList.length / totalRosterCount) * 100) : 0;

  // Extract unique departments for filter
  const departments = Array.from(
    new Set(attendees.map(a => a.department).filter((d): d is string => Boolean(d && d.trim())))
  );

  // Filter attendees list based on tab, search, and department
  const filteredAttendees = attendees.filter(attendee => {
    // Tab filter
    if (activeTab === 'checked_in' && attendee.status !== 'CHECKED_IN' && attendee.status !== 'WALK_IN') return false;
    if (activeTab === 'not_checked_in' && attendee.status !== 'NOT_CHECKED_IN') return false;
    if (activeTab === 'walk_in' && attendee.status !== 'WALK_IN') return false;
    if (activeTab === 'checked_out' && !attendee.checkOutTime) return false;
    if (activeTab === 'hr_verified' && !attendee.hrVerified) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = attendee.name.toLowerCase().includes(q);
      const matchTitle = attendee.title.toLowerCase().includes(q);
      const matchDept = attendee.department ? attendee.department.toLowerCase().includes(q) : false;
      if (!matchName && !matchTitle && !matchDept) return false;
    }

    // Department filter
    if (departmentFilter !== 'all' && attendee.department !== departmentFilter) {
      return false;
    }

    return true;
  });

  // Copy missing attendees list to clipboard for quick reminders
  const handleCopyMissing = () => {
    if (notCheckedInList.length === 0) return;
    const text = `【${eventInfo.title} - 未完成報到人員名單】\n` +
      notCheckedInList.map((a, i) => `${i + 1}. ${a.name} (${a.title}${a.department ? ` - ${a.department}` : ''})`).join('\n') +
      `\n共計 ${notCheckedInList.length} 位人員尚未報到，請儘速完成手續。`;
    navigator.clipboard.writeText(text);
    setCopiedMissing(true);
    setTimeout(() => setCopiedMissing(false), 2500);
  };

  const handleAddNewAttendeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttendee.name.trim()) return;
    onAddRosterParticipant({
      id: `manual-${Date.now()}`,
      name: newAttendee.name.trim(),
      title: newAttendee.title.trim() || '未填寫職稱',
      department: newAttendee.department.trim() || undefined,
      phone: newAttendee.phone.trim() || undefined,
      registeredAt: new Date().toISOString()
    });
    setNewAttendee({ name: '', title: '', department: '', phone: '' });
    setShowAddAttendeeModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              活動承辦人管理後台
            </span>
            <span className="text-xs text-slate-400">即時資料自動比對</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            報名名冊與報到比對概況
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            活動：{eventInfo.title} · 最後更新於 {new Date().toLocaleTimeString('zh-TW', { hour12: false })}
          </p>
        </div>

        {/* Global Download & Export Action Group */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportToExcel(attendees, eventInfo)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
            title="匯出包含姓名、職稱、報到時間與簽署狀態之 Excel 檔"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>下載 Excel 報表</span>
          </button>

          <button
            type="button"
            onClick={() => exportToCsv(attendees, eventInfo)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
            title="下載標準 UTF-8 CSV 檔"
          >
            <FileText className="w-4 h-4" />
            <span>下載 CSV 檔</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
            title="開啟含手寫電子簽章圖樣的正式列印/存為 PDF 簽到清冊"
          >
            <Printer className="w-4 h-4" />
            <span>列印簽章名冊 / PDF</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToCheckIn}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>前往學員簽到端</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToCheckOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>前往學員簽退端</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              title="離開並鎖定承辦人後台，需重新輸入密碼方可存取"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>鎖定後台</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Expected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">名冊應到人數</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalRosterCount}</span>
            <span className="text-xs text-slate-500">位已預先報名</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            名冊資料來源：Excel / CSV 上傳
          </div>
        </div>

        {/* Card 2: Checked In */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs bg-gradient-to-br from-white to-blue-50/40">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-900">
              已完成報到 (實到)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">{totalCheckedIn}</span>
            <span className="text-xs font-bold text-blue-700">({attendanceRate}%)</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(attendanceRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Not Checked In */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
              未完成報到 (缺席)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600">
              {notCheckedInList.length}
            </span>
            <span className="text-xs text-slate-500">位待簽到</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">尚餘 {100 - attendanceRate}% 未報到</span>
            {notCheckedInList.length > 0 && (
              <button
                type="button"
                onClick={handleCopyMissing}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                {copiedMissing ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedMissing ? '已複製名單' : '一鍵複製催報名單'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 4: Walk-ins */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              現場追加報到
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{walkInList.length}</span>
            <span className="text-xs text-slate-500">位臨時追加</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            不在預先名冊中之現場新增簽署
          </div>
        </div>
      </div>

      {/* Main Tabbed Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 px-4 sm:px-6 pt-3 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2 overflow-x-auto pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>全部人員資料</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {attendees.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('checked_in')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'checked_in'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>已完成報到</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'checked_in' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 font-bold'}`}>
                {totalCheckedIn}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('not_checked_in')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'not_checked_in'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>未完成報到</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'not_checked_in' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-700 font-bold'}`}>
                {notCheckedInList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('walk_in')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'walk_in'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>現場臨時追加</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'walk_in' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700 font-bold'}`}>
                {walkInList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('checked_out')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'checked_out'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Hourglass className="w-3.5 h-3.5 text-amber-600" />
              <span>已完成簽退</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'checked_out' ? 'bg-orange-700 text-white' : 'bg-orange-50 text-orange-700 font-bold'}`}>
                {checkedOutList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hr_verified')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'hr_verified'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>人事已覆核</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'hr_verified' ? 'bg-indigo-700 text-white' : 'bg-indigo-50 text-indigo-700 font-bold'}`}>
                {hrVerifiedList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('roster_upload')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'roster_upload'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>上傳與管理名冊 (Excel/CSV)</span>
            </button>
          </div>

          <div className="pb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddAttendeeModal(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>手動新增單筆學員</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Roster Upload Tab */}
        {activeTab === 'roster_upload' ? (
          <div className="p-6 space-y-6">
            <FileUploader onImport={onImportRoster} currentCount={roster.length} />

            {/* Current Roster Quick Management */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    目前預先報名名冊清單 ({roster.length} 人)
                  </h4>
                  <p className="text-xs text-slate-500">
                    可個別刪除錯誤名單，或透過上方 Excel/CSV 上傳替換
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-96 overflow-y-auto divide-y divide-slate-100 text-xs">
                {roster.map((p, idx) => (
                  <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400 text-[11px] w-6">#{idx + 1}</span>
                      <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                      <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {p.title}
                      </span>
                      {p.department && (
                        <span className="text-slate-400 text-[11px]">
                          {p.department}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteRosterParticipant(p.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="從預先報名名冊移除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Attendance Comparison & Records Table */
          <div className="p-4 sm:p-6 space-y-4">
            {/* Search and Filter Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜尋人員姓名、職稱或部門..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs bg-slate-50 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Department Dropdown Filter */}
              {departments.length > 0 && (
                <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-500">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span>部門篩選：</span>
                  <select
                    value={departmentFilter}
                    onChange={e => setDepartmentFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">全部部門 ({attendees.length})</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Table of Attendees */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center">序號</th>
                      <th className="py-3 px-3">參加人員姓名</th>
                      <th className="py-3 px-3">職稱 (Job Title)</th>
                      <th className="py-3 px-3">部門/單位</th>
                      <th className="py-3 px-3 text-center">報到狀態</th>
                      <th className="py-3 px-3 text-center">報到時間</th>
                      <th className="py-3 px-3 text-center">簽退時間</th>
                      <th className="py-3 px-3 text-center">參加時間(計算)</th>
                      <th className="py-3 px-3 text-center">手寫簽名</th>
                      <th className="py-3 px-3 text-center">人事覆核</th>
                      <th className="py-3 px-3 text-center">承辦人操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttendees.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="text-sm">查無符合條件之人員資料</p>
                          <p className="text-xs text-slate-400 mt-0.5">請確認搜尋關鍵字或篩選設定</p>
                        </td>
                      </tr>
                    ) : (
                      filteredAttendees.map((attendee, idx) => {
                        const isChecked = attendee.status === 'CHECKED_IN' || attendee.status === 'WALK_IN';
                        return (
                          <tr key={attendee.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* # */}
                            <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            {/* Name */}
                            <td className="py-3 px-3 font-bold text-slate-900 text-sm">
                              <div className="flex items-center gap-1.5">
                                <span>{attendee.name}</span>
                                {attendee.isWalkIn && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                                    現場追加
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Title */}
                            <td className="py-3 px-3 text-slate-700">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                {attendee.title}
                              </span>
                            </td>

                            {/* Department */}
                            <td className="py-3 px-3 text-slate-500">
                              {attendee.department || '—'}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3 text-center">
                              {attendee.status === 'CHECKED_IN' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>已完成報到</span>
                                </span>
                              ) : attendee.status === 'WALK_IN' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <Sparkles className="w-3 h-3" />
                                  <span>現場追加報到</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <Clock className="w-3 h-3" />
                                  <span>未完成報到</span>
                                </span>
                              )}
                            </td>

                            {/* Sign-in Time */}
                            <td className="py-3 px-3 text-center font-mono text-slate-600 text-[11px]">
                              {attendee.checkInTime ? (
                                <div>
                                  <div>{new Date(attendee.checkInTime).toLocaleDateString('zh-TW')}</div>
                                  <div className="font-bold text-slate-800">
                                    {new Date(attendee.checkInTime).toLocaleTimeString('zh-TW', { hour12: false })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Sign-out Time */}
                            <td className="py-3 px-3 text-center font-mono text-slate-600 text-[11px]">
                              {attendee.checkOutTime ? (
                                <div>
                                  <div>{new Date(attendee.checkOutTime).toLocaleDateString('zh-TW')}</div>
                                  <div className="font-bold text-amber-700">
                                    {new Date(attendee.checkOutTime).toLocaleTimeString('zh-TW', { hour12: false })}
                                  </div>
                                </div>
                              ) : isChecked ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  待簽退
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Participation Duration */}
                            <td className="py-3 px-3 text-center">
                              {attendee.durationDisplay ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                                  <Hourglass className="w-3 h-3 text-indigo-500" />
                                  <span>{attendee.durationDisplay}</span>
                                </span>
                              ) : isChecked ? (
                                <span className="text-slate-400 italic text-[11px]">進行中</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Signatures (Sign-in & Sign-out) */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {attendee.signatureDataUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedSignature({
                                        name: `${attendee.name} (簽到)`,
                                        url: attendee.signatureDataUrl!,
                                        time: attendee.checkInTime,
                                        title: attendee.title
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer group"
                                    title="點擊放大檢視簽到簽名"
                                  >
                                    <span className="text-[10px] text-blue-600 font-semibold">簽到</span>
                                    <Eye className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                                  </button>
                                )}
                                {attendee.checkOutSignatureDataUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedSignature({
                                        name: `${attendee.name} (簽退)`,
                                        url: attendee.checkOutSignatureDataUrl!,
                                        time: attendee.checkOutTime,
                                        title: attendee.title
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50/50 hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer group"
                                    title="點擊放大檢視簽退簽名"
                                  >
                                    <span className="text-[10px] text-amber-700 font-semibold">簽退</span>
                                    <Eye className="w-3 h-3 text-amber-500 group-hover:text-amber-700" />
                                  </button>
                                )}
                                {!attendee.signatureDataUrl && !attendee.checkOutSignatureDataUrl && (
                                  <span className="text-slate-300 italic text-[11px]">無簽章</span>
                                )}
                              </div>
                            </td>

                            {/* HR Verification (人事覆核) */}
                            <td className="py-3 px-3 text-center">
                              {isChecked ? (
                                attendee.hrVerified ? (
                                  <button
                                    type="button"
                                    onClick={() => onToggleHrVerify(attendee.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer shadow-xs"
                                    title="人事已覆核確認學員參加。點擊可切換/取消覆核"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>已覆核</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onToggleHrVerify(attendee.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                                    title="人事人員點擊此處完成覆核確認"
                                  >
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>未覆核</span>
                                  </button>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onToggleHrVerify(attendee.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-slate-400 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 transition-colors cursor-pointer"
                                  title="學員尚未報到。若人事確認其在場，點擊可直接代辦報到並完成人事覆核"
                                >
                                  <span>未覆核</span>
                                </button>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-center">
                              {isChecked ? (
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  {!attendee.checkOutTime ? (
                                    <button
                                      type="button"
                                      onClick={() => onManualCheckOut(attendee.id)}
                                      className="text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                      title="學員離席，協助完成簽退並計算參加時間"
                                    >
                                      協助簽退
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      已簽退
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`確定要取消 ${attendee.name} 的報到紀錄嗎？`)) {
                                        // find the check-in record id
                                        const found = checkIns.find(c => c.participantId === attendee.id || c.id === attendee.id);
                                        if (found) onRemoveCheckIn(found.id);
                                      }
                                    }}
                                    className="text-[11px] text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="取消報到狀態"
                                  >
                                    取消報到
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onManualCheckIn(attendee)}
                                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                  title="承辦人確認到場，協助代為簽到"
                                >
                                  手動協助報到
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom summary bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 pt-2 gap-2">
              <div>
                顯示 {filteredAttendees.length} 筆（名冊應到 {totalRosterCount} 人 · 實到 {totalCheckedIn} 人 · 缺席 {notCheckedInList.length} 人）
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('確定要清空所有人員的報到簽名紀錄嗎？名冊人員資料將會保留。')) {
                      onResetAllCheckIns();
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>清空所有簽到紀錄</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Signature Large Viewer Modal */}
      {selectedSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden p-6">
            <div className="flex items-start justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedSignature.name} 的手寫簽署存根
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedSignature.title} · 報到時間：
                  {selectedSignature.time ? new Date(selectedSignature.time).toLocaleString('zh-TW', { hour12: false }) : '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSignature(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex justify-center items-center shadow-inner">
              <img
                src={selectedSignature.url}
                alt="簽名放大檢視"
                className="max-h-48 max-w-full object-contain"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSignature(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Attendee Modal */}
      {showAddAttendeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              手動新增預先報名學員
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              將此人員加入活動預先報名名冊中
            </p>

            <form onSubmit={handleAddNewAttendeeSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  姓名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newAttendee.name}
                  onChange={e => setNewAttendee({ ...newAttendee, name: e.target.value })}
                  placeholder="例：郭曉芬"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  職稱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newAttendee.title}
                  onChange={e => setNewAttendee({ ...newAttendee, title: e.target.value })}
                  placeholder="例：資深產品設計師"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  部門 / 單位 (選填)
                </label>
                <input
                  type="text"
                  value={newAttendee.department}
                  onChange={e => setNewAttendee({ ...newAttendee, department: e.target.value })}
                  placeholder="例：體驗設計處"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  聯絡電話 (選填)
                </label>
                <input
                  type="text"
                  value={newAttendee.phone}
                  onChange={e => setNewAttendee({ ...newAttendee, phone: e.target.value })}
                  placeholder="例：0912-345-678"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddAttendeeModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs"
                >
                  新增至名冊
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Sheet Modal */}
      {showPrintModal && (
        <PrintableView
          eventInfo={eventInfo}
          attendees={attendees}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
