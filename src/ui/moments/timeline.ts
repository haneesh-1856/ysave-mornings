// The timeline of the close moments player, in seconds. Every function is a worklet so the animated styles can call
// it on the UI thread; they are also plain functions, so tests call them directly.

export const INTRO = 1.4;
export const MOMENT_DUR = 3.6;
export const CUT = 0.35;
export const OUTRO = 2.4;

export const clamp = (x: number, a = 0, b = 1): number => {
  'worklet';
  return Math.max(a, Math.min(b, x));
};
/** 0 before a, 1 after b, linear between. */
export const seg = (t: number, a: number, b: number): number => {
  'worklet';
  return clamp((t - a) / (b - a));
};
export const lerp = (a: number, b: number, k: number): number => {
  'worklet';
  return a + (b - a) * k;
};
export const outExpo = (x: number): number => {
  'worklet';
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
};
export const inOut = (x: number): number => {
  'worklet';
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** When the moments end and the pull back begins. */
export const endOf = (count: number): number => {
  'worklet';
  return INTRO + count * MOMENT_DUR;
};

/** Length of the whole sequence. */
export const totalOf = (count: number): number => {
  'worklet';
  return endOf(count) + OUTRO;
};

/** Which moment is on screen at time t and how far into it we are (clamped to the last moment's end). */
export const phaseAt = (t: number, count: number): { index: number; local: number } => {
  'worklet';
  const last = Math.max(0, count - 1);
  const into = clamp(t - INTRO, 0, count * MOMENT_DUR);
  const index = Math.min(last, Math.floor(into / MOMENT_DUR));
  return { index, local: Math.min(MOMENT_DUR, into - index * MOMENT_DUR) };
};

/** The sun mark's state at time t. `quiet` is the ending with tasks left: dim sun, ring left open. */
export const markAt = (t: number, count: number, quiet: boolean, zoomMax: number) => {
  'worklet';
  const end = endOf(count);
  const zin = inOut(seg(t, 0.8, INTRO));
  const zout = inOut(seg(t, end + 0.1, end + 0.9));
  return {
    ring: inOut(seg(t, 0, 0.7)),
    close: quiet ? 0 : inOut(seg(t, end + 0.95, end + 1.45)),
    zoom: zout > 0 ? lerp(zoomMax, 1, zout) : lerp(1, zoomMax, zin),
    alpha: t < end ? 1 - seg(t, INTRO - 0.3, INTRO) : seg(t, end + 0.1, end + 0.45) * (quiet ? 0.5 : 1),
    /** 0..1 progress of the pulse ring that goes out when the ring has closed. */
    pulse: seg(t, end + 1.4, end + 2.1),
    /** The window into the moments is open from the start of the fly through to the end of the pull back. */
    windowOpen: t >= 0.8 && t < end + 0.9,
  };
};

/** Progress 0..1 of ray `i` extending. */
export const rayAt = (t: number, i: number): number => {
  'worklet';
  return outExpo(seg(t, 0.35 + i * 0.05, 0.75 + i * 0.05));
};
