import { Card } from '@/ui/Card';
import { Header } from '@/ui/Header';
import { Screen } from '@/ui/Screen';
import { T } from '@/ui/T';

export default function CalendarScreen() {
  return (
    <Screen tabs>
      <Header title="Calendar" />
      <Card>
        <T>Your days will glow here</T>
        <T variant="sub">A day glows when everything you planned got done. (Milestone M6)</T>
      </Card>
    </Screen>
  );
}
