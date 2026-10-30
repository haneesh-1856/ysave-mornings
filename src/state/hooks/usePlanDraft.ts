import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDay, loadDayBundle } from '../../data/repos/days';
import { getTask, listTasks } from '../../data/repos/tasks';
import { getTopic, listTopics } from '../../data/repos/topics';
import {
  addOneOff as addOneOffTo,
  buildPlan,
  canConfirm as canConfirmDraft,
  isDraftable,
  plannableDays,
  setCue as setCueOn,
  setTicked,
  setTreat as setTreatOn,
  stepMinutes,
} from '../../domain/plan';
import type { PlanDraft } from '../../domain/plan';
import type { DayKey, Task, TaskKind } from '../../domain/types';
import { confirmDayPlan, discardDayDraft, saveDayDraft } from '../actions/plan';
import { now } from '../clock';
import { getDb } from '../dbRef';
import { ValidationError } from '../errors';
import { useDataVersion } from '../store';
import { todayKey as resolveTodayKey } from '../today';

export interface PlanDraftApi {
  draft: PlanDraft | null;
  /** 'draft' for a later day (ADR-010: Save draft / Discard), 'plan' for today or tomorrow (Confirm). */
  mode: 'draft' | 'plan';
  /** A draft is already saved for this day (draft mode: show "Discard draft"). */
  hasDraft: boolean;
  plannable: boolean;
  dirty: boolean;
  totals: { count: number; minutes: number };
  toggle(key: string): void;
  step(key: string, delta: 5 | -5): void;
  setCue(key: string, v: string | null): void;
  setTreat(key: string, v: string | null): void;
  addOneOff(row: { topicId: string; name: string; kind: TaskKind; minutes: number }): void;
  canConfirm: boolean;
  /**
   * confirmDayPlan(dayKey, draft), then freeze: later 'days' bumps no longer change draft, plannable, dirty,
   * totals or canConfirm for this mount. Throws (and does not freeze) if the confirm fails.
   */
  confirm(): void;
  /** Draft mode: saveDayDraft(dayKey, draft). The edits stay on screen; nothing is frozen. Throws on failure. */
  saveDraft(): void;
  /** Draft mode: discardDayDraft(dayKey), then the screen shows the library defaults again. */
  discardDraft(): void;
}

type Snapshot = { dayKey: DayKey; draft: PlanDraft; dirty: boolean };

/**
 * In-memory plan draft for `dayKey`; nothing is written until confirmDayPlan. The base plan is built
 * once per dayKey and rebuilt only when the days table changes underneath; edits (dirty) always win.
 */
