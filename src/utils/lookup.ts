import { CombinedAttendeeView, EventInfo } from '../types';
import { parseSerial } from './serial';

/**
 * 「報到資訊查詢」頁 (不需密碼)
 * 只顯示：姓名、序號、職稱、報到時間、覆核狀態，以及承辦人勾選在報到成功頁顯示的欄位 (例如桌次、用餐)，
 * 自動排除電話、信箱等個資與部門。
 */

const SENSITIVE = /電話|手機|phone|mobile|\btel\b|信箱|email|e-mail|mail|郵件|身分證|身份證|證號|地址|住址|address|生日|出生|birthday|帳號|密碼|password/i;
const ALREADY_SHOWN = /^(姓名|名字|name|職稱|職務|title|部門|單位|處室|department|dept|編號|序號|no\.?)$/i;

export function isSensitiveField(field: string): boolean {
  return SENSITIVE.test(field.trim());
}

/** 查詢頁要額外顯示的欄位 (依承辦人在後台勾選的順序) */
export function lookupDisplayFields(eventInfo: Pick<EventInfo, 'completionDisplayFields'>): string[] {
  const fields = eventInfo.completionDisplayFields || [];
  const seen = new Set<string>();
  return fields.filter(f => {
    const t = f.trim();
    if (!t || seen.has(t) || isSensitiveField(t) || ALREADY_SHOWN.test(t)) return false;
    seen.add(t);
    return true;
  });
}

export function fieldValue(a: CombinedAttendeeView, field: string): string | undefined {
  const fields = a.customFields || {};
  const key = Object.keys(fields).find(k => k.trim() === field.trim());
  const v = key ? fields[key] : undefined;
  return v && String(v).trim() ? String(v).trim() : undefined;
}

export const isCheckedIn = (a: CombinedAttendeeView) => a.status === 'CHECKED_IN' || a.status === 'WALK_IN';

/** 只找已報到的人：姓名 (部分符合) 或序號 (完全符合，可加 #) */
export function searchCheckedIn(attendees: CombinedAttendeeView[], query: string, limit = 20): CombinedAttendeeView[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const serialMatch = /^#?\s*(\d+)$/.exec(q);
  const serial = serialMatch ? parseSerial(serialMatch[1]) : undefined;
  return attendees
    .filter(isCheckedIn)
    .filter(a => a.name.toLowerCase().includes(q) || (serial !== undefined && a.serialNo === serial))
    .slice(0, limit);
}
