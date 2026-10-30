import { formatMinutes } from './formatMinutes';
import { T } from './T';

type Props = { done: number; total: number; focusedMs: number; extraMs: number };

const minutes = (ms: number) => Math.floor(Math.max(0, ms) / 60_000);

/** "3 of 4 done · 2h 10m focused · +12m extra" (the extra part is omitted when there is none). */
export function closeSummaryText({ done, total, focusedMs, extraMs }: Props): string {
  const parts = [`${done} of ${total} done`, `${formatMinutes(minutes(focusedMs))} focused`];
  const extra = minutes(extraMs);
  if (extra > 0) parts.push(`+${formatMinutes(extra)} extra`);
  return parts.join(' · ');
}

export function CloseSummary(props: Props) {
  const text = closeSummaryText(props);
  const extra = minutes(props.extraMs);
  const spoken = `${props.done} of ${props.total} done, ${formatMinutes(minutes(props.focusedMs))} focused${extra > 0 ? `, ${formatMinutes(extra)} extra` : ''}`;
  return (
    <T variant="sub" accessible accessibilityLabel={spoken}>{text}</T>
  );
}
