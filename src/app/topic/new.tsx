import { router } from 'expo-router';
import { useState } from 'react';

import { TOPIC_COLOR_KEYS } from '@/theme/buildTheme';
import { createTopic } from '@/state/actions/library';
import { ValidationError } from '@/state/errors';
import { useSubmitGuard } from '@/state/hooks/useSubmitGuard';
import { useTopicsLibrary } from '@/state/hooks/useTopicsLibrary';
import { TopicForm } from '@/ui/TopicForm';
import { TopicScreen } from '@/ui/TopicScreen';

export default function NewTopic() {
  const { topics } = useTopicsLibrary();
  const [error, setError] = useState<string>();
  // first color no existing topic uses; 'study' when all six are taken
  const [initialColor] = useState(() => TOPIC_COLOR_KEYS.find(k => !topics.some(e => e.topic.colorKey === k)) ?? 'study');
  const { busy, run } = useSubmitGuard();

  return (
    <TopicScreen title="New topic" onBack={() => router.back()}>
      <TopicForm
        initialName=""
        initialColor={initialColor}
        error={error}
        busy={busy}
        onSave={(name, colorKey) => {
          try {
            run(() => {
              createTopic({ name, colorKey });
              router.back();
            });
          } catch (e) {
            if (!(e instanceof ValidationError)) throw e;
            setError(e.message);
          }
        }}
      />
    </TopicScreen>
  );
}
