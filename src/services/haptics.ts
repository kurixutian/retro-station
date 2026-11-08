// ============================================================================
// HAPTIC FEEDBACK SERVICE (Vibration API for Android & Mobile Web)
// ============================================================================

class HapticsService {
  private enabled: boolean;

  constructor() {
    this.enabled = true;
    try {
      const saved = localStorage.getItem('retro_haptics');
      if (saved !== null) {
        this.enabled = saved === 'true';
      }
    } catch {
      this.enabled = true;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    try {
      localStorage.setItem('retro_haptics', String(val));
    } catch {}
    if (typeof window !== 'undefined') {
      import('../cloudSync')
        .then(({ markLocalSaveModified, SETTINGS_SYNC_KEY }) =>
          markLocalSaveModified(SETTINGS_SYNC_KEY)
        )
        .catch(() => {});
    }
    if (val) {
      this.trigger(15);
    }
  }

  public trigger(pattern: number | number[] = 10) {
    if (!this.enabled) return;
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (!('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch {}
  }

  /** Quick, crisp tactile click for action buttons (A, B, X, Y, Select, Start) */
  public tap() {
    this.trigger(12);
  }

  /** Micro-tick for D-Pad directional steps and sliding turns */
  public dpad() {
    this.trigger(8);
  }

  /** Subtle magnetic tick for Canva-style guidelines and snap grid locks */
  public selection() {
    this.trigger(6);
  }

  /** Double pulse for toggles (2x Speed, Pause, Rewind) */
  public toggle() {
    this.trigger([10, 30, 12]);
  }

  /** Strong bump for save state operations and cartridge management */
  public bump() {
    this.trigger(25);
  }
}

export const haptics = new HapticsService();
