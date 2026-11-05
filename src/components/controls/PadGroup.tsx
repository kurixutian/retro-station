import React, { useRef } from 'react';
import { PadGroupId, PadLayout } from '../../types';
import { DEFAULT_PAD_LAYOUT } from '../../constants/controls';

interface PadGroupProps {
  id: PadGroupId;
  layout: PadLayout;
  customizing: boolean;
  selected: boolean;
  onSelect: (id: PadGroupId) => void;
  onMove: (id: PadGroupId, x: number, y: number) => void;
  deckRef: React.RefObject<HTMLDivElement | null>;
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
  children
}: PadGroupProps) {
  const g = layout?.[id] || DEFAULT_PAD_LAYOUT[id] || { x: 0.5, y: 0.5, s: 1 };
  const dragging = useRef(false);

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
            const x = Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width));
            const y = Math.min(0.97, Math.max(0.03, (e.clientY - r.top) / r.height));
            onMove(id, x, y);
          }}
          onPointerUp={(e) => {
            if (dragging.current) {
              dragging.current = false;
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch (err) {}
            }
          }}
          onPointerCancel={(e) => {
            if (dragging.current) {
              dragging.current = false;
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
