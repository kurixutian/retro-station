import { useState, useEffect, useCallback } from 'react';
import { PadLayout, PadGroupId } from '../types';
import {
  loadPadLayout,
  savePadLayout,
  getActiveSlot,
  setActiveSlot,
  LayoutSlot,
} from '../constants/controls';

export function usePadLayoutState(currentSystemKey: string) {
  const [hidePad, setHidePad] = useState(() => {
    try {
      return localStorage.getItem('retro_hide_pad') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('retro_hide_pad', hidePad ? '1' : '0');
    } catch {}
  }, [hidePad]);

  const [slotPortrait, setSlotPortrait] = useState<LayoutSlot>(() => getActiveSlot(false, currentSystemKey));
  const [slotLandscape, setSlotLandscape] = useState<LayoutSlot>(() => getActiveSlot(true, currentSystemKey));
  const [padLayoutPortrait, setPadLayoutPortrait] = useState<PadLayout>(() =>
    loadPadLayout(false, getActiveSlot(false, currentSystemKey), currentSystemKey)
  );
  const [padLayoutLandscape, setPadLayoutLandscape] = useState<PadLayout>(() =>
    loadPadLayout(true, getActiveSlot(true, currentSystemKey), currentSystemKey)
  );
  const [customizing, setCustomizing] = useState(false);
  const [selectedPad, setSelectedPad] = useState<PadGroupId>('dpad');

  useEffect(() => {
    savePadLayout(false, slotPortrait, padLayoutPortrait, currentSystemKey);
  }, [slotPortrait, padLayoutPortrait, currentSystemKey]);

  useEffect(() => {
    savePadLayout(true, slotLandscape, padLayoutLandscape, currentSystemKey);
  }, [slotLandscape, padLayoutLandscape, currentSystemKey]);

  useEffect(() => {
    const handleLayoutUpdate = () => {
      const sp = getActiveSlot(false, currentSystemKey);
      const sl = getActiveSlot(true, currentSystemKey);
      setSlotPortrait(sp);
      setSlotLandscape(sl);
      setPadLayoutPortrait(loadPadLayout(false, sp, currentSystemKey));
      setPadLayoutLandscape(loadPadLayout(true, sl, currentSystemKey));
    };
    window.addEventListener('retro_layout_updated', handleLayoutUpdate);
    return () => window.removeEventListener('retro_layout_updated', handleLayoutUpdate);
  }, [currentSystemKey]);

  const switchSlotPortrait = useCallback(
    (slot: LayoutSlot) => {
      setSlotPortrait(slot);
      setActiveSlot(false, slot, currentSystemKey);
      setPadLayoutPortrait(loadPadLayout(false, slot, currentSystemKey));
    },
    [currentSystemKey]
  );

  const switchSlotLandscape = useCallback(
    (slot: LayoutSlot) => {
      setSlotLandscape(slot);
      setActiveSlot(true, slot, currentSystemKey);
      setPadLayoutLandscape(loadPadLayout(true, slot, currentSystemKey));
    },
    [currentSystemKey]
  );

  return {
    hidePad,
    setHidePad,
    slotPortrait,
    switchSlotPortrait,
    slotLandscape,
    switchSlotLandscape,
    padLayoutPortrait,
    setPadLayoutPortrait,
    padLayoutLandscape,
    setPadLayoutLandscape,
    customizing,
    setCustomizing,
    selectedPad,
    setSelectedPad,
  };
}
