# Animation Improvement Plans

Generated on 2026-11-05 against commit `c43f6fc`.
Execute in order (`001` → `003`). Each plan is self-contained.

## Plans

| # | Plan | Severity | Files | Status |
|---|---|---|---|---|
| 001 | [001-composited-hero-and-backdrop-perf.md](./001-composited-hero-and-backdrop-perf.md) | high | `src/index.css`, `src/components/library/LibraryView.tsx`, `src/components/emulator/InGameView.tsx` | completed |
| 002 | [002-eliminate-transition-all-and-introduce-motion-tokens.md](./002-eliminate-transition-all-and-introduce-motion-tokens.md) | high | `src/index.css`, `src/components/emulator/InGameView.tsx`, `src/components/library/GameCard.tsx`, `src/components/library/LibraryView.tsx` | completed |
| 003 | [003-tactile-press-and-reduced-motion-accessibility.md](./003-tactile-press-and-reduced-motion-accessibility.md) | medium | `src/index.css`, `src/App.tsx`, `src/components/modals/*.tsx` | completed |
| 004 | [004-android-apk-packaging-and-optimization.md](./004-android-apk-packaging-and-optimization.md) | high | `capacitor.config.json`, `android/`, `.github/workflows/build-apk.yml`, `src/components/modals/SettingsModal.tsx`, `src/App.tsx` | proposed |

## Out of Scope / Intentional Non-Changes

- **Virtual D-pad and ABXY button press state (`InGameView.tsx`, `PadGroup.tsx`)**: Gamepad buttons are high-frequency controls pressed hundreds of times per minute. Per the motion decision framework, high-frequency controls use instant state switches (`translate-y-[1.5px]` / active color) with **no** entrance/exit tween so rapid inputs never feel sluggish.
- **Emulator canvas rendering (`playerBridge.ts`)**: Handled directly by WebGL/2D canvas inside the emulator iframe rather than CSS transitions.
