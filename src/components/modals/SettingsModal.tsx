import React from 'react';
import { Sliders, X, Tv, Palette, Check, Vibrate } from 'lucide-react';
import { THEMES } from '../../constants/themes';
import { Theme } from '../../types';
import { haptics } from '../../services/haptics';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  themeId: string;
  applyTheme: (id: string) => void;
  shaders: Record<string, boolean>;
  toggleShader: (key: string) => void;
  hapticsEnabled?: boolean;
  setHapticsEnabled?: (val: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  themeId,
  applyTheme,
  shaders,
  toggleShader,
  hapticsEnabled = true,
  setHapticsEnabled,
}) => {
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
    >
      <div className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto">
        <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <Sliders className={`w-5 h-5 ${theme.accentText}`} />
            <h2 className="text-base font-black text-white">Appearance</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Controls & Haptic Feedback Toggle Card */}
          <div
            onClick={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled?.(next);
              haptics.setEnabled(next);
            }}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
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
                Crisp physical click vibrations on D-Pad and action buttons for authentic tactile controller response.
              </p>
            </div>

            <div
              className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                hapticsEnabled ? 'bg-sky-500 justify-end' : 'bg-zinc-800 border border-zinc-700 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md" />
            </div>
          </div>

          {/* AMOLED Battery Saver Dedicated Toggle Card */}
          <div
            onClick={() => toggleShader('amoled')}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
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
                Turns chassis & display pure pitch black (<span className="text-zinc-200 font-mono">#000000</span>) to physically power off OLED pixels, disables screen bloom, and turns grid lines true black.
              </p>
            </div>

            <div
              className={`shrink-0 w-12 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                shaders.amoled ? 'bg-emerald-500 justify-end' : 'bg-zinc-800 border border-zinc-700 justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md" />
            </div>
          </div>

          {/* Section 1: CRT & LCD SHADER FILTER */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-emerald-400" />
              <span>CRT & LCD SHADER FILTER</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
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

          {/* Section 2: THEME */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-amber-400" />
              <span>THEME</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.values(THEMES).map((t) => {
                const active = themeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => applyTheme(t.id)}
                    className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      active
                        ? 'bg-zinc-900 border-emerald-400 text-white shadow-lg'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full inline-block border border-white/20"
                        style={{ backgroundColor: t.hex }}
                      />
                      <span>{t.name}</span>
                    </div>
                    {active && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
