import React, { useEffect, useRef, useState } from 'react';
import { Star, CheckCircle2, LogOut, Clock } from 'lucide-react';
import { CombinedAttendeeView, EventInfo } from '../types';
import { buildVipBoard } from '../utils/vip';

interface VipStatusBoardProps {
  eventInfo: EventInfo;
  attendees: CombinedAttendeeView[];
}

const HIGHLIGHT_MS = 8000;

const twTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' }) : '';

/** 前台「貴賓報到情形」：不需密碼，資料即時同步；最早報到在最上面，最新報到在最下面 */
export const VipStatusBoard: React.FC<VipStatusBoardProps> = ({ eventInfo, attendees }) => {
  const board = buildVipBoard(attendees);

  // 新報到的貴賓短暫閃爍提示 (第一次載入時不閃爍)
  const seenRef = useRef<Set<string> | null>(null);
  const [highlight, setHighlight] = useState<Record<string, number>>({});
  const arrivedKey = board.arrived.map(a => a.id).join(',');
  useEffect(() => {
    const ids = board.arrived.map(a => a.id);
    if (seenRef.current === null) {
      seenRef.current = new Set(ids);
      return;
    }
    const fresh = ids.filter(id => !seenRef.current!.has(id));
    seenRef.current = new Set(ids);
    if (fresh.length === 0) return;
    const until = Date.now() + HIGHLIGHT_MS;
    setHighlight(h => ({ ...h, ...Object.fromEntries(fresh.map(id => [id, until])) }));
    // 捲動到最新報到的貴賓
    requestAnimationFrame(() => {
      document.querySelector(`[data-vip-id="${CSS.escape(fresh[fresh.length - 1])}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    const timer = setTimeout(() => setHighlight(h => Object.fromEntries(Object.entries(h).filter(([, t]) => t > Date.now()))), HIGHLIGHT_MS + 100);
    return () => clearTimeout(timer);
  }, [arrivedKey]);

  const { counts } = board;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-5" data-testid="vip-board">
      {/* Title & summary */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-5 sm:p-6 text-white shadow-md">
        <div className="flex items-center gap-2 text-amber-50 text-xs font-semibold">
          <Star className="w-4 h-4 fill-current" />
          <span>貴賓報到情形 · 即時更新</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black mt-1 truncate">{eventInfo.title}</h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center" data-testid="vip-counts">
          {[
            { label: '貴賓', value: counts.total },
            { label: '已到場', value: counts.present },
            { label: '已簽退', value: counts.checkedOut },
            { label: '尚未報到', value: counts.notArrived }
          ].map(c => (
            <div key={c.label} className="bg-white/15 rounded-xl py-2">
              <div className="text-2xl font-black">{c.value}</div>
              <div className="text-[11px] text-amber-50">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {counts.total === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500 text-sm">
          <Star className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          目前尚未標記任何貴賓
          <div className="text-xs text-slate-400 mt-1">請承辦人於後台名單的「貴賓」欄位勾選</div>
        </div>
      ) : (
        <>
          {/* Arrived: earliest on top, newest at the bottom */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <h3 className="px-4 py-3 border-b border-slate-100 text-sm font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              已報到（依報到時間，最早在上）
              <span className="text-xs font-semibold text-slate-400">{board.arrived.length} 位</span>
            </h3>
            {board.arrived.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">尚無貴賓報到</p>
            ) : (
              <ul className="divide-y divide-slate-100" data-testid="vip-arrived">
                {board.arrived.map(a => {
                  const isNew = (highlight[a.id] ?? 0) > Date.now();
                  return (
                    <li
                      key={a.id}
                      data-vip-id={a.id}
                      data-testid="vip-arrived-item"
                      className={`px-4 py-3 flex items-center gap-3 transition-colors duration-700 ${isNew ? 'bg-amber-100 animate-pulse' : ''}`}
                    >
                      <PersonInfo a={a} />
                      <div className="shrink-0 text-right space-y-1">
                        <div className="text-xs font-semibold text-emerald-700 flex items-center justify-end gap-1">
                          <Clock className="w-3.5 h-3.5" /> {twTime(a.checkInTime)} 報到
                        </div>
                        {a.checkOutTime && (
                          <div className="text-xs font-semibold text-orange-700 flex items-center justify-end gap-1">
                            <LogOut className="w-3.5 h-3.5" /> {twTime(a.checkOutTime)} 已簽退
                          </div>
                        )}
                        {isNew && <div className="text-[11px] font-black text-amber-700">剛剛報到</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Not yet arrived */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <h3 className="px-4 py-3 border-b border-slate-100 text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              尚未報到
              <span className="text-xs font-semibold text-slate-400">{board.notArrived.length} 位</span>
            </h3>
            {board.notArrived.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-emerald-600 font-semibold">貴賓皆已報到</p>
            ) : (
              <ul className="divide-y divide-slate-100" data-testid="vip-not-arrived">
                {board.notArrived.map(a => (
                  <li key={a.id} data-testid="vip-not-arrived-item" className="px-4 py-3 flex items-center gap-3 opacity-80">
                    <PersonInfo a={a} />
                    <span className="shrink-0 text-xs text-slate-400 font-semibold">未報到</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

const PersonInfo: React.FC<{ a: CombinedAttendeeView }> = ({ a }) => (
  <div className="flex items-center gap-3 min-w-0 flex-1">
    <span className="shrink-0 w-10 text-center font-mono font-black text-slate-500 text-sm">
      {a.serialNo !== undefined ? `#${a.serialNo}` : '—'}
    </span>
    <div className="min-w-0">
      <div className="font-bold text-slate-900 text-base flex items-center gap-1.5">
        <span className="truncate">{a.name}</span>
        {a.isWalkIn && <span className="shrink-0 text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded font-semibold">現場追加</span>}
      </div>
      <div className="text-xs text-slate-500 truncate">
        {[a.title, a.department].filter(Boolean).join('／') || '—'}
      </div>
    </div>
  </div>
);
