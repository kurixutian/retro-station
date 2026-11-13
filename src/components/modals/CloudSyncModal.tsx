import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  X,
  Check,
  RefreshCw,
  ShieldCheck,
  LogOut,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileWarning,
  HardDrive,
  Download,
  Upload,
  Trash2,
  KeyRound,
  Gamepad2,
} from 'lucide-react';
import { Theme } from '../../types';
import { ModalShell } from '../common/ModalShell';
import {
  getSyncStatus,
  subscribeSyncStatus,
  getSyncReport,
  syncNow,
  signInWithGoogle,
  signOutGoogle,
  getCachedUserProfile,
  getCustomGoogleClientId,
  setGoogleClientId,
  setRomSyncEnabled,
  isRomSyncEnabled,
  deleteAllCloudSaves,
  CloudSyncStatus,
  SyncReport,
  GoogleUserProfile,
} from '../../cloudSync';
import { createBackupFile, downloadBackup, importBackupFile } from '../../services/backup';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  showToast: (msg: string) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  theme,
  showToast,
}) => {
  const [user, setUser] = useState<GoogleUserProfile | null>(getCachedUserProfile());
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('unlinked');
  const [statusDetails, setStatusDetails] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmClearCloud, setConfirmClearCloud] = useState(false);
  const [report, setReport] = useState<SyncReport>(getSyncReport());
  const [clientIdInput, setClientIdInput] = useState<string>(getCustomGoogleClientId() || '');
  const [romSyncOn, setRomSyncOn] = useState<boolean>(() => isRomSyncEnabled());

  // Manual Backup state
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const current = getSyncStatus();
    setUser(current.user);
    setSyncStatus(current.status);
    setStatusDetails(current.details);
    setLastSyncTime(current.lastSyncTime);
    setClientIdInput(getCustomGoogleClientId() || '');
    setReport(getSyncReport());
    setConfirmDisconnect(false);
    setConfirmClearCloud(false);
    setRomSyncOn(isRomSyncEnabled());

    const unsub = subscribeSyncStatus((status, details) => {
      setSyncStatus(status);
      setStatusDetails(details);
      const updated = getSyncStatus();
      setLastSyncTime(updated.lastSyncTime);
      setUser(updated.user);
      if (status === 'idle' || status === 'error' || status === 'needs_reauth') {
        setReport(getSyncReport());
      }
    });

    return () => unsub();
  }, [isOpen]);

  // Escape-to-close: must sit above the isOpen guard so hook order stays stable
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSignInAndSync = async () => {
    setIsSyncing(true);
    try {
      const ok = await signInWithGoogle();
      if (!ok) {
        showToast('Google sign-in was cancelled or blocked');
        return;
      }
      setUser(getCachedUserProfile());
      const res = await syncNow(true);
      setReport(getSyncReport());
      if (res.success) {
        showToast(
          `Synced with Google Drive (↓${res.pulledCount} pulled, ↑${res.pushedCount} pushed)`
        );
      } else {
        showToast(res.error || 'Connected, but sync encountered an error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncNow(true);
      setReport(getSyncReport());
      if (res.success) {
        if (res.pulledCount > 0 || res.pushedCount > 0) {
          showToast(
            `Google Drive Sync complete! (↓${res.pulledCount} pulled, ↑${res.pushedCount} pushed)`
          );
        } else {
          showToast('Google Drive is up to date!');
        }
      } else {
        showToast(res.error || 'Sync failed — check report below');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleRomSync = () => {
    const next = !romSyncOn;
    setRomSyncOn(next);
    setRomSyncEnabled(next);
    if (next) {
      showToast('ROM sync ON — uploading library to Drive in background');
    } else {
      showToast('ROM sync OFF — files already in Drive are kept until you clear them');
    }
  };

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      setTimeout(() => setConfirmDisconnect(false), 4000);
      return;
    }
    await signOutGoogle();
    setUser(null);
    setConfirmDisconnect(false);
    showToast('Disconnected from Google Drive (local saves kept safe)');
  };

  const handleClearCloud = async () => {
    if (!confirmClearCloud) {
      setConfirmClearCloud(true);
      setTimeout(() => setConfirmClearCloud(false), 4000);
      return;
    }
    setIsSyncing(true);
    try {
      const ok = await deleteAllCloudSaves();
      setConfirmClearCloud(false);
      if (ok) {
        showToast('Cleared all RetroStation files from Google Drive');
      } else {
        showToast('Could not clear Google Drive files');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportBackup = async () => {
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const backup = await createBackupFile();
      downloadBackup(backup);
      const count = Object.keys(backup.items).length;
      setBackupMsg(`Exported ${count} save item(s) & ${backup.lists.retro_games?.length || 0} game(s).`);
      showToast('Backup file downloaded!');
    } catch (e: any) {
      setBackupMsg(`Export failed: ${e?.message || 'unknown error'}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const raw = await file.text();
      const res = await importBackupFile(raw);
      if (res.ok) {
        setBackupMsg(
          `Restored ${res.appliedListItemCount} game(s) & ${res.appliedItems} save item(s).`
        );
        showToast(`Restored ${res.appliedItems} save items from backup!`);
      } else {
        setBackupMsg(`Restore error: ${res.error || 'invalid file'}`);
      }
    } catch (err: any) {
      setBackupMsg(`Restore error: ${err?.message || 'could not read file'}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const statusColor =
    syncStatus === 'syncing' || isSyncing
      ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      : syncStatus === 'error'
        ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
        : syncStatus === 'needs_reauth'
          ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
          : syncStatus === 'offline'
            ? 'text-zinc-400 border-zinc-700 bg-zinc-800/60'
            : user
              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
              : 'text-zinc-400 border-zinc-700 bg-zinc-800/60';

  const statusLabel =
    syncStatus === 'syncing' || isSyncing
      ? 'syncing'
      : syncStatus === 'error' || syncStatus === 'needs_reauth' || syncStatus === 'offline'
        ? 'not synced'
        : user
          ? 'synced'
          : 'not linked';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="cloud-sync-dialog-title"
      closeOnScrim
      panelClassName={`relative w-full max-w-lg max-h-[90vh] shadow-xl ${
        theme.isLight
          ? 'bg-[#eae6dd] border-[#cfcac0] text-[#121214]'
          : 'bg-[#131316] border-[#222227] text-[#f4f4f6]'
      }`}
    >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          theme.isLight ? 'border-[#cfcac0] bg-[#dedad0]' : 'border-[#222227] bg-[#0a0a0c]'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 id="cloud-sync-dialog-title" className={`text-base font-bold tracking-tight flex items-center gap-2 ${
                theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'
              }`}>
                Cloud Save & Backup
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}
                >
                  {statusLabel}
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition cursor-pointer tactile-btn border ${
              theme.isLight
                ? 'bg-[#dedad0] hover:bg-[#d5d0c5] text-[#121214] border-[#cfcac0]'
                : 'bg-[#1c1c21] hover:bg-[#25252c] text-[#f4f4f6] border-[#222227]'
            }`}
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {/* 1. GOOGLE DRIVE SYNC SECTION */}
          {user ? (
            <div className="space-y-3">
              <div className={`p-4 rounded-2xl border space-y-3 ${
                theme.isLight ? 'bg-stone-100 border-stone-300' : 'bg-zinc-950/90 border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name || 'User'}
                        className="w-10 h-10 rounded-full border border-emerald-500/40 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-500 font-black text-sm shrink-0">
                        {(user.name || user.email || 'G')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className={`text-xs font-extrabold truncate ${
                        theme.isLight ? 'text-zinc-900' : 'text-white'
                      }`}>
                        {user.name || 'Google Drive Account'}
                      </div>
                      <div className="text-[11px] text-emerald-500 font-medium truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[11px] shrink-0 ${theme.isLight ? 'text-stone-500' : 'text-zinc-400'}`}>
                    {lastSyncTime ? `Last sync: ${lastSyncTime}` : statusDetails || 'Ready'}
                  </span>
                </div>

                {syncStatus === 'needs_reauth' && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Google session expired. Tap Reconnect & Sync below.</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing || syncStatus === 'syncing'}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-black text-xs transition shadow-lg shadow-emerald-500/10 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${
                        isSyncing || syncStatus === 'syncing' ? 'animate-spin' : ''
                      }`}
                    />
                    {isSyncing || syncStatus === 'syncing'
                      ? 'Syncing...'
                      : syncStatus === 'needs_reauth'
                        ? 'Reconnect & Sync'
                        : 'Sync Now'}
                  </button>

                  <button
                    onClick={handleDisconnect}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border font-bold text-xs transition cursor-pointer ${
                      confirmDisconnect
                        ? theme.isLight
                          ? 'bg-rose-500/15 border-rose-500 text-rose-700'
                          : 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : theme.isLight
                          ? 'bg-stone-200 hover:bg-stone-300 border-stone-300 text-zinc-800'
                          : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-300'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    {confirmDisconnect ? 'Tap to Confirm' : 'Sign Out'}
                  </button>
                </div>

                {/* ROM Files Sync toggle (opt-in — uploads/downloads can be large) */}
                <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                  theme.isLight ? 'bg-stone-200/80 border-stone-300' : 'bg-zinc-900/70 border-zinc-800/80'
                }`}>
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Gamepad2 className={`w-4 h-4 shrink-0 mt-0.5 ${theme.isLight ? 'text-sky-600' : 'text-sky-400'}`} />
                    <div className="min-w-0">
                      <div className={`text-[11px] font-extrabold flex items-center gap-1.5 ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>
                        ROM Files {romSyncOn ? 'Synced' : 'Not Synced'}
                      </div>
                      <p className={`text-[10px] leading-relaxed ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                        {romSyncOn
                          ? 'ROMs upload to your private Drive and restore automatically on a new device. Use Wi-Fi for large libraries.'
                          : 'Turn this on to upload imported ROM files, so a new device downloads them automatically instead of re-finding and re-downloading each ROM.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleRomSync}
                    role="switch"
                    aria-checked={romSyncOn}
                    aria-label="Sync ROM files to Google Drive"
                    className={`relative w-11 h-6 rounded-full shrink-0 transition-colors cursor-pointer focus:outline-none ${theme.focusRing} ${
                      romSyncOn ? 'bg-emerald-500' : theme.isLight ? 'bg-stone-400' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform transform ${
                        romSyncOn ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Sync Report Panel */}
              {report.at > 0 && (
                <div className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
                  theme.isLight ? 'bg-stone-200/80 border-stone-300' : 'bg-zinc-900/70 border-zinc-800/80'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${theme.isLight ? 'text-zinc-900' : 'text-zinc-300'}`}>Last Sync Report</span>
                    <span className={`text-[11px] font-mono ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                      ↓ {report.pulled} pulled · ↑ {report.pushed} pushed
                    </span>
                  </div>

                  {report.skipped.length > 0 && (
                    <div className={`p-2.5 rounded-xl border space-y-1 ${
                      theme.isLight
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-900'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <FileWarning className={`w-3.5 h-3.5 shrink-0 ${theme.isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                        <span>{report.skipped.length} item(s) skipped:</span>
                      </div>
                      <ul className={`text-[11px] pl-5 list-disc space-y-0.5 ${theme.isLight ? 'text-amber-900/90' : 'text-amber-200/90'}`}>
                        {report.skipped.slice(0, 4).map((s, idx) => (
                          <li key={idx} className="break-all">
                            <span className="font-mono">{s.key}</span> — {s.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {report.errors.length > 0 && (
                    <div className={`p-2.5 rounded-xl border space-y-1 ${
                      theme.isLight
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-900'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${theme.isLight ? 'text-rose-600' : 'text-rose-400'}`} />
                        <span>{report.errors.length} error(s):</span>
                      </div>
                      <ul className={`text-[11px] pl-5 list-disc space-y-0.5 ${theme.isLight ? 'text-rose-900/90' : 'text-rose-200/90'}`}>
                        {report.errors.slice(0, 4).map((err, idx) => (
                          <li key={idx} className="break-all">
                            {err.key ? <span className="font-mono">{err.key}: </span> : null}
                            {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={`p-4 rounded-2xl border space-y-3 ${
              theme.isLight ? 'bg-[#dedad0]/60 border-[#cfcac0]' : 'bg-[#18181c] border-[#26262c]'
            }`}>
              <div className="space-y-1">
                <h3 className={`text-sm font-extrabold ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>
                  Google Drive Auto-Sync
                </h3>
                <p className={`text-xs leading-relaxed ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                  Sign in with Google to automatically sync save states, battery saves (.srm),
                  settings (theme, controls, shaders), and your game library to your private
                  Google Drive <span className={`font-semibold ${theme.isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>appDataFolder</span>.
                  Turn on "ROM Files" (shown once linked) to sync the ROM binaries too.
                </p>
              </div>
              <button
                onClick={handleSignInAndSync}
                disabled={isSyncing}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-950 font-black text-xs flex items-center justify-center gap-2.5 transition shadow-lg cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isSyncing ? 'Connecting...' : 'Sign in with Google Drive'}</span>
              </button>
            </div>
          )}

          {/* 2. MANUAL FILE BACKUP SECTION (Always available, 100% offline & reliable) */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            theme.isLight ? 'border-amber-500/40 bg-amber-500/10' : 'border-amber-500/25 bg-amber-500/5'
          }`}>
            <div className={`flex items-center gap-2 font-extrabold text-xs ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>
              <HardDrive className={`w-4 h-4 ${theme.isLight ? 'text-amber-600' : 'text-amber-400'}`} />
              <span>Manual Backup File (.json)</span>
            </div>

            {backupMsg && (
              <div className={`p-2 rounded-lg border text-[11px] font-bold break-words ${
                theme.isLight
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-900'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
              }`}>
                {backupMsg}
              </div>
            )}

            <p className={`text-xs leading-relaxed ${theme.isLight ? 'text-stone-700' : 'text-zinc-400'}`}>
              Export all your ROMs, save states, battery saves (.srm), and game library into a
              single file. You can save it to your device or Google Drive manually and import it
              anywhere.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleExportBackup}
                disabled={backupBusy}
                className="py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{backupBusy ? 'Working...' : 'Export'}</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={backupBusy}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition active:scale-95 disabled:opacity-50 cursor-pointer ${
                  theme.isLight
                    ? 'bg-stone-200 hover:bg-stone-300 text-zinc-900 border-stone-300'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportBackup}
            />
          </div>

          {/* Info Box */}
          <div className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
            theme.isLight
              ? 'bg-stone-200/80 border-stone-300 text-stone-700'
              : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400'
          }`}>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${theme.isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <p className="leading-relaxed">
                <span className={`font-bold ${theme.isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>Zero Server Bills & Private:</span>{' '}
                Everything lives in your own Google Drive hidden{' '}
                <span className={`font-semibold ${theme.isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>appDataFolder</span>: saves, settings
                {romSyncOn ? ', and your imported ROM files' : ''}.{' '}
                {!romSyncOn && (
                  <>
                    <span className={`font-semibold ${theme.isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>ROM binaries are not uploaded</span>{' '}
                    (turn on "ROM Files" above to sync them).{' '}
                  </>
                )}
                On a new device: sign in once and your library, saves, settings
                {romSyncOn ? ' and ROMs' : ''} restore automatically.
              </p>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className={`border-t pt-2 ${theme.isLight ? 'border-stone-300' : 'border-zinc-800/80'}`}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`w-full flex items-center justify-between py-2 text-xs font-bold transition cursor-pointer ${
                theme.isLight ? 'text-stone-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <KeyRound className={`w-3.5 h-3.5 ${theme.isLight ? 'text-stone-500' : 'text-zinc-500'}`} />
                Advanced / Self-Hosted OAuth Settings
              </span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAdvanced && (
              <div className={`mt-2 p-3.5 rounded-2xl border space-y-3 ${
                theme.isLight ? 'bg-stone-200/80 border-stone-300' : 'bg-zinc-950/80 border-zinc-800/80'
              }`}>
                <div>
                  <label className={`block text-[11px] font-bold mb-1 ${theme.isLight ? 'text-zinc-900' : 'text-zinc-300'}`}>
                    Custom Google OAuth Client ID (Optional)
                  </label>
                  <p className={`text-[11px] mb-2 leading-relaxed ${theme.isLight ? 'text-stone-600' : 'text-zinc-500'}`}>
                    Leave blank to use the built-in Client ID. If hosting on your own domain,
                    paste your own Google Web Client ID here.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      placeholder="Your Google OAuth Web Client ID"
                      className={`flex-1 px-3 py-2 rounded-xl border font-mono text-xs focus:outline-none focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                        theme.isLight
                          ? 'bg-white border-stone-300 text-zinc-900 placeholder:text-stone-400'
                          : 'bg-zinc-900 border-zinc-700/80 text-white'
                      }`}
                    />
                    <button
                      onClick={() => {
                        setGoogleClientId(clientIdInput);
                        showToast(
                          clientIdInput.trim()
                            ? 'Custom Google Client ID saved'
                            : 'Reverted to default Google Client ID'
                        );
                      }}
                      className={`px-3 py-2 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${
                        theme.isLight
                          ? 'bg-stone-300 hover:bg-stone-400/70 text-zinc-900'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                      }`}
                    >
                      Save
                    </button>
                  </div>
                </div>

                {user && (
                  <div className={`pt-2 border-t flex items-center justify-between gap-3 ${
                    theme.isLight ? 'border-stone-300' : 'border-zinc-800/80'
                  }`}>
                    <span className={`text-[11px] ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                      Delete all RetroStation saves from Google Drive
                    </span>
                    <button
                      onClick={handleClearCloud}
                      disabled={isSyncing}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
                        confirmClearCloud
                          ? 'bg-rose-500 text-white'
                          : theme.isLight
                            ? 'bg-rose-500/15 border border-rose-500/40 text-rose-700 hover:bg-rose-500/25'
                            : 'bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {confirmClearCloud ? 'Confirm Wipe Cloud' : 'Clear Drive Saves'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </ModalShell>
  );
};
