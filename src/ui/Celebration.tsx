import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { T } from './T';
import { useMotion } from './useMotion';

type Props = { visible: boolean; text?: string };

/**
 * "Done for today" pop. Transition-based: only a hidden -> visible change (while mounted) plays the pop
 * and fires the success haptic. Mounting with `visible` already true (e.g. a Run screen opened on a task
 * that is already done) renders the static "Done for today" text, no pop and no haptic, so the celebration
 * is never replayed. Re-renders with `visible` unchanged never replay it either. Hiding then showing again
 * is a new transition and does celebrate again (cannot happen for the same task in practice).
 */
export function Celebration({ visible, text = 'Done for today' }: Props) {
  const { animate, reduce } = useMotion();
  // Seeded from the first `visible`, so a mount-with-visible is not treated as a transition.
  const was = useRef(visible);
  const p = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible === was.current) return;
    was.current = visible;
    if (visible) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    p.value = reduce ? (visible ? 1 : 0) : animate(visible ? 1 : 0);
    // `animate`/`reduce` come from motion settings; `visible` is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const style = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.85 + 0.15 * p.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      style={[{ alignItems: 'center' }, style]}>
      {visible ? <T variant="title" color="accent" weight="extrabold">{text}</T> : null}
    </Animated.View>
  );
}
