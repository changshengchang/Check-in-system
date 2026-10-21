import { EventInfo, RegisteredParticipant, CheckInRecord } from '../types';

export interface SyncPayload {
  eventInfo: EventInfo;
  roster: RegisteredParticipant[];
  checkIns: CheckInRecord[];
  version: number;
  updatedAt: string;
}

const KVDB_BUCKET = 'CrJjmEhDSTVdfJwSimtxNm';
const DEFAULT_ROOM_KEY = 'event-2026-training-main';
const STORAGE_ROOM_KEY = 'training_app_cloud_room_id';

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

let isLocalServerAvailable: boolean | null = null;

/**
 * Detect whether backend /api/data is running (Local/Docker) or missing (Vercel static)
 */
export async function checkBackendAvailability(): Promise<boolean> {
  if (isLocalServerAvailable !== null) return isLocalServerAvailable;
  try {
    const res = await fetch('/api/data', { method: 'GET', headers: { 'Cache-Control': 'no-cache' } });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      isLocalServerAvailable = true;
      return true;
    }
  } catch {
    // ignore
  }
  isLocalServerAvailable = false;
  return false;
}

/**
 * Pull latest data from KVDB cloud storage
 */
export async function fetchFromCloudRelay(roomId: string): Promise<SyncPayload | null> {
  try {
    const url = `https://kvdb.io/${KVDB_BUCKET}/${encodeURIComponent(roomId)}?t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim() === '') return null;
    return JSON.parse(text);
  } catch (err) {
    console.warn('[CloudSync] Fetch failed:', err);
    return null;
  }
}

/**
 * Push data to KVDB cloud storage (works globally on Vercel, phones, computers)
 */
export async function pushToCloudRelay(roomId: string, payload: SyncPayload): Promise<boolean> {
  try {
    const url = `https://kvdb.io/${KVDB_BUCKET}/${encodeURIComponent(roomId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.error('[CloudSync] Push to cloud failed:', err);
    return false;
  }
}
