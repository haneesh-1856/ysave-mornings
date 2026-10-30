import { Redirect } from 'expo-router';

// The app opens on Today. Onboarding and the Morning screen will redirect from here in later milestones.
export default function Index() {
  return <Redirect href="/today" />;
}
