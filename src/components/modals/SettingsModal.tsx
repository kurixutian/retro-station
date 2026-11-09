import React, { useState, useRef, useEffect } from 'react';
import { Sliders, X, Tv, Palette, Check, Vibrate, Cloud, ChevronRight, ChevronLeft, Sparkles, Gamepad2, Download, Upload, HardDrive, Coffee, Maximize, Moon } from 'lucide-react';
import { COLOR_PROFILES } from '../../constants/shaders';
import { Theme } from '../../types';
import { haptics } from '../../services/haptics';
import { getSyncCode } from '../../cloudSync';
import { createBackupFile, downloadBackup, importBackupFile } from '../../services/backup';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  themeId: string;
  applyTheme: (id: string) => void;
  shaders: Record<string, any>;
  toggleShader: (key: string) => void;
  setColorProfile?: (profile: string) => void;
  hapticsEnabled?: boolean;
  setHapticsEnabled?: (val: boolean) => void;
  onOpenCloudSync?: () => void;
  onOpenControls?: () => void;
}

type SettingsPanel = 'menu' | 'display' | 'controls' | 'themes' | 'vault';

const SETTINGS_PANELS: { id: SettingsPanel; label: string; desc: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'display', label: 'Display & CRT', desc: 'Screen filters, color profiles & CRT effects', icon: Tv },
  { id: 'controls', label: 'Controls & Haptic', desc: 'Haptics, gamepad & keyboard shortcuts', icon: Vibrate },
  { id: 'themes', label: 'Themes', desc: 'Dark or light app appearance', icon: Palette },
  { id: 'vault', label: 'Cloud Vault', desc: 'Drive sync & manual backup file', icon: Cloud },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  themeId,
  applyTheme,
  shaders,
  toggleShader,
  setColorProfile,
  hapticsEnabled = true,
  setHapticsEnabled,
  onOpenCloudSync,
  onOpenControls,
}) => {
  const [activePanel, setActivePanel] = useState<SettingsPanel>('menu');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportBackup = async () => {
    setBackupBusy(true);
    try {
      const backup = await createBackupFile();
      downloadBackup(backup);
      setBackupMsg(`Backup exported (${Object.keys(backup.items).length} saves). Keep the file somewhere safe.`);
    } catch (e) {
      setBackupMsg('Backup export failed — try again.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupBusy(true);
    try {
      const text = await file.text();
      const res = await importBackupFile(text);
      setBackupMsg(
        res.ok
          ? `Restored ${res.appliedItems} saves and ${res.appliedListItemCount} games from backup. Relink ROM files to play.`
          : `Import failed: ${res.error}`
      );
    } catch (err) {
      setBackupMsg('Import failed: could not read that file.');
    } finally {
      setBackupBusy(false);
    }
  };

  useEffect(() => {
    if (isOpen) setActivePanel('menu');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activePanel !== 'menu') setActivePanel('menu');
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activePanel, onClose]);

  if (!isOpen) return null;
  const syncCode = getSyncCode();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)'
      }}
    >
      <div className={`w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl border shadow-xl overflow-hidden my-auto hardware-panel ${
        theme.isLight
          ? 'bg-[#eae6dd] border-[#cfcac0] text-[#121214]'
          : 'bg-[#131316] border-[#222227] text-[#f4f4f6]'
      }`}>
        <div className={`flex-none flex items-center justify-between px-5 py-4 border-b ${
          theme.isLight ? 'border-[#cfcac0] bg-[#dedad0]' : 'border-[#222227] bg-[#0a0a0c]'
        }`}>
          <div className="flex items-center gap-2.5">
            {activePanel !== 'menu' && (
              <button
                onClick={() => setActivePanel('menu')}
                className={`p-2 rounded-xl tactile-btn border transition ${
                  theme.isLight
                    ? 'bg-[#dedad0] hover:bg-[#d5d0c5] text-[#121214] border-[#cfcac0]'
                    : 'bg-[#1c1c21] hover:bg-[#25252c] text-[#f4f4f6] border-[#222227]'
                }`}
                aria-label="Back to Configuration"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <Sliders className={`w-5 h-5 ${theme.accentText}`} />
            <h2 id="settings-dialog-title" className={`text-base font-bold ${
              theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'
            }`}>
              {activePanel === 'menu' ? 'Configuration' : SETTINGS_PANELS.find((p) => p.id === activePanel)?.label}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl tactile-btn border transition ${
              theme.isLight
                ? 'bg-[#dedad0] hover:bg-[#d5d0c5] text-[#121214] border-[#cfcac0]'
                : 'bg-[#1c1c21] hover:bg-[#25252c] text-[#f4f4f6] border-[#222227]'
            }`}
            aria-label="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto modal-scroll p-5 space-y-6">
          {/* CATEGORY PICKER: choose which settings to open */}
          {activePanel === 'menu' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SETTINGS_PANELS.map((panel) => {
                const Icon = panel.icon;
                return (
                  <button
                    key={panel.id}
                    onClick={() => setActivePanel(panel.id)}
                    className={`text-left p-4 rounded-2xl border transition flex items-center gap-3 min-h-[74px] tactile-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      theme.isLight
                        ? 'bg-stone-100 hover:bg-white border-stone-300 hover:border-stone-400 text-zinc-900'
                        : 'bg-zinc-900/70 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-100'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      theme.isLight ? 'bg-stone-200 border-stone-300' : 'bg-zinc-950 border-zinc-800'
                    }`}>
                      <Icon className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-extrabold truncate ${
                        theme.isLight ? 'text-zinc-900' : 'text-white'
                      }`}>{panel.label}</div>
                      <div className={`text-[11px] truncate ${
                        theme.isLight ? 'text-stone-600' : 'text-zinc-400'
                      }`}>{panel.desc}</div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${
                      theme.isLight ? 'text-stone-400' : 'text-zinc-600'
                    }`} />
                  </button>
                );
              })}
            </div>
          )}

          {/* PANEL 1: DISPLAY & CRT */}
          {activePanel === 'display' && (
            <div className="space-y-6">
              {/* AMOLED Battery Saver Dedicated Toggle Card */}
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(shaders.amoled)}
                onClick={() => toggleShader('amoled')}
                className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 tactile-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  shaders.amoled
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                    : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${shaders.amoled ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <span className="text-sm font-extrabold text-white">AMOLED Black Mode</span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Battery Saver
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-snug">
                    Pure true-black screen — OLED pixels fully turn off, saving battery.
                  </p>
                </div>

                <div
                  className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                    shaders.amoled ? 'bg-emerald-500 justify-end' : 'bg-zinc-800 border border-zinc-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                </div>
              </button>

              {/* Section: COLOR ACCURACY & CONTRAST (RETROARCH) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs font-bold flex items-center gap-1.5 ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`}>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Color Accuracy & Contrast</span>
                  </h3>
                  <button
                    onClick={() => toggleShader('colorCorrection')}
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition ${
                      shaders.colorCorrection !== false && shaders.colorProfile !== 'off'
                        ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    {shaders.colorCorrection !== false && shaders.colorProfile !== 'off' ? 'ACTIVE' : 'OFF'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {COLOR_PROFILES.map((prof) => {
                    const isSelected =
                      (shaders.colorProfile || 'vivid') === prof.id &&
                      (prof.id === 'off' || shaders.colorCorrection !== false);
                    return (
                      <button
                        key={prof.id}
                        onClick={() => {
                          if (setColorProfile) {
                            setColorProfile(prof.id);
                          } else {
                            toggleShader('colorCorrection');
                          }
                        }}
                        className={`text-left p-3 rounded-2xl border transition flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md'
                            : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{prof.name}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold bg-zinc-800 text-amber-300 border border-white/5">
                              {prof.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-snug">
                            {prof.desc}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center bg-amber-400 text-zinc-950 shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 1: CRT & LCD SHADER FILTER */}
              <div className="space-y-2.5">
                <h3 className={`text-xs font-bold flex items-center gap-1.5 ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`}>
                  <Tv className="w-4 h-4 text-emerald-400" />
                  <span>CRT & LCD Shader Filters</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      key: 'edgeToEdge',
                      title: 'Edge-to-Edge Screen (No Bezel)',
                      desc: 'Remove bezel borders and expand screen flush edge-to-edge'
                    },
                    {
                      key: 'scanlines',
                      title: 'CRT Scanlines',
                      desc: 'Authentic horizontal phosphor scanline grilles'
                    },
                    {
                      key: 'gbGrid',
                      title: 'Game Boy LCD Grid Lines',
                      desc: 'Dot-matrix pixel grid overlay (combines with AMOLED black!)'
                    },
                    {
                      key: 'rgbBloom',
                      title: 'Post-RGB Phosphor Bloom',
                      desc: 'High-contrast halation glow & color boost'
                    },
                    {
                      key: 'bezelVignette',
                      title: 'Bezel Vignette Shadow',
                      desc: 'Subtle tube corner darkening around screen edges'
                    },
                    {
                      key: 'crtCurve',
                      title: 'CRT Curved Glass',
                      desc: 'Rounded Trinitron-style cabinet bezel corners'
                    }
                  ].map((item) => {
                    const checked = shaders[item.key];
                    return (
                      <button
                        key={item.key}
                        onClick={() => toggleShader(item.key)}
                        className={`text-left p-3 rounded-2xl border transition flex items-start gap-3 ${
                          checked
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                            : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                            checked
                              ? 'bg-emerald-400 border-emerald-300 text-zinc-950'
                              : 'border-zinc-700 bg-zinc-950'
                          }`}
                        >
                          {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{item.title}</div>
                          <div className="text-[10px] text-zinc-400 leading-snug mt-0.5">
                            {item.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PANEL 2: CONTROLS & HAPTIC */}
          {activePanel === 'controls' && (
            <div className="space-y-6">
              {/* Controls & Haptic Feedback Toggle Card */}
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(hapticsEnabled)}
                onClick={() => {
                  const next = !hapticsEnabled;
                  setHapticsEnabled?.(next);
                  haptics.setEnabled(next);
                }}
                className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 tactile-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  hapticsEnabled
                    ? 'bg-sky-500/15 border-sky-500/50 text-white'
                    : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Vibrate className={`w-4 h-4 ${hapticsEnabled ? 'text-sky-400' : 'text-zinc-500'}`} />
                    <span className="text-sm font-extrabold text-white">Haptic Vibration</span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      Touchpad
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-snug">
                    Tactile vibration feedback on on-screen button presses.
                  </p>
                </div>

                <div
                  className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                    hapticsEnabled ? 'bg-sky-500 justify-end' : 'bg-zinc-800 border border-zinc-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                </div>
              </button>

              {/* Gamepad & Keyboard Integration Card */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-2">
                <div className="flex items-center gap-2 text-white font-extrabold text-xs">
                  <Gamepad2 className="w-4 h-4 text-emerald-400" />
                  <span>Physical Gamepad Support</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Bluetooth & USB controllers connect automatically via HTML5 Gamepad API with zero battery overhead.
                </p>
                <div className="text-[11px] text-zinc-500 font-mono pt-1">
                  Quick Save: <span className="text-amber-300 font-bold">Shift + F1</span> • Quick Load: <span className="text-cyan-300 font-bold">F3</span>
                </div>
              </div>

              {onOpenControls && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenControls();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-bold transition active:scale-[0.98] tactile-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Gamepad2 className="w-4 h-4" />
                    </div>
                    <span>Open Full Keyboard & Gamepad Guide</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </button>
              )}
            </div>
          )}

          {/* PANEL 3: THEMES (Dark/Light Mode Appearance) */}
          {activePanel === 'themes' && (
            <div className="space-y-5">
              <div>
                <h3 className={`text-xs font-bold flex items-center gap-1.5 mb-3 ${
                  theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'
                }`}>
                  <Palette className="w-4 h-4 text-amber-500" />
                  <span>Appearance & Theme</span>
                </h3>

                <button
                  type="button"
                  role="switch"
                  aria-checked={!theme.isLight}
                  onClick={() => applyTheme(theme.isLight ? 'midnight' : 'trooper')}
                  className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 tactile-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    theme.isLight
                      ? 'bg-stone-100 border-stone-300 text-zinc-900 shadow-sm'
                      : 'bg-zinc-900 border-zinc-700 text-white'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-emerald-500" />
                      <span className={`text-sm font-extrabold ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>Dark Mode</span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase border ${
                        theme.isLight
                          ? 'bg-stone-200 text-stone-700 border-stone-300'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {theme.isLight ? 'Light' : 'Dark'}
                      </span>
                    </div>
                    <p className={`text-xs leading-snug ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                      Toggle between dark obsidian and warm retro light stone across the library and console.
                    </p>
                  </div>

                  <div
                    className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                      !theme.isLight ? 'bg-emerald-500 justify-end' : 'bg-stone-300 border border-stone-400 justify-start'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* PANEL 4: CLOUD VAULT */}
          {activePanel === 'vault' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCloudSync?.();
                }}
                className="w-full text-left p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700 tactile-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-sky-400" />
                    <span className="text-sm font-extrabold text-white">Cloud Save Vault</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase ${
                      syncCode
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}>
                      {syncCode ? 'Linked' : 'Not Linked'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-snug">
                    {syncCode
                      ? `Connected: ${syncCode}. Tap to manage or sync.`
                      : 'Sign in with Google Drive to sync saves, states & games across devices.'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
              </button>

              <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 space-y-2 text-xs text-zinc-400">
                <span className="font-bold text-zinc-300 block">About Google Drive Sync</span>
                <p>
                  Zero server cost ($0.00 forever). Your SRAM battery saves, save states, and game library metadata synchronize directly to your personal Google Drive private appDataFolder.
                </p>
                <p>
                  Works 100% offline first — whenever you are off the grid, saves write instantly to device storage and sync when you reconnect.
                </p>
              </div>

              {/* MANUAL BACKUP (Safety Net) — independent of cloud vault */}
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-3">
                <div className="flex items-center gap-2 text-white font-extrabold text-xs">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span>Manual Backup File</span>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Safety Net
                  </span>
                </div>
                {backupMsg && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-300 font-bold break-words">
                    {backupMsg}
                  </div>
                )}
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Export all your games, save states, cartridge SRAM, and covers as a single JSON file you keep
                  yourself — no internet needed. Restore it on any device. ROM files are not included (link them
                  again after importing).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleExportBackup}
                    disabled={backupBusy}
                    className={`py-2.5 px-3 rounded-xl font-bold text-[11px] flex items-center justify-center gap-2 transition active:scale-95 ${
                      backupBusy ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{backupBusy ? 'Building backup...' : 'Export Backup'}</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={backupBusy}
                    className="py-2.5 px-3 rounded-xl font-bold text-[11px] flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition active:scale-95 disabled:opacity-40"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Backup</span>
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
            </div>
          )}

          {/* Support / Buy Me a Coffee Footer Banner */}
          <a
            href="https://buymeacoffee.com/kurixutian"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 flex items-center justify-between gap-3 tactile-btn transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-white">Enjoying Retro Pocket?</div>
                <div className="text-[11px] text-amber-300/90">Buy me a coffee to support development</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-300 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
};
