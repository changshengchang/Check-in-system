export interface EventInfo {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  notes: string;
  defaultTravelMinutes?: number; // 預設路途時間 (分鐘，例如 60 分鐘)
}

export interface RegisteredParticipant {
  id: string;
  name: string;
  title: string;
  department?: string;
  phone?: string;
  email?: string;
  registeredAt?: string;
  travelMinutes?: number; // 個別設定路途時間 (分鐘)
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
  hrVerified?: boolean; // 相容性欄位: 人事簽到覆核
  hrVerifiedAt?: string;
  checkInHrVerified?: boolean; // 簽到覆核狀態: true 已覆核, false/undefined 未覆核
  checkInHrVerifiedAt?: string; // 簽到覆核時間
  checkOutHrVerified?: boolean; // 簽退覆核狀態: true 已覆核, false/undefined 未覆核
  checkOutHrVerifiedAt?: string; // 簽退覆核時間
  checkOutTime?: string; // ISO string (簽退時間)
  checkOutSignatureDataUrl?: string; // Base64 image (簽退手寫簽署)
  durationMinutes?: number; // 參加時間 (分鐘數)
  durationDisplay?: string; // 參加時間文字 (例如: 2小時15分)
  travelMinutes?: number; // 統一路途時間 (分鐘數)
  travelDisplay?: string; // 路途時間文字 (例如: 1小時 或 60分鐘)
  compTimeMinutes?: number; // 核予補休時間 (參加時間 + 路途時間，單位分鐘)
  compTimeDisplay?: string; // 核予補休時間文字 (例如: 3小時15分)
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
  hrVerified?: boolean; // 相容性欄位
  hrVerifiedAt?: string;
  checkInHrVerified?: boolean; // 簽到覆核狀態
  checkInHrVerifiedAt?: string;
  checkOutHrVerified?: boolean; // 簽退覆核狀態
  checkOutHrVerifiedAt?: string;
  checkOutTime?: string; // 簽退時間
  checkOutSignatureDataUrl?: string; // 簽退手寫簽名
  durationMinutes?: number; // 參加時間 (分鐘數)
  durationDisplay?: string; // 參加時間文字 (例如: 2小時15分)
  travelMinutes?: number; // 統一路途時間 (分鐘數)
  travelDisplay?: string; // 路途時間文字
  compTimeMinutes?: number; // 核予補休時間 (分鐘數)
  compTimeDisplay?: string; // 核予補休時間文字 (參加時間 + 路途時間)
}
