import { Redirect } from 'expo-router';
import { useState } from 'react';

import { needsOnboarding } from '@/state/hooks/useOnboarding';
import { useMorning } from '@/state/hooks/useMorning';

/** Where the app opens: the welcome flow on a fresh install, Morning when a new day has begun (with history), else Today. */
export function launchHref(onboarding: boolean, morningDue: boolean): '/onboarding' | '/morning' | '/today' {
  if (onboarding) return '/onboarding';
  return morningDue ? '/morning' : '/today';
}

export default function Index() {
  const [onboarding] = useState(needsOnboarding); // read once at launch; the flow's own writes must not re-route
  const { due } = useMorning();
  return <Redirect href={launchHref(onboarding, due)} />;
}
