# Plan 003: Tactile Press Feedback, Touch Hover Gating & Reduced-Motion Support

**Source audit:** `plans/README.md` (commit `c43f6fc`)
**Severity:** medium
**Files touched:**
- `src/index.css`
- `src/App.tsx`
- `src/components/modals/SaveSlotsModal.tsx`
- `src/components/modals/LibrarySettingsModal.tsx`
- `src/components/modals/KeyMappingsModal.tsx`
- `src/components/modals/PatchManagerModal.tsx`
- `src/components/modals/MissingRomModal.tsx`

## Problem

1. **Missing `prefers-reduced-motion` guard (`src/index.css`)**: None of the CSS keyframe animations (`.hero-art-pan`, `.animate-pulse`) or transitions respect `@media (prefers-reduced-motion: reduce)`.
2. **Duplicate pointer + touch listeners (`src/App.tsx:1546-1565`)**: `bindPadButton` attaches both `onPointerDown`/`onPointerUp` and `onTouchStart`/`onTouchEnd` to every gamepad button, causing mobile taps to fire `setButtonDown` and haptics twice and stacking two `75ms` hold timers (`App.tsx:517` + `playerBridge.ts:217`).
3. **Missing `.no-scrollbar` rule & modal scroll containment (`src/index.css`)**: `LibraryView.tsx` uses `.no-scrollbar` on the system filter pill bar, but `.no-scrollbar` is not defined in `src/index.css`. Modal scroll views also need `overscroll-behavior: contain` so scrolling save slots or settings never chains to the underlying viewport.

## Goal

Make every button press feel instantaneous (zero double-triggering, zero artificial 150ms release lag), gate hover states properly on touch devices, contain scroll inside modals, and honor `prefers-reduced-motion: reduce`.

## Changes

### 1. `src/index.css`

- Add `.no-scrollbar` utility (`scrollbar-width: none` and `::-webkit-scrollbar { display: none }`).
- Add `@media (prefers-reduced-motion: reduce)` rule that stops `.hero-art-pan` and collapses transform transitions while preserving opacity/color feedback.
- Add `.modal-scroll` / `overscroll-contain` support and gate sticky hover utilities on touch devices.

### 2. `src/App.tsx` (`bindPadButton` & `setButtonUp`)

- Remove redundant `onTouchStart` / `onTouchEnd` / `onTouchCancel` from `bindPadButton` where `onPointerDown` / `onPointerUp` / `onPointerCancel` already handle touch, pen, and mouse uniformly.
- Remove the duplicate `75ms` release timer in `App.tsx` `setButtonUp` so D-pad and button releases happen immediately on pointer release.

## Do Not Touch

- Do not change keyboard mapping defaults in `src/constants/controls.ts`.

## Verification

- [ ] Tapping D-pad or A/B/X/Y on mobile triggers haptics and `simulateButton` once per tap.
- [ ] Enabling `prefers-reduced-motion: reduce` stops background motion while keeping button press opacity/color states intact.
