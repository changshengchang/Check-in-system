import React from 'react';
import { EventInfo } from '../types';
import { Calendar, MapPin, UserCheck, LayoutDashboard, Clock, Sparkles, Lock, Unlock, LogOut, RefreshCw, Wifi } from 'lucide-react';

interface EventHeaderProps {
  eventInfo: EventInfo;
  onUpdateEventInfo: (updated: EventInfo) => void;
  activeMode: 'checkin' | 'checkout' | 'dashboard';
  onRequestSwitchMode: (mode: 'checkin' | 'checkout' | 'dashboard') => void;
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
  const percentage = totalExpectedCount > 0 ? Math.round((checkedInCount / totalExpectedCount) * 100) : 0;

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
                  苗栗縣三義鄉公所 · 簽到與簽退系統
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
                  {eventInfo.location || '三義鄉公所'}
                </span>
              </div>
            </div>

            {/* Right: Quick Stats & Navigation Mode Switcher */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Mini progress tracker */}
              <div className="hidden lg:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <div className="text-right">
                  <div className="text-slate-500">實到率</div>
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
                  <span>學員簽到端</span>
                </button>

                <button
                  type="button"
                  onClick={() => onRequestSwitchMode('checkout')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeMode === 'checkout'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span>學員簽退端</span>
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
    </>
  );
};
