/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { EventInfo, RegisteredParticipant, CheckInRecord } from './types';
import {
  DEFAULT_EVENT_INFO,
  DEFAULT_ROSTER,
  DEFAULT_CHECKINS,
  loadEventInfo,
  saveEventInfo,
  loadRoster,
  saveRoster,
  loadCheckIns,
  saveCheckIns,
  buildCombinedAttendeeList,
  calculateParticipationDuration,
  calculateCompTime,
  formatMinutesDisplay
} from './utils/storage';
import {
  getDeviceId,
  getCloudRoomId,
  fetchFromCloudRelay,
  pushToCloudRelay,
  SyncPayload
} from './utils/cloudSync';
import { EventHeader } from './components/EventHeader';
import { CheckInForm } from './components/CheckInForm';
import { CheckOutForm } from './components/CheckOutForm';
import { Dashboard } from './components/Dashboard';
import { OrganizerAuthModal } from './components/OrganizerAuthModal';

export default function App() {
  const [eventInfo, setEventInfo] = useState<EventInfo>(() => loadEventInfo());
  const [roster, setRoster] = useState<RegisteredParticipant[]>(() => loadRoster());
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(() => loadCheckIns());
  const [activeMode, setActiveMode] = useState<'checkin' | 'checkout' | 'dashboard'>('checkin');

  const myDeviceIdRef = useRef<string>(getDeviceId());
  const lastSyncedUpdatedAtRef = useRef<number>(0);
  const isBroadcastingRef = useRef<boolean>(false);

  const [lastSyncInfo, setLastSyncInfo] = useState<{
    time: string;
    device: string;
    action: string;
  } | null>(null);

  // Organizer Authentication state (Required password: nick620504)
  const [isOrganizerAuthenticated, setIsOrganizerAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('organizer_auth_verified') === 'true';
    } catch {
      return false;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Core Sync Engine: Apply mutation on local state immediately, then sync with cloud
  const executeMutationAndBroadcast = async (
    actionDesc: string,
    mutation: (base: {
      eventInfo: EventInfo;
      roster: RegisteredParticipant[];
      checkIns: CheckInRecord[];
    }) => {
      eventInfo: EventInfo;
      roster: RegisteredParticipant[];
      checkIns: CheckInRecord[];
    }
  ) => {
    isBroadcastingRef.current = true;
    try {
      // 0. Immediate optimistic update: instant UI response with 0ms delay
      const optimisticBase = { eventInfo, roster, checkIns };
      const optimisticNext = mutation(optimisticBase);
      setEventInfo(optimisticNext.eventInfo);
      setRoster(optimisticNext.roster);
      setCheckIns(optimisticNext.checkIns);
      saveEventInfo(optimisticNext.eventInfo);
      saveRoster(optimisticNext.roster);
      saveCheckIns(optimisticNext.checkIns);

      const roomId = getCloudRoomId();

      // 1. Fetch freshest cloud state first so changes from the other device are never lost
      const freshCloud = await fetchFromCloudRelay(roomId);
      const baseRoster = freshCloud && Array.isArray(freshCloud.roster) && freshCloud.roster.length > 0 ? freshCloud.roster : optimisticNext.roster;
      const baseCheckIns = freshCloud && Array.isArray(freshCloud.checkIns) ? freshCloud.checkIns : optimisticNext.checkIns;
      const baseEvent = freshCloud && freshCloud.eventInfo ? freshCloud.eventInfo : optimisticNext.eventInfo;

      const base = {
        eventInfo: baseEvent,
        roster: baseRoster,
        checkIns: baseCheckIns
      };

      // 2. Apply addition, deletion, or modification
      const next = mutation(base);

      // 3. Stamp with strictly increasing millisecond timestamp
      const now = Math.max(Date.now(), (freshCloud?.updatedAt || 0) + 1, lastSyncedUpdatedAtRef.current + 1);
      lastSyncedUpdatedAtRef.current = now;

      // 4. Update local React state & LocalStorage immediately
      setEventInfo(next.eventInfo);
      setRoster(next.roster);
      setCheckIns(next.checkIns);
      saveEventInfo(next.eventInfo);
      saveRoster(next.roster);
      saveCheckIns(next.checkIns);

      setLastSyncInfo({
        time: new Date(now).toLocaleTimeString('zh-TW', { hour12: false }),
        device: myDeviceIdRef.current,
        action: actionDesc
      });

      // 5. Broadcast newest state to Cloud Relay (instantly picked up by phone or computer)
      const payload: SyncPayload = {
        eventInfo: next.eventInfo,
        roster: next.roster,
        checkIns: next.checkIns,
        updatedAt: now,
        lastModifiedBy: myDeviceIdRef.current,
        actionDescription: actionDesc
      };

      await pushToCloudRelay(roomId, payload);
    } catch (err) {
      console.error('[Sync] Error during mutation broadcast:', err);
    } finally {
      setTimeout(() => {
        isBroadcastingRef.current = false;
      }, 300);
    }
  };

  // High-frequency Real-time Auto-Sync Loop (Self-scheduling timeout loop, ensures both phone and computer stay in sync)
  useEffect(() => {
    let isMounted = true;
    let timerId: any = null;
    const roomId = getCloudRoomId();

    const checkCloudUpdates = async () => {
      if (isBroadcastingRef.current) return;
      try {
        const remote = await fetchFromCloudRelay(roomId);
        if (!remote || typeof remote.updatedAt !== 'number' || !isMounted) return;

        // If cloud data is newer or from another device with different timestamp, accept immediately (fixes clock skew)
        const isFromOtherDevice = Boolean(remote.lastModifiedBy && remote.lastModifiedBy !== myDeviceIdRef.current);
        const isNewer = remote.updatedAt > lastSyncedUpdatedAtRef.current;
        const isDifferentTimestampFromOther = isFromOtherDevice && remote.updatedAt !== lastSyncedUpdatedAtRef.current;

        if (isNewer || isDifferentTimestampFromOther) {
          lastSyncedUpdatedAtRef.current = Math.max(remote.updatedAt, lastSyncedUpdatedAtRef.current);
          setEventInfo(remote.eventInfo);
          setRoster(remote.roster);
          setCheckIns(remote.checkIns);
          saveEventInfo(remote.eventInfo);
          saveRoster(remote.roster);
          saveCheckIns(remote.checkIns);

          setLastSyncInfo({
            time: new Date(remote.updatedAt).toLocaleTimeString('zh-TW', { hour12: false }),
            device: remote.lastModifiedBy || '遠端裝置',
            action: remote.actionDescription || '同步最新資料'
          });
        }
      } catch (err) {
        // network hiccup
      }
    };

    // Sequential self-scheduling poll loop: prevents request pile-up on slower mobile networks
    const pollLoop = async () => {
      if (!isMounted) return;
      await checkCloudUpdates();
      if (isMounted) {
        timerId = setTimeout(pollLoop, 1200);
      }
    };

    // Immediate initial load on mount
    pollLoop();

    // Instant re-check when phone screen wakes up, browser tab becomes visible, or comes online
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkCloudUpdates();
      }
    };
    const handleOnline = () => {
      checkCloudUpdates();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Request mode switcher with password gate
  const handleRequestSwitchMode = (targetMode: 'checkin' | 'checkout' | 'dashboard') => {
    if (targetMode === 'checkin' || targetMode === 'checkout') {
      setActiveMode(targetMode);
    } else {
      if (isOrganizerAuthenticated) {
        setActiveMode('dashboard');
      } else {
        setShowAuthModal(true);
      }
    }
  };

  const handleAuthSuccess = () => {
    setIsOrganizerAuthenticated(true);
    try {
      sessionStorage.setItem('organizer_auth_verified', 'true');
    } catch {
      // ignore
    }
    setShowAuthModal(false);
    setActiveMode('dashboard');
  };

  const handleOrganizerLogout = () => {
    setIsOrganizerAuthenticated(false);
    try {
      sessionStorage.removeItem('organizer_auth_verified');
    } catch {
      // ignore
    }
    setActiveMode('checkin');
  };

  // 1. Handle event info updates (synced based on latest write)
  const handleUpdateEventInfo = (updated: EventInfo) => {
    executeMutationAndBroadcast('修改活動資訊', base => ({
      ...base,
      eventInfo: updated
    }));
  };

  // 2. Handle participant check-in submission (synced based on latest write)
  const handleCheckInSuccess = (record: CheckInRecord) => {
    executeMutationAndBroadcast(`學員報到: ${record.name}`, base => {
      const cleanName = record.name.trim().toLowerCase();
      const existingIdx = base.checkIns.findIndex(
        c => (record.participantId && c.participantId === record.participantId) ||
             c.name.trim().toLowerCase() === cleanName
      );

      let nextCheckIns: CheckInRecord[];
      if (existingIdx >= 0) {
        nextCheckIns = [...base.checkIns];
        nextCheckIns[existingIdx] = record;
      } else {
        nextCheckIns = [record, ...base.checkIns];
      }

      return {
        ...base,
        checkIns: nextCheckIns
      };
    });
  };

  // 3. Handle roster Excel/CSV import (synced based on latest write)
  const handleImportRoster = (
    newParticipants: RegisteredParticipant[],
    mode: 'replace' | 'append',
    selectedColumns?: string[],
    allColumns?: string[]
  ) => {
    executeMutationAndBroadcast(`匯入名冊 (${newParticipants.length}人)`, base => {
      let nextRoster: RegisteredParticipant[];
      if (mode === 'replace') {
        nextRoster = newParticipants;
      } else {
        const existingNames = new Set(base.roster.map(p => p.name.trim().toLowerCase()));
        const filteredNew = newParticipants.filter(p => !existingNames.has(p.name.trim().toLowerCase()));
        nextRoster = [...base.roster, ...filteredNew];
      }
      const nextEventInfo: EventInfo = {
        ...base.eventInfo,
        ...(selectedColumns && selectedColumns.length > 0 ? { completionDisplayFields: selectedColumns } : {}),
        ...(allColumns && allColumns.length > 0 ? { availableRosterColumns: allColumns } : {})
      };
      return {
        ...base,
        eventInfo: nextEventInfo,
        roster: nextRoster
      };
    });
  };

  // 4. Handle adding attendee manually (synced based on latest write)
  const handleAddRosterParticipant = (p: RegisteredParticipant) => {
    executeMutationAndBroadcast(`新增學員: ${p.name}`, base => {
      // Avoid duplicate by id or name
      const exists = base.roster.some(x => x.id === p.id || (x.name.trim() === p.name.trim() && x.title === p.title));
      const nextRoster = exists ? base.roster : [...base.roster, p];
      return {
        ...base,
        roster: nextRoster
      };
    });
  };

  // 5. Handle deleting attendee from roster (synced based on latest write)
  const handleDeleteRosterParticipant = (id: string) => {
    const target = roster.find(p => p.id === id);
    const targetName = target ? target.name : '學員';
    executeMutationAndBroadcast(`刪除學員: ${targetName}`, base => ({
      ...base,
      roster: base.roster.filter(p => p.id !== id && (target ? p.name !== target.name : true))
    }));
  };

  // 6. Manual check-in performed by organizer (synced based on latest write)
  const handleManualCheckIn = (attendee: { id: string; name: string; title: string; department?: string; phone?: string; email?: string; customFields?: Record<string, string> }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 240, 80);
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 220, 60);
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('承辦人員現場核驗報到', 120, 36);
      ctx.font = '11px sans-serif';
      ctx.fillText(new Date().toLocaleTimeString('zh-TW', { hour12: false }), 120, 56);
    }

    const stampDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const newRecord: CheckInRecord = {
      id: `manual-chk-${Date.now()}`,
      participantId: attendee.id,
      name: attendee.name,
      title: attendee.title,
      department: attendee.department,
      phone: attendee.phone,
      email: attendee.email,
      customFields: attendee.customFields,
      checkInTime: new Date().toISOString(),
      signatureDataUrl: stampDataUrl,
      isWalkIn: false,
      notes: '活動承辦人手動協助報到'
    };

    handleCheckInSuccess(newRecord);
  };

  // 6b. Check-out success submission from CheckOutForm (支援參加時間 + 路途時間 - 扣除時間)
  const handleCheckOutSuccess = (
    checkInId: string,
    checkOutTime: string,
    signatureDataUrl: string,
    durationMinutes: number,
    durationDisplay: string,
    travelMinutes?: number,
    travelDisplay?: string,
    compTimeMinutes?: number,
    compTimeDisplay?: string,
    deductionMinutes?: number,
    deductionDisplay?: string,
    deductionReason?: string
  ) => {
    const existingCheckIn = checkIns.find(c => c.id === checkInId);
    const participantName = existingCheckIn ? existingCheckIn.name : '學員';

    const useTravel = eventInfo.showTravelTime !== false;
    const actualTravelMinutes = useTravel ? (typeof travelMinutes === 'number' ? travelMinutes : (existingCheckIn?.travelMinutes ?? eventInfo.defaultTravelMinutes ?? 60)) : 0;
    const actualTravelDisplay = useTravel ? (travelDisplay || formatMinutesDisplay(actualTravelMinutes)) : undefined;

    const useDeduction = !!eventInfo.showDeductionTime;
    const actualDeductionMinutes = useDeduction ? (typeof deductionMinutes === 'number' ? deductionMinutes : (existingCheckIn?.deductionMinutes ?? eventInfo.defaultDeductionMinutes ?? 60)) : 0;
    const actualDeductionDisplay = useDeduction ? (deductionDisplay || formatMinutesDisplay(actualDeductionMinutes)) : undefined;
    const actualDeductionReason = useDeduction ? (deductionReason || eventInfo.deductionReason || '午休用餐休息時間不計入補休') : undefined;

    const compResult = calculateCompTime(durationMinutes, actualTravelMinutes, actualDeductionMinutes);
    const actualCompTime = typeof compTimeMinutes === 'number' ? compTimeMinutes : compResult.compMinutes;
    const actualCompDisplay = compTimeDisplay || compResult.compDisplay;

    executeMutationAndBroadcast(`學員簽退: ${participantName} (${durationDisplay})`, base => {
      const nextCheckIns = base.checkIns.map(c => {
        if (c.id === checkInId) {
          return {
            ...c,
            checkOutTime,
            checkOutSignatureDataUrl: signatureDataUrl,
            durationMinutes,
            durationDisplay,
            travelMinutes: actualTravelMinutes,
            travelDisplay: actualTravelDisplay,
            deductionMinutes: actualDeductionMinutes,
            deductionDisplay: actualDeductionDisplay,
            deductionReason: actualDeductionReason,
            compTimeMinutes: actualCompTime,
            compTimeDisplay: actualCompDisplay
          };
        }
        return c;
      });

      return {
        ...base,
        checkIns: nextCheckIns
      };
    });
  };

  // 6c. Manual check-out performed by organizer from Dashboard (參加時間 + 路途時間 - 扣除時間)
  const handleManualCheckOut = (attendeeId: string) => {
    const target = combinedAttendees.find(a => a.id === attendeeId);
    if (!target) return;

    const checkInRecord = checkIns.find(
      c => c.id === attendeeId || c.participantId === attendeeId || c.name.trim().toLowerCase() === target.name.trim().toLowerCase()
    );
    if (!checkInRecord) {
      return;
    }

    const checkOutTime = new Date().toISOString();
    const duration = calculateParticipationDuration(checkInRecord.checkInTime, checkOutTime);
    const durationMinutes = duration?.minutes ?? 0;
    const durationDisplay = duration?.display ?? '0分鐘';

    const useTravel = eventInfo.showTravelTime !== false;
    const travelMins = useTravel ? (checkInRecord.travelMinutes ?? target.travelMinutes ?? eventInfo.defaultTravelMinutes ?? 60) : 0;
    const travelDisp = useTravel ? formatMinutesDisplay(travelMins) : undefined;

    const useDeduction = !!eventInfo.showDeductionTime;
    const deductionMins = useDeduction ? (checkInRecord.deductionMinutes ?? eventInfo.defaultDeductionMinutes ?? 60) : 0;
    const deductionDisp = useDeduction ? formatMinutesDisplay(deductionMins) : undefined;
    const deductionReason = useDeduction ? (checkInRecord.deductionReason ?? eventInfo.deductionReason ?? '午休用餐休息時間不計入補休') : undefined;

    const compResult = calculateCompTime(durationMinutes, travelMins, deductionMins);
    const compMins = compResult.compMinutes;
    const compDisp = compResult.compDisplay;

    // Create a virtual stamp for manual sign-out
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 240, 80);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 220, 60);
      ctx.fillStyle = '#d97706';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('承辦人員現場協助簽退', 120, 36);
      ctx.font = '11px sans-serif';
      ctx.fillText(new Date().toLocaleTimeString('zh-TW', { hour12: false }), 120, 56);
    }
    const stampDataUrl = canvas.toDataURL('image/jpeg', 0.8);

    executeMutationAndBroadcast(`承辦人協助簽退: ${target.name}`, base => {
      const nextCheckIns = base.checkIns.map(c => {
        if (c.id === checkInRecord.id) {
          return {
            ...c,
            checkOutTime,
            checkOutSignatureDataUrl: stampDataUrl,
            durationMinutes,
            durationDisplay,
            travelMinutes: travelMins,
            travelDisplay: travelDisp,
            deductionMinutes: deductionMins,
            deductionDisplay: deductionDisp,
            deductionReason: deductionReason,
            compTimeMinutes: compMins,
            compTimeDisplay: compDisp,
            notes: c.notes ? `${c.notes} / 承辦人協助簽退` : '承辦人協助簽退'
          };
        }
        return c;
      });

      return {
        ...base,
        checkIns: nextCheckIns
      };
    });
  };

  // 6d. Update travel time for attendee directly
  const handleUpdateTravelTime = (attendeeId: string, minutes: number) => {
    const targetAttendee = combinedAttendees.find(a => a.id === attendeeId);
    const targetName = targetAttendee ? targetAttendee.name : '學員';

    executeMutationAndBroadcast(`更新路途時間: ${targetName} (${minutes}分鐘)`, base => {
      const nextCheckIns = base.checkIns.map(c => {
        const isMatch =
          c.id === attendeeId ||
          c.participantId === attendeeId ||
          (targetAttendee && c.name.trim().toLowerCase() === targetAttendee.name.trim().toLowerCase());

        if (isMatch) {
          const compResult = calculateCompTime(c.durationMinutes ?? 0, minutes);
          return {
            ...c,
            travelMinutes: minutes,
            travelDisplay: formatMinutesDisplay(minutes),
            compTimeMinutes: compResult.compMinutes,
            compTimeDisplay: compResult.compDisplay
          };
        }
        return c;
      });

      const nextRoster = base.roster.map(r => {
        if (r.id === attendeeId || (targetAttendee && r.name.trim().toLowerCase() === targetAttendee.name.trim().toLowerCase())) {
          return {
            ...r,
            travelMinutes: minutes
          };
        }
        return r;
      });

      return {
        ...base,
        checkIns: nextCheckIns,
        roster: nextRoster
      };
    });
  };

  // 7. Remove single check-in (synced based on latest write, matches checkInId, attendeeId, and name)
  const handleRemoveCheckIn = (attendeeId: string, checkInId?: string, attendeeName?: string) => {
    executeMutationAndBroadcast(`取消報到: ${attendeeName || attendeeId}`, base => {
      const cleanName = attendeeName ? attendeeName.trim().toLowerCase() : '';
      return {
        ...base,
        checkIns: base.checkIns.filter(c => {
          if (checkInId && c.id === checkInId) return false;
          if (c.id === attendeeId) return false;
          if (c.participantId === attendeeId) return false;
          if (cleanName && c.name.trim().toLowerCase() === cleanName) return false;
          return true;
        })
      };
    });
  };

  // 8. Reset all check-in records (synced based on latest write)
  const handleResetAllCheckIns = () => {
    executeMutationAndBroadcast('重設所有簽到紀錄', base => ({
      ...base,
      checkIns: []
    }));
  };

  // 9. Handle toggling verification state (獨立拆分為簽到覆核與簽退覆核，即時雙向同步)
  const handleToggleHrVerify = (attendeeId: string, type: 'checkin' | 'checkout' = 'checkin') => {
    const targetAttendee = combinedAttendees.find(a => a.id === attendeeId);
    const targetName = targetAttendee ? targetAttendee.name : '學員';

    executeMutationAndBroadcast(`${type === 'checkin' ? '簽到' : '簽退'}覆核變更: ${targetName}`, base => {
      const isAlreadyCheckedIn = targetAttendee && (targetAttendee.status === 'CHECKED_IN' || targetAttendee.status === 'WALK_IN');

      let nextCheckIns: CheckInRecord[];

      if (isAlreadyCheckedIn) {
        nextCheckIns = base.checkIns.map(c => {
          const isMatch =
            c.id === attendeeId ||
            c.participantId === attendeeId ||
            (targetAttendee && c.name.trim().toLowerCase() === targetAttendee.name.trim().toLowerCase());

          if (isMatch) {
            const nowIso = new Date().toISOString();
            if (type === 'checkout') {
              const nextVerified = !c.checkOutHrVerified;
              return {
                ...c,
                checkOutHrVerified: nextVerified,
                checkOutHrVerifiedAt: nextVerified ? nowIso : undefined
              };
            } else {
              const nextVerified = !(c.checkInHrVerified ?? c.hrVerified);
              return {
                ...c,
                checkInHrVerified: nextVerified,
                hrVerified: nextVerified,
                checkInHrVerifiedAt: nextVerified ? nowIso : undefined
              };
            }
          }
          return c;
        });
      } else if (targetAttendee && type === 'checkin') {
        // Attendee has not checked in yet, but HR clicks verify -> direct check-in with verification stamp
        const now = new Date();
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 240, 80);
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 2;
          ctx.strokeRect(10, 10, 220, 60);
          ctx.fillStyle = '#4f46e5';
          ctx.font = 'bold 15px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('人事單位現場簽到覆核', 120, 36);
          ctx.font = '11px sans-serif';
          ctx.fillText(now.toLocaleTimeString('zh-TW', { hour12: false }), 120, 56);
        }
        const stampDataUrl = canvas.toDataURL('image/jpeg', 0.8);

        const newRecord: CheckInRecord = {
          id: `hr-checkin-${now.getTime()}`,
          participantId: targetAttendee.id,
          name: targetAttendee.name,
          title: targetAttendee.title,
          department: targetAttendee.department,
          checkInTime: now.toISOString(),
          signatureDataUrl: stampDataUrl,
          isWalkIn: false,
          checkInHrVerified: true,
          hrVerified: true,
          checkInHrVerifiedAt: now.toISOString(),
          notes: '人事單位現場直接簽到覆核'
        };

        nextCheckIns = [newRecord, ...base.checkIns];
      } else {
        nextCheckIns = base.checkIns;
      }

      return {
        ...base,
        checkIns: nextCheckIns
      };
    });
  };

  // Combined real-time attendee comparison list (傳入 eventInfo 完整包含路途時間與扣除時間設定)
  const combinedAttendees = buildCombinedAttendeeList(roster, checkIns, eventInfo);

  const checkedInCount = combinedAttendees.filter(
    a => a.status === 'CHECKED_IN' || a.status === 'WALK_IN'
  ).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Top Application Header */}
      <EventHeader
        eventInfo={eventInfo}
        onUpdateEventInfo={handleUpdateEventInfo}
        activeMode={activeMode}
        onRequestSwitchMode={handleRequestSwitchMode}
        isOrganizerAuthenticated={isOrganizerAuthenticated}
        onOrganizerLogout={handleOrganizerLogout}
        checkedInCount={checkedInCount}
        totalExpectedCount={roster.length}
        myDeviceId={myDeviceIdRef.current}
        lastSyncInfo={lastSyncInfo}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeMode === 'checkin' ? (
          <CheckInForm
            eventInfo={eventInfo}
            roster={roster}
            existingCheckIns={checkIns}
            onCheckInSuccess={handleCheckInSuccess}
            onNavigateToDashboard={() => handleRequestSwitchMode('dashboard')}
          />
        ) : activeMode === 'checkout' ? (
          <CheckOutForm
            eventInfo={eventInfo}
            attendees={combinedAttendees}
            existingCheckIns={checkIns}
            onCheckOutSuccess={handleCheckOutSuccess}
            onToggleHrVerify={handleToggleHrVerify}
            onNavigateToCheckIn={() => handleRequestSwitchMode('checkin')}
            onNavigateToDashboard={() => handleRequestSwitchMode('dashboard')}
          />
        ) : (
          <Dashboard
            eventInfo={eventInfo}
            roster={roster}
            checkIns={checkIns}
            attendees={combinedAttendees}
            onUpdateEventInfo={handleUpdateEventInfo}
            onImportRoster={handleImportRoster}
            onAddRosterParticipant={handleAddRosterParticipant}
            onDeleteRosterParticipant={handleDeleteRosterParticipant}
            onManualCheckIn={handleManualCheckIn}
            onManualCheckOut={handleManualCheckOut}
            onUpdateTravelTime={handleUpdateTravelTime}
            onRemoveCheckIn={handleRemoveCheckIn}
            onResetAllCheckIns={handleResetAllCheckIns}
            onToggleHrVerify={handleToggleHrVerify}
            onNavigateToCheckIn={() => handleRequestSwitchMode('checkin')}
            onNavigateToCheckOut={() => handleRequestSwitchMode('checkout')}
            onLogout={handleOrganizerLogout}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">苗栗縣三義鄉公所培訓或活動簽到系統</span>
            <span>·</span>
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              手機與電腦全端以最新更新為基準即時同步
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>
              目前模式：
              {activeMode === 'checkin'
                ? '現場學員手寫簽到'
                : activeMode === 'checkout'
                ? '學員簽退端 (參加時間主動計算)'
                : '承辦人比對後台 (已解鎖)'}
            </span>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleRequestSwitchMode(activeMode === 'dashboard' ? 'checkin' : 'dashboard')}
              className="text-indigo-600 hover:underline font-semibold cursor-pointer"
            >
              {activeMode === 'dashboard' ? '前往學員簽到端' : '承辦人後台 (需密碼)'}
            </button>
          </div>
        </div>
      </footer>

      {/* Organizer Password Authentication Modal */}
      <OrganizerAuthModal
        isOpen={showAuthModal}
        onSuccess={handleAuthSuccess}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
