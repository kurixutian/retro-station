import { useEffect, useRef } from 'react';
import { soundFX } from '../services/audio/synth';

interface UseGamepadInputOptions {
  isActive: boolean;
  onButtonDown: (name: string) => void;
  onButtonUp: (name: string) => void;
  onShowToast: (msg: string) => void;
}

export function useGamepadInput({
  isActive,
  onButtonDown,
  onButtonUp,
  onShowToast
}: UseGamepadInputOptions) {
  const prevButtonsRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let animId = 0;

    const hasConnectedGamepad = () => {
      try {
        const list = navigator.getGamepads ? navigator.getGamepads() : [];
        return Boolean(list && (list[0] || list[1] || list[2] || list[3]));
      } catch {
        return false;
      }
    };

    const pollGamepads = () => {
      animId = 0;
      if (!isActive) return;
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];
      if (!gp) {
        for (const key of Object.keys(prevButtonsRef.current)) {
          if (prevButtonsRef.current[key]) {
            onButtonUp(key);
          }
        }
        prevButtonsRef.current = {};
        return;
      }

      const btn = (idx: number) => Boolean(gp.buttons[idx]?.pressed);
      const axis = (idx: number) => gp.axes[idx] || 0;

      const curState: Record<string, boolean> = {
        up: btn(12) || axis(1) < -0.45,
        down: btn(13) || axis(1) > 0.45,
        left: btn(14) || axis(0) < -0.45,
        right: btn(15) || axis(0) > 0.45,
        actionA: btn(0),
        actionB: btn(1),
        actionX: btn(2),
        actionY: btn(3),
        btnL: btn(4),
        btnR: btn(5),
        select: btn(8),
        start: btn(9)
      };

      for (const key of Object.keys(curState)) {
        const wasDown = prevButtonsRef.current[key];
        const isDown = curState[key];
        if (isDown && !wasDown) {
          onButtonDown(key);
        } else if (!isDown && wasDown) {
          onButtonUp(key);
        }
      }
      prevButtonsRef.current = curState;
      animId = requestAnimationFrame(pollGamepads);
    };

    const startPollingIfNeeded = () => {
      if (isActive && !animId && hasConnectedGamepad()) {
        animId = requestAnimationFrame(pollGamepads);
      }
    };

    const handleGamepadConnected = (e: GamepadEvent) => {
      onShowToast(`Gamepad Connected: ${e.gamepad.id.slice(0, 24)}`);
      soundFX.save();
      if (isActive && !animId) {
        animId = requestAnimationFrame(pollGamepads);
      }
    };

    const handleGamepadDisconnected = () => {
      onShowToast('Gamepad Disconnected');
      if (!hasConnectedGamepad() && animId) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    startPollingIfNeeded();

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      if (animId) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
      for (const key of Object.keys(prevButtonsRef.current)) {
        if (prevButtonsRef.current[key]) {
          onButtonUp(key);
        }
      }
      prevButtonsRef.current = {};
    };
  }, [isActive, onButtonDown, onButtonUp, onShowToast]);
}
