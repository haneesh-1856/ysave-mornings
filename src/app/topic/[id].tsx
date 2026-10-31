import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { removeTopic, updateTopic } from '@/state/actions/library';
import { ValidationError } from '@/state/errors';
import { useSubmitGuard } from '@/state/hooks/useSubmitGuard';
import { useTopic } from '@/state/hooks/useTopicsLibrary';
import { useTopicRemoval } from '@/state/hooks/useTopicRemoval';
import { TopicForm } from '@/ui/TopicForm';
import { MissingTopic, TopicScreen } from '@/ui/TopicScreen';

export default function EditTopic() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const topic = useTopic(id);
  const removal = useTopicRemoval(id);
  const [error, setError] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();
  // one guard shared by Save and Remove
  const { busy, run } = useSubmitGuard();
  const back = () => router.back();

  if (!topic) return <MissingTopic onBack={back} />;
  return (
    <TopicScreen title="Edit topic" onBack={back}>
      <TopicForm
        initialName={topic.name}
        initialColor={topic.colorKey}
        error={error}
        busy={busy}
        onSave={(name, colorKey) => {
          try {
            run(() => {
              updateTopic(topic.id, { name, colorKey });
              back();
            });
          } catch (e) {
            if (!(e instanceof ValidationError)) throw e;
            setError(e.message);
          }
        }}
        removal={removal}
        removeError={removeError}
        onRemove={(moves) => {
          try {
            run(() => {
              removeTopic(topic.id, moves && { moves });
              back();
            });
          } catch (e) {
            if (!(e instanceof ValidationError)) throw e;
            setRemoveError(e.message);
          }
        }}
      />
    </TopicScreen>
  );
}
