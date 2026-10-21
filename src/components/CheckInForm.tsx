import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { CheckInRecord, EventInfo, RegisteredParticipant } from '../types';
import { SignaturePad, SignaturePadHandle } from './SignaturePad';
import {
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  UserPlus,
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  Building
} from 'lucide-react';

interface CheckInFormProps {
  eventInfo: EventInfo;
  roster: RegisteredParticipant[];
  existingCheckIns: CheckInRecord[];
  onCheckInSuccess: (record: CheckInRecord) => void;
  onNavigateToDashboard: () => void;
}

export const CheckInForm: React.FC<CheckInFormProps> = ({
  eventInfo,
  roster,
  existingCheckIns,
  onCheckInSuccess,
  onNavigateToDashboard
}) => {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [matchedParticipant, setMatchedParticipant] = useState<RegisteredParticipant | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success dialog state
  const [recentCheckedIn, setRecentCheckedIn] = useState<CheckInRecord | null>(null);

  const signaturePadRef = useRef<SignaturePadHandle | null>(null);

  // Already checked in IDs/names
  const checkedInIds = new Set(existingCheckIns.map(c => c.participantId).filter(Boolean));
  const checkedInNames = new Set(existingCheckIns.map(c => c.name.trim().toLowerCase()));

  // Search filtered suggestions from roster
  const searchSuggestions = name.trim().length > 0
    ? roster.filter(p =>
        p.name.toLowerCase().includes(name.trim().toLowerCase()) ||
        p.title.toLowerCase().includes(name.trim().toLowerCase()) ||
        (p.department && p.department.toLowerCase().includes(name.trim().toLowerCase()))
      ).slice(0, 5)
    : [];

  // When selecting an attendee from the pre-registered list
  const handleSelectParticipant = (p: RegisteredParticipant) => {
    setName(p.name);
    setTitle(p.title);
    setDepartment(p.department || '');
    setMatchedParticipant(p);
    setIsWalkIn(false);
    setErrorMessage('');

    // Check if already checked in
    if (checkedInIds.has(p.id) || checkedInNames.has(p.name.trim().toLowerCase())) {
      setErrorMessage(`提醒：${p.name} 似乎已完成過報到！若要重新簽署將會更新原報到紀錄。`);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setErrorMessage('');

    // Try auto-match exact name
    const exact = roster.find(p => p.name.trim() === val.trim());
    if (exact) {
      setMatchedParticipant(exact);
      setTitle(exact.title);
      setDepartment(exact.department || '');
      setIsWalkIn(false);

      if (checkedInIds.has(exact.id) || checkedInNames.has(exact.name.trim().toLowerCase())) {
        setErrorMessage(`提醒：${exact.name} 似乎已於先前完成報到。`);
      }
    } else {
      if (matchedParticipant && matchedParticipant.name !== val) {
        setMatchedParticipant(null);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('請輸入參加人員「姓名」');
      return;
    }

    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setErrorMessage('請在下方簽署區完成手寫簽名後再送出！');
      return;
    }

    const signatureDataUrl = signaturePadRef.current.getDataUrl();
    if (!signatureDataUrl) {
      setErrorMessage('簽名處理失敗，請重新簽名');
      return;
    }

    setIsSubmitting(true);

    const now = new Date();
    const newRecord: CheckInRecord = {
      id: `checkin-${now.getTime()}-${Math.random().toString(36).substring(2, 7)}`,
      participantId: matchedParticipant ? matchedParticipant.id : undefined,
      name: trimmedName,
      title: title.trim() || (matchedParticipant ? matchedParticipant.title : (isWalkIn ? '現場報名人員' : '學員')),
      department: department.trim() || matchedParticipant?.department || undefined,
      checkInTime: now.toISOString(),
      signatureDataUrl,
      isWalkIn: !matchedParticipant,
      notes: notes.trim() || undefined
    };

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // ignore
    }

    onCheckInSuccess(newRecord);
    setRecentCheckedIn(newRecord);
    setIsSubmitting(false);
  };

  const handleResetForNext = () => {
    setName('');
    setTitle('');
    setDepartment('');
    setNotes('');
    setMatchedParticipant(null);
    setIsWalkIn(false);
    setErrorMessage('');
    setRecentCheckedIn(null);
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  // Quick list of attendees waiting to check in (max 6 for easy tap)
  const pendingAttendees = roster.filter(
    p => !checkedInIds.has(p.id) && !checkedInNames.has(p.name.trim().toLowerCase())
  ).slice(0, 8);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      {/* Event Info Card Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-6 mb-6 shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>員工訓練與活動現場報到處</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {eventInfo.title}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-100/90 pt-3 border-t border-blue-500/30">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-300 shrink-0" />
              <span>日期：{eventInfo.date || '今日'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-300 shrink-0" />
              <span>時間：{eventInfo.time || '研習時間'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-300 shrink-0" />
              <span className="truncate">地點：{eventInfo.location || '研習教室'}</span>
            </div>
          </div>

          {eventInfo.notes && (
            <div className="mt-3 bg-blue-900/50 rounded-lg p-2.5 text-xs text-blue-100 flex items-center gap-2 border border-blue-400/20">
              <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{eventInfo.notes}</span>
            </div>
          )}
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
      </div>

      {/* Main Check-In Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span>學員簽到報名表單</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              請輸入或點選姓名，確認身分與職稱後，於手寫簽署區完成手寫簽名
            </p>
          </div>

          {/* Quick toggle for walk-in */}
          <button
            type="button"
            onClick={() => {
              setIsWalkIn(!isWalkIn);
              if (!isWalkIn) {
                setMatchedParticipant(null);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isWalkIn
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isWalkIn ? '✓ 現場臨時追加模式' : '+ 現場臨時報到 (未在名冊中)'}</span>
          </button>
        </div>

        {/* Quick Click Roster Chips for faster sign-in */}
        {pendingAttendees.length > 0 && !isWalkIn && (
          <div className="px-6 py-3.5 bg-blue-50/50 border-b border-blue-100/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                快速點選您的姓名簽到（待報到名單）：
              </span>
              <span className="text-[11px] text-blue-600">共 {pendingAttendees.length} 位</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingAttendees.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => handleSelectParticipant(p)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    matchedParticipant?.id === p.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/80'
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
          {/* Form Row: Name with smart auto-suggest */}
          <div className="relative">
            <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>參加人員「姓名」</span>
                <span className="text-rose-500 font-bold">*必填</span>
              </span>
              {matchedParticipant && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已自動比對預先報名名冊
                </span>
              )}
            </label>

            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="請輸入您的真實姓名 (例: 王大偉)"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold text-slate-900 bg-white shadow-xs"
              />
              {name && (
                <button
                  type="button"
                  onClick={() => {
                    setName('');
                    setMatchedParticipant(null);
                  }}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  清除
                </button>
              )}
            </div>

            {/* Autocomplete dropdown */}
            {searchSuggestions.length > 0 && !matchedParticipant && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 bg-slate-50">
                  找到名冊中符合的學員，點擊即可帶入資料：
                </div>
                {searchSuggestions.map(p => {
                  const alreadyDone = checkedInIds.has(p.id) || checkedInNames.has(p.name.trim().toLowerCase());
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => handleSelectParticipant(p)}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                        <span className="ml-2 text-slate-500">{p.title}</span>
                        {p.department && <span className="ml-1 text-slate-400">· {p.department}</span>}
                      </div>
                      {alreadyDone ? (
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          已報到
                        </span>
                      ) : (
                        <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                          選擇
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Form Row: Title and Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                <span>職稱 (Job Title)</span>
                {matchedParticipant && <span className="text-[11px] text-blue-600">(自動比對)</span>}
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例如：高級後端工程師 / 經理"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span>服務部門 / 單位 (選填)</span>
              </label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="例如：資訊研發處 / 人資部"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm text-slate-800"
              />
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              備註說明 (選填，如用餐需求、座位需求或代簽人)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="無特殊需求可留空"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm text-slate-800"
            />
          </div>

          {/* Interactive Signature Pad Component */}
          <div className="pt-2">
            <SignaturePad ref={signaturePadRef} height={180} />
          </div>

          {/* Error notice if validation fails */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>確認送出並完成活動報到</span>
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal Confirmation Dialog */}
      {recentCheckedIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-center p-6 sm:p-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              報到手續完成！
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              歡迎參加本次培訓與研習課程
            </p>

            {/* Check-in Details Card */}
            <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">參加學員</span>
                <span className="font-bold text-slate-900 text-sm">{recentCheckedIn.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">職稱 / 單位</span>
                <span className="font-semibold text-slate-800">
                  {recentCheckedIn.title} {recentCheckedIn.department ? `(${recentCheckedIn.department})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">報到時間</span>
                <span className="font-mono text-slate-700">
                  {new Date(recentCheckedIn.checkInTime).toLocaleTimeString('zh-TW', { hour12: false })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">名冊狀態</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  recentCheckedIn.isWalkIn ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {recentCheckedIn.isWalkIn ? '現場追加報到' : '預先報名符合'}
                </span>
              </div>

              {/* Signature snapshot thumbnail */}
              {recentCheckedIn.signatureDataUrl && (
                <div className="pt-2">
                  <div className="text-[11px] text-slate-400 mb-1">數位手寫簽署存根：</div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 flex justify-center">
                    <img
                      src={recentCheckedIn.signatureDataUrl}
                      alt="手寫簽名"
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
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>下一位學員報到</span>
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
                查看承辦人統計
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
