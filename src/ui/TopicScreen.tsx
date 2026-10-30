import { View } from 'react-native';

import { Button } from './Button';
import { Header } from './Header';
import { Screen } from './Screen';
import { T } from './T';
import type { ReactNode } from 'react';

/** Pushed-screen frame for topic new/edit: "‹ Topics" back, title, body. No tab bar (root stack). */
export function TopicScreen({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <Screen>
      <View style={{ alignItems: 'flex-start' }}>
        <Button label="‹ Topics" kind="ghost" accessibilityLabel="Back to Topics" onPress={onBack} />
      </View>
      <Header title={title} />
      {children}
    </Screen>
  );
}

export function MissingTopic({ onBack }: { onBack: () => void }) {
  return (
    <TopicScreen title="Topic" onBack={onBack}>
      <T>This topic no longer exists</T>
      <Button label="Back to Topics" onPress={onBack} />
    </TopicScreen>
  );
}
