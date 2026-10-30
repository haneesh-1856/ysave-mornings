import { useMemo } from 'react';
import { Easing, useReducedMotion, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

/** Motion for the current look. Under Reduce Motion, `animate` returns the target value (no animation). */
export function useMotion() {
  const t = useTheme();
  const reduce = useReducedMotion();
  const easing = useMemo(() => Easing.bezier(...t.motion.bezier), [t.motion.bezier]);
  const duration = t.motion.duration;
  return useMemo(
    () => ({ reduce, animate: (to: number) => (reduce ? to : withTiming(to, { duration, easing })) }),
    [reduce, duration, easing],
  );
}
