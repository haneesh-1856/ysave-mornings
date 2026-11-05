import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ValidationError } from '@/data/errors';
import { listDays, loadDayBundle } from '@/data/repos/days';
import { getDayStartHour, getMomentMarkers, getMomentsEnabled, getMonthlyGoalHours } from '@/data/repos/settings';
import { listTopics } from '@/data/repos/topics';
import { collectionItems } from '@/domain/collection';
import { addDays, dayStartOf, weekdayIndex } from '@/domain/dayKey';
import type { Moment } from '@/domain/moments';
import { addOneOff, setTicked, stepMinutes, type PlanDraft } from '@/domain/plan';
import { focusedMs, overtimeMs } from '@/domain/timer';
import type { CloseOutcome, DayKey } from '@/domain/types';
import { closeToday } from '@/state/actions/close';
import { confirmDayPlan, saveDayDraft } from '@/state/actions/plan';
import { pauseTask, startTask, stopTask, toggleCheckTask } from '@/state/actions/run';
import { setDayStart, setMomentsEnabled, setMonthlyGoal } from '@/state/actions/settings';
import { getDb } from '@/state/dbRef';
import { useCloseSummary } from '@/state/hooks/useCloseSummary';
import { useDataVersion } from '@/state/store';
import { todayKey as resolveTodayKey } from '@/state/today';
import { MomentsPlayer } from '@/ui/moments/MomentsPlayer';

import { clock, fromBase64, rawQuery, restore, snapshot, toBase64, type Snapshot } from './engine';
import { focusFor, moveClock, runScenario, scriptedDraft, type CloseRecord, type DayScript, type LogLine, type Scenario } from './history';
import { DEFAULT_SCENARIO } from './scenario';
import { setPhoneSize } from './rn-shim';

const MIN = 60_000;
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KEY = 'ysave-sandbox-v1';

const hm = (ms: number) => `${Math.floor(ms / 3_600_000)}:${String(Math.floor((ms % 3_600_000) / MIN)).padStart(2, '0')}`;
const stamp = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dayLabel = (k: DayKey) => `${WD[weekdayIndex(k)]} ${Number(k.slice(8))} ${new Date(k + 'T12:00').toLocaleString('en-GB', { month: 'short' })}`;

type Saved = { scenario: Scenario; db?: string; now?: number; closes?: CloseRecord[] };
function load(): Saved | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Saved) : null;
  } catch {
    return null;
  }
}
function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the sandbox still works for this visit */
  }
}

type Playing = { moments: Moment[]; bars: { name: string; focusedMs: number }[]; label: string };

