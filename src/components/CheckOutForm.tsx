import React, { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckInRecord, EventInfo, CombinedAttendeeView } from '../types';
import { SignaturePad, SignaturePadHandle } from './SignaturePad';
import { calculateParticipationDuration } from '../utils/storage';
import {
  LogOut,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  Building,
  Hourglass,
  UserCheck
} from 'lucide-react';

interface CheckOutFormProps {
  eventInfo: EventInfo;
  attendees: CombinedAttendeeView[];
  existingCheckIns: CheckInRecord[];
  onCheckOutSuccess: (checkInId: string, checkOutTime: string, signatureDataUrl: string, durationMinutes: number, durationDisplay: string) => void;
  onNavigateToDashboard: () => void;
  onNavigateToCheckIn: () => void;
}

export const CheckOutForm: React.FC<CheckOutFormProps> = ({
  eventInfo,
  attendees,
  existingCheckIns,
  onCheckOutSuccess,
  onNavigateToDashboard,
  onNavigateToCheckIn
}) => {
  const [name, setName] = useState('');
  const [selectedAttendee, setSelectedAttendee] = useState<CombinedAttendeeView | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Success dialog state
  const [recentCheckedOut, setRecentCheckedOut] = useState<{
    name: string;
    title: string;
    department?: string;
    checkInTime: string;
    checkOutTime: string;
    durationDisplay: string;
    signatureDataUrl: string;
  } | null>(null);

  const signaturePadRef = useRef<SignaturePadHandle | null>(null);

  // Live timer tick for accurate duration preview
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter attendees eligible for check-out: must have checked in
  const checkedInAttendees = attendees.filter(
    a => a.status === 'CHECKED_IN' || a.status === 'WALK_IN'
  );

  // Attendees who checked in but haven't signed out yet
  const pendingCheckOutAttendees = checkedInAttendees.filter(a => !a.checkOutTime);

  // Search filtered suggestions among checked-in attendees
  const searchSuggestions = name.trim().length > 0
    ? checkedInAttendees.filter(p =>
        p.name.toLowerCase().includes(name.trim().toLowerCase()) ||
        p.title.toLowerCase().includes(name.trim().toLowerCase()) ||
        (p.department && p.department.toLowerCase().includes(name.trim().toLowerCase()))
      ).slice(0, 6)
    : [];

  const handleSelectAttendee = (a: CombinedAttendeeView) => {
    setName(a.name);
    setSelectedAttendee(a);
    setErrorMessage('');

    if (a.checkOutTime) {
      setErrorMessage(`提醒：${a.name} 已於 ${new Date(a.checkOutTime).toLocaleTimeString('zh-TW', { hour12: false })} 完成過簽退！若再次簽署將更新簽退時間與時數。`);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setErrorMessage('');

    const exact = checkedInAttendees.find(p => p.name.trim() === val.trim());
    if (exact) {
      setSelectedAttendee(exact);
      if (exact.checkOutTime) {
        setErrorMessage(`提醒：${exact.name} 已於先前完成過簽退。再次簽署將更新紀錄。`);
      }
    } else {
      if (selectedAttendee && selectedAttendee.name !== val) {
        setSelectedAttendee(null);
      }
    }
  };

  // Calculate live preview duration
  const liveDuration = selectedAttendee?.checkInTime
    ? calculateParticipationDuration(selectedAttendee.checkInTime, currentTime.toISOString())
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedAttendee) {
      setErrorMessage('請點選或搜尋已完成「簽到」的學員姓名！若尚未簽到，請先至「學員簽到端」完成簽到。');
      return;
    }

    if (!selectedAttendee.checkInTime) {
      setErrorMessage('此學員查無簽到時間紀錄，無法計算簽退時數！');
      return;
    }

    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setErrorMessage('請在下方簽署區完成手寫簽退簽名後再送出！');
      return;
    }

    const signatureDataUrl = signaturePadRef.current.getDataUrl();
    if (!signatureDataUrl) {
      setErrorMessage('簽名處理失敗，請重新簽名');
      return;
    }

    setIsSubmitting(true);

    const nowIso = new Date().toISOString();
    const duration = calculateParticipationDuration(selectedAttendee.checkInTime, nowIso);
    const durationMinutes = duration?.minutes || 1;
    const durationDisplay = duration?.display || '1分鐘';

    // Target check-in record id
    const targetCheckInId = selectedAttendee.checkInId || selectedAttendee.id;

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }

    onCheckOutSuccess(
      targetCheckInId,
      nowIso,
      signatureDataUrl,
      durationMinutes,
      durationDisplay
    );

    setRecentCheckedOut({
      name: selectedAttendee.name,
      title: selectedAttendee.title,
      department: selectedAttendee.department,
      checkInTime: selectedAttendee.checkInTime,
      checkOutTime: nowIso,
      durationDisplay,
      signatureDataUrl
    });

    setIsSubmitting(false);
  };

  const handleResetForNext = () => {
    setName('');
    setSelectedAttendee(null);
    setErrorMessage('');
    setRecentCheckedOut(null);
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      {/* Event Info Card Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-700 via-amber-800 to-orange-900 text-white p-6 mb-6 shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-amber-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>苗栗縣三義鄉公所 · 學員簽退與參加時數結算處</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {eventInfo.title}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-amber-100/90 pt-3 border-t border-amber-500/30">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-300 shrink-0" />
              <span>日期：{eventInfo.date || '今日'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-300 shrink-0" />
              <span>當前時間：{currentTime.toLocaleTimeString('zh-TW', { hour12: false })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="truncate">地點：{eventInfo.location || '研習教室'}</span>
            </div>
          </div>

          <div className="mt-3 bg-amber-950/60 rounded-lg p-2.5 text-xs text-amber-100 flex items-center justify-between gap-2 border border-amber-400/20">
            <div className="flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-300 shrink-0" />
              <span>簽退將由系統自動計算【參加時間 = 簽退時間 - 簽到時間】，並產製研習時數證明報表。</span>
            </div>
            <button
              type="button"
              onClick={onNavigateToCheckIn}
              className="text-amber-200 hover:text-white underline text-[11px] whitespace-nowrap cursor-pointer"
            >
              尚未簽到？切換至簽到端 →
            </button>
          </div>
        </div>

        {/* Decorative circle */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
      </div>

      {/* Main Check-Out Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <LogOut className="w-5 h-5 text-amber-600" />
              <span>學員簽退表單 (核算研習參加時間)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              請搜尋或點選您的姓名，確認簽到時間與累計參加時間後，於簽署區手寫簽名完成簽退
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500">已簽到人數：</span>
            <span className="font-bold text-slate-800 text-sm">{checkedInAttendees.length} 位</span>
            <span className="text-xs text-emerald-600 font-semibold ml-2">
              (已簽退：{checkedInAttendees.filter(a => a.checkOutTime).length} 人)
            </span>
          </div>
        </div>

        {/* Quick Click Chips: Attendees waiting to sign out */}
        {pendingCheckOutAttendees.length > 0 && (
          <div className="px-6 py-3.5 bg-amber-50/50 border-b border-amber-100/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-amber-700" />
                點選您的姓名進行簽退（已到場待簽退）：
              </span>
              <span className="text-[11px] text-amber-700 font-medium">共 {pendingCheckOutAttendees.length} 位</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingCheckOutAttendees.slice(0, 10).map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => handleSelectAttendee(p)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedAttendee?.id === p.id
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50'
                  }`}
                >
                  <span className="font-bold">{p.name}</span>
                  <span className="text-[11px] opacity-75">({p.title})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name input with auto-suggest among checked-in participants */}
          <div className="relative">
            <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>參加人員「姓名」</span>
                <span className="text-rose-500 font-bold">*必填</span>
              </span>
              {selectedAttendee && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已匹配簽到紀錄
                </span>
              )}
            </label>

            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="輸入姓名或點選上方名冊快速帶入 (例如: 王大偉)"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base font-semibold text-slate-900 bg-white shadow-xs"
              />
              {name && (
                <button
                  type="button"
                  onClick={() => {
                    setName('');
                    setSelectedAttendee(null);
                  }}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  清除
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {searchSuggestions.length > 0 && !selectedAttendee && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 bg-slate-50">
                  找到已簽到之學員，點擊即可進行簽退：
                </div>
                {searchSuggestions.map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => handleSelectAttendee(p)}
                    className="w-full text-left px-3.5 py-2 hover:bg-amber-50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                      <span className="ml-2 text-slate-500">{p.title}</span>
                      {p.department && <span className="ml-1 text-slate-400">· {p.department}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-mono">
                        簽到: {p.checkInTime ? new Date(p.checkInTime).toLocaleTimeString('zh-TW', { hour12: false }) : '—'}
                      </span>
                      {p.checkOutTime ? (
                        <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                          已簽退
                        </span>
                      ) : (
                        <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                          點選簽退
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Attendee Details & Participation Time Computation Display */}
          {selectedAttendee && (
            <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50/80 to-orange-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-base">{selectedAttendee.name}</span>
                  <span className="text-xs bg-white px-2 py-0.5 rounded border border-amber-300 text-slate-700 font-medium">
                    {selectedAttendee.title}
                  </span>
                  {selectedAttendee.department && (
                    <span className="text-xs text-slate-500">{selectedAttendee.department}</span>
                  )}
                </div>
                {selectedAttendee.hrVerified && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>人事已覆核</span>
                  </span>
                )}
              </div>

              {/* Time Calculation Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Check-In Time */}
                <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>簽到時間 (Check-in)</span>
                  </div>
                  <div className="text-base font-extrabold text-slate-800 font-mono mt-1">
                    {selectedAttendee.checkInTime
                      ? new Date(selectedAttendee.checkInTime).toLocaleTimeString('zh-TW', { hour12: false })
                      : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {selectedAttendee.checkInTime
                      ? new Date(selectedAttendee.checkInTime).toLocaleDateString('zh-TW')
                      : ''}
                  </div>
                </div>

                {/* 2. Check-Out Time */}
                <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <LogOut className="w-3.5 h-3.5 text-amber-600" />
                    <span>簽退時間 (Check-out)</span>
                  </div>
                  <div className="text-base font-extrabold text-amber-700 font-mono mt-1">
                    {currentTime.toLocaleTimeString('zh-TW', { hour12: false })}
                  </div>
                  <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                    即時系統簽退時間
                  </div>
                </div>

                {/* 3. Calculated Duration (簽退時間 - 簽到時間) */}
                <div className="bg-gradient-to-br from-amber-600 to-orange-600 text-white p-3 rounded-xl shadow-xs">
                  <div className="text-[11px] text-amber-100 font-medium flex items-center gap-1">
                    <Hourglass className="w-3.5 h-3.5 text-amber-200" />
                    <span>主動計算「參加時間」</span>
                  </div>
                  <div className="text-xl font-black text-white tracking-tight mt-1">
                    {liveDuration ? liveDuration.display : '計算中...'}
                  </div>
                  <div className="text-[10px] text-amber-100/90 mt-0.5">
                    {liveDuration ? `(共約 ${liveDuration.minutes} 分鐘)` : '簽退 - 簽到時間差'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Signature Pad for Check-Out */}
          <div className="pt-2">
            <SignaturePad ref={signaturePadRef} height={180} />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-base bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <LogOut className="w-5 h-5" />
              <span>確認送出並完成活動簽退 (結算參加時間)</span>
            </button>
          </div>
        </form>
      </div>

      {/* Check-Out Success Modal Confirmation Dialog */}
      {recentCheckedOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-center p-6 sm:p-8">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-amber-50">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              簽退手續完成！
            </h3>
            <p className="text-sm font-bold text-amber-700 mt-1.5">
              感謝您參加苗栗縣三義鄉公所培訓活動
            </p>

            {/* Check-out Details Card */}
            <div className="mt-5 p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-amber-200/80">
                <span className="text-slate-500">參加學員</span>
                <span className="font-bold text-slate-900 text-sm">{recentCheckedOut.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-amber-200/80">
                <span className="text-slate-500">職稱 / 單位</span>
                <span className="font-semibold text-slate-800">
                  {recentCheckedOut.title} {recentCheckedOut.department ? `(${recentCheckedOut.department})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-amber-200/80">
                <span className="text-slate-500">簽到時間</span>
                <span className="font-mono text-slate-700 font-bold">
                  {new Date(recentCheckedOut.checkInTime).toLocaleTimeString('zh-TW', { hour12: false })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-amber-200/80">
                <span className="text-slate-500">簽退時間</span>
                <span className="font-mono text-amber-800 font-bold">
                  {new Date(recentCheckedOut.checkOutTime).toLocaleTimeString('zh-TW', { hour12: false })}
                </span>
              </div>

              {/* Highlighted Participation Duration */}
              <div className="p-3 bg-white rounded-xl border border-amber-300 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                  <Hourglass className="w-4 h-4 text-amber-600" />
                  <span>核算總參加時間：</span>
                </div>
                <div className="text-lg font-black text-amber-700 font-mono">
                  {recentCheckedOut.durationDisplay}
                </div>
              </div>

              {/* Signature snapshot thumbnail */}
              {recentCheckedOut.signatureDataUrl && (
                <div className="pt-2">
                  <div className="text-[11px] text-slate-500 mb-1">數位手寫簽退存根：</div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 flex justify-center">
                    <img
                      src={recentCheckedOut.signatureDataUrl}
                      alt="手寫簽退簽名"
                      className="h-12 object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleResetForNext}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>下一位學員簽退</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetForNext();
                  onNavigateToDashboard();
                }}
                className="py-3 px-4 rounded-xl font-semibold text-xs text-slate-600 hover:bg-slate-100 transition-colors"
              >
                查看統計清冊
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
