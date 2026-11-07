import React, { useRef } from 'react';
import { PadGroupId, PadLayout } from '../../types';
import { DEFAULT_PAD_LAYOUT, PAD_LABELS } from '../../constants/controls';
import { haptics } from '../../services/haptics';

export interface SnapGuide {
  x?: number | null;
  y?: number | null;
  label?: string | null;
}

interface PadGroupProps {
  id: PadGroupId;
  layout: PadLayout;
  customizing: boolean;
  selected: boolean;
  onSelect: (id: PadGroupId) => void;
  onMove: (id: PadGroupId, x: number, y: number) => void;
  deckRef: React.RefObject<HTMLDivElement | null>;
  onSnapGuide?: (guide: SnapGuide | null) => void;
  children: React.ReactNode;
}

export function PadGroup({
  id,
  layout,
  customizing,
  selected,
  onSelect,
  onMove,
  deckRef,
  onSnapGuide,
  children
}: PadGroupProps) {
  const g = layout?.[id] || DEFAULT_PAD_LAYOUT[id] || { x: 0.5, y: 0.5, s: 1 };
  const dragging = useRef(false);
  const lastSnapRef = useRef<{ x: number | null; y: number | null } | null>(null);

  return (
    <div
      className="absolute touch-none select-none pointer-events-auto"
      style={{
        left: `${g.x * 100}%`,
        top: `${g.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${g.s})`,
        zIndex: selected ? 30 : 10,
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        userSelect: 'none'
      }}
    >
      <div className={customizing ? 'pointer-events-none select-none' : undefined}>
        {children}
      </div>
      {customizing && (
        <div
          className={`absolute -inset-3 rounded-2xl border-2 border-dashed touch-none cursor-move pointer-events-auto z-30 ${
            selected ? 'border-emerald-400 bg-emerald-400/20 shadow-xl' : 'border-white/40 bg-white/5 hover:border-emerald-400/60'
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch (err) {}
            dragging.current = true;
            onSelect(id);
          }}
          onPointerMove={(e) => {
            if (!dragging.current || !deckRef.current) return;
            const r = deckRef.current.getBoundingClientRect();
            const rawX = Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width));
            const rawY = Math.min(0.97, Math.max(0.03, (e.clientY - r.top) / r.height));

            let finalX = rawX;
            let finalY = rawY;
            let snapX: number | null = null;
            let snapY: number | null = null;
            let snapLabel: string | null = null;
            const SNAP_THRESHOLD = 0.022; // ~10px magnetic snap zone

            // 1. Center Line Snapping
            if (Math.abs(rawX - 0.5) < SNAP_THRESHOLD) {
              finalX = 0.5;
              snapX = 0.5;
              snapLabel = 'Center (50% X)';
            }
            if (Math.abs(rawY - 0.5) < SNAP_THRESHOLD) {
              finalY = 0.5;
              snapY = 0.5;
              snapLabel = snapLabel ? 'Centered Crosshair (50%)' : 'Center (50% Y)';
            }

            // 2. Sibling Alignment Snapping (Align with other pads)
            if (layout) {
              const siblingKeys = (Object.keys(layout) as PadGroupId[]).filter((k) => k !== id && k !== 'screen');
              for (const sibKey of siblingKeys) {
                const sib = layout[sibKey];
                if (!sib) continue;
                if (snapX === null && Math.abs(rawX - sib.x) < SNAP_THRESHOLD) {
                  finalX = sib.x;
                  snapX = sib.x;
                  snapLabel = `Aligned with ${PAD_LABELS[sibKey] || sibKey} (X)`;
                }
                if (snapY === null && Math.abs(rawY - sib.y) < SNAP_THRESHOLD) {
                  finalY = sib.y;
                  snapY = sib.y;
                  snapLabel = `Aligned with ${PAD_LABELS[sibKey] || sibKey} (Y)`;
                }
              }
            }

            // 3. 5% Grid Snapping
            if (snapX === null) {
              const gridX = Math.round(rawX / 0.05) * 0.05;
              if (Math.abs(rawX - gridX) < 0.012) {
                finalX = parseFloat(gridX.toFixed(2));
                snapX = finalX;
                snapLabel = `Grid Snap (${Math.round(finalX * 100)}% X)`;
              }
            }
            if (snapY === null) {
              const gridY = Math.round(rawY / 0.05) * 0.05;
              if (Math.abs(rawY - gridY) < 0.012) {
                finalY = parseFloat(gridY.toFixed(2));
                snapY = finalY;
                snapLabel = snapLabel ? `${snapLabel} • (${Math.round(finalY * 100)}% Y)` : `Grid Snap (${Math.round(finalY * 100)}% Y)`;
              }
            }

            // Haptic pulse when entering a magnetic snap lock
            const isSnapped = snapX !== null || snapY !== null;
            if (isSnapped && (!lastSnapRef.current || lastSnapRef.current.x !== snapX || lastSnapRef.current.y !== snapY)) {
              haptics.selection();
            }
            lastSnapRef.current = isSnapped ? { x: snapX, y: snapY } : null;

            onSnapGuide?.(isSnapped ? { x: snapX, y: snapY, label: snapLabel } : null);
            onMove(id, finalX, finalY);
          }}
          onPointerUp={(e) => {
            if (dragging.current) {
              dragging.current = false;
              lastSnapRef.current = null;
              onSnapGuide?.(null);
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch (err) {}
            }
          }}
          onPointerCancel={(e) => {
            if (dragging.current) {
              dragging.current = false;
              lastSnapRef.current = null;
              onSnapGuide?.(null);
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch (err) {}
            }
          }}
        />
      )}
    </div>
  );
}
