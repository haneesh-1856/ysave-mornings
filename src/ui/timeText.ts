import { extraMinutesLabel, minutesLeftLabel } from '@/domain/timer';

/** "12 min left": whole minutes rounded up, floored at 0 (doc 04 §4). */
export const minutesLeftText = (remainingMs: number): string => `${minutesLeftLabel(remainingMs)} min left`;

/** "+3 min extra": whole minutes rounded down. */
export const extraText = (overtimeMs: number): string => `+${extraMinutesLabel(overtimeMs)} min extra`;