export function App() {
  const saved = useMemo(load, []);
  const [scenario, setScenario] = useState<Scenario>(saved?.scenario ?? DEFAULT_SCENARIO);
  const [log, setLog] = useState<LogLine[]>([]);
  const [closes, setCloses] = useState<CloseRecord[]>(saved?.closes ?? []);
  const [beforeClose, setBeforeClose] = useState<Snapshot | null>(null);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [tab, setTab] = useState<'live' | 'history' | 'library' | 'inspect' | 'log'>('live');
  const [phone, setPhone] = useState(true);
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const [rev, setRev] = useState(0);
  const version = useDataVersion(['topics', 'tasks', 'days', 'sessions', 'settings']);
  const refresh = useCallback(() => setRev((r) => r + 1), []);

  const push = useCallback((l: LogLine) => setLog((xs) => [...xs.slice(-400), l]), []);
  const say = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3500);
  }, []);

  /** Runs one app action; a ValidationError is the app's own refusal and is shown as such. */
  const act = useCallback(
    (label: string, fn: () => void) => {
      try {
        fn();
        push({ at: clock.get(), kind: 'action', text: label });
      } catch (e) {
        const msg = e instanceof ValidationError ? `App refused: ${e.message}` : `Error: ${(e as Error).message}`;
        push({ at: clock.get(), kind: 'error', text: `${label} → ${msg}` });
        say(msg, true);
        if (!(e instanceof ValidationError)) console.error(e);
      }
      refresh();
    },
    [push, refresh, say],
  );

  const rebuild = useCallback(
    (sc: Scenario) => {
      const recs: CloseRecord[] = [];
      setLog([]);
      try {
        runScenario(sc, push, (r) => recs.push(r));
        say('History rebuilt through the app’s own actions');
      } catch (e) {
        push({ at: clock.get(), kind: 'error', text: `Rebuild stopped: ${(e as Error).message}` });
        say(`Rebuild stopped: ${(e as Error).message}`, true);
        console.error(e);
      }
      setCloses(recs);
      setBeforeClose(null);
      refresh();
    },
    [push, refresh, say],
  );

  // First load: the saved live database if there is one, else build the scenario.
  useEffect(() => {
    if (saved?.db) {
      try {
        restore({ bytes: fromBase64(saved.db), now: saved.now ?? Date.now() });
        refresh();
        return;
      } catch {
        /* fall through to a rebuild */
      }
    }
    rebuild(scenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep this viewer's work across reloads (browser storage only).
  useEffect(() => {
    try {
      const s = snapshot();
      save({ scenario, db: toBase64(s.bytes), now: s.now, closes });
    } catch {
      /* not ready */
    }
  }, [scenario, closes, rev, version]);

  useEffect(() => setPhoneSize(phone ? { width: 412, height: 915 } : null), [phone]);

  const db = getDb();
  const now = clock.get();
  const h = getDayStartHour(db);
  const today = resolveTodayKey(db, now);

  const move = (ms: number, label: string) => act(label, () => moveClock(ms, push));

  return (
    <div className="shell" data-rev={rev + version}>
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <h1>YSave Sandbox</h1>
            <p className="sub">Your real app code on a test database. Time only moves when you move it.</p>
          </div>
        </div>
        <div className="clock" aria-live="polite">
          <div className="now">{stamp(now)}</div>
          <div className="dim">
            app day <b>{today}</b> · day starts {String(h).padStart(2, '0')}:00
          </div>
          <div className="row wrap">
            <button onClick={() => move(5 * MIN, '+5 min')}>+5m</button>
            <button onClick={() => move(15 * MIN, '+15 min')}>+15m</button>
            <button onClick={() => move(60 * MIN, '+1 h')}>+1h</button>
            <button onClick={() => move(Math.max(0, dayStartOf(addDays(today, 1), h) + 30 * MIN - now), 'Next morning (app opens)')}>
              Next morning
            </button>
            <input
              id="jump"
              type="datetime-local"
              aria-label="Jump to date and time"
              onChange={(e) => {
                const t = new Date(e.target.value).getTime();
                if (Number.isFinite(t) && t > now) move(t - now, `Jump to ${stamp(t)}`);
                else if (Number.isFinite(t)) say('The clock only moves forward. Use Rewind or rebuild the history.', true);
              }}
            />
          </div>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {(
          [
            ['live', 'Live day'],
            ['history', 'History script'],
            ['library', 'Library & settings'],
            ['inspect', 'Inspector'],
            ['log', `Log (${log.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
        <label className="phone">
          <input id="phone" type="checkbox" checked={phone} onChange={(e) => setPhone(e.target.checked)} /> Pixel 9a size (412×915)
        </label>
      </nav>

      <main>
        {tab === 'live' && (
          <Live
            today={today}
            act={act}
            push={push}
            say={say}
            beforeClose={beforeClose}
            onClosed={(snap, rec) => {
              setBeforeClose(snap);
              setCloses((c) => [...c, rec]);
              if (rec.moments.length) setPlaying({ moments: rec.moments, bars: rec.bars, label: `Close of ${rec.day}` });
            }}
            onReopen={() => {
              if (!beforeClose) return;
              restore(beforeClose);
              setCloses((c) => c.slice(0, -1));
              setBeforeClose(null);
              push({ at: clock.get(), kind: 'action', text: 'Rewound to just before the close (sandbox only; the app has no reopen)' });
              refresh();
            }}
            lastClose={closes[closes.length - 1] ?? null}
            play={(p) => setPlaying(p)}
          />
        )}
        {tab === 'history' && (
          <History scenario={scenario} setScenario={setScenario} rebuild={rebuild} closes={closes} play={(p) => setPlaying(p)} />
        )}
        {tab === 'library' && <Library scenario={scenario} setScenario={setScenario} act={act} rebuild={rebuild} />}
        {tab === 'inspect' && <Inspector today={today} />}
        {tab === 'log' && <Log log={log} />}
      </main>

      {toast ? <div className={toast.bad ? 'toast bad' : 'toast'} role="status">{toast.text}</div> : null}

      {playing ? <Playback key={playing.label + playing.moments.length} /> : null}
      {playing ? (
        <MomentsPlayer
          moments={playing.moments}
          bars={playing.bars}
          onDone={() => {
            push({ at: clock.get(), kind: 'moments', text: `Player finished: ${playing.label}` });
            setPlaying(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------------- Live day ---------------- */

function Live({
  today, act, push, say, beforeClose, onClosed, onReopen, lastClose, play,
}: {
  today: DayKey;
  act: (label: string, fn: () => void) => void;
  push: (l: LogLine) => void;
  say: (t: string, bad?: boolean) => void;
  beforeClose: Snapshot | null;
  onClosed: (snap: Snapshot, rec: CloseRecord) => void;
  onReopen: () => void;
  lastClose: CloseRecord | null;
  play: (p: Playing) => void;
}) {
  const db = getDb();
  const now = clock.get();
  const bundle = loadDayBundle(db, today);
  const summary = useCloseSummary();
  const [outcomes, setOutcomes] = useState<Record<string, CloseOutcome>>({});
  const [preview, setPreview] = useState<Moment[] | null>(null);
  const [planDay, setPlanDay] = useState<DayKey>(today);
  useEffect(() => setPlanDay(today), [today]);
  // A new action changes what a close would do; a preview's own rewind restores identical data and keeps it.
  useEffect(() => setPreview(null), [today, summary.focusedMs, summary.done, summary.closed, outcomes]);

  const closed = bundle?.day.closedAt != null;
  const rows = [...(bundle?.dayTasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const doClose = () => {
    const snap = snapshot();
    let moments: Moment[] = [];
    const bars = summary.timedFocus;
    try {
      moments = closeToday(outcomes);
    } catch (e) {
      say(e instanceof ValidationError ? `App refused: ${e.message}` : (e as Error).message, true);
      push({ at: clock.get(), kind: 'error', text: `Close → ${(e as Error).message}` });
      return;
    }
    push({ at: clock.get(), kind: 'moments', text: `Closed ${today} by hand: ${moments.length ? moments.map((m) => m.kind).join(', ') : 'no moments'}` });
    onClosed(snap, { day: today, at: clock.get(), moments, bars });
  };

  const doPreview = () => {
    const snap = snapshot();
    try {
      setPreview(closeToday(outcomes));
    } catch (e) {
      say(e instanceof ValidationError ? `App refused: ${e.message}` : (e as Error).message, true);
    } finally {
      restore(snap);
    }
  };

  return (
    <div className="grid2">
      <section className="panel">
        <h2>
          Today · {dayLabel(today)} <Pill tone={closed ? 'done' : bundle?.day.planConfirmedAt ? 'ok' : 'warn'}>{closed ? `closed ${bundle?.day.closedBy === 'auto' ? 'automatically' : 'by hand'}` : bundle?.day.planConfirmedAt ? 'planned' : 'not planned'}</Pill>
        </h2>
        {rows.length === 0 ? <p className="dim">No tasks on today yet. Plan it on the right.</p> : null}
        <ul className="tasks">
          {rows.map((t) => {
            const sessions = bundle?.sessionsByDayTask[t.id] ?? [];
            const ms = focusedMs(sessions, now);
            const running = sessions.some((s) => s.endedAt === null);
            const extra = t.kind === 'timed' ? overtimeMs(t.budgetSec, sessions, now) : 0;
            const pct = t.kind === 'timed' ? Math.min(1, ms / (t.budgetSec * 1000)) : t.completedAt ? 1 : 0;
            return (
              <li key={t.id} className={running ? 'task running' : 'task'}>
                <div className="tline">
                  <span className={`dot c-${t.colorKey}`} aria-hidden="true" />
                  <b>{t.name}</b>
                  <span className="dim">{t.kind === 'timed' ? `${hm(ms)} / ${hm(t.budgetSec * 1000)}` : 'checklist'}</span>
                  {t.completedAt ? <Pill tone="done">done</Pill> : null}
                  {extra >= 60_000 ? <Pill tone="gold">gold +{hm(extra)}</Pill> : null}
                  {running ? <Pill tone="ok">running</Pill> : null}
                  {t.forwardedFromDayKey ? <Pill tone="warn">from {t.forwardedFromDayKey}</Pill> : null}
                </div>
                <div className="bar"><i style={{ width: `${pct * 100}%` }} /></div>
                {!closed ? (
                  <div className="row wrap">
                    {t.kind === 'timed' ? (
                      <>
                        {running ? (
                          <button onClick={() => act(`Pause ${t.name}`, () => (t.completedAt ? stopTask(t.id) : pauseTask(t.id)))}>{t.completedAt ? 'Stop' : 'Pause'}</button>
                        ) : (
                          <button onClick={() => act(`Start ${t.name}`, () => startTask(t.id))}>Start</button>
                        )}
                        <button onClick={() => act(`Focus ${t.name} 15 min`, () => focusFor(t, 15, push))}>Focus 15m</button>
                        <button onClick={() => act(`Focus ${t.name} to its time`, () => focusFor(t, Math.max(1, Math.ceil((t.budgetSec * 1000 - ms) / MIN)), push))}>Focus to done</button>
                        <button onClick={() => act(`Focus ${t.name} to gold`, () => focusFor(t, Math.max(2, Math.ceil((t.budgetSec * 1000 - ms) / MIN) + 2), push))}>…+2m gold</button>
                      </>
                    ) : (
                      <button onClick={() => act(`Tick ${t.name}`, () => toggleCheckTask(t.id))}>{t.completedAt ? 'Untick' : 'Tick'}</button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <h3>Close the day</h3>
        {closed ? (
          <div className="stack">
            <p>
              Closed. {lastClose && lastClose.day === today ? (lastClose.moments.length ? `Moments played: ${lastClose.moments.map((m) => m.kind).join(' → ')}.` : 'No moments were due.') : ''}
            </p>
            <div className="row wrap">
              {lastClose && lastClose.day === today && lastClose.moments.length ? (
                <button className="primary" onClick={() => play({ moments: lastClose.moments, bars: lastClose.bars, label: `Replay ${today}` })}>Replay these moments</button>
              ) : null}
              <button disabled={!beforeClose} onClick={onReopen}>Reopen (rewind to before the close)</button>
            </div>
            {!beforeClose ? <p className="dim small">Rewind is available right after a close made on this tab.</p> : null}
          </div>
        ) : (
          <div className="stack">
            {summary.unfinished.length ? (
              <ul className="plain">
                {summary.unfinished.map((u) => (
                  <li key={u.dayTaskId} className="row wrap">
                    <span>{u.name}{u.leftoverMin !== undefined ? <span className="dim"> · {u.leftoverMin} min left</span> : null}</span>
                    <select
                      id={`oc-${u.dayTaskId}`}
                      aria-label={`What happens to ${u.name}`}
                      value={outcomes[u.dayTaskId] ?? ''}
                      onChange={(e) => setOutcomes((o) => ({ ...o, [u.dayTaskId]: e.target.value as CloseOutcome }))}>
                      <option value="">choose…</option>
                      <option value="moved">Move to {dayLabel(summary.tomorrowKey)}</option>
                      <option value="let_go">Let it go</option>
                    </select>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dim">Every task is done.</p>
            )}
            <div className="row wrap">
              <button onClick={doPreview}>What would play?</button>
              <button className="primary" onClick={doClose}>Close today by hand</button>
            </div>
            {preview ? (
              <p className="note">
                {preview.length ? <>A close now would play: <b>{preview.map((m) => m.kind).join(' → ')}</b> (nothing was saved).</> : 'A close now would play no moments (nothing was saved).'}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Plan</h2>
        <div className="row wrap">
          {[today, addDays(today, 1), addDays(today, 2)].map((k, i) => (
            <button key={k} className={planDay === k ? 'chip on' : 'chip'} onClick={() => setPlanDay(k)}>
              {['Today', 'Tomorrow', 'Day after (draft)'][i]} · {dayLabel(k)}
            </button>
          ))}
        </div>
        <PlanEditor key={planDay} dayKey={planDay} draftOnly={planDay > addDays(today, 1)} act={act} />
        <Markers />
      </section>
    </div>
  );
}

function PlanEditor({ dayKey, draftOnly, act }: { dayKey: DayKey; draftOnly: boolean; act: (l: string, fn: () => void) => void }) {
  const version = useDataVersion(['days', 'tasks', 'topics']);
  const base = useMemo(() => scriptedDraft(dayKey, null), [dayKey, version]);
  const [d, setD] = useState<PlanDraft>(base);
  useEffect(() => setD(base), [base]);
  const [oneName, setOneName] = useState('');
  const [oneKind, setOneKind] = useState<'timed' | 'check'>('timed');
  const topics = listTopics(getDb());
  const day = loadDayBundle(getDb(), dayKey)?.day;
  const rows = [...d.groups.flatMap((g) => g.rows), ...d.notOn];
  return (
    <div className="stack">
      <p className="dim small">
        {day?.planConfirmedAt ? 'Plan confirmed; you can still edit it.' : day?.planDraftedAt ? 'Draft saved, not yet planned.' : 'Not planned yet.'} Rows come from the app’s own plan builder.
      </p>
      <ul className="plain">
        {rows.map((r) => (
          <li key={r.key} className="row wrap prow">
            <label className="row">
              <input id={`t-${dayKey}-${r.key}`} type="checkbox" checked={r.ticked} onChange={(e) => setD((x) => setTicked(x, r.key, e.target.checked))} />
              <span className={`dot c-${r.colorKey}`} aria-hidden="true" /> {r.name}
            </label>
            <span className="dim small">{r.reason.replace('_', ' ')}</span>
            {r.kind === 'timed' ? (
              <span className="row">
                <button className="mini" aria-label="5 minutes less" onClick={() => setD((x) => stepMinutes(x, r.key, -5))}>−</button>
                <span className="num">{r.minutes}m</span>
                <button className="mini" aria-label="5 minutes more" onClick={() => setD((x) => stepMinutes(x, r.key, 5))}>+</button>
              </span>
            ) : (
              <span className="dim small">checklist</span>
            )}
          </li>
        ))}
      </ul>
      <div className="row wrap">
        <input id={`one-${dayKey}`} placeholder="One-off task" value={oneName} onChange={(e) => setOneName(e.target.value)} />
        <select id={`onek-${dayKey}`} aria-label="Kind" value={oneKind} onChange={(e) => setOneKind(e.target.value as 'timed' | 'check')}>
          <option value="timed">timed 30m</option>
          <option value="check">checklist</option>
        </select>
        <button
          onClick={() => {
            const t = topics[0];
            setD((x) => addOneOff(x, { topicId: t.id, name: oneName, colorKey: t.colorKey, kind: oneKind, minutes: 30 }));
            setOneName('');
          }}>
          Add
        </button>
      </div>
      <button className="primary" onClick={() => act(`${draftOnly ? 'Save draft' : 'Confirm plan'} for ${dayKey}`, () => (draftOnly ? saveDayDraft(dayKey, d) : confirmDayPlan(dayKey, d)))}>
        {draftOnly ? 'Save draft' : `Confirm ${dayLabel(dayKey)}`}
      </button>
    </div>
  );
}

function Markers() {
  useDataVersion(['settings']);
  const db = getDb();
  const m = getMomentMarkers(db);
  return (
    <div className="stack">
      <h3>What the app remembers about moments</h3>
      <dl className="kv">
        <dt>Best day so far</dt><dd>{m.bestMs ? hm(m.bestMs) : '—'}</dd>
        <dt>Streak celebrated</dt><dd>{m.streakCelebrated ? `${m.streakCelebrated} days (run ending ${m.streakEndDayKey})` : '—'}</dd>
        <dt>Week celebrated</dt><dd>{m.weekCelebrated ?? '—'}</dd>
        <dt>Month celebrated</dt><dd>{m.monthCelebrated ?? '—'}</dd>
        <dt>Monthly goal</dt><dd>{getMonthlyGoalHours(db) ?? 'not set (month plays on its last day)'}</dd>
        <dt>Moments</dt><dd>{getMomentsEnabled(db) ? 'on' : 'off'}</dd>
      </dl>
      <p className="dim small">These are saved at the close, before the player starts. A close replays nothing it has already celebrated.</p>
    </div>
  );
}

/* ---------------- History script ---------------- */

function History({
  scenario, setScenario, rebuild, closes, play,
}: { scenario: Scenario; setScenario: (s: Scenario) => void; rebuild: (s: Scenario) => void; closes: CloseRecord[]; play: (p: Playing) => void }) {
  const names = scenario.tasks.map((t) => t.name);
  const setDay = (i: number, patch: Partial<DayScript>) =>
    setScenario({ ...scenario, days: scenario.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const setWork = (i: number, name: string, v: number | 'done' | 'open' | null) => {
    const w = { ...scenario.days[i].work };
    if (v === null) delete w[name];
    else w[name] = v;
    setDay(i, { work: w });
  };
  const lastDay = scenario.days[scenario.days.length - 1]?.day ?? addDays(scenario.liveDay, -1);
  const byDay = new Map(closes.map((c) => [c.day, c]));
  return (
    <section className="panel">
      <h2>History script</h2>
      <p className="dim">
        Each row is a day the sandbox lives through with the app’s real actions: plan in the morning, focus from 09:00, close at 21:00 by hand or leave it for the next morning’s auto-close. Minutes are focus time; empty means not in that day’s plan.
      </p>
      <div className="row wrap">
        <label className="row">Live day
          <input id="liveday" type="date" value={scenario.liveDay} onChange={(e) => setScenario({ ...scenario, liveDay: e.target.value })} />
        </label>
        <button onClick={() => setScenario({ ...scenario, days: [{ day: addDays(scenario.days[0]?.day ?? scenario.liveDay, -1), work: {}, end: 'hand', leftover: 'let_go' }, ...scenario.days] })}>Add earlier day</button>
        <button onClick={() => setScenario({ ...scenario, days: [...scenario.days, { day: addDays(lastDay, 1), work: {}, end: 'hand', leftover: 'let_go' }] })}>Add later day</button>
        <button className="primary" onClick={() => rebuild(scenario)}>Rebuild history and go live</button>
      </div>
      <div className="scroll">
        <table className="script">
          <thead>
            <tr>
              <th>Day</th>
              {names.map((n) => <th key={n}>{n}</th>)}
              <th>Ends</th>
              <th>Left tasks</th>
              <th>Moments at that close</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {scenario.days.map((d, i) => {
              const rec = byDay.get(d.day);
              const live = d.day >= scenario.liveDay;
              return (
                <tr key={d.day} className={live ? 'future' : ''}>
                  <th scope="row">{dayLabel(d.day)}</th>
                  {scenario.tasks.map((t) => {
                    const v = d.work[t.name];
                    return (
                      <td key={t.name}>
                        {t.kind === 'timed' ? (
                          <input
                            id={`w-${d.day}-${t.name}`}
                            className="cell"
                            inputMode="numeric"
                            aria-label={`${t.name} minutes on ${d.day}`}
                            value={typeof v === 'number' ? String(v) : ''}
                            placeholder="—"
                            onChange={(e) => setWork(i, t.name, e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
                          />
                        ) : (
                          <select id={`w-${d.day}-${t.name}`} aria-label={`${t.name} on ${d.day}`} value={v === 'done' || v === 'open' ? v : ''} onChange={(e) => setWork(i, t.name, (e.target.value || null) as 'done' | 'open' | null)}>
                            <option value="">—</option>
                            <option value="open">planned</option>
                            <option value="done">done</option>
                          </select>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <select id={`end-${d.day}`} aria-label={`How ${d.day} ends`} value={d.end} onChange={(e) => setDay(i, { end: e.target.value as 'hand' | 'auto' })}>
                      <option value="hand">by hand</option>
                      <option value="auto">auto</option>
                    </select>
                  </td>
                  <td>
                    <select id={`lo-${d.day}`} aria-label={`Unfinished tasks on ${d.day}`} value={d.leftover} onChange={(e) => setDay(i, { leftover: e.target.value as CloseOutcome })}>
                      <option value="let_go">let go</option>
                      <option value="moved">move</option>
                    </select>
                  </td>
                  <td className="small">
                    {live ? <span className="dim">live day</span> : rec ? (rec.moments.length ? rec.moments.map((m) => m.kind).join(' → ') : <span className="dim">none</span>) : <span className="dim">{d.end === 'auto' ? 'auto-closed, no moments' : 'rebuild to see'}</span>}
                  </td>
                  <td>
                    {rec?.moments.length ? <button className="mini" onClick={() => play({ moments: rec.moments, bars: rec.bars, label: `History ${rec.day}` })}>Play</button> : null}
                    <button className="mini" aria-label={`Remove ${d.day}`} onClick={() => setScenario({ ...scenario, days: scenario.days.filter((_, j) => j !== i) })}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------- Library & settings ---------------- */

function Library({ scenario, setScenario, act, rebuild }: { scenario: Scenario; setScenario: (s: Scenario) => void; act: (l: string, fn: () => void) => void; rebuild: (s: Scenario) => void }) {
  const db = getDb();
  const [goal, setGoal] = useState(String(getMonthlyGoalHours(db) ?? ''));
  const [hour, setHour] = useState(String(getDayStartHour(db)));
  const setTask = (i: number, patch: Partial<Scenario['tasks'][number]>) =>
    setScenario({ ...scenario, tasks: scenario.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Settings (live, through the app’s actions)</h2>
        <div className="stack">
          <label className="row wrap">Monthly goal (hours, empty = none)
            <input id="goal" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} />
            <button onClick={() => act(`Monthly goal ${goal || 'none'}`, () => setMonthlyGoal(goal === '' ? null : Number(goal)))}>Save</button>
          </label>
          <label className="row wrap">Day starts at (hour)
            <input id="hour" inputMode="numeric" value={hour} onChange={(e) => setHour(e.target.value)} />
            <button onClick={() => act(`Day start ${hour}:00 (applies from tomorrow)`, () => setDayStart(Number(hour)))}>Save</button>
          </label>
          <label className="row">
            <input id="mon" type="checkbox" checked={getMomentsEnabled(db)} onChange={(e) => act(`Moments ${e.target.checked ? 'on' : 'off'}`, () => setMomentsEnabled(e.target.checked))} /> Moments at close
          </label>
        </div>
      </section>
      <section className="panel">
        <h2>Library (used when the history is rebuilt)</h2>
        <div className="scroll">
          <table className="script">
            <thead><tr><th>Task</th><th>Topic</th><th>Kind</th><th>Min</th><th>Repeats</th><th>Default</th><th /></tr></thead>
            <tbody>
              {scenario.tasks.map((t, i) => (
                <tr key={i}>
                  <td><input id={`ln-${i}`} aria-label="Task name" value={t.name} onChange={(e) => setTask(i, { name: e.target.value })} /></td>
                  <td>
                    <select id={`lt-${i}`} aria-label="Topic" value={t.topic} onChange={(e) => setTask(i, { topic: e.target.value })}>
                      {scenario.topics.map((tp) => <option key={tp.name}>{tp.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select id={`lk-${i}`} aria-label="Kind" value={t.kind} onChange={(e) => setTask(i, { kind: e.target.value as 'timed' | 'check' })}>
                      <option value="timed">timed</option>
                      <option value="check">checklist</option>
                    </select>
                  </td>
                  <td><input id={`lm-${i}`} className="cell" aria-label="Minutes" value={t.minutes} onChange={(e) => setTask(i, { minutes: Number(e.target.value) || 5 })} /></td>
                  <td className="days">
                    {WD.map((w, d) => (
                      <button key={w} className={t.days.includes(d) ? 'dd on' : 'dd'} aria-pressed={t.days.includes(d)} onClick={() => setTask(i, { days: t.days.includes(d) ? t.days.filter((x) => x !== d) : [...t.days, d].sort() })}>
                        {w[0]}
                      </button>
                    ))}
                  </td>
                  <td><input id={`ld-${i}`} type="checkbox" aria-label="Default" checked={t.isDefault} onChange={(e) => setTask(i, { isDefault: e.target.checked })} /></td>
                  <td><button className="mini" aria-label={`Remove ${t.name}`} onClick={() => setScenario({ ...scenario, tasks: scenario.tasks.filter((_, j) => j !== i) })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row wrap">
          <button onClick={() => setScenario({ ...scenario, tasks: [...scenario.tasks, { name: `Task ${scenario.tasks.length + 1}`, topic: scenario.topics[0].name, kind: 'timed', minutes: 30, days: [0, 1, 2, 3, 4], isDefault: true }] })}>Add task</button>
          <button onClick={() => setScenario(DEFAULT_SCENARIO)}>Reset to the example</button>
          <button className="primary" onClick={() => rebuild(scenario)}>Rebuild history and go live</button>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Inspector ---------------- */

function Inspector({ today }: { today: DayKey }) {
  useDataVersion(['days', 'sessions', 'settings']);
  const db = getDb();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [pick, setPick] = useState<DayKey>(today);
  const [sql, setSql] = useState('SELECT dayKey, closedBy, closedAt, planConfirmedAt FROM days ORDER BY dayKey DESC LIMIT 20');
  const [rows, setRows] = useState<Record<string, unknown>[] | string>([]);
  const first = `${month}-01`;
  const lead = weekdayIndex(first);
  const daysIn = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const stored = new Map(listDays(db, first, `${month}-${daysIn}`).map((d) => [d.dayKey, d]));
  const at = clock.get();
  const b = loadDayBundle(db, pick);
  const prevMonth = addDays(first, -1).slice(0, 7);
  const nextMonth = addDays(`${month}-${daysIn}`, 1).slice(0, 7);
  return (
    <div className="grid2">
      <section className="panel">
        <h2 className="row wrap">
          <button className="mini" aria-label="Previous month" onClick={() => setMonth(prevMonth)}>‹</button>
          {new Date(first + 'T12:00').toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
          <button className="mini" aria-label="Next month" onClick={() => setMonth(nextMonth)}>›</button>
        </h2>
        <div className="cal">
          {WD.map((w) => <span key={w} className="dow">{w}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
          {Array.from({ length: daysIn }, (_, i) => {
            const k = `${month}-${String(i + 1).padStart(2, '0')}`;
            const d = stored.get(k);
            const bb = d ? loadDayBundle(db, k) : null;
            const ms = bb ? Object.values(bb.sessionsByDayTask).reduce((s, x) => s + focusedMs(x, at), 0) : 0;
            const cls = ['dayc', k === pick ? 'pick' : '', k === today ? 'today' : '', d?.closedBy === 'user' ? 'hand' : d?.closedBy === 'auto' ? 'auto' : ''].join(' ');
            return (
              <button key={k} className={cls} onClick={() => setPick(k)} aria-label={`${k}${ms ? `, ${hm(ms)} focus` : ''}`}>
                <span>{i + 1}</span>
                <small>{ms ? hm(ms) : ''}</small>
              </button>
            );
          })}
        </div>
        <p className="dim small legend"><span className="sw hand" /> closed by hand <span className="sw auto" /> auto-closed <span className="sw today" /> today</p>
      </section>
      <section className="panel">
        <h2>{dayLabel(pick)} as stored</h2>
        {b ? (
          <div className="stack">
            <dl className="kv">
              <dt>Planned</dt><dd>{b.day.planConfirmedAt ? stamp(b.day.planConfirmedAt) : b.day.planDraftedAt ? 'draft only' : 'no'}</dd>
              <dt>Closed</dt><dd>{b.day.closedAt ? `${stamp(b.day.closedAt)} (${b.day.closedBy})` : 'open'}</dd>
              <dt>Focus</dt><dd>{hm(Object.values(b.sessionsByDayTask).reduce((s, x) => s + focusedMs(x, at), 0))}</dd>
              <dt>Collection items</dt><dd>{collectionItems(b, at).length}</dd>
            </dl>
            <div className="scroll">
              <table className="script">
                <thead><tr><th>Task</th><th>Kind</th><th>Budget</th><th>Focus</th><th>Sessions</th><th>Done</th><th>Close</th></tr></thead>
                <tbody>
                  {b.dayTasks.map((t) => {
                    const ss = b.sessionsByDayTask[t.id] ?? [];
                    return (
                      <tr key={t.id}>
                        <td>{t.name}</td><td>{t.kind}</td><td>{t.kind === 'timed' ? hm(t.budgetSec * 1000) : '—'}</td>
                        <td>{hm(focusedMs(ss, at))}</td><td>{ss.length}</td>
                        <td>{t.completedAt ? new Date(t.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>{t.closeOutcome ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="dim">Nothing stored for this day.</p>
        )}
        <h3>Ask the database</h3>
        <textarea id="sql" rows={3} value={sql} onChange={(e) => setSql(e.target.value)} aria-label="SQL query" />
        <button onClick={() => { try { setRows(rawQuery(sql)); } catch (e) { setRows((e as Error).message); } }}>Run</button>
        {typeof rows === 'string' ? <p className="bad">{rows}</p> : rows.length ? (
          <div className="scroll">
            <table className="script">
              <thead><tr>{Object.keys(rows[0]).map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Log({ log }: { log: LogLine[] }) {
  return (
    <section className="panel">
      <h2>Log</h2>
      <ol className="log">
        {[...log].reverse().map((l, i) => (
          <li key={i} className={`lk-${l.kind}`}>
            <time>{stamp(l.at)}</time> {l.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------- Playback speed (sandbox only) ---------------- */

declare global {
  interface Window {
    __sandboxTime?: { setRate: (x: number) => void; step: (ms: number) => void; now: () => number; rate: () => number };
  }
}

const SPEEDS = [1, 0.25, 0.1, 0.05, 0.02, 0.01] as const;
const SPEED_KEY = 'ysave-sandbox-speed';
/** The last speed picked, remembered in this browser (falls back to 1x if storage is blocked). */
let chosenSpeed = (() => {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY));
    return v > 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
})();
function rememberSpeed(v: number) {
  chosenSpeed = v;
  try {
    localStorage.setItem(SPEED_KEY, String(v));
  } catch {
    /* blocked: kept for this visit only */
  }
}

/** Floats above the player: speed, pause, step one frame, and the player's own clock in seconds. */
function Playback() {
  const time = window.__sandboxTime;
  const [speed, setSpeed] = useState(chosenSpeed);
  const [paused, setPaused] = useState(false);
  const [start] = useState(() => time?.now() ?? 0);
  const [, tick] = useState(0);
  useEffect(() => {
    time?.setRate(paused ? 0 : speed);
  }, [time, speed, paused]);
  useEffect(() => () => time?.setRate(1), [time]);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, []);
  if (!time) return null;
  const secs = (time.now() - start) / 1000;
  // Rendered into <body>: inside the app root it would sit under the player's layer.
  return createPortal(
    <div className="playback" role="toolbar" aria-label="Playback speed">
      <span className="pt" aria-live="off">{secs.toFixed(1)} s</span>
      {SPEEDS.map((s) => (
        <button key={s} className={!paused && speed === s ? 'on' : ''} aria-pressed={!paused && speed === s} onClick={() => { rememberSpeed(s); setSpeed(s); setPaused(false); }}>
          {s}×
        </button>
      ))}
      <input
        id="speed"
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label="Speed, fine"
        title={`${speed}x`}
        // Logarithmic: 0 = 0.01x, 50 = 0.1x, 100 = 1x, so the slow end has as much room as the fast end.
        value={Math.round(50 * (Math.log10(speed) + 2))}
        onChange={(e) => { const v = Number((10 ** (Number(e.target.value) / 50 - 2)).toFixed(3)); rememberSpeed(v); setSpeed(v); setPaused(false); }}
      />
      <span className="pt sp">{speed}×</span>
      <button className={paused ? 'on' : ''} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>{paused ? 'Play' : 'Pause'}</button>
      <button disabled={!paused} onClick={() => { time.step(1000 / 30); tick((n) => n + 1); }} aria-label="Step one frame">+1 frame</button>
      <button disabled={!paused} onClick={() => { time.step(250); tick((n) => n + 1); }} aria-label="Step a quarter second">+¼ s</button>
    </div>,
    document.body,
  );
}

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'done' | 'gold'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
