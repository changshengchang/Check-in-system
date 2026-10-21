/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { EventInfo, RegisteredParticipant, CheckInRecord } from './types';
import {
  loadEventInfo,
  saveEventInfo,
  loadRoster,
  saveRoster,
  loadCheckIns,
  saveCheckIns,
  buildCombinedAttendeeList
} from './utils/storage';
import {
  fetchEventData,
  updateEventInfoApi,
  submitCheckInApi,
  deleteCheckInApi,
  resetCheckInsApi,
  updateRosterApi,
  addRosterParticipantApi,
  deleteRosterParticipantApi
} from './utils/api';
import {
  getCloudRoomId,
  setCloudRoomId,
  fetchFromCloudRelay,
  pushToCloudRelay,
  checkBackendAvailability,
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
  const [roomId, setRoomIdState] = useState<string>(() => getCloudRoomId());

  // Real-time server sync states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const lastVersionRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);

  // Organizer Authentication state (Required password: nick620504)
  const [isOrganizerAuthenticated, setIsOrganizerAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('organizer_auth_verified') === 'true';
    } catch {
      return false;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Core function to broadcast changes to both local backend and Vercel Global Cloud Relay
  const broadcastSync = async (
    newEventInfo: EventInfo,
    newRoster: RegisteredParticipant[],
    newCheckIns: CheckInRecord[]
  ) => {
    isUpdatingRef.current = true;
    const newVersion = lastVersionRef.current + 1;
    lastVersionRef.current = newVersion;

    const payload: SyncPayload = {
      eventInfo: newEventInfo,
      roster: newRoster,
      checkIns: newCheckIns,
      version: newVersion,
      updatedAt: new Date().toISOString()
    };

    // Save locally
    saveEventInfo(newEventInfo);
    saveRoster(newRoster);
    saveCheckIns(newCheckIns);

    // Push to Vercel Global Cloud Relay (works everywhere, across phones, computers, Vercel)
    pushToCloudRelay(roomId, payload).finally(() => {
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 500);
    });

    // Also attempt local backend if available
    try {
      const hasLocal = await checkBackendAvailability();
      if (hasLocal) {
        updateEventInfoApi(newEventInfo);
        updateRosterApi(newRoster, 'replace');
      }
    } catch {
      // ignore
    }
  };

  // Automated Real-time Synchronization Loop (Sub-2s automatic push & pull)
  useEffect(() => {
    let isMounted = true;

    const syncCheck = async () => {
      if (isUpdatingRef.current) return;
      try {
        // 1. Check Cloud Relay first (supports Vercel serverless / static)
        const cloudData = await fetchFromCloudRelay(roomId);
        if (cloudData && cloudData.version !== undefined && isMounted) {
          if (cloudData.version > lastVersionRef.current) {
            lastVersionRef.current = cloudData.version;
            setEventInfo(cloudData.eventInfo);
            setRoster(cloudData.roster);
            setCheckIns(cloudData.checkIns);
            saveEventInfo(cloudData.eventInfo);
            saveRoster(cloudData.roster);
            saveCheckIns(cloudData.checkIns);
            return;
          }
        }

        // 2. Fallback check local /api/data if available
        const hasLocal = await checkBackendAvailability();
        if (hasLocal && isMounted) {
          const localData = await fetchEventData();
          if (localData && localData.version > lastVersionRef.current) {
            lastVersionRef.current = localData.version;
            setEventInfo(localData.eventInfo);
            setRoster(localData.roster);
            setCheckIns(localData.checkIns);
            saveEventInfo(localData.eventInfo);
            saveRoster(localData.roster);
            saveCheckIns(localData.checkIns);
          }
        }
      } catch (err) {
        console.warn('[Sync] Poll error:', err);
      }
    };

    // Initial check
    syncCheck();

    // Fast automatic sync loop every 1.5 seconds for instant multi-device reflection
    const timer = setInterval(syncCheck, 1500);

    // Recheck immediately when phone screen unlocks or user switches back to browser tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [roomId]);

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

  // Handle event info updates (synced to server and cloud)
  const handleUpdateEventInfo = (updated: EventInfo) => {
    setEventInfo(updated);
    broadcastSync(updated, roster, checkIns);
  };

  // Handle participant check-in submission (synced to server and cloud)
  const handleCheckInSuccess = (record: CheckInRecord) => {
    let nextCheckIns: CheckInRecord[];
    const existingIdx = checkIns.findIndex(
      c => (record.participantId && c.participantId === record.participantId) ||
           c.name.trim().toLowerCase() === record.name.trim().toLowerCase()
    );
    if (existingIdx >= 0) {
      nextCheckIns = [...checkIns];
      nextCheckIns[existingIdx] = record;
    } else {
      nextCheckIns = [record, ...checkIns];
    }

    setCheckIns(nextCheckIns);
    broadcastSync(eventInfo, roster, nextCheckIns);
  };

  // Handle roster Excel/CSV import (synced to server and cloud)
  const handleImportRoster = (newParticipants: RegisteredParticipant[], mode: 'replace' | 'append') => {
    let nextRoster: RegisteredParticipant[];
    if (mode === 'replace') {
      nextRoster = newParticipants;
    } else {
      const existingNames = new Set(roster.map(p => p.name.trim().toLowerCase()));
      const filteredNew = newParticipants.filter(p => !existingNames.has(p.name.trim().toLowerCase()));
      nextRoster = [...roster, ...filteredNew];
    }

    setRoster(nextRoster);
    broadcastSync(eventInfo, nextRoster, checkIns);
  };

  // Handle adding attendee manually (synced to server and cloud)
  const handleAddRosterParticipant = (p: RegisteredParticipant) => {
    const nextRoster = [...roster, p];
    setRoster(nextRoster);
    broadcastSync(eventInfo, nextRoster, checkIns);
  };

  // Handle deleting attendee from roster (synced to server and cloud)
  const handleDeleteRosterParticipant = (id: string) => {
    const nextRoster = roster.filter(p => p.id !== id);
    setRoster(nextRoster);
    broadcastSync(eventInfo, nextRoster, checkIns);
  };

  // Manual check-in performed by organizer (synced to server and cloud)
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

  // Remove single check-in (synced to server and cloud)
  const handleRemoveCheckIn = (checkInId: string) => {
    const nextCheckIns = checkIns.filter(c => c.id !== checkInId && c.participantId !== checkInId);
    setCheckIns(nextCheckIns);
    broadcastSync(eventInfo, roster, nextCheckIns);
  };

  // Reset all check-in records (synced to server and cloud)
  const handleResetAllCheckIns = () => {
    setCheckIns([]);
    broadcastSync(eventInfo, roster, []);
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
        isSyncing={isSyncing}
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
              Vercel 雲端全設備自動即時同步
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
