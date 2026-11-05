import { createRoot } from 'react-dom/client';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { FONT_ASSETS } from '@/theme/fonts';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { App } from './App';
import { boot, freshDb } from './engine';

// The app loads these with expo-font's useFonts (which registers each file under its key as the font family); the
// sandbox registers the ones the player and this page use, under the same family names.
const USED = ['BarlowCondensed_800ExtraBold', 'IBMPlexMono_400Regular', 'IBMPlexMono_500Medium', 'IBMPlexMono_700Bold', 'PlusJakartaSans_400Regular', 'PlusJakartaSans_600SemiBold', 'PlusJakartaSans_800ExtraBold'] as const;

async function start() {
  const assets = FONT_ASSETS as unknown as Record<string, string>;
  await Promise.all(
    USED.map(async (name) => {
      try {
        const face = new FontFace(name, `url(${assets[name]})`);
        document.fonts.add(await face.load());
      } catch (e) {
        console.warn('font', name, e);
      }
    }),
  );
  await boot();
  freshDb(); // so the first render has a database; App then restores the saved one or rebuilds the history
  createRoot(document.getElementById('root')!).render(
    // Fixed phone-like insets (a Pixel 9a's status bar and gesture bar, in dp). The web provider measured the page
    // instead and reported a bottom inset of ~424 px, which pushed the player's Skip button to mid-screen.
    <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width: 412, height: 915 }}>
      <SafeAreaInsetsContext.Provider value={{ top: 24, bottom: 24, left: 0, right: 0 }}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>,
  );
}

start().catch((e) => {
  document.getElementById('root')!.textContent = `The sandbox could not start: ${(e as Error).message}`;
  console.error(e);
});

// Show the underlying SQLite error behind a Drizzle "Failed query" in the console.
window.addEventListener('error', (ev) => {
  const cause = (ev.error as { cause?: Error } | undefined)?.cause;
  if (cause) console.error('cause:', cause.message);
});
