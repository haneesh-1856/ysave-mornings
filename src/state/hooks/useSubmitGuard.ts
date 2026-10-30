import { useCallback, useRef, useState } from 'react';

/**
 * Double-submit guard. The ref blocks a second call synchronously (state would lag a frame);
 * `busy` disables the buttons. On success busy stays true (the screen navigates away); a thrown
 * error resets the guard and is rethrown. A blocked second call returns undefined.
 */
export function useSubmitGuard(): { busy: boolean; run<T>(fn: () => T): T | undefined; reset(): void } {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    running.current = false;
    setBusy(false);
  }, []);

  const run = useCallback(
    function run<T>(fn: () => T): T | undefined {
      if (running.current) return undefined;
      running.current = true;
      setBusy(true);
      try {
        return fn();
      } catch (e) {
        reset();
        throw e;
      }
    },
    [reset],
  );

  return { busy, run, reset };
}
