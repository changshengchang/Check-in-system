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
  checkInTime: string; // ISO string (簽到時間)
  signatureDataUrl: string; // Base64 PNG/JPEG image (簽到手寫簽署)
  isWalkIn: boolean; // True if registered on site
  notes?: string;
  hrVerified?: boolean; // 人事覆核狀態: true 已覆核, false/undefined 未覆核
  hrVerifiedAt?: string; // 人事覆核時間
  checkOutTime?: string; // ISO string (簽退時間)
  checkOutSignatureDataUrl?: string; // Base64 image (簽退手寫簽署)
  durationMinutes?: number; // 參加時間 (分鐘數)
  durationDisplay?: string; // 參加時間文字 (例如: 2小時15分)
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
  checkOutTime?: string; // 簽退時間
  checkOutSignatureDataUrl?: string; // 簽退手寫簽名
  durationMinutes?: number; // 參加時間 (分鐘數)
  durationDisplay?: string; // 參加時間文字 (例如: 2小時15分)
}
