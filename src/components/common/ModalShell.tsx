import React from 'react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy?: string;
  /** Theme colors, width and height classes for the dialog panel. */
  panelClassName?: string;
  /** Clicking the dark scrim closes the modal. */
  closeOnScrim?: boolean;
  children: React.ReactNode;
}

const EXIT_MS = 200;

/**
 * Shared full-screen modal shell: scrim + panel with enter/exit transitions.
 * Keeps the panel mounted for EXIT_MS while the exit animation plays.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  labelledBy,
  panelClassName = '',
  closeOnScrim = false,
  children,
}) => {
  const [mounted, setMounted] = React.useState(isOpen);
  const [closing, setClosing] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [isOpen, mounted]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 ${
        closing ? 'modal-out' : 'modal-in'
      }`}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 20px, 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 20px, 36px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px) + 12px, 16px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px) + 12px, 16px)',
      }}
      onClick={closeOnScrim ? onClose : undefined}
    >
      <div
        className={`rounded-3xl border overflow-hidden my-auto flex flex-col hardware-panel modal-pop ${
          closing ? 'modal-pop-out' : ''
        } ${panelClassName}`}
        onClick={closeOnScrim ? (e) => e.stopPropagation() : undefined}
      >
        {children}
      </div>
    </div>
  );
};
