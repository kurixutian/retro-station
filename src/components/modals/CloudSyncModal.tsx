import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  X,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  Server,
  LogOut,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileWarning,
} from 'lucide-react';
import { Theme } from '../../types';
import {
  getSyncCode,
  setSyncCode,
  clearSyncCode,
  generateSyncCode,
  setSyncEndpoint,
  getCustomEndpoint,
  getSyncStatus,
  subscribeSyncStatus,
  getSyncReport,
  getVaultHealth,
  getSyncEndpoint,
  syncNow,
  CloudSyncStatus,
  SyncReport,
} from '../../cloudSync';

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
  const [syncCode, setLocalSyncCode] = useState<string | null>(getSyncCode());
  const [inputCode, setInputCode] = useState('');
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('unlinked');
  const [statusDetails, setStatusDetails] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [report, setReport] = useState<SyncReport>(getSyncReport());
  const [healthProblem, setHealthProblem] = useState<string | null>(null);
  const [endpointInput, setEndpointInput] = useState<string>(getCustomEndpoint() || '');

  const runVaultHealthCheck = useCallback(async () => {
    try {
      const health = await getVaultHealth(getSyncEndpoint());
      if (!health.ok) {
        setHealthProblem(
          health.storage === 'unreachable'
            ? 'Vault server unreachable right now'
            : `Vault server reports a misconfiguration: ${health.storage}`
        );
      } else {
        setHealthProblem(null);
      }
    } catch (e) {
      setHealthProblem('Vault server unreachable right now');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const current = getSyncStatus();
    setLocalSyncCode(current.syncCode);
    setSyncStatus(current.status);
    setStatusDetails(current.details);
    setLastSyncTime(current.lastSyncTime);
    setEndpointInput(getCustomEndpoint() || '');
    setReport(getSyncReport());
    runVaultHealthCheck();

    const unsub = subscribeSyncStatus((status, details) => {
      setSyncStatus(status);
      setStatusDetails(details);
      const updated = getSyncStatus();
      setLastSyncTime(updated.lastSyncTime);
      setLocalSyncCode(updated.syncCode);
      if (status === 'idle' || status === 'error') {
        setReport(getSyncReport());
      }
    });

    return () => unsub();
  }, [isOpen, runVaultHealthCheck]);

  if (!isOpen) return null;

  const copyCode = async () => {
    if (!syncCode) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(syncCode);
      } else {
        const input = document.createElement('input');
        input.value = syncCode;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      showToast('Sync Code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      showToast(`Code: ${syncCode}`);
    }
  };

  const afterSync = (res: { success: boolean; pulledCount: number; pushedCount: number; error?: string }) => {
    setReport(getSyncReport());
    runVaultHealthCheck();
    if (res.success) {
      showToast(`Vault synced! ${res.pushedCount} uploaded, ${res.pulledCount} downloaded`);
    } else {
      showToast(`Sync issue: ${res.error || 'will retry automatically'}`);
    }
  };

  const handleGenerateCode = async () => {
    const newCode = generateSyncCode();
    setSyncCode(newCode);
    setLocalSyncCode(newCode);
    showToast(`Generated: ${newCode}`);
    setIsSyncing(true);
    const res = await syncNow(true);
    setIsSyncing(false);
    afterSync(res);
  };

  const handleConnectCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean || clean.length < 3) {
      showToast('Please enter a valid Sync Code');
      return;
    }
    // Fresh device: start from a clean local meta so vault contents strictly
    // mirror the other device instead of racing with unknown local state.
    try {
      localStorage.removeItem('retro_sync_meta');
    } catch (err) {}
    setSyncCode(clean);
    setLocalSyncCode(clean);
    setInputCode('');
    showToast(`Connected to vault ${clean}. Restoring progress...`);

    setIsSyncing(true);
    const res = await syncNow(true);
    setIsSyncing(false);
    afterSync(res);
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const res = await syncNow(true);
    setIsSyncing(false);
    afterSync(res);
  };

  const handleDisconnect = () => {
    clearSyncCode();
    setLocalSyncCode(null);
    setSyncStatus('unlinked');
    setConfirmDisconnect(false);
    showToast('Disconnected from Sync Code');
  };

  const handleSaveEndpoint = async () => {
    const clean = endpointInput.trim();
    if (!clean) {
      handleResetEndpoint();
      return;
    }
    setSyncEndpoint(clean);
    showToast('Vault endpoint saved. Testing connection...');
    setIsSyncing(true);
    const res = await syncNow(true);
    setIsSyncing(false);
    afterSync(res);
  };

  const handleResetEndpoint = () => {
    setSyncEndpoint(null);
    setEndpointInput('');
    showToast('Reset vault endpoint to default');
    runVaultHealthCheck();
  };

  const attemptedEndpoint = getSyncEndpoint();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)',
      }}
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto hardware-panel">
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Cloud Save Vault</h2>
              <p className="text-[10px] text-zinc-400 font-medium">
                Free Zero-Cost Sync • Works 100% Offline On The Go
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white tactile-btn border border-zinc-800"
            aria-label="Close Cloud Save Vault"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto modal-scroll p-5 space-y-5">
          {/* Offline-First Reassurance Banner */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs space-y-1">
              <div className="font-extrabold text-white flex items-center gap-1.5">
                <span>Plays Offline Anywhere</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider bg-emerald-500/20 text-emerald-300">
                  Offline-First
                </span>
              </div>
              <p className="text-zinc-400 leading-snug">
                Your saves, states, and cartridge SRAM are saved locally to your device immediately.
                When connected to Wi-Fi or mobile data, your progress syncs automatically.
              </p>
              <p className="text-zinc-500 leading-snug">
                <span className="text-emerald-400 font-bold">Synced:</span> save states, cartridge SRAM/RTC, cover art, library&nbsp;•&nbsp;
                <span className="text-amber-400 font-bold">Not synced:</span> ROM files — link them again on each new device.
              </p>
            </div>
          </div>

          {/* ACTIVE STATE: SYNC CODE LINKED */}
          {syncCode ? (
            <div className="space-y-4">
              {/* Sync Code Display Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-sky-500/30 shadow-lg space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-black tracking-wider uppercase text-zinc-400">
                    Active Sync Code
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        syncStatus === 'offline'
                          ? 'bg-amber-400'
                          : syncStatus === 'error'
                          ? 'bg-rose-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span className="text-[11px] font-bold text-zinc-300 capitalize">
                      {syncStatus === 'offline'
                        ? 'Offline'
                        : syncStatus === 'syncing'
                        ? 'Syncing'
                        : syncStatus === 'error'
                        ? 'Connection Warning'
                        : 'Active'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-lg sm:text-xl font-black text-sky-300 bg-black/60 px-4 py-3 rounded-xl border border-sky-500/20 tracking-wider select-all text-center">
                    {syncCode}
                  </div>
                  <button
                    onClick={copyCode}
                    className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition active:scale-95 shrink-0 flex items-center justify-center"
                    title="Copy Sync Code"
                    aria-label="Copy Sync Code"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-emerald-400 stroke-[3]" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Error / Connection Notice */}
                {syncStatus === 'error' && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 leading-snug space-y-1">
                    <div className="font-extrabold flex items-center gap-1.5 text-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Sync Notice:</span>
                    </div>
                    <p>{statusDetails || 'Could not connect to cloud vault.'}</p>
                    <p className="text-zinc-400 text-[10px] pt-1">
                      Retrying automatically. You can also tap &quot;Sync Now&quot; to retry now.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-zinc-400 text-center leading-snug">
                  Enter this code on your phone, tablet, or PC to access all your save files and imported games!
                </p>

                {lastSyncTime && (
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Last Cloud Sync:</span>
                    <span className="font-mono text-zinc-200">{lastSyncTime}</span>
                  </div>
                )}
              </div>

              {/* Last Sync Report */}
              {(report.pushed > 0 ||
                report.pulled > 0 ||
                report.skipped.length > 0 ||
                report.at > 0) && (
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black tracking-wider uppercase text-zinc-500">
                    <span>Last Sync Report</span>
                    <span className="text-zinc-600 normal-case font-medium">
                      {new Date(report.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[11px] font-bold">
                    <span className="text-emerald-400">↓ {report.pulled} pulled</span>
                    <span className="text-sky-400">↑ {report.pushed} pushed</span>
                    {report.skipped.length > 0 && (
                      <span className="text-amber-400">⚠ {report.skipped.length} skipped</span>
                    )}
                  </div>
                  {report.skipped.map((s, i) => (
                    <div
                      key={`skip-${i}`}
                      className="flex items-start gap-2 text-[10px] text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-2 py-1.5"
                    >
                      <FileWarning className="w-3 h-3 mt-0.5 shrink-0" />
                      <span className="font-mono break-all">{s.key}</span>
                      <span className="text-zinc-400 shrink-0">— {s.reason}</span>
                    </div>
                  ))}
                  {report.errors.map((er, i) => (
                    <div
                      key={`err-${i}`}
                      className="flex items-start gap-2 text-[10px] text-rose-300/90 bg-rose-500/5 border border-rose-500/20 rounded-lg px-2 py-1.5"
                    >
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      {er.key && <span className="font-mono break-all">{er.key}</span>}
                      <span className="text-zinc-300 break-words">{er.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons: Sync Now & Disconnect */}
              <div className="flex gap-2.5">
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${
                    isSyncing
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : `${theme.accentBg}`
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing Vault...' : 'Sync Now'}</span>
                </button>

                {confirmDisconnect ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleDisconnect}
                      className="py-3 px-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white transition active:scale-95"
                    >
                      Disconnect?
                    </button>
                    <button
                      onClick={() => setConfirmDisconnect(false)}
                      className="py-3 px-2.5 rounded-xl text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDisconnect(true)}
                    className="py-3 px-4 rounded-xl font-bold text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-rose-400 transition active:scale-95 flex items-center gap-1.5"
                    title="Disconnect Code"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Disconnect</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* UNLINKED STATE: GENERATE OR ENTER CODE */
            <div className="space-y-4">
              {/* Option A: Generate New Code */}
              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
                <div className="flex items-center gap-2 text-white text-xs font-black">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>New to Cloud Save?</span>
                </div>
                <p className="text-xs text-zinc-400 leading-snug">
                  Generate a private Sync Code with 1 tap. All your cartridge saves, save states, and imported game covers will be backed up automatically.
                </p>
                <button
                  onClick={handleGenerateCode}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${theme.accentBg}`}
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Generate New Sync Code</span>
                </button>
              </div>

              {/* Option B: Enter Existing Code */}
              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-white text-xs font-black">
                  <Cloud className="w-4 h-4 text-sky-400" />
                  <span>Already Have a Sync Code?</span>
                </div>
                <p className="text-xs text-zinc-400 leading-snug">
                  Enter your code from another device to immediately sync and restore your progress.
                </p>

                <form onSubmit={handleConnectCode} className="space-y-2.5">
                  <div className="relative">
                    <input
                      type="text"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      placeholder="e.g. RETRO-7K9P-4X2B"
                      aria-label="Enter Sync Code"
                      className="w-full bg-black/60 border border-zinc-800 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white placeholder-zinc-600 outline-none uppercase tracking-wider"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!inputCode.trim()}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-white border border-zinc-700 flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <span>Connect & Restore Saves</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Collapsible Advanced Settings (Custom Cloudflare Worker Endpoint) */}
          <div className="pt-2 border-t border-zinc-900">
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-zinc-400 hover:text-zinc-200 py-1 transition"
            >
              <div className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                <span>Custom Cloud Vault Server (Optional)</span>
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-3.5 rounded-xl bg-black/40 border border-zinc-800/80 space-y-2.5">
                <p className="text-[11px] text-zinc-400 leading-snug">
                  By default, RetroStation uses the community Cloudflare Worker vault. If you deployed
                  your own private worker, paste your worker URL below:
                </p>
                {attemptedEndpoint !== getSyncEndpoint() && (
                  <p className="text-[11px] text-amber-400 font-bold break-all">
                    Current endpoint: {attemptedEndpoint}
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    placeholder="https://your-worker.your-subdomain.workers.dev"
                    aria-label="Custom Cloud Vault Server URL"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-[11px] font-mono text-zinc-200 outline-none focus:border-zinc-700"
                  />
                  <button
                    onClick={handleSaveEndpoint}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[11px] font-bold transition"
                  >
                    Save
                  </button>
                </div>
                {healthProblem && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 leading-snug flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="break-words">{healthProblem}</p>
                      <p className="text-zinc-400 mt-0.5">
                        Touching &quot;Reset to default URL&quot; below returns you to the working community vault.
                        Your stored endpoint is never wiped automatically by a failed sync.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={handleResetEndpoint}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 underline"
                  >
                    Reset to default URL
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
