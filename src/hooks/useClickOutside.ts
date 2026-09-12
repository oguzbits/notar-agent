import { useEffect, useRef } from 'react';

interface UseClickOutsideOptions {
  enabled?: boolean;
  onEscape?: boolean;
}

/**
 * Hook zum Erkennen von Klicks außerhalb eines Elements sowie optionalem Schließen per Escape-Taste.
 *
 * @param onTrigger Callback, der bei Klick außerhalb (oder Escape) aufgerufen wird.
 * @param options Optionale Einstellungen (enabled: boolean, onEscape: boolean)
 * @returns ref, die an das DOM-Element übergeben werden muss
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
  onTrigger: () => void,
  options: UseClickOutsideOptions = {}
) {
  const { enabled = true, onEscape = true } = options;
  const ref = useRef<T | null>(null);
  const onTriggerRef = useRef(onTrigger);

  // Halte Referenz auf neuste Callback-Funktion ohne unnötige Re-Subscriptions
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onTriggerRef.current();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (onEscape && event.key === 'Escape') {
        onTriggerRef.current();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    if (onEscape) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (onEscape) {
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [enabled, onEscape]);

  return ref;
}
