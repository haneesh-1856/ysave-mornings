import type { Moment } from '@/domain/moments';

import { clearTrail, readLabFlags, readLastClose, readTrail, recordStep, saveLabFlags, saveLastClose } from '../devLab';
import { setClockOverride } from '../clock';
import { setupState, teardownState } from '../testSupport';

const NOW = Date.parse('2026-11-04T21:00:00');
beforeEach(() => setupState(NOW));
afterEach(teardownState);

describe('Moments lab storage (dev)', () => {
  it('keeps each step in order with its time, the last 60 only', () => {
    recordStep('player opened');
    setClockOverride(() => NOW + 1000);
    recordStep('moment 1/3 longest mounted');
    expect(readTrail()).toEqual([
      { at: NOW, step: 'player opened' },
      { at: NOW + 1000, step: 'moment 1/3 longest mounted' },
    ]);
    for (let i = 0; i < 70; i++) recordStep(`s${i}`);
    const t = readTrail();
    expect(t).toHaveLength(60);
    expect(t[59].step).toBe('s69');
    clearTrail();
    expect(readTrail()).toEqual([]);
  });

  it('keeps the last close to replay, and ignores an empty one', () => {
    expect(readLastClose()).toBeNull();
    saveLastClose([], []);
    expect(readLastClose()).toBeNull();
    const moments: Moment[] = [{ kind: 'day', done: 4, total: 4, focusedMs: 6_000_000, closedAt: NOW }];
    saveLastClose(moments, [{ name: 'Deep work', focusedMs: 5_400_000 }]);
    expect(readLastClose()).toEqual({ at: NOW, moments, bars: [{ name: 'Deep work', focusedMs: 5_400_000 }] });
  });

  it('stores the switches as given', () => {
    expect(readLabFlags()).toBeUndefined();
    saveLabFlags({ scene3d: false });
    expect(readLabFlags()).toEqual({ scene3d: false });
  });
});
