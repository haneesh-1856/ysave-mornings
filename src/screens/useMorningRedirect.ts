import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useMorning } from '@/state/hooks/useMorning';

/**
 * Routes to Morning once when a new day starts while the app stays open (day boundary or foreground
 * reconcile flips `useMorning().due` false -> true). No push at mount: `src/app/index.tsx` handles launch.
 * Morning calls `markMorningSeen()` on mount, which makes `due` false again, so this fires once per day.
 * Mounted once in the root stack (`src/app/_layout.tsx`).
 */
export function useMorningRedirect(): void {
  const { due } = useMorning();
  const router = useRouter();
  const pathname = usePathname();
  const prev = useRef(due);
  useEffect(() => {
    if (due && !prev.current && pathname !== '/morning') router.push('/morning');
    prev.current = due;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the due edge matters
  }, [due]);
}