export function usePlanDraft(dayKey: DayKey): PlanDraftApi {
  const daysVersion = useDataVersion(['days', 'settings']);
  const db = getDb();
  const todayKey = resolveTodayKey(db, now());

  const { plannable, base, mode, hasDraft } = useMemo(() => {
    const mode: 'draft' | 'plan' = isDraftable(todayKey, dayKey) ? 'draft' : 'plan';
    const ok = mode === 'draft' || plannableDays(todayKey, getDay(db, todayKey)).includes(dayKey);
    if (!ok) return { plannable: false, base: null, mode, hasDraft: false };
    const bundle = loadDayBundle(db, dayKey);
    const dayTasks = bundle?.dayTasks ?? [];
    const tasks: Task[] = listTasks(db);
    const known = new Set(tasks.map(t => t.id));
    for (const d of dayTasks) {
      // a deleted task still referenced by this day's rows must be in the input (doc 04 section 11)
      if (d.taskId != null && !known.has(d.taskId)) {
        const t = getTask(db, d.taskId);
        if (t) {
          tasks.push(t);
          known.add(t.id);
        }
      }
    }
    const built = buildPlan({ dayKey, topics: listTopics(db), tasks, day: bundle?.day ?? null, dayTasks });
    const day = bundle?.day;
    return { plannable: true, base: built, mode, hasDraft: day != null && day.planDraftedAt !== null && day.planConfirmedAt === null };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dayKey, todayKey and the days version are the rebuild keys
  }, [db, dayKey, todayKey, daysVersion]);

  const [edited, setEdited] = useState<{ dayKey: DayKey; draft: PlanDraft } | null>(null);
  const mine = edited != null && edited.dayKey === dayKey ? edited.draft : null;
  // frozen after this hook's own confirm: the confirm's 'days' bump must not rebuild what the screen shows
  const [frozenState, setFrozen] = useState<Snapshot | null>(null);
  const frozen = frozenState != null && frozenState.dayKey === dayKey ? frozenState : null;
  const live = plannable ? (mine ?? base) : null;
  const draft = frozen ? frozen.draft : live;
  const isPlannable = frozen ? true : plannable;
  const dirty = frozen ? frozen.dirty : plannable && mine != null;

  // refs so confirm() keeps one identity; synced after commit, before any user event can call it
  const current = useRef<Snapshot | null>(null);
  const frozenRef = useRef<Snapshot | null>(null);
  useEffect(() => {
    current.current = draft ? { dayKey, draft, dirty } : null;
    frozenRef.current = frozen;
  });

  const confirm = useCallback(() => {
    const snap = current.current;
    if (frozenRef.current != null && frozenRef.current.dayKey === snap?.dayKey) return; // already confirmed here
    if (!snap) throw new ValidationError('dayKey', 'nothing to confirm');
    confirmDayPlan(snap.dayKey, snap.draft); // throws -> not frozen; the caller's guard resets
    frozenRef.current = snap;
    setFrozen(snap); // batched with the bump('days') above, so no render shows the rebuilt base
  }, []);

  const saveDraft = useCallback(() => {
    const snap = current.current;
    if (!snap) throw new ValidationError('dayKey', 'nothing to save');
    saveDayDraft(snap.dayKey, snap.draft);
  }, []);

  const discardDraft = useCallback(() => {
    discardDayDraft(dayKey);
    setEdited(null); // the screen goes back to the rebuilt base
  }, [dayKey]);

  const edit = useCallback(
    (fn: (d: PlanDraft) => PlanDraft) => {
      if (!base || frozenRef.current != null) return;
      setEdited(prev => {
        const cur = prev != null && prev.dayKey === dayKey ? prev.draft : base;
        return { dayKey, draft: fn(cur) };
      });
    },
    [base, dayKey],
  );

  const totals = useMemo(() => {
    let count = 0;
    let minutes = 0;
    if (draft) {
      for (const r of [...draft.groups.flatMap(g => g.rows), ...draft.notOn]) {
        if (!r.ticked) continue;
        count += 1;
        if (r.kind === 'timed') minutes += r.minutes;
      }
    }
    return { count, minutes };
  }, [draft]);

  const toggle = useCallback(
    (key: string) => {
      edit(d => {
        const row = [...d.groups.flatMap(g => g.rows), ...d.notOn].find(r => r.key === key);
        return row ? setTicked(d, key, !row.ticked) : d;
      });
    },
    [edit],
  );
  const step = useCallback((key: string, delta: 5 | -5) => edit(d => stepMinutes(d, key, delta)), [edit]);
  const setCue = useCallback((key: string, v: string | null) => edit(d => setCueOn(d, key, v)), [edit]);
  const setTreat = useCallback((key: string, v: string | null) => edit(d => setTreatOn(d, key, v)), [edit]);
  const addOneOff = useCallback(
    (row: { topicId: string; name: string; kind: TaskKind; minutes: number }) => {
      const topic = getTopic(db, row.topicId);
      if (!topic) return;
      edit(d => addOneOffTo(d, { ...row, colorKey: topic.colorKey }));
    },
    [db, edit],
  );

  return {
    draft,
    mode,
    hasDraft,
    plannable: isPlannable,
    dirty,
    totals,
    toggle,
    step,
    setCue,
    setTreat,
    addOneOff,
    canConfirm: draft != null && canConfirmDraft(draft),
    confirm,
    saveDraft,
    discardDraft,
  };
}
