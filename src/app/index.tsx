import { Redirect } from 'expo-router';
import { useMorning } from '@/state/hooks/useMorning';

// The app opens on Morning when a new day has begun (and there is history), otherwise on Today.
export default function Index() {
  const { due } = useMorning();
  return <Redirect href={due ? '/morning' : '/today'} />;
}
