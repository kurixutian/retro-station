import React from 'react';
import { PadGroupPosition } from '../../types';

interface DpadControlProps {
  customizing: boolean;
  isLandscape: boolean;
  dpadLayout: PadGroupPosition;
  setButtonDown?: (name: string) => void;
  setButtonUp?: (name: string) => void;
}

export const DpadControl: React.FC<DpadControlProps> = ({
  customizing,
  isLandscape,
  dpadLayout,
  setButtonDown,
  setButtonUp,
}) => {
  const dpadContainerRef = React.useRef<HTMLDivElement | null>(null);
  const dpadRectRef = React.useRef<DOMRect | null>(null);
  const activeDpadPointerId = React.useRef<number | null>(null);
  const activeDpadTouchId = React.useRef<number | null>(null);
  const activeDpadDirs = React.useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const activeDpadMaskRef = React.useRef<number>(0);
  const dpadArmRefs = React.useRef<{
    up: HTMLDivElement | null;
    down: HTMLDivElement | null;
    left: HTMLDivElement | null;
    right: HTMLDivElement | null;
  }>({ up: null, down: null, left: null, right: null });

  React.useEffect(() => {
    const refreshDpadRect = () => {
      if (dpadContainerRef.current) {
        dpadRectRef.current = dpadContainerRef.current.getBoundingClientRect();
      }
    };
    refreshDpadRect();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && dpadContainerRef.current) {
      ro = new ResizeObserver(refreshDpadRect);
      ro.observe(dpadContainerRef.current);
    }
    window.addEventListener('resize', refreshDpadRect);
    window.addEventListener('orientationchange', refreshDpadRect);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', refreshDpadRect);
      window.removeEventListener('orientationchange', refreshDpadRect);
    };
  }, [isLandscape, dpadLayout, customizing]);

  const syncDpadArmVisuals = React.useCallback((mask: number) => {
    const arms = dpadArmRefs.current;
    if (arms.up) arms.up.dataset.pressed = (mask & 16) !== 0 ? 'true' : 'false';
    if (arms.down) arms.down.dataset.pressed = (mask & 32) !== 0 ? 'true' : 'false';
    if (arms.left) arms.left.dataset.pressed = (mask & 64) !== 0 ? 'true' : 'false';
    if (arms.right) arms.right.dataset.pressed = (mask & 128) !== 0 ? 'true' : 'false';
  }, []);

  const updateDpadByCoords = React.useCallback((clientX: number, clientY: number) => {
    const rect = dpadRectRef.current;
    if (!rect || rect.width === 0) return;
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const distSq = dx * dx + dy * dy;

    const outsideDeadzone = distSq > 25;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const up = outsideDeadzone && dy < -4 && absDy > absDx * 0.42;
    const down = outsideDeadzone && dy > 4 && absDy > absDx * 0.42;
    const left = outsideDeadzone && dx < -4 && absDx > absDy * 0.42;
    const right = outsideDeadzone && dx > 4 && absDx > absDy * 0.42;

    const nextMask = (up ? 16 : 0) | (down ? 32 : 0) | (left ? 64 : 0) | (right ? 128 : 0);
    if (nextMask === activeDpadMaskRef.current) return;

    activeDpadMaskRef.current = nextMask;
    syncDpadArmVisuals(nextMask);

    const nextDirs = { up, down, left, right };
    (['up', 'down', 'left', 'right'] as const).forEach((dir) => {
      if (nextDirs[dir] && !activeDpadDirs.current[dir]) {
        activeDpadDirs.current[dir] = true;
        setButtonDown?.(dir);
      } else if (!nextDirs[dir] && activeDpadDirs.current[dir]) {
        activeDpadDirs.current[dir] = false;
        setButtonUp?.(dir);
      }
    });
  }, [setButtonDown, setButtonUp, syncDpadArmVisuals]);

  const releaseDpadAll = React.useCallback(() => {
    activeDpadPointerId.current = null;
    activeDpadTouchId.current = null;
    if (activeDpadMaskRef.current === 0) return;
    activeDpadMaskRef.current = 0;
    syncDpadArmVisuals(0);
    (['up', 'down', 'left', 'right'] as const).forEach((dir) => {
      if (activeDpadDirs.current[dir]) {
        activeDpadDirs.current[dir] = false;
        setButtonUp?.(dir);
      }
    });
  }, [setButtonUp, syncDpadArmVisuals]);

  // Attach native non-passive touch listeners so Android Chrome skips gesture
  // disambiguation and fires D-Pad inputs at 0ms touch latency.
  React.useEffect(() => {
    const el = dpadContainerRef.current;
    if (!el || customizing) return;

    const findTouchById = (list: TouchList, id: number): Touch | null => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].identifier === id) return list[i];
      }
      return null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const t = e.changedTouches[0];
      if (!t) return;
      activeDpadTouchId.current = t.identifier;
      dpadRectRef.current = el.getBoundingClientRect();
      updateDpadByCoords(t.clientX, t.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      const id = activeDpadTouchId.current;
      if (id === null) return;
      const t = findTouchById(e.changedTouches, id) || findTouchById(e.touches, id);
      if (!t) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      updateDpadByCoords(t.clientX, t.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const id = activeDpadTouchId.current;
      if (id === null) return;
      if (!findTouchById(e.changedTouches, id)) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      releaseDpadAll();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      if (activeDpadTouchId.current !== null) {
        releaseDpadAll();
      }
    };
  }, [customizing, updateDpadByCoords, releaseDpadAll]);

  return (
    <div
      ref={dpadContainerRef}
      className="relative w-36 h-36 select-none touch-none gb-dpad-base rounded-2xl flex items-center justify-center"
      style={{
        contain: 'layout style',
        transform: 'translateZ(0)',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (customizing || e.pointerType === 'touch') return;
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        activeDpadPointerId.current = e.pointerId;
        dpadRectRef.current = e.currentTarget.getBoundingClientRect();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        updateDpadByCoords(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (customizing || e.pointerType === 'touch' || activeDpadPointerId.current !== e.pointerId) return;
        updateDpadByCoords(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (customizing || e.pointerType === 'touch' || activeDpadPointerId.current !== e.pointerId) return;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        releaseDpadAll();
      }}
      onPointerCancel={(e) => {
        if (customizing || e.pointerType === 'touch' || activeDpadPointerId.current !== e.pointerId) return;
        releaseDpadAll();
      }}
      onPointerLeave={(e) => {
        if (customizing || e.pointerType === 'touch' || activeDpadPointerId.current !== e.pointerId) return;
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) return;
        } catch {}
        releaseDpadAll();
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ transform: 'translateZ(0)', contain: 'strict' }}
      >
        <svg className="w-full h-full" viewBox="0 0 144 144" aria-hidden="true">
          <defs>
            <linearGradient id="gbDpadCrossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#36363d" />
              <stop offset="45%" stopColor="#222227" />
              <stop offset="100%" stopColor="#141418" />
            </linearGradient>
          </defs>
          <path
            d="M 48,10 A 10,10 0 0,1 58,0 L 86,0 A 10,10 0 0,1 96,10 L 96,48 L 134,48 A 10,10 0 0,1 144,58 L 144,86 A 10,10 0 0,1 134,96 L 96,96 L 96,134 A 10,10 0 0,1 86,144 L 58,144 A 10,10 0 0,1 48,134 L 48,96 L 10,96 A 10,10 0 0,1 0,86 L 0,58 A 10,10 0 0,1 10,48 L 48,48 Z"
            fill="url(#gbDpadCrossGrad)"
            stroke="#40404a"
            strokeWidth="0.75"
          />
        </svg>
      </div>
      <div
        ref={(el) => { dpadArmRefs.current.up = el; }}
        className="absolute top-0 left-12 w-12 h-14 rounded-t-xl gb-dpad-arm flex items-start justify-center pt-2.5 pointer-events-none select-none dpad-arm z-10"
        aria-hidden="true"
      >
        <svg className="w-2.5 h-2.5 fill-black/80" viewBox="0 0 10 10" aria-hidden="true">
          <polygon points="5,1 9,8 1,8" />
        </svg>
      </div>
      <div
        ref={(el) => { dpadArmRefs.current.down = el; }}
        className="absolute bottom-0 left-12 w-12 h-14 rounded-b-xl gb-dpad-arm flex items-end justify-center pb-2.5 pointer-events-none select-none dpad-arm z-10"
        aria-hidden="true"
      >
        <svg className="w-2.5 h-2.5 fill-black/80" viewBox="0 0 10 10" aria-hidden="true">
          <polygon points="1,2 9,2 5,9" />
        </svg>
      </div>
      <div
        ref={(el) => { dpadArmRefs.current.left = el; }}
        className="absolute top-12 left-0 w-14 h-12 rounded-l-xl gb-dpad-arm flex items-center justify-start pl-2.5 pointer-events-none select-none dpad-arm z-10"
        aria-hidden="true"
      >
        <svg className="w-2.5 h-2.5 fill-black/80" viewBox="0 0 10 10" aria-hidden="true">
          <polygon points="8,1 8,9 1,5" />
        </svg>
      </div>
      <div
        ref={(el) => { dpadArmRefs.current.right = el; }}
        className="absolute top-12 right-0 w-14 h-12 rounded-r-xl gb-dpad-arm flex items-center justify-end pr-2.5 pointer-events-none select-none dpad-arm z-10"
        aria-hidden="true"
      >
        <svg className="w-2.5 h-2.5 fill-black/80" viewBox="0 0 10 10" aria-hidden="true">
          <polygon points="2,1 2,9 9,5" />
        </svg>
      </div>
      <div className="absolute top-12 left-12 w-12 h-12 flex items-center justify-center pointer-events-none z-20">
        <div className="w-5 h-5 rounded-full gb-pivot-dish" />
      </div>
    </div>
  );
};
