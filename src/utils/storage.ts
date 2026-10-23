import { CheckInRecord, CombinedAttendeeView, EventInfo, RegisteredParticipant } from '../types';

const STORAGE_KEY_EVENT = 'training_app_event_info';
const STORAGE_KEY_ROSTER = 'training_app_roster';
const STORAGE_KEY_CHECKINS = 'training_app_checkins';

export const DEFAULT_EVENT_INFO: EventInfo = {
  id: 'event-sanyi-001',
  title: '苗栗縣三義鄉公所培訓或活動簽到系統',
  date: '2026-10-22',
  time: '09:00 - 16:30',
  location: '苗栗縣三義鄉公所 3F 大禮堂會議室',
  organizer: '苗栗縣三義鄉公所 (人事室 / 社會民政課)',
  notes: '請於入場時完成手寫簽到，培訓活動結束前請至「學員簽退端」完成手寫簽退以核算參加時數'
};

/**
 * Formats minutes into human-readable Chinese string
 * e.g. 90 -> "1小時 30分", 45 -> "45分鐘", 120 -> "2小時"
 */
export function formatMinutesDisplay(minutes?: number): string {
  if (!minutes || minutes <= 0) return '0分鐘';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}分鐘`;
  if (mins === 0) return `${hours}小時`;
  return `${hours}小時 ${mins}分`;
}

/**
 * Calculates participation duration: check-out time minus check-in time
 */
export function calculateParticipationDuration(
  checkInIso?: string,
  checkOutIso?: string
): { minutes: number; display: string } | null {
  if (!checkInIso || !checkOutIso) return null;
  const inTime = new Date(checkInIso).getTime();
  const outTime = new Date(checkOutIso).getTime();
  if (isNaN(inTime) || isNaN(outTime) || outTime < inTime) return null;

  const totalMinutes = Math.max(1, Math.round((outTime - inTime) / 60000));
  return {
    minutes: totalMinutes,
    display: formatMinutesDisplay(totalMinutes)
  };
}

/**
 * Calculates Comp Time (核予補休時間): "參加時間(計算)" 加上 "路途時間"
 */
export function calculateCompTime(
  durationMinutes: number = 0,
  travelMinutes: number = 0
): { compMinutes: number; compDisplay: string } {
  const compMinutes = Math.max(0, (durationMinutes || 0) + (travelMinutes || 0));
  return {
    compMinutes,
    compDisplay: formatMinutesDisplay(compMinutes)
  };
}

export const DEFAULT_ROSTER: RegisteredParticipant[] = [
  { id: 'p1', name: '王大偉', title: '技術研發總監', department: '資訊研發處', phone: '0912-345-678', email: 'dawei.wang@example.com' },
  { id: 'p2', name: '陳建明', title: '高級後端工程師', department: '雲端架構組', phone: '0923-456-789', email: 'jm.chen@example.com' },
  { id: 'p3', name: '林美華', title: '資深產品經理', department: '產品創新中心', phone: '0934-567-890', email: 'meihua.lin@example.com' },
  { id: 'p4', name: '張淑珍', title: '人力資源經理', department: '人資發展部', phone: '0945-678-901', email: 'sc.chang@example.com' },
  { id: 'p5', name: '黃俊彥', title: '行銷企劃專員', department: '品牌推廣組', phone: '0956-789-012', email: 'jy.huang@example.com' },
  { id: 'p6', name: '劉怡君', title: '財務分析師', department: '財務會計處', phone: '0967-890-123', email: 'yc.liu@example.com' },
  { id: 'p7', name: '楊宗緯', title: '品保工程師', department: '品質工程部', phone: '0978-901-234', email: 'zw.yang@example.com' },
  { id: 'p8', name: '蔡雅芳', title: '客戶關係主管', department: '客戶成功處', phone: '0989-012-345', email: 'yf.tsai@example.com' },
  { id: 'p9', name: '許瑞祥', title: '系統維運工程師', department: 'IT基礎維運組', phone: '0990-123-456', email: 'rx.hsu@example.com' },
  { id: 'p10', name: '吳佩蓉', title: 'UI/UX 設計專員', department: '設計體驗中心', phone: '0901-234-567', email: 'pr.wu@example.com' },
  { id: 'p11', name: '詹小鎮', title: '營運管理專員', department: '營運管理部', phone: '0911-222-333', email: 'xz.zhan@example.com' },
  { id: 'p12', name: '楊過', title: '資深系統架構師', department: '技術平台部', phone: '0922-333-444', email: 'guo.yang@example.com' },
  { id: 'p13', name: '張小風', title: '專案管理師', department: '專案管理處', phone: '0933-444-555', email: 'xf.chang@example.com' }
];

// In production, an event check-in list begins empty (0 checked in).
// All participants on the roster start with status "未完成報到".
export const DEFAULT_CHECKINS: CheckInRecord[] = [];

export function loadEventInfo(): EventInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.title === 'string') {
        // Upgrade legacy default title to Sanyi township default
        if (parsed.title === '2026年度企業核心職能培訓與內部實務研習') {
          parsed.title = DEFAULT_EVENT_INFO.title;
          parsed.location = DEFAULT_EVENT_INFO.location;
          parsed.organizer = DEFAULT_EVENT_INFO.organizer;
          parsed.notes = DEFAULT_EVENT_INFO.notes;
          saveEventInfo(parsed);
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load event info from localStorage', e);
  }
  return DEFAULT_EVENT_INFO;
}

export function saveEventInfo(info: EventInfo) {
  try {
    localStorage.setItem(STORAGE_KEY_EVENT, JSON.stringify(info));
  } catch (e) {
    console.error('Failed to save event info', e);
  }
}

export function loadRoster(): RegisteredParticipant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROSTER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load roster from localStorage', e);
  }
  return DEFAULT_ROSTER;
}

export function saveRoster(roster: RegisteredParticipant[]) {
  try {
    localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(roster));
  } catch (e) {
    console.error('Failed to save roster', e);
  }
}

export function loadCheckIns(): CheckInRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHECKINS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load check-ins from localStorage', e);
  }
  return DEFAULT_CHECKINS;
}

export function saveCheckIns(checkIns: CheckInRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY_CHECKINS, JSON.stringify(checkIns));
  } catch (e) {
    console.error('Failed to save check-ins', e);
  }
}

/**
 * Core Matching Algorithm:
 * Cross-references the registered roster against the actual check-in records.
 * Handles:
 * 1. Participants on the roster who have checked in (CHECKED_IN)
 * 2. Participants on the roster who haven't checked in yet (NOT_CHECKED_IN)
 * 3. Walk-in participants who registered directly at check-in (WALK_IN)
 */
export function buildCombinedAttendeeList(
  roster: RegisteredParticipant[],
  checkIns: CheckInRecord[]
): CombinedAttendeeView[] {
  const list: CombinedAttendeeView[] = [];

  // Map check-ins by participantId and by normalized name
  const checkInByParticipantId = new Map<string, CheckInRecord>();
  const checkInByName = new Map<string, CheckInRecord>();
  const usedCheckInIds = new Set<string>();

  checkIns.forEach(c => {
    if (c.participantId) {
      checkInByParticipantId.set(c.participantId, c);
    }
    const cleanName = c.name.trim().toLowerCase();
    if (!checkInByName.has(cleanName)) {
      checkInByName.set(cleanName, c);
    }
  });

  // Step 1: Process all registered participants from roster
  roster.forEach(p => {
    let matchedCheckIn: CheckInRecord | undefined;

    // Check direct ID match first
    if (checkInByParticipantId.has(p.id)) {
      matchedCheckIn = checkInByParticipantId.get(p.id);
    } else {
      // Check normalized name match
      const cleanName = p.name.trim().toLowerCase();
      if (checkInByName.has(cleanName)) {
        matchedCheckIn = checkInByName.get(cleanName);
      }
    }

    if (matchedCheckIn) {
      usedCheckInIds.add(matchedCheckIn.id);
      const calcDuration = calculateParticipationDuration(
        matchedCheckIn.checkInTime,
        matchedCheckIn.checkOutTime
      );
      const durationMins = calcDuration?.minutes || matchedCheckIn.durationMinutes;
      const durationDisp = calcDuration?.display || matchedCheckIn.durationDisplay;
      const travelMins = matchedCheckIn.travelMinutes ?? p.travelMinutes ?? 0;
      const comp = durationMins !== undefined
        ? calculateCompTime(durationMins, travelMins)
        : undefined;

      list.push({
        id: p.id,
        checkInId: matchedCheckIn.id,
        name: p.name,
        title: p.title,
        department: p.department,
        status: 'CHECKED_IN',
        checkInTime: matchedCheckIn.checkInTime,
        signatureDataUrl: matchedCheckIn.signatureDataUrl,
        isWalkIn: false,
        notes: matchedCheckIn.notes,
        hrVerified: Boolean(matchedCheckIn.hrVerified),
        hrVerifiedAt: matchedCheckIn.hrVerifiedAt,
        checkOutTime: matchedCheckIn.checkOutTime,
        checkOutSignatureDataUrl: matchedCheckIn.checkOutSignatureDataUrl,
        durationMinutes: durationMins,
        durationDisplay: durationDisp,
        travelMinutes: travelMins,
        travelDisplay: travelMins > 0 ? formatMinutesDisplay(travelMins) : '0分鐘',
        compTimeMinutes: comp?.compMinutes,
        compTimeDisplay: comp?.compDisplay
      });
    } else {
      const travelMins = p.travelMinutes ?? 0;
      list.push({
        id: p.id,
        name: p.name,
        title: p.title,
        department: p.department,
        status: 'NOT_CHECKED_IN',
        isWalkIn: false,
        hrVerified: false,
        travelMinutes: travelMins,
        travelDisplay: travelMins > 0 ? formatMinutesDisplay(travelMins) : '0分鐘'
      });
    }
  });

  // Step 2: Any check-in record not matched to a roster attendee is a walk-in
  checkIns.forEach(c => {
    if (!usedCheckInIds.has(c.id)) {
      const calcDuration = calculateParticipationDuration(
        c.checkInTime,
        c.checkOutTime
      );
      const durationMins = calcDuration?.minutes || c.durationMinutes;
      const durationDisp = calcDuration?.display || c.durationDisplay;
      const travelMins = c.travelMinutes ?? 0;
      const comp = durationMins !== undefined
        ? calculateCompTime(durationMins, travelMins)
        : undefined;

      list.push({
        id: c.id,
        checkInId: c.id,
        name: c.name,
        title: c.title || '現場追加人員',
        department: c.department,
        status: 'WALK_IN',
        checkInTime: c.checkInTime,
        signatureDataUrl: c.signatureDataUrl,
        isWalkIn: true,
        notes: c.notes,
        hrVerified: Boolean(c.hrVerified),
        hrVerifiedAt: c.hrVerifiedAt,
        checkOutTime: c.checkOutTime,
        checkOutSignatureDataUrl: c.checkOutSignatureDataUrl,
        durationMinutes: durationMins,
        durationDisplay: durationDisp,
        travelMinutes: travelMins,
        travelDisplay: travelMins > 0 ? formatMinutesDisplay(travelMins) : '0分鐘',
        compTimeMinutes: comp?.compMinutes,
        compTimeDisplay: comp?.compDisplay
      });
    }
  });

  return list;
}
