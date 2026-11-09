import React, { useState, useEffect } from 'react';
import { Gamepad2, Keyboard, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { Theme } from '../../types';
import { CONTROL_BINDINGS } from '../../constants/controls';

interface ControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
}

export const ControlsModal: React.FC<ControlsModalProps> = ({
  isOpen,
  onClose,
  theme
}) => {
  const [activeTab, setActiveTab] = useState<'keyboard' | 'gamepad'>('keyboard');
  const [connectedGamepad, setConnectedGamepad] = useState<string | null>(null);

  useEffect(() => {
    const checkGamepads = () => {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const gps = navigator.getGamepads();
        const active = gps[0] || gps[1] || gps[2] || gps[3];
        setConnectedGamepad(active?.id || null);
      }
    };
    checkGamepads();
    window.addEventListener('gamepadconnected', checkGamepads);
    window.addEventListener('gamepaddisconnected', checkGamepads);
    return () => {
      window.removeEventListener('gamepadconnected', checkGamepads);
      window.removeEventListener('gamepaddisconnected', checkGamepads);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="controls-dialog-title"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)'
      }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl border shadow-xl overflow-hidden my-auto hardware-panel ${
          theme.isLight
            ? 'bg-[#eae6dd] border-[#cfcac0] text-[#121214]'
            : 'bg-[#131316] border-[#222227] text-[#f4f4f6]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex-none flex items-center justify-between px-5 py-4 border-b ${
          theme.isLight ? 'border-[#cfcac0] bg-[#dedad0]' : 'border-[#222227] bg-[#0a0a0c]'
        }`}>
          <div className="flex items-center gap-2.5">
            <Gamepad2 className={`w-5 h-5 ${theme.accentText}`} />
            <div>
              <h2 id="controls-dialog-title" className={`text-sm font-bold tracking-tight flex items-center gap-2 ${
                theme.isLight ? 'text-[#121214]' : 'text-[#f4f4f6]'
              }`}>
                <span>Controls & Keybindings</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  theme.isLight
                    ? 'bg-[#dedad0] text-[#575654] border-[#cfcac0]'
                    : 'bg-[#1c1c21] text-[#8e8e93] border-[#222227]'
                }`}>
                  Universal Map
                </span>
              </h2>
              <p className={`text-[11px] ${theme.isLight ? 'text-[#575654]' : 'text-[#8e8e93]'}`}>
                Plug-and-play desktop keyboard and Bluetooth controller support.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl border transition ${
              theme.isLight
                ? 'bg-[#dedad0] text-[#121214] border-[#cfcac0] hover:bg-[#d5d0c5]'
                : 'bg-[#1c1c21] text-[#8e8e93] hover:text-[#f4f4f6] border-[#222227]'
            }`}
            aria-label="Close controls modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Picker */}
        <div className={`px-5 pt-4 pb-2 flex items-center justify-between gap-3 border-b ${
          theme.isLight ? 'border-stone-300 bg-stone-200/50' : 'border-zinc-900 bg-zinc-950/50'
        }`}>
          <div role="tablist" aria-label="Control devices" className={`flex items-center gap-1.5 p-1 rounded-xl border ${
            theme.isLight ? 'bg-stone-200 border-stone-300' : 'bg-zinc-900 border-zinc-800'
          }`}>
            <button
              role="tab"
              id="controls-tab-keyboard"
              aria-selected={activeTab === 'keyboard'}
              aria-controls="controls-tabpanel-keyboard"
              onClick={() => setActiveTab('keyboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === 'keyboard'
                  ? theme.isLight
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-zinc-800 text-white shadow'
                  : theme.isLight
                  ? 'text-stone-600 hover:text-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Keyboard</span>
            </button>
            <button
              role="tab"
              id="controls-tab-gamepad"
              aria-selected={activeTab === 'gamepad'}
              aria-controls="controls-tabpanel-gamepad"
              onClick={() => setActiveTab('gamepad')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                activeTab === 'gamepad'
                  ? theme.isLight
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-zinc-800 text-white shadow'
                  : theme.isLight
                  ? 'text-stone-600 hover:text-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Gamepad</span>
            </button>
          </div>

          {/* Gamepad Detection Status */}
          <div className="flex items-center gap-1.5 text-[11px]">
            {connectedGamepad ? (
              <span className="flex items-center gap-1.5 text-emerald-500 font-medium truncate max-w-[200px]" title={connectedGamepad}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Connected: {connectedGamepad}</span>
              </span>
            ) : (
              <span className={`font-medium ${theme.isLight ? 'text-stone-500' : 'text-zinc-500'}`}>
                No Gamepad Detected
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto modal-scroll">
          {activeTab === 'keyboard' ? (
            <div className="space-y-4">
              <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
                theme.isLight
                  ? 'bg-stone-100 border-stone-300 text-stone-700'
                  : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400'
              }`}>
                <span className={`font-bold ${theme.isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>Standard Layout:</span> Use <kbd className={`px-1.5 py-0.5 rounded font-mono border ${
                  theme.isLight ? 'bg-stone-200 border-stone-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                }`}>WASD</kbd> or arrow keys for D-Pad navigation, and <kbd className={`px-1.5 py-0.5 rounded font-mono border ${
                  theme.isLight ? 'bg-stone-200 border-stone-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                }`}>Z</kbd> / <kbd className={`px-1.5 py-0.5 rounded font-mono border ${
                  theme.isLight ? 'bg-stone-200 border-stone-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                }`}>X</kbd> for B and A action buttons.
              </div>

              <div className="space-y-2">
                <h4 className={`text-[11px] font-black uppercase tracking-wider ${
                  theme.isLight ? 'text-stone-600' : 'text-zinc-400'
                }`}>
                  Button Mappings
                </h4>
                <div className={`rounded-xl border overflow-hidden divide-y ${
                  theme.isLight ? 'border-stone-300 divide-stone-200' : 'border-zinc-800 divide-zinc-900'
                }`}>
                  {CONTROL_BINDINGS.filter((b) => b.category !== 'Hotkeys').map((binding) => (
                    <div key={binding.name} className={`px-3.5 py-2 flex items-center justify-between text-xs transition ${
                      theme.isLight ? 'bg-stone-100 hover:bg-white text-zinc-900' : 'bg-zinc-950/60 hover:bg-zinc-900/40 text-zinc-200'
                    }`}>
                      <span className="font-bold">{binding.name}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <kbd className={`px-2 py-0.5 rounded-md border font-bold shadow-xs ${
                          theme.isLight ? 'bg-stone-200 border-stone-300 text-zinc-900' : 'bg-zinc-800 border-zinc-700 text-zinc-100'
                        }`}>
                          {binding.primaryKey}
                        </kbd>
                        {binding.altKey !== '—' && (
                          <>
                            <span className={theme.isLight ? 'text-stone-400' : 'text-zinc-600'}>/</span>
                            <kbd className={`px-2 py-0.5 rounded-md border ${
                              theme.isLight ? 'bg-stone-200/60 border-stone-300 text-stone-600' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                            }`}>
                              {binding.altKey}
                            </kbd>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className={`text-[11px] font-black uppercase tracking-wider ${
                  theme.isLight ? 'text-stone-600' : 'text-zinc-400'
                }`}>
                  Emulation Hotkeys
                </h4>
                <div className={`rounded-xl border overflow-hidden divide-y ${
                  theme.isLight ? 'border-stone-300 divide-stone-200' : 'border-zinc-800 divide-zinc-900'
                }`}>
                  {CONTROL_BINDINGS.filter((b) => b.category === 'Hotkeys').map((binding) => (
                    <div key={binding.name} className={`px-3.5 py-2 flex items-center justify-between text-xs transition ${
                      theme.isLight ? 'bg-stone-100 hover:bg-white text-zinc-900' : 'bg-zinc-950/60 hover:bg-zinc-900/40 text-zinc-300'
                    }`}>
                      <span className="font-bold">{binding.name}</span>
                      <kbd className={`px-2 py-0.5 rounded-md border font-mono font-bold shadow-xs ${
                        theme.isLight
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'bg-zinc-800 border-zinc-700 text-amber-300'
                      }`}>
                        {binding.primaryKey}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-3.5 rounded-xl border space-y-2 ${
                theme.isLight ? 'bg-stone-100 border-stone-300' : 'bg-zinc-900/50 border-zinc-800'
              }`}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span className={`text-xs font-bold ${theme.isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>W3C Standard Gamepad Mapping</span>
                </div>
                <p className={`text-[11px] leading-snug ${theme.isLight ? 'text-stone-600' : 'text-zinc-400'}`}>
                  RetroStation natively connects to Bluetooth and USB gamepads via the browser Gamepad API without needing any driver or extension.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className={`text-[11px] font-black uppercase tracking-wider ${
                  theme.isLight ? 'text-stone-600' : 'text-zinc-400'
                }`}>
                  Gamepad Mapping Reference
                </h4>
                <div className={`rounded-xl border overflow-hidden divide-y ${
                  theme.isLight ? 'border-stone-300 divide-stone-200' : 'border-zinc-800 divide-zinc-900'
                }`}>
                  {CONTROL_BINDINGS.filter((b) => b.category !== 'Hotkeys').map((binding) => (
                    <div key={binding.name} className={`px-3.5 py-2 flex items-center justify-between text-xs transition ${
                      theme.isLight ? 'bg-stone-100 hover:bg-white text-zinc-900' : 'bg-zinc-950/60 hover:bg-zinc-900/40 text-zinc-200'
                    }`}>
                      <span className="font-bold">{binding.name}</span>
                      <span className="font-mono text-emerald-500 font-semibold text-[11px]">
                        {binding.gamepad}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex-none px-5 py-3 border-t flex justify-end ${
          theme.isLight ? 'border-stone-300 bg-[#dedbd2]' : 'border-zinc-800 bg-zinc-950'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow tactile-btn ${theme.accentBg}`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
