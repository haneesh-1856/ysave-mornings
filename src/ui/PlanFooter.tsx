import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { formatMinutes } from './formatMinutes';
import { T } from './T';

type Props = {
  count: number;
  minutes: number;
  dayName: string;
  canConfirm: boolean;
  busy: boolean;
  onConfirm: () => void;
};

export function PlanFooter({ count, minutes, dayName, canConfirm, busy, onConfirm }: Props) {
  const t = useTheme();
  return (
    <View style={{ gap: 10, padding: 16, backgroundColor: t.c.bg, borderTopWidth: 1, borderTopColor: t.c.line }}>
      <T variant="sub" weight="bold" style={{ textAlign: 'center' }}>
        {`${count} ${count === 1 ? 'task' : 'tasks'} · ${formatMinutes(minutes)} planned`}
      </T>
      <Button label={`${dayName} looks like this ✓`} disabled={!canConfirm || busy} onPress={onConfirm} />
    </View>
  );
}
