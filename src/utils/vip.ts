import { CombinedAttendeeView, RegisteredParticipant } from '../types';

/**
 * 貴賓 (VIP) 標記
 * - 承辦人在後台逐一勾選 / 取消
 * - Excel 名冊可加「貴賓」欄位預先標記 (填 是 / V / Y / ✓ / 1 等)
 */

const VIP_COLUMNS = ['貴賓', 'vip', '重要貴賓', '貴賓標記'];
const TRUTHY = new Set(['是', 'v', 'y', 'yes', 'true', '1', 'o', '○', '●', '✓', '✔', '★', '☆', '貴賓', 'vip', '◎']);

/** Excel「貴賓」欄位的值是否代表「是貴賓」(空白、否、N、0 等都視為不是) */
export function parseVipFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;
  return TRUTHY.has(value.trim().toLowerCase());
}

/** 從 Excel 列中找出貴賓欄位並判斷 */
export function vipFromRow(row: Record<string, unknown>): boolean {
  const key = Object.keys(row).find(k => VIP_COLUMNS.includes(k.trim().toLowerCase()));
  return key ? parseVipFlag(row[key]) : false;
}

/** 設定名冊中某人的貴賓標記 (寫入明確的值，不受其他裝置操作順序影響) */
export function setRosterVip(roster: RegisteredParticipant[], participantId: string, isVip: boolean): RegisteredParticipant[] {
  return roster.map(p => (p.id === participantId ? { ...p, isVip } : p));
}

export interface VipBoard {
  /** 已報到 (含已簽退)：最早報到在最上面，最新報到在最下面 */
  arrived: CombinedAttendeeView[];
  /** 尚未報到：依序號 */
  notArrived: CombinedAttendeeView[];
  counts: { total: number; present: number; checkedOut: number; notArrived: number };
}

/** 貴賓報到情形看板的資料 */
export function buildVipBoard(attendees: CombinedAttendeeView[]): VipBoard {
  const vips = attendees.filter(a => a.isVip);
  const isArrived = (a: CombinedAttendeeView) =>
    (a.status === 'CHECKED_IN' || a.status === 'WALK_IN') && Boolean(a.checkInTime);

  const arrived = vips
    .filter(isArrived)
    .map((a, i) => ({ a, i, t: new Date(a.checkInTime as string).getTime() }))
    .sort((x, y) => (x.t - y.t) || ((x.a.serialNo ?? Infinity) - (y.a.serialNo ?? Infinity)) || (x.i - y.i))
    .map(x => x.a);

  const notArrived = vips
    .filter(a => !isArrived(a))
    .map((a, i) => ({ a, i }))
    .sort((x, y) => ((x.a.serialNo ?? Infinity) - (y.a.serialNo ?? Infinity)) || (x.i - y.i))
    .map(x => x.a);

  const checkedOut = arrived.filter(a => a.checkOutTime).length;
  return {
    arrived,
    notArrived,
    counts: { total: vips.length, present: arrived.length - checkedOut, checkedOut, notArrived: notArrived.length }
  };
}
