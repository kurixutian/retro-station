# Plan 002: Eliminate `transition-all` & Introduce Purposeful Motion Tokens

**Source audit:** `plans/README.md` (commit `c43f6fc`)
**Severity:** high
**Files touched:**
- `src/index.css`
- `src/components/emulator/InGameView.tsx`
- `src/components/library/GameCard.tsx`
- `src/components/library/LibraryView.tsx`

## Problem

1. `src/components/emulator/InGameView.tsx:961` and `1261` use `transition-all duration-300` and `transition-all` on the in-game HUD Top Bar and Landscape Transport Bar. `transition: all` is a Hard Rule violation—it transitions layout properties unintentionally during orientation/resize changes and causes jank over the running emulator.
2. `src/components/library/GameCard.tsx:76` and `106`, and `src/components/library/LibraryView.tsx:167` and `254` use `transition-all duration-300` on cards, progress bars, and hero CTAs with default sluggish easing instead of explicit `transform, opacity, border-color, box-shadow` with a snappy custom `--ease-out` curve (`cubic-bezier(0.23, 1, 0.32, 1)`).

## Goal

Define reusable CSS custom property easing curves in `src/index.css` (`--ease-out`, `--ease-in-out`, `--ease-drawer`) and replace every `transition-all` across the HUD and Library with explicit property transitions under 200ms–250ms.

## Changes

### 1. `src/index.css` (Root Motion Tokens)

**Why:** Centralize strong custom easing curves so interactive controls respond immediately on touch/press and settle cleanly.

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}
```

### 2. `src/components/emulator/InGameView.tsx` (lines 961 & 1261)

**Why:** The Top Bar and Landscape Transport Bar only animate `transform` and `opacity` when toggling visibility.

**Before (line 961):**
```tsx
className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 transition-all duration-300 ${
  topBarVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
}`}
```

**After:**
```tsx
className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
  topBarVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
}`}
```

### 3. `src/components/library/GameCard.tsx` & `src/components/library/LibraryView.tsx`

**Why:** Replace `transition-all duration-300` on interactive cards and buttons with explicit `transition-[transform,border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]` and active scale feedback (`active:scale-[0.97]`).

## Do Not Touch

- Do not add entrance stagger animations to high-frequency HUD controls.

## Verification

- [ ] `grep -rn "transition-all" src/components/emulator/InGameView.tsx src/components/library/` returns zero matches.
- [ ] Toggling the in-game HUD bar slides smoothly at 60fps without layout shift.
