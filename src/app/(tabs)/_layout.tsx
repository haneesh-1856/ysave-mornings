import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: 'transparent' } }}>
      <Tabs.Screen name="topics" />
      <Tabs.Screen name="today" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
