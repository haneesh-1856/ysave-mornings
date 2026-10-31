import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { CloseOutcome } from '@/domain/types';
import { closeToday, MissingOutcomesError } from '@/state/actions/close';
import { ValidationError } from '@/state/errors';
import { useCloseSummary } from '@/state/hooks/useCloseSummary';
import { useSubmitGuard } from '@/state/hooks/useSubmitGuard';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CloseSummary } from '@/ui/CloseSummary';
import { useTheme } from '@/theme/ThemeProvider';
import { Collection } from '@/ui/collection/Collection';
import { collectionNoun } from '@/ui/collectionNoun';
import { weekdayName } from '@/ui/dayNames';
import { Header } from '@/ui/Header';
import { OutcomePicker } from '@/ui/OutcomePicker';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

// Pop back to the existing (tabs) entry (Today focused) rather than stacking a second one.
const goToday = () => router.dismissTo('/(tabs)/today');

export default function CloseScreen() {
  const s = useCloseSummary();
  const t = useTheme();
  const noun = collectionNoun(t.look.art);
  const guard = useSubmitGuard();
  const [outcomes, setOutcomes] = useState<Record<string, CloseOutcome>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [justClosed, setJustClosed] = useState(false);

  const tomorrowName = weekdayName(s.tomorrowKey);
  const planTomorrow = () => router.replace({ pathname: '/plan/[dayKey]', params: { dayKey: s.tomorrowKey } });

  const choose = (id: string, v: CloseOutcome) => {
    setOutcomes((o) => ({ ...o, [id]: v }));
    setMissing((m) => m.filter((x) => x !== id));
    setMessage(null);
  };

  const close = () => {
    try {
      const ok = guard.run(() => {
        closeToday(outcomes);
        return true;
      });
      if (ok) {
        // The data bump flips `closed` while the jar stays mounted, so the lid swings.
        setJustClosed(true);
        setMessage(null);
        setMissing([]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (e) {
      if (e instanceof MissingOutcomesError) setMissing(e.missing);
      else if (!(e instanceof ValidationError)) throw e;
      setMessage((e as Error).message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  };

  const nothing = !s.closed && s.total === 0;
  const jar = <Collection items={s.items} closed={s.closed} scale={2} animateLid />;

  return (
    <Screen>
      <Header title="Close today" />
      <View style={{ alignItems: 'center' }}>{jar}</View>
      {nothing ? (
        <>
          <T variant="sub">Nothing to close yet</T>
          <Button label="Back to Today" onPress={goToday} />
        </>
      ) : (
        <>
          <CloseSummary done={s.done} total={s.total} focusedMs={s.focusedMs} extraMs={s.extraMs} />
          {s.closed ? (
            <>
              <T weight="bold">{justClosed ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} closed` : 'Today is closed'}</T>
              <Button testID="close-plan-tomorrow" label="Plan tomorrow" onPress={planTomorrow} />
              <Button label="Back to Today" kind="ghost" onPress={goToday} />
            </>
          ) : (
            <>
              {s.unticked.length > 0 ? (
                <Card>
                  <T weight="bold">Not ticked today</T>
                  {s.unticked.map((u) => (
                    <View
                      key={u.dayTaskId}
                      testID={missing.includes(u.dayTaskId) ? 'outcome-missing' : undefined}
                      style={{
                        gap: 8, padding: 8, borderRadius: t.radius.r, borderWidth: 2,
                        borderColor: missing.includes(u.dayTaskId) ? t.c.danger : 'transparent',
                      }}>
                      <OutcomePicker
                        name={u.name}
                        topicColor={u.colorKey}
                        value={outcomes[u.dayTaskId] ?? null}
                        nextDayName={tomorrowName}
                        onChange={(v) => choose(u.dayTaskId, v)}
                      />
                    </View>
                  ))}
                </Card>
              ) : null}
              {message ? <T accessibilityRole="alert" color="danger">{message}</T> : null}
              <Button testID="close-confirm" label={`Close the ${noun}`} disabled={guard.busy} onPress={close} />
              <Button label="Not yet" kind="ghost" onPress={goToday} />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
