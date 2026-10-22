import React from 'react';
import { CombinedAttendeeView, EventInfo } from '../types';
import { Printer, Download, X } from 'lucide-react';

interface PrintableViewProps {
  eventInfo: EventInfo;
  attendees: CombinedAttendeeView[];
  onClose: () => void;
}

export const PrintableView: React.FC<PrintableViewProps> = ({
  eventInfo,
  attendees,
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  const checkedInCount = attendees.filter(a => a.status === 'CHECKED_IN' || a.status === 'WALK_IN').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs p-4 sm:p-6 print:p-0 print:bg-white flex justify-center">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl overflow-hidden my-auto print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Header / Action bar (hidden when printing) */}
        <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              簽到名冊列印與存根預覽 (含電子簽名)
            </h3>
            <p className="text-xs text-slate-500">
              可直接使用瀏覽器「另存為 PDF」或實體印表機列印正式存查報到清冊
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>立即列印 / 存為 PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-12 print:p-4 text-slate-900 bg-white">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="text-center">
              <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                出席與簽到正式存檔紀錄表
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-1">
                {eventInfo.title}
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500">日期：</span>
                <span className="font-semibold">{eventInfo.date}</span>
              </div>
              <div>
                <span className="text-slate-500">時間：</span>
                <span className="font-semibold">{eventInfo.time}</span>
              </div>
              <div>
                <span className="text-slate-500">地點：</span>
                <span className="font-semibold">{eventInfo.location}</span>
              </div>
              <div>
                <span className="text-slate-500">實到率：</span>
                <span className="font-bold text-blue-700">
                  {checkedInCount} / {attendees.length} 人
                </span>
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100 font-bold text-slate-800">
                <th className="py-2.5 px-3 w-12 text-center">項次</th>
                <th className="py-2.5 px-3 w-28">姓名</th>
                <th className="py-2.5 px-3 w-36">職稱</th>
                <th className="py-2.5 px-3 w-32">服務單位</th>
                <th className="py-2.5 px-3 w-28 text-center">報到狀態</th>
                <th className="py-2.5 px-3 w-36 text-center">報到時間</th>
                <th className="py-2.5 px-4 text-center">參加人員手寫簽名</th>
                <th className="py-2.5 px-3 w-24 text-center">人事覆核</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {attendees.map((a, index) => {
                const isDone = a.status === 'CHECKED_IN' || a.status === 'WALK_IN';
                return (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 text-sm">
                      {a.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {a.title}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {a.department || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          a.status === 'CHECKED_IN'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : a.status === 'WALK_IN'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {a.status === 'CHECKED_IN'
                          ? '已報到'
                          : a.status === 'WALK_IN'
                          ? '現場追加'
                          : '未報到'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                      {a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString('zh-TW', { hour12: false }) : '—'}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {a.signatureDataUrl ? (
                        <div className="flex justify-center items-center">
                          <img
                            src={a.signatureDataUrl}
                            alt={`${a.name} 簽名`}
                            className="h-10 max-w-[140px] object-contain border border-slate-200 rounded bg-white p-0.5"
                          />
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[11px]">未簽名</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {a.hrVerified ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300">
                          已覆核
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] text-slate-400 bg-slate-50 border border-slate-200">
                          未覆核
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer sign-off box */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
            <div>
              承辦人簽章：____________________ &nbsp;&nbsp;&nbsp;&nbsp; 單位主管核閱：____________________
            </div>
            <div>
              列印時間：{new Date().toLocaleString('zh-TW', { hour12: false })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
