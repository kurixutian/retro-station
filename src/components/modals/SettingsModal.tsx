import React, { useState, useEffect } from 'react';
import { Sliders, X, Tv, Check, Vibrate, Cloud, ChevronRight, ChevronLeft, Sparkles, Gamepad2, Coffee, Moon, Move } from 'lucide-react';
import { COLOR_PROFILES } from '../../constants/shaders';
import { Theme } from '../../types';
import { haptics } from '../../services/haptics';
import { ModalShell } from '../common/ModalShell';
import { getSyncStatus } from '../../cloudSync';

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

type SettingsPanel = 'menu' | 'display' | 'controls';

const SETTINGS_PANELS: { id: SettingsPanel; label: string; desc: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'display', label: 'Display & Appearance', desc: 'Theme, color profiles & CRT filters', icon: Tv },
  { id: 'controls', label: 'Controls & Haptic', desc: 'Haptics, gamepad & keyboard shortcuts', icon: Vibrate },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
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
  const [reduceMotion, setReduceMotion] = useState(() => {
    try {
      return localStorage.getItem('retro_reduce_motion') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('retro_reduce_motion', reduceMotion ? '1' : '0');
      document.documentElement.classList.toggle('reduce-motion', reduceMotion);
    } catch {}
  }, [reduceMotion]);

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
  const syncState = getSyncStatus();
  const syncStatusBadge =
    syncState.status === 'syncing'
      ? { label: 'Syncing', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
      : syncState.status === 'needs_reauth' || syncState.status === 'error'
        ? { label: 'Not Synced', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
        : syncState.user
          ? { label: 'Synced', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
          : null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="settings-dialog-title"
      panelClassName={`w-full max-w-xl max-h-[88vh] shadow-xl ${
        theme.isLight
          ? 'bg-[#eae6dd] border-[#cfcac0] text-[#121214]'
          : 'bg-[#131316] border-[#222227] text-[#f4f4f6]'
      }`}
    >
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
            <div className="grid grid-cols-1 gap-2.5">
              {SETTINGS_PANELS.map((panel) => {
                const Icon = panel.icon;
                return (
                  <button
                    key={panel.id}
                    onClick={() => setActivePanel(panel.id)}
                    className={`text-left p-4 rounded-2xl border transition flex items-center gap-3 min-h-[74px] tactile-btn focus-visible:outline-none ${theme.focusRing} ${
                      theme.isLight
                        ? 'bg-stone-100 hover:bg-white border-stone-300 hover:border-stone-400 text-zinc-900'
                        : 'bg-zinc-900/70 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-100'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      theme.isLight ? 'bg-stone-200 border-stone-300' : 'bg-zinc-950 border-zinc-800'
                    }`}>
                      <Icon className={`w-5 h-5 ${theme.accentText}`} />
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

              {onOpenCloudSync && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCloudSync();
                  }}
                  className={`text-left p-4 rounded-2xl border transition flex items-center gap-3 min-h-[74px] tactile-btn focus-visible:outline-none ${theme.focusRing} ${
                    theme.isLight
                      ? 'bg-stone-100 hover:bg-white border-stone-300 hover:border-stone-400 text-zinc-900'
                      : 'bg-zinc-900/70 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-100'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                    theme.isLight ? 'bg-stone-200 border-stone-300' : 'bg-zinc-950 border-zinc-800'
                  }`}>
                    <Cloud className={`w-5 h-5 ${theme.accentText}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-extrabold truncate ${
                        theme.isLight ? 'text-zinc-900' : 'text-white'
                      }`}>Cloud Save & Backup</span>
                      {syncStatusBadge && (
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase border shrink-0 ${syncStatusBadge.cls}`}>
                          {syncStatusBadge.label}
                        </span>
                      )}
                    </div>
                    <div className={`text-[11px] truncate ${
                      theme.isLight ? 'text-stone-600' : 'text-zinc-400'
                    }`}>
                      {syncState.user?.email
                        ? `${syncState.user.email} • Drive sync & manual backup`
                        : 'Google Drive sync & offline backup file'}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${
                    theme.isLight ? 'text-stone-400' : 'text-zinc-600'
                  }`} />
                </button>
              )}
            </div>
          )}

          {/* PANEL 1: DISPLAY & APPEARANCE */}
          {activePanel === 'display' && (
            <div className="space-y-6">
              {/* App Theme + AMOLED Toggles */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={!theme.isLight}
                  onClick={() => applyTheme(theme.isLight ? 'midnight' : 'trooper')}
                  className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 tactile-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    theme.isLight
                      ? 'bg-stone-100 border-stone-300 text-zinc-900 shadow-sm'
                      : 'bg-zinc-900/70 border-zinc-800 text-white hover:bg-zinc-900'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Moon className={`w-4 h-4 ${theme.accentText}`} />
                      <span className={`text-sm font-extrabold ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>Dark Mode</span>
                    </div>
                    <p className={`text-xs leading-snug ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                      Switch between dark obsidian and warm retro stone across the library and console.
                    </p>
                  </div>

                  <div
                    className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                      !theme.isLight ? 'justify-end' : 'bg-stone-300 border border-stone-400 justify-start'
                    }`}
                    style={{ backgroundColor: !theme.isLight ? theme.hex : undefined }}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                  </div>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(shaders.amoled)}
                  onClick={() => toggleShader('amoled')}
                  className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 tactile-btn focus-visible:outline-none ${theme.focusRing} ${
                    shaders.amoled
                      ? theme.isLight
                        ? 'bg-emerald-500/10 border-emerald-600/50 text-zinc-900'
                        : `bg-[${theme.hex}]/15 border-[${theme.hex}]/50 text-white`
                      : theme.isLight
                        ? 'bg-stone-200/80 border-stone-300 text-zinc-800 hover:bg-stone-200'
                        : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${shaders.amoled ? `bg-[${theme.hex}]` : theme.isLight ? 'bg-stone-400' : 'bg-zinc-600'}`} />
                      <span className={`text-sm font-extrabold ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>AMOLED Black Mode</span>
                    </div>
                    <p className={`text-xs leading-snug ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                      Pure true-black in-game shell — OLED pixels turn off to save battery.
                    </p>
                  </div>

                  <div
                    className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                      shaders.amoled
                        ? 'justify-end'
                        : theme.isLight
                          ? 'bg-stone-300 border border-stone-400 justify-start'
                          : 'bg-zinc-800 border border-zinc-700 justify-start'
                    }`}
                    style={{ backgroundColor: shaders.amoled ? theme.hex : undefined }}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                  </div>
                </button>
              </div>

              {/* Section: COLOR ACCURACY & CONTRAST (RETROARCH) */}
              <div className="space-y-2.5">
                <h3 className={`text-xs font-bold flex items-center gap-1.5 ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`}>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Color Accuracy & Contrast</span>
                </h3>
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
                            ? theme.isLight
                              ? 'bg-amber-500/15 border-amber-500/60 text-zinc-900 shadow-sm'
                              : 'bg-amber-500/15 border-amber-500/50 text-white shadow-md'
                            : theme.isLight
                              ? 'bg-stone-200/80 border-stone-300 text-zinc-700 hover:bg-stone-200'
                              : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>{prof.name}</span>
                            {prof.id === 'vivid' && (
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold border ${
                                theme.isLight
                                  ? 'bg-amber-500/20 text-amber-900 border-amber-600/30'
                                  : 'bg-zinc-800 text-amber-300 border-white/5'
                              }`}>
                                {prof.badge}
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] leading-snug ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
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
                  <Tv className={`w-4 h-4 ${theme.accentText}`} />
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
                        className={`text-left p-3 rounded-2xl border transition flex items-start gap-3 ${theme.focusRing} ${
                          checked
                            ? theme.isLight
                              ? 'bg-emerald-500/10 border-emerald-600/50 text-zinc-900'
                              : `bg-[${theme.hex}]/15 border-[${theme.hex}]/50 text-white`
                            : theme.isLight
                              ? 'bg-stone-200/80 border-stone-300 text-zinc-700 hover:bg-stone-200'
                              : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                        }`}
                      >
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                            checked
                              ? `bg-[${theme.hex}] border-[${theme.hex}]/70 text-zinc-950`
                              : theme.isLight
                                ? 'border-stone-400 bg-white'
                                : 'border-zinc-700 bg-zinc-950'
                          }`}
                        >
                          {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>{item.title}</div>
                          <div className={`text-[10px] leading-snug mt-0.5 ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
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
              {/* Motion Preferences */}
              <div className="space-y-2.5">
                <h3 className={`text-xs font-bold flex items-center gap-1.5 ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`}>
                  <Move className={`w-4 h-4 ${theme.accentText}`} />
                  <span>Motion & Animation</span>
                </h3>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reduceMotion}
                  onClick={() => setReduceMotion(!reduceMotion)}
                  className={`w-full text-left p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 tactile-btn focus-visible:outline-none ${theme.focusRing} ${
                    reduceMotion
                      ? theme.isLight
                        ? 'bg-emerald-500/10 border-emerald-600/50 text-zinc-900'
                        : `bg-[${theme.hex}]/15 border-[${theme.hex}]/50 text-white`
                      : theme.isLight
                        ? 'bg-stone-200/80 border-stone-300 text-zinc-800 hover:bg-stone-200'
                        : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${reduceMotion ? `bg-[${theme.hex}]` : theme.isLight ? 'bg-stone-400' : 'bg-zinc-600'}`} />
                      <span className={`text-sm font-extrabold ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>Reduce Motion</span>
                    </div>
                    <p className={`text-xs leading-snug ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                      Disable continuous animations (hero pan, backdrop drift) and shorten transitions.
                    </p>
                  </div>

                  <div
                    className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                      reduceMotion
                        ? 'justify-end'
                        : theme.isLight
                          ? 'bg-stone-300 border border-stone-400 justify-start'
                          : 'bg-zinc-800 border border-zinc-700 justify-start'
                    }`}
                    style={{ backgroundColor: reduceMotion ? theme.hex : undefined }}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                  </div>
                </button>
              </div>

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
                    ? theme.isLight
                      ? 'bg-sky-500/15 border-sky-600/40 text-zinc-900'
                      : 'bg-sky-500/15 border-sky-500/50 text-white'
                    : theme.isLight
                      ? 'bg-stone-200/80 border-stone-300 text-zinc-800 hover:bg-stone-200'
                      : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Vibrate className={`w-4 h-4 ${hapticsEnabled ? (theme.isLight ? 'text-sky-600' : 'text-sky-400') : theme.isLight ? 'text-stone-500' : 'text-zinc-500'}`} />
                    <span className={`text-sm font-extrabold ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>Haptic Vibration</span>
                  </div>
                  <p className={`text-xs leading-snug ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                    Tactile vibration feedback on on-screen button presses.
                  </p>
                </div>

                <div
                  className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                    hapticsEnabled
                      ? 'bg-sky-500 justify-end'
                      : theme.isLight
                        ? 'bg-stone-300 border border-stone-400 justify-start'
                        : 'bg-zinc-800 border border-zinc-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                </div>
              </button>

              {/* Gamepad & Keyboard Integration Card */}
              <div className={`p-4 rounded-2xl border space-y-2 ${
                theme.isLight ? 'border-stone-300 bg-stone-200/80' : 'border-zinc-800 bg-zinc-900/50'
              }`}>
                <div className={`flex items-center gap-2 font-extrabold text-xs ${theme.isLight ? 'text-zinc-900' : 'text-white'}`}>
                  <Gamepad2 className={`w-4 h-4 ${theme.accentText}`} />
                  <span>Physical Gamepad Support</span>
                </div>
                <p className={`text-xs leading-relaxed ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                  Bluetooth & USB controllers connect automatically via HTML5 Gamepad API with zero battery overhead.
                </p>
                <div className={`text-[11px] font-mono pt-1 ${theme.isLight ? 'text-stone-600' : 'text-zinc-500'}`}>
                  Quick Save: <span className={`font-bold ${theme.isLight ? 'text-amber-700' : 'text-amber-300'}`}>Shift + F1</span> • Quick Load: <span className={`font-bold ${theme.isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>F3</span>
                </div>
              </div>

              {onOpenControls && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenControls();
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs font-bold transition active:scale-[0.98] tactile-btn focus-visible:outline-none ${theme.focusRing} ${
                    theme.isLight
                      ? 'bg-stone-200/80 hover:bg-stone-200 border-stone-300 text-zinc-900'
                      : 'bg-zinc-900/80 hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg bg-[${theme.hex}]/10 border border-[${theme.hex}]/30 flex items-center justify-center ${theme.accentText}`}>
                      <Gamepad2 className="w-4 h-4" />
                    </div>
                    <span>Open Full Keyboard & Gamepad Guide</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${theme.isLight ? 'text-stone-500' : 'text-zinc-500'}`} />
                </button>
              )}
            </div>
          )}

          {/* Support / Buy Me a Coffee Footer Banner (Main Menu only) */}
          {activePanel === 'menu' && (
            <a
              href="https://buymeacoffee.com/kurixutian"
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 tactile-btn transition ${
                theme.isLight
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-800'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                    theme.isLight
                      ? 'bg-amber-400/25 border-amber-400/50 text-amber-700'
                      : 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                  }`}
                >
                  <Coffee className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-xs font-extrabold ${theme.isLight ? 'text-[#121214]' : 'text-white'}`}>Enjoying Retro Station?</div>
                  <div className={`text-[11px] ${theme.isLight ? 'text-amber-700/90' : 'text-amber-300/90'}`}>Buy me a coffee to support development</div>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${theme.isLight ? 'text-amber-600' : 'text-amber-300'}`} />
            </a>
          )}
        </div>
    </ModalShell>
  );
};
