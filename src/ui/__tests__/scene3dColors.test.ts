import { processColor } from 'react-native-reanimated';

import { bestSceneDraw } from '../moments/bestScene';
import { monthSceneDraw } from '../moments/monthScene';
import { slotProps } from '../moments/Scene3D';
import { streakSceneDraw } from '../moments/streakScene';
import type { Prim } from '../moments/three';
import { nearest } from '../moments/three';
import { weekSceneDraw } from '../moments/weekScene';

// Regression for the close crash on the Pixel 9a (2 and 4 Nov 2026): Expo Go quit as the first 3D scene started.
// The Moments lab's red box showed "[Reanimated] Invalid color value: "none"" from processColor: an ANIMATED colour
// goes through processColor on Android, and the scenes' prims use the SVG paint 'none'. jest's processColor throws the
// same error, so this runs every scene frame by frame and checks every colour each slot sends.

const MIN = 60_000;
const size = { w: 411, h: 820 };
const SCENES: [string, (lt: number) => Prim[], number][] = [
  ['best', (lt) => bestSceneDraw(lt, [...[60, 90, 0, 120, 150, 40, 80, 100, 0, 30, 110, 70, 60].map((m) => m * MIN), 185 * MIN, 150 * MIN], size), 50],
  ['streak', (lt) => streakSceneDraw(lt, 14, size), 66],
  ['week', (lt) => weekSceneDraw(lt, [120, 150, 95, 185, 60, 80, 70].map((m) => m * MIN), size), 56],
  ['month (goal)', (lt) => monthSceneDraw(lt, [10 * 3_600_000, ...[150, 0, 200, 185].map((m) => m * MIN)], size), 14],
  ['month (no goal)', (lt) => monthSceneDraw(lt, [-1, ...[150, 0, 200, 185].map((m) => m * MIN)], size), 14],
];
/**
 * What react-native-svg on Android can turn into a DashPathEffect without a native exception: no prop at all, or at
 * least 2 non-negative values (an odd count is doubled) with a total above 0. [] is NOT ok: it becomes an empty
 * interval array, which Android rejects and the app closes (Pixel 9a, 5 Nov 2026).
 */
function androidDashOk(v: unknown): boolean {
  if (v === undefined) return true;
  if (!Array.isArray(v) || v.length === 0) return false;
  const n = v.length % 2 === 1 ? [...v, ...v] : v;
  return n.length >= 2 && n.every((x) => typeof x === 'number' && x >= 0) && n.reduce((a, x) => a + x, 0) > 0;
}

const FRAMES = Array.from({ length: 81 }, (_, i) => i * 0.05); // 0 .. 4 s, past every scene's still point

describe('3D scenes send only colours Reanimated accepts and dash patterns Android accepts', () => {
  it('jest reproduces the phone error for the raw paint "none"', () => {
    expect(() => processColor('none')).toThrow('Invalid color value');
    expect(processColor('transparent')).toBe(0);
  });

  it.each(SCENES)('%s: every slot of every frame', (_name, draw, slots) => {
    let sawNone = false;
    for (const lt of FRAMES) {
      const prims = nearest(draw(lt), slots);
      for (let i = 0; i < slots; i++) {
        const p = prims[i];
        if (p && (p.fill === 'none' || p.stroke === 'none')) sawNone = true;
        const props = slotProps(p, 'animated', true);
        expect(props.fill).not.toBe('none');
        expect(props.stroke).not.toBe('none');
        expect(() => processColor(props.fill)).not.toThrow();
        expect(() => processColor(props.stroke)).not.toThrow();
        expect(androidDashOk(props.strokeDasharray)).toBe(true);
        expect(String(props.d)).not.toMatch(/NaN|Infinity/);
      }
    }
    // The scenes do use 'none' internally (lines without fill, faces without outline), so this covers the real case.
    expect(sawNone).toBe(true);
  });

  it('the Android dash rule itself', () => {
    expect(androidDashOk([])).toBe(false);
    expect(androidDashOk([6, 5])).toBe(true);
    expect(androidDashOk([4])).toBe(true);
    expect(androidDashOk([0, 0])).toBe(false);
    expect(androidDashOk(undefined)).toBe(true);
  });

  it('an unused slot draws nothing and sends no "none"', () => {
    expect(slotProps(undefined, 'animated', true)).toEqual({
      d: 'M0 0', fillOpacity: 0, strokeOpacity: 0, strokeWidth: 0, fill: 'transparent', stroke: 'transparent', strokeDasharray: [100000, 0],
    });
  });
});
