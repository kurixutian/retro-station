# Plan 001: Composited Hero Art & Ambient Backdrop Performance

**Source audit:** `plans/README.md` (commit `c43f6fc`)
**Severity:** high
**Files touched:**
- `src/index.css`
- `src/components/library/LibraryView.tsx`
- `src/components/emulator/InGameView.tsx`

## Problem

1. In `src/index.css:142-158`, `.hero-art-pan` animates `object-position: center 20%` → `center 80%` infinitely (`16s ease-in-out infinite`) with `will-change: object-position`. `object-position` is a **paint** property, not a compositor property, forcing main-thread image repaints on every frame while viewing the library.
2. In `src/components/library/LibraryView.tsx:104`, the fixed ambient background renders 6 separate `<GameCoverImage>` components inside a grid with `blur-3xl` (`64px` Gaussian blur). Per the animation performance checklist, `filter: blur()` beyond `20px` is exponentially expensive on mobile GPUs and wastes VRAM.
3. In `src/components/emulator/InGameView.tsx:990-1002`, Nintendo DS emulation (`isNds`) renders 4 full-screen DOM overlay layers (`rgbBloom` box-shadow, scanlines, LCD subpixel grid, vignette) over the active dual-screen WebGL canvas, adding unnecessary compositor overdraw on top of the heavy dual-screen NDS emulator.

## Goal

Keep the library hero pan and ambient backdrop strictly on the GPU compositor within the 16.6ms mobile frame budget, and eliminate redundant shader overlay layers over the Nintendo DS touch/display canvas so NDS emulation gets maximum GPU headroom.

## Changes

### 1. `src/index.css` (`@keyframes heroArtPan` and `.hero-art-pan`, lines 142–158)

**Why:** Replace the continuous `object-position` paint animation with a GPU-composited `transform: scale(...) translate3d(...)` animation and remove permanent `will-change: object-position`.

**Before:**
```css
@keyframes heroArtPan {
  0% {
    object-position: center 20%;
  }
  50% {
    object-position: center 80%;
  }
  100% {
    object-position: center 20%;
  }
}

.hero-art-pan {
  animation: heroArtPan 16s ease-in-out infinite;
  will-change: object-position;
}
```

**After:**
```css
@keyframes heroArtPan {
  0%, 100% {
    transform: scale(1.08) translate3d(0, -3%, 0);
  }
  50% {
    transform: scale(1.08) translate3d(0, 3%, 0);
  }
}

.hero-art-pan {
  animation: heroArtPan 18s var(--ease-in-out, cubic-bezier(0.65, 0, 0.35, 1)) infinite;
  backface-visibility: hidden;
}
```

### 2. `src/components/library/LibraryView.tsx` (Ambient Background Mosaic, lines 102–114)

**Why:** Replace the 6-image `blur-3xl` (`64px`) mosaic with a lightweight CSS radial ambient glow so mobile GPUs do not allocate and blur 6 large textures in the background.

### 3. `src/components/emulator/InGameView.tsx` (Screen container isolation & NDS overlay bypass)

**Why:** Isolate the emulator viewport with `contain: layout paint` and skip expensive full-screen multi-layer CSS box-shadow bloom on NDS unless explicitly enabled.

## Do Not Touch

- Do not alter the game card aspect ratios or cover art fallback chain in `GameCoverImage.tsx`.
- Do not change shader definitions in `src/constants/shaders.ts`.

## Verification

- [ ] `npm run build` succeeds with zero TypeScript or bundler errors.
- [ ] In Chrome DevTools Rendering → Paint Flashing, the library hero banner no longer flashes green on every frame.
- [ ] `prefers-reduced-motion: reduce` disables `.hero-art-pan` completely.
