import { useMemo } from 'react';
import { getDay, loadDayBundle } from '../../data/repos/days';
import { glows } from '../../domain/calendar';
import { collectionItems } from '../../domain/collection';
import type { CollectionItem } from '../../domain/collection';
import { addDays, compareDayKeys } from '../../domain/dayKey';
import { isDraftable, plannableDays } from '../../domain/plan';
import { focusedMs, overtimeMs } from '../../domain/timer';
import type { DayKey } from '../../domain/types';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { useDataVersion } from '../store';
import { todayKey as resolveTodayKey } from '../today';

export interface DayCard {
  dayKey: DayKey;
  kind: 'past' | 'today' | 'tomorrow' | 'later';
  glows: boolean;
  planned: boolean;
  closed: boolean;
  done: number;
  total: number;
  focusedMs: number;
  extraMs: number;
  items: CollectionItem[];
  canPlan: boolean;
  /** A saved draft (ADR-010) that is not yet a confirmed plan. Never means "planned". */
  drafted: boolean;
  draftCount: number;
  /** A later day (after tomorrow) that can hold a draft. */
  canDraft: boolean;
}

/** The card under the Calendar for one day. A day with no row reads as empty. */
export function useDayCard(dayKey: DayKey): DayCard {
  const version = useDataVersion(['days', 'sessions', 'settings']);
  const db = getDb();
  return useMemo(() => {
    const at = now();
    const todayKey = resolveTodayKey(db, at);
    const cmp = compareDayKeys(dayKey, todayKey);
    const kind: DayCard['kind'] =
      cmp < 0 ? 'past' : cmp === 0 ? 'today' : dayKey === addDays(todayKey, 1) ? 'tomorrow' : 'later';
    const canPlan = plannableDays(todayKey, getDay(db, todayKey)).includes(dayKey);
    const canDraft = isDraftable(todayKey, dayKey);
    const bundle = loadDayBundle(db, dayKey);
    if (!bundle) {
      return {
        dayKey, kind, glows: false, planned: false, closed: false, done: 0, total: 0, focusedMs: 0, extraMs: 0, items: [],
        canPlan, drafted: false, draftCount: 0, canDraft,
      };
    }
    let focused = 0;
    let extra = 0;
    for (const t of bundle.dayTasks) {
      const sessions = bundle.sessionsByDayTask[t.id] ?? [];
      focused += focusedMs(sessions, at);
      if (t.kind === 'timed') extra += overtimeMs(t.budgetSec, sessions, at);
    }
    const drafted = bundle.day.planDraftedAt !== null && bundle.day.planConfirmedAt === null && kind !== 'past' && kind !== 'today';
    return {
      dayKey,
      kind,
      glows: glows(bundle, todayKey),
      planned: bundle.day.planConfirmedAt !== null,
      closed: bundle.day.closedAt !== null,
      done: bundle.dayTasks.filter((t) => t.completedAt !== null).length,
      total: bundle.dayTasks.length,
      focusedMs: focused,
      extraMs: extra,
      items: collectionItems(bundle, at),
      canPlan,
      drafted,
      draftCount: drafted ? bundle.dayTasks.length : 0,
      canDraft,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key
  }, [db, version, dayKey]);
}
