import { EventInfo, RegisteredParticipant, CheckInRecord } from '../types';

export interface SyncPayload {
  eventInfo: EventInfo;
  roster: RegisteredParticipant[];
  checkIns: CheckInRecord[];
  updatedAt: number; // millisecond timestamp: Date.now()
  lastModifiedBy: string; // e.g. "手機端-7A2B" or "電腦端-9X4C"
  actionDescription?: string; // e.g. "學員報到: 張淑珍"
}

const KVDB_BUCKET = 'CrJjmEhDSTVdfJwSimtxNm';
export const CANONICAL_ROOM_KEY = 'training-event-4820472b';
export const LEGACY_ROOM_KEY = 'event-2026-training-main';
export const DEFAULT_ROOM_KEY = CANONICAL_ROOM_KEY;

// Proactively purge any divergent room keys saved in localStorage
try {
  localStorage.removeItem('training_app_cloud_room_id');
} catch {
  // ignore
}

export function getDeviceId(): string {
  try {
    const existing = sessionStorage.getItem('app_device_id');
    if (existing) return existing;
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768;
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = `${isMobile ? '手機端' : '電腦端'}-${randomHex}`;
    sessionStorage.setItem('app_device_id', id);
    return id;
  } catch {
    return '客戶端';
  }
}

export function getCloudRoomId(): string {
  // Always use canonical room key so mobile and desktop never talk to separate channels
  return CANONICAL_ROOM_KEY;
}

export function setCloudRoomId(_newRoomId: string) {
  // Intentionally locked to CANONICAL_ROOM_KEY to prevent device divergence
}

/**
 * Normalize incoming payload timestamp (handles both millisecond number and legacy ISO string)
 */
function normalizePayload(data: any): SyncPayload | null {
  if (!data || typeof data !== 'object') return null;

  let updatedAtMs = 0;
  if (typeof data.updatedAt === 'number') {
    updatedAtMs = data.updatedAt;
  } else if (typeof data.updatedAt === 'string') {
    const parsed = new Date(data.updatedAt).getTime();
    if (!isNaN(parsed)) updatedAtMs = parsed;
  }

  if (updatedAtMs <= 0) return null;

  return {
    eventInfo: data.eventInfo,
    roster: Array.isArray(data.roster) ? data.roster : [],
    checkIns: Array.isArray(data.checkIns) ? data.checkIns : [],
    updatedAt: updatedAtMs,
    lastModifiedBy: data.lastModifiedBy || '遠端裝置',
    actionDescription: data.actionDescription || '更新資料'
  };
}

/**
 * Pull latest data from KVDB cloud storage.
 * Using a simple GET with a query timestamp '?t=...' bypasses browser caching with zero CORS preflight.
 */
export async function fetchFromCloudRelay(roomId: string = CANONICAL_ROOM_KEY): Promise<SyncPayload | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://kvdb.io/${KVDB_BUCKET}/${encodeURIComponent(roomId)}?t=${Date.now()}`;
    const res = await fetch(url, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const raw = await res.json();
    return normalizePayload(raw);
  } catch (err) {
    // Silent warn on expected network jitter
    return null;
  }
}

/**
 * Push data to KVDB cloud storage.
 * Synchronously pushes to CANONICAL_ROOM_KEY and simultaneously replicates to LEGACY_ROOM_KEY
 * so any older client still running cached code receives the update immediately.
 */
export async function pushToCloudRelay(roomId: string = CANONICAL_ROOM_KEY, payload: SyncPayload): Promise<boolean> {
  const body = JSON.stringify(payload);

  const pushToTarget = async (targetKey: string): Promise<boolean> => {
    const url = `https://kvdb.io/${KVDB_BUCKET}/${encodeURIComponent(targetKey)}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  };

  // Push to canonical room
  const success = await pushToTarget(roomId);

  // Cross-replicate to legacy room in background if roomId is canonical
  if (roomId === CANONICAL_ROOM_KEY) {
    pushToTarget(LEGACY_ROOM_KEY).catch(() => {});
  }

  return success;
}
