import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider } from '@/theme/ThemeProvider';

/** Same providers as the app root: gesture root (GestureDetector throws without one in __DEV__) + theme. */
function Providers({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>{children}</ThemeProvider>
    </GestureHandlerRootView>
  );
}

/** RNTL render wrapped in the app providers (as a wrapper, so rerender keeps it), for ui tests. */
export const renderThemed = (ui: ReactElement) => render(ui, { wrapper: Providers });
