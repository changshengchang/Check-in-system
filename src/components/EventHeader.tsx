import React, { useState } from 'react';
import { EventInfo } from '../types';
import { Calendar, MapPin, Edit3, UserCheck, LayoutDashboard, Clock, Save, X, Sparkles, Lock, Unlock, LogOut, RefreshCw, Wifi } from 'lucide-react';

interface EventHeaderProps {
  eventInfo: EventInfo;
  onUpdateEventInfo: (updated: EventInfo) => void;
  activeMode: 'checkin' | 'dashboard';
  onRequestSwitchMode: (mode: 'checkin' | 'dashboard') => void;
  isOrganizerAuthenticated: boolean;
  onOrganizerLogout: () => void;
  checkedInCount: number;
  totalExpectedCount: number;
  myDeviceId?: string;
  lastSyncInfo?: { time: string; device: string; action: string } | null;
}

export const EventHeader: React.FC<EventHeaderProps> = ({
  eventInfo,
  onUpdateEventInfo,
  activeMode,
  onRequestSwitchMode,
  isOrganizerAuthenticated,
  onOrganizerLogout,
  checkedInCount,
  totalExpectedCount,
  myDeviceId,
  lastSyncInfo
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<EventInfo>(eventInfo);

  const percentage = totalExpectedCount > 0 ? Math.round((checkedInCount / totalExpectedCount) * 100) : 0;

  const handleOpenEdit = () => {
    setFormData(eventInfo);
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onUpdateEventInfo(formData);
    setIsEditing(false);
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Left: Event Title & Meta with Edit button */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  員工訓練 / 活動報到系統
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="手機與電腦任何一方更新，系統皆會以最新時間為準自動同步">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>雙端最新資料自動同步</span>
                  {myDeviceId && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-medium">
                      本機: {myDeviceId}
                    </span>
                  )}
                </span>
                {lastSyncInfo && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    <span>最新更新：{lastSyncInfo.time} 來自 {lastSyncInfo.device}（{lastSyncInfo.action}）</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-2 py-0.5 rounded border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                  title="修改活動或訓練名稱與詳細資訊"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>編輯活動資訊</span>
                </button>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1 truncate">
                {eventInfo.title}
              </h1>

              {/* Sub-info chips */}
              <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {eventInfo.date || '今日'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {eventInfo.time || '全天'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {eventInfo.location || '實體研習教室'}
                </span>
              </div>
            </div>

            {/* Right: Quick Stats & Navigation Mode Switcher */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Mini progress tracker */}
              <div className="hidden lg:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <div className="text-right">
                  <div className="text-slate-500">即時報到率</div>
                  <div className="font-bold text-slate-800">
                    {checkedInCount} / {totalExpectedCount} 人 ({percentage}%)
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-blue-500 flex items-center justify-center font-bold text-blue-600 text-xs bg-blue-50">
                  {percentage}%
                </div>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => onRequestSwitchMode('checkin')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeMode === 'checkin'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>現場學員報到端</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRequestSwitchMode('dashboard')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeMode === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title={isOrganizerAuthenticated ? '已通過密碼驗證' : '需輸入密碼驗證存取'}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>承辦人管理後台</span>
                  {!isOrganizerAuthenticated ? (
                    <span className="bg-slate-200/80 text-slate-600 text-[10px] px-1.5 py-0.2 rounded flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>密碼</span>
                    </span>
                  ) : (
                    <span className="bg-emerald-500/20 text-emerald-200 text-[10px] px-1.5 py-0.2 rounded flex items-center gap-0.5">
                      <Unlock className="w-2.5 h-2.5 text-emerald-300" />
                      <span>已驗證</span>
                    </span>
                  )}
                </button>

                {/* Logout/Lock button when in dashboard */}
                {isOrganizerAuthenticated && activeMode === 'dashboard' && (
                  <button
                    type="button"
                    onClick={onOrganizerLogout}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                    title="鎖定並登出承辦人管理後台"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">鎖定/登出</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Edit Event Info Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>人工修正訓練及活動資訊</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  訓練或活動名稱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例如：2026年度關鍵人才核心職能培訓營"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    活動日期
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    活動時間
                  </label>
                  <input
                    type="text"
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    placeholder="09:00 - 17:00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  活動地點 / 教室
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  placeholder="例如：總部大樓 3F 國際會議廳"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  承辦單位 / 講師
                </label>
                <input
                  type="text"
                  value={formData.organizer}
                  onChange={e => setFormData({ ...formData, organizer: e.target.value })}
                  placeholder="例如：人力資源處培訓科"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  活動注意事項 / 簽到須知
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="學員簽到時可看到的補充提示..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>儲存修正</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
