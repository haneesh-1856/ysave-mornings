import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { db, migrations } from '@/data/db';
import { useMorningRedirect } from '@/screens/useMorningRedirect';
import { loadLook } from '@/state/actions/look';
import { setDb } from '@/state/dbRef';
import { useDayBoundary } from '@/state/hooks/useDayBoundary';
import { useReconcileOnForeground } from '@/state/hooks/useReconcileOnForeground';
import { FONT_ASSETS } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

SplashScreen.preventAutoHideAsync();

// Stack animation for each "Screen transition" option. "Grow from the task" needs shared-element
// transitions, so it fades for now (docs/06-design-system.md#motion--transitions).
const STACK_ANIMATION = { slide: 'slide_from_right', fade: 'fade', rise: 'slide_from_bottom', expand: 'fade' } as const;

function RootStack() {
  const t = useTheme();
  useReconcileOnForeground(); // rollover + task completions on open and on every return to the app
  useDayBoundary(); // same, at the day boundary while the app stays open
  useMorningRedirect(); // a new day while the app is open routes to Morning once
  return (
    <>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.c.bg },
          animation: STACK_ANIMATION[t.look.trans],
          animationDuration: t.motion.duration,
        }}
      />
    </>
  );
}

function MigrationError({ message }: { message: string }) {
  return (
    <Screen>
      <T variant="title">Couldn&apos;t open your data</T>
      <T>{message}</T>
      <T>Your data is safe on this phone; please restart the app. This screen does not delete anything.</T>
    </Screen>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const { success: migrated, error: migrationError } = useMigrations(db, migrations);
  const fontsReady = fontsLoaded || !!fontError; // if fonts fail, the system font still renders
  if (migrated) setDb(db); // before any screen renders, so hooks can call getDb()
  const [lookLoaded, setLookLoaded] = useState(false);
  // The splash stays up until the saved look is in the store, so no frame shows the default look.
  if (migrated && !lookLoaded) {
    loadLook();
    setLookLoaded(true);
  }
  const ready = fontsReady && (migrationError ? true : lookLoaded);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // TODO(M5): run rollover here once migrations succeed, and again whenever the app returns to the foreground.
  if (!ready) return null;
  // One gesture root for the whole app (gesture-handler 3: every GestureDetector must be under it).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        {migrationError ? <MigrationError message={migrationError.message} /> : <RootStack />}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
