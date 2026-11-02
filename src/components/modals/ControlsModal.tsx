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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)'
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto hardware-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <Gamepad2 className={`w-5 h-5 ${theme.accentText}`} />
            <div>
              <h2 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                <span>Controls & Keybindings</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-white/10">
                  Universal Map
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Plug-and-play desktop keyboard and Bluetooth controller support.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 transition"
            aria-label="Close controls modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Picker */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/50">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setActiveTab('keyboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'keyboard'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Keyboard</span>
            </button>
            <button
              onClick={() => setActiveTab('gamepad')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'gamepad'
                  ? 'bg-zinc-800 text-white shadow'
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
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium truncate max-w-[200px]" title={connectedGamepad}>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Connected: {connectedGamepad}</span>
              </span>
            ) : (
              <span className="text-zinc-500 font-medium">
                No Gamepad Detected
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {activeTab === 'keyboard' ? (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-zinc-200 font-bold">Standard Layout:</span> Use <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">WASD</kbd> or arrow keys for D-Pad navigation, and <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">Z</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">X</kbd> for B and A action buttons.
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Button Mappings
                </h4>
                <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-900">
                  {CONTROL_BINDINGS.filter((b) => b.category !== 'Hotkeys').map((binding) => (
                    <div key={binding.name} className="px-3.5 py-2 flex items-center justify-between text-xs bg-zinc-950/60 hover:bg-zinc-900/40 transition">
                      <span className="font-bold text-zinc-200">{binding.name}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <kbd className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold shadow-xs">
                          {binding.primaryKey}
                        </kbd>
                        {binding.altKey !== '—' && (
                          <>
                            <span className="text-zinc-600">/</span>
                            <kbd className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400">
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
                <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Emulation Hotkeys
                </h4>
                <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-900">
                  {CONTROL_BINDINGS.filter((b) => b.category === 'Hotkeys').map((binding) => (
                    <div key={binding.name} className="px-3.5 py-2 flex items-center justify-between text-xs bg-zinc-950/60 hover:bg-zinc-900/40 transition">
                      <span className="font-bold text-zinc-300">{binding.name}</span>
                      <kbd className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-amber-300 font-mono font-bold shadow-xs">
                        {binding.primaryKey}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200">W3C Standard Gamepad Mapping</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  RetroStation natively connects to Bluetooth and USB gamepads via the browser Gamepad API without needing any driver or extension.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Gamepad Mapping Reference
                </h4>
                <div className="rounded-xl border border-zinc-800 overflow-hidden divide-y divide-zinc-900">
                  {CONTROL_BINDINGS.filter((b) => b.category !== 'Hotkeys').map((binding) => (
                    <div key={binding.name} className="px-3.5 py-2 flex items-center justify-between text-xs bg-zinc-950/60 hover:bg-zinc-900/40 transition">
                      <span className="font-bold text-zinc-200">{binding.name}</span>
                      <span className="font-mono text-emerald-400 font-semibold text-[11px]">
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
        <div className="flex-none px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex justify-end">
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
