export interface EventInfo {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  notes: string;
}

export interface RegisteredParticipant {
  id: string;
  name: string;
  title: string;
  department?: string;
  phone?: string;
  email?: string;
  registeredAt?: string;
}

export interface CheckInRecord {
  id: string;
  participantId?: string; // If matched to pre-registered
  name: string;
  title: string;
  department?: string;
  checkInTime: string; // ISO string
  signatureDataUrl: string; // Base64 PNG/JPEG image
  isWalkIn: boolean; // True if registered on site
  notes?: string;
  hrVerified?: boolean; // 人事覆核狀態: true 已覆核, false/undefined 未覆核
  hrVerifiedAt?: string; // 人事覆核時間
}

export type AttendeeStatus = 'CHECKED_IN' | 'NOT_CHECKED_IN' | 'WALK_IN';

export interface CombinedAttendeeView {
  id: string;
  checkInId?: string;
  name: string;
  title: string;
  department?: string;
  status: AttendeeStatus;
  checkInTime?: string;
  signatureDataUrl?: string;
  isWalkIn: boolean;
  notes?: string;
  hrVerified?: boolean; // 人事覆核狀態: true 已覆核, false 未覆核
  hrVerifiedAt?: string;
}
