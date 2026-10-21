import { EventInfo, RegisteredParticipant, CheckInRecord } from '../types';

export interface SyncPayload {
  eventInfo: EventInfo;
  roster: RegisteredParticipant[];
  checkIns: CheckInRecord[];
  updatedAt: number; // millisecond timestamp: Date.now()
  lastModifiedBy: string; // e.g. "手機端-7A2B" or "電腦端-9X4C"
  actionDescription?: string; // e.g. "新增學員: 張小明"
}

const KVDB_BUCKET = 'CrJjmEhDSTVdfJwSimtxNm';
export const DEFAULT_ROOM_KEY = 'training-event-4820472b';
const STORAGE_ROOM_KEY = 'training_app_cloud_room_id';

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
  try {
    const custom = localStorage.getItem(STORAGE_ROOM_KEY);
    if (custom && custom.trim()) return custom.trim();
  } catch {
    // ignore
  }
  return DEFAULT_ROOM_KEY;
}

export function setCloudRoomId(newRoomId: string) {
  try {
    localStorage.setItem(STORAGE_ROOM_KEY, newRoomId.trim());
  } catch {
    // ignore
  }
}

/**
 * Pull latest data from KVDB cloud storage.
 * CRITICAL: Do NOT set custom headers (like Cache-Control or Pragma) on this GET request,
 * because custom headers trigger an OPTIONS preflight which KVDB rejects.
 * Using a simple GET with a query timestamp '?t=...' bypasses browser caching with zero CORS preflight!
 */
export async function fetchFromCloudRelay(roomId: string): Promise<SyncPayload | null> {
  try {
    const url = `https://kvdb.io/${KVDB_BUCKET}/${encodeURIComponent(roomId)}?t=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.updatedAt !== 'number') return null;
    return data;
  } catch (err) {
    console.warn('[CloudSync] Fetch failed:', err);
    return null;
  }
}

/**
 * Push data to KVDB cloud storage.
 * Uses Content-Type: application/json which is permitted by KVDB's Access-Control-Allow-Headers.
 */
export async function pushToCloudRelay(roomId: string, payload: SyncPayload): Promise<boolean> {
  const url = `https://kvdb.io/${KVDB_BUCKET}/${encodeURIComponent(roomId)}`;
  const body = JSON.stringify(payload);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn(`[CloudSync] Push attempt ${attempt + 1} failed:`, err);
    }
  }
  return false;
}
