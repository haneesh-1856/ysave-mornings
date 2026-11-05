// The Moments lab (dev only, 2026-11-05): switches that change how the 3D scenes draw, and a step reporter, so the
// close crash on the Pixel 9a (Expo Go quits as the first 3D scene starts) can be narrowed down on the phone itself.
// UI layer only: nothing here reads or writes data. The dev setup plugs a sink in (`setLabSink`) that saves each step
// to the phone's storage; without a sink (release builds) `labStep` does nothing and the flags stay at their defaults,
// which draw exactly as before.

export type LabFlags = {
  /** Mount the 3D scene at all (off: the moment shows its headline, labels and text without the 3D drawing). */
  scene3d: boolean;
  /**
   * How a 3D shape gets its colours each frame: 'animated' as designed; 'fixed' no animated colours at all (every shape
   * one fixed grey, only its outline, opacities and width move). (A 'noNone' mode existed for one day: it proved the
   * crash cause and became the default, see Scene3D NO_PAINT.)
   */
  colors: 'animated' | 'fixed';
  /** Animate strokeDasharray (dashed glass/goal lines). Off: no dash prop is ever sent; dashed lines draw solid. */
  dashes: boolean;
  /** Draw the floating 3D labels (weekday letters, BEST 2:30, ...). */
  labels: boolean;
  /** Draw the glow around the gold pieces. */
  glow: boolean;
};

export const DEFAULT_LAB_FLAGS: LabFlags = { scene3d: true, colors: 'animated', dashes: true, labels: true, glow: true };

let flags: LabFlags = DEFAULT_LAB_FLAGS;
let sink: ((step: string) => void) | null = null;

export function getLabFlags(): LabFlags {
  return flags;
}

/** Unknown or partial input falls back to the defaults field by field. */
export function setLabFlags(next: Partial<LabFlags> | null | undefined): LabFlags {
  const n = next ?? {};
  flags = {
    scene3d: typeof n.scene3d === 'boolean' ? n.scene3d : DEFAULT_LAB_FLAGS.scene3d,
    colors: n.colors === 'fixed' || n.colors === 'animated' ? n.colors : DEFAULT_LAB_FLAGS.colors,
    dashes: typeof n.dashes === 'boolean' ? n.dashes : DEFAULT_LAB_FLAGS.dashes,
    labels: typeof n.labels === 'boolean' ? n.labels : DEFAULT_LAB_FLAGS.labels,
    glow: typeof n.glow === 'boolean' ? n.glow : DEFAULT_LAB_FLAGS.glow,
  };
  return flags;
}

export function flagsText(f: LabFlags = flags): string {
  return `3D ${f.scene3d ? 'on' : 'off'}, colours ${f.colors}, dashes ${f.dashes ? 'on' : 'off'}, labels ${f.labels ? 'on' : 'off'}, glow ${f.glow ? 'on' : 'off'}`;
}

export function setLabSink(fn: ((step: string) => void) | null): void {
  sink = fn;
}

export function hasLabSink(): boolean {
  return sink !== null;
}

/** Reports one step of the player. Called on the JS thread (worklets reach it through scheduleOnRN). Never throws. */
export function labStep(step: string): void {
  if (!sink) return;
  try {
    sink(step);
  } catch {
    /* a failing trail must never break the player */
  }
}
