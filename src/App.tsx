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
import { EventHeader } from './components/EventHeader';
import { CheckInForm } from './components/CheckInForm';
import { Dashboard } from './components/Dashboard';
import { OrganizerAuthModal } from './components/OrganizerAuthModal';

export default function App() {
  const [eventInfo, setEventInfo] = useState<EventInfo>(() => loadEventInfo());
  const [roster, setRoster] = useState<RegisteredParticipant[]>(() => loadRoster());
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(() => loadCheckIns());
  const [activeMode, setActiveMode] = useState<'checkin' | 'dashboard'>('checkin');

  // Real-time server sync states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const lastVersionRef = useRef<number>(0);

  // Organizer Authentication state (Required password: nick620504)
  const [isOrganizerAuthenticated, setIsOrganizerAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('organizer_auth_verified') === 'true';
    } catch {
      return false;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Background real-time synchronization with server
  const syncFromServer = async (showSpinner = false) => {
    if (showSpinner) setIsSyncing(true);
    try {
      const remote = await fetchEventData();
      if (remote) {
        if (remote.version !== lastVersionRef.current) {
          lastVersionRef.current = remote.version;
          setEventInfo(remote.eventInfo);
          setRoster(remote.roster);
          setCheckIns(remote.checkIns);
          // Also update local cache
          saveEventInfo(remote.eventInfo);
          saveRoster(remote.roster);
          saveCheckIns(remote.checkIns);
        }
      }
    } catch (err) {
      console.warn('[Sync] Poll error:', err);
    } finally {
      if (showSpinner) setIsSyncing(false);
    }
  };

  // Initial fetch and periodic polling (every 2.5s for seamless multi-device sync)
  useEffect(() => {
    syncFromServer(true);
    const interval = setInterval(() => {
      syncFromServer(false);
    }, 2500);
    return () => clearInterval(interval);
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

  // Handle event info updates (synced to server)
  const handleUpdateEventInfo = async (updated: EventInfo) => {
    setEventInfo(updated);
    saveEventInfo(updated);
    await updateEventInfoApi(updated);
    syncFromServer(false);
  };

  // Handle participant check-in submission (synced to server)
  const handleCheckInSuccess = async (record: CheckInRecord) => {
    setCheckIns(prev => {
      const existingIdx = prev.findIndex(
        c => (record.participantId && c.participantId === record.participantId) ||
             c.name.trim().toLowerCase() === record.name.trim().toLowerCase()
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = record;
        return copy;
      }
      return [record, ...prev];
    });

    await submitCheckInApi(record);
    syncFromServer(false);
  };

  // Handle roster Excel/CSV import (synced to server)
  const handleImportRoster = async (newParticipants: RegisteredParticipant[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setRoster(newParticipants);
    } else {
      const existingNames = new Set(roster.map(p => p.name.trim().toLowerCase()));
      const filteredNew = newParticipants.filter(p => !existingNames.has(p.name.trim().toLowerCase()));
      setRoster(prev => [...prev, ...filteredNew]);
    }

    await updateRosterApi(newParticipants, mode);
    syncFromServer(false);
  };

  // Handle adding attendee manually (synced to server)
  const handleAddRosterParticipant = async (p: RegisteredParticipant) => {
    setRoster(prev => [...prev, p]);
    await addRosterParticipantApi(p);
    syncFromServer(false);
  };

  // Handle deleting attendee from roster (synced to server)
  const handleDeleteRosterParticipant = async (id: string) => {
    setRoster(prev => prev.filter(p => p.id !== id));
    await deleteRosterParticipantApi(id);
    syncFromServer(false);
  };

  // Manual check-in performed by organizer (synced to server)
  const handleManualCheckIn = async (attendee: { id: string; name: string; title: string; department?: string }) => {
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

    const stampDataUrl = canvas.toDataURL('image/png');
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

    await handleCheckInSuccess(newRecord);
  };

  // Remove single check-in (synced to server)
  const handleRemoveCheckIn = async (checkInId: string) => {
    setCheckIns(prev => prev.filter(c => c.id !== checkInId && c.participantId !== checkInId));
    await deleteCheckInApi(checkInId);
    syncFromServer(false);
  };

  // Reset all check-in records (synced to server)
  const handleResetAllCheckIns = async () => {
    setCheckIns([]);
    await resetCheckInsApi();
    syncFromServer(false);
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
        onManualSync={() => syncFromServer(true)}
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
            <span>手機與電腦多端即時資料雲端同步</span>
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
