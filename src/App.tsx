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
  buildCombinedAttendeeList
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
import { Dashboard } from './components/Dashboard';
import { OrganizerAuthModal } from './components/OrganizerAuthModal';

export default function App() {
  const [eventInfo, setEventInfo] = useState<EventInfo>(() => loadEventInfo());
  const [roster, setRoster] = useState<RegisteredParticipant[]>(() => loadRoster());
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(() => loadCheckIns());
  const [activeMode, setActiveMode] = useState<'checkin' | 'dashboard'>('checkin');

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

  // Core Sync Engine: Apply mutation on the freshest remote base and broadcast to cloud
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
      const roomId = getCloudRoomId();

      // 1. Fetch freshest cloud state first so changes from the other device are never lost
      const freshCloud = await fetchFromCloudRelay(roomId);
      const baseRoster = freshCloud && Array.isArray(freshCloud.roster) ? freshCloud.roster : roster;
      const baseCheckIns = freshCloud && Array.isArray(freshCloud.checkIns) ? freshCloud.checkIns : checkIns;
      const baseEvent = freshCloud && freshCloud.eventInfo ? freshCloud.eventInfo : eventInfo;

      const base = {
        eventInfo: baseEvent,
        roster: baseRoster,
        checkIns: baseCheckIns
      };

      // 2. Apply addition, deletion, or modification
      const next = mutation(base);

      // 3. Stamp with current millisecond timestamp
      const now = Date.now();
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

  // High-frequency Real-time Auto-Sync Loop (Polls every 1s, ensures both phone and computer stay in sync)
  useEffect(() => {
    let isMounted = true;
    const roomId = getCloudRoomId();

    const checkCloudUpdates = async () => {
      if (isBroadcastingRef.current) return;
      try {
        const remote = await fetchFromCloudRelay(roomId);
        if (!remote || typeof remote.updatedAt !== 'number' || !isMounted) return;

        // If cloud data is newer than this device's last synced time, accept and update immediately!
        if (remote.updatedAt > lastSyncedUpdatedAtRef.current) {
          lastSyncedUpdatedAtRef.current = remote.updatedAt;
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
        console.warn('[Sync] Poll error:', err);
      }
    };

    // Immediate initial load on mount to get latest cloud roster
    checkCloudUpdates();

    // 1-second auto-sync interval
    const interval = setInterval(checkCloudUpdates, 1000);

    // Instant re-check when phone screen wakes up or browser tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkCloudUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Request mode switcher with password gate
  const handleRequestSwitchMode = (targetMode: 'checkin' | 'dashboard') => {
    if (targetMode === 'checkin') {
      setActiveMode('checkin');
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
  const handleImportRoster = (newParticipants: RegisteredParticipant[], mode: 'replace' | 'append') => {
    executeMutationAndBroadcast(`匯入名冊 (${newParticipants.length}人)`, base => {
      let nextRoster: RegisteredParticipant[];
      if (mode === 'replace') {
        nextRoster = newParticipants;
      } else {
        const existingNames = new Set(base.roster.map(p => p.name.trim().toLowerCase()));
        const filteredNew = newParticipants.filter(p => !existingNames.has(p.name.trim().toLowerCase()));
        nextRoster = [...base.roster, ...filteredNew];
      }
      return {
        ...base,
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
  const handleManualCheckIn = (attendee: { id: string; name: string; title: string; department?: string }) => {
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
      checkInTime: new Date().toISOString(),
      signatureDataUrl: stampDataUrl,
      isWalkIn: false,
      notes: '活動承辦人手動協助報到'
    };

    handleCheckInSuccess(newRecord);
  };

  // 7. Remove single check-in (synced based on latest write)
  const handleRemoveCheckIn = (checkInId: string) => {
    executeMutationAndBroadcast('取消報到紀錄', base => ({
      ...base,
      checkIns: base.checkIns.filter(c => c.id !== checkInId && c.participantId !== checkInId)
    }));
  };

  // 8. Reset all check-in records (synced based on latest write)
  const handleResetAllCheckIns = () => {
    executeMutationAndBroadcast('重設所有簽到紀錄', base => ({
      ...base,
      checkIns: []
    }));
  };

  // Combined real-time attendee comparison list
  const combinedAttendees = buildCombinedAttendeeList(roster, checkIns);

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
        ) : (
          <Dashboard
            eventInfo={eventInfo}
            roster={roster}
            checkIns={checkIns}
            attendees={combinedAttendees}
            onImportRoster={handleImportRoster}
            onAddRosterParticipant={handleAddRosterParticipant}
            onDeleteRosterParticipant={handleDeleteRosterParticipant}
            onManualCheckIn={handleManualCheckIn}
            onRemoveCheckIn={handleRemoveCheckIn}
            onResetAllCheckIns={handleResetAllCheckIns}
            onNavigateToCheckIn={() => handleRequestSwitchMode('checkin')}
            onLogout={handleOrganizerLogout}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">員工訓練或活動報到管理系統</span>
            <span>·</span>
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              手機與電腦全端以最新更新為基準即時同步
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>目前模式：{activeMode === 'checkin' ? '現場學員手寫簽到' : '承辦人比對後台 (已解鎖)'}</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleRequestSwitchMode(activeMode === 'checkin' ? 'dashboard' : 'checkin')}
              className="text-indigo-600 hover:underline font-semibold cursor-pointer"
            >
              切換至{activeMode === 'checkin' ? '承辦人後台 (需密碼)' : '學員簽到端'}
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
