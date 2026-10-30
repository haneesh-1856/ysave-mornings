import type { collectionLooks } from '@/theme/tokens';

import { unitNoun } from './collectionNoun';
import { formatMinutes } from './formatMinutes';

type Art = keyof typeof collectionLooks;

/** The fields of `useDayCard()` the line needs (structural, so the hook's result is assignable). */
export type DayCardLineInput = {
  kind: 'past' | 'today' | 'tomorrow' | 'later';
  glows: boolean;
  planned: boolean;
  done: number;
  total: number;
  focusedMs: number;
  /** A saved draft that is not a confirmed plan (ADR-010). */
  drafted?: boolean;
  draftCount?: number;
};

const tasks = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

/**
 * The one line under a day's title on the Calendar. Calm wording only: never "failed" or "missed".
 * `weekdayName` is accepted for callers that already have it (e.g. "Friday") and is not used in the current copy.
 */
export function dayCardLine(card: DayCardLineInput, weekdayName?: string, art: Art = 'glass'): string {
  void weekdayName;
  switch (card.kind) {
    case 'tomorrow':
      if (card.drafted && !card.planned) return `Draft ready: ${tasks(card.draftCount ?? 0)}. Finalize it tonight.`;
      return card.planned ? `Planned: ${tasks(card.total)}. One ${unitNoun(art, 1)} waiting.` : `Plan it tonight. One ${unitNoun(art, 1)} waiting.`;
    case 'later':
      return card.drafted ? `Draft: ${tasks(card.draftCount ?? 0)}. Finalize it the evening before.` : 'Not planned yet.';
    case 'past':
    case 'today': {
      const focusedMin = Math.floor(card.focusedMs / 60_000);
      if (card.total === 0 && focusedMin === 0) return card.kind === 'past' ? 'A rest day. Nothing missing.' : 'Nothing planned yet.';
      // A past day with plans but nothing done reads as "planned", never as "0 of n" (guilt-free).
      if (card.kind === 'past' && card.done === 0 && card.total > 0 && !card.glows) {
        return focusedMin > 0 ? `${tasks(card.total)} planned · ${formatMinutes(focusedMin)} focused` : `${tasks(card.total)} planned.`;
      }
      const count = card.glows || card.done >= card.total ? tasks(card.total) : `${card.done} of ${tasks(card.total)}`;
      const stats = focusedMin > 0 ? `${count} · ${formatMinutes(focusedMin)} focused` : count;
      return card.glows ? `Everything you planned, done. ${stats}` : stats;
    }
  }
}
