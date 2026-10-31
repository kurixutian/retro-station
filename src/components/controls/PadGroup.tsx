import React, { useRef } from 'react';
import { PadGroupId, PadLayout } from '../../types';

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
  const g = layout[id];
  const dragging = useRef(false);

  return (
    <div
      className="absolute"
      style={{
        left: `${g.x * 100}%`,
        top: `${g.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${g.s})`,
        zIndex: selected ? 30 : 10
      }}
    >
      {children}
      {customizing && (
        <div
          className={`absolute -inset-2 rounded-2xl border-2 border-dashed touch-none cursor-move ${
            selected ? 'border-emerald-400 bg-emerald-400/15' : 'border-white/40 bg-white/5'
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
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
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
        />
      )}
    </div>
  );
}
