export type Epoch = number; // ms since 1970 UTC
export type DayKey = string; // 'YYYY-MM-DD', local calendar date
export type TaskKind = 'timed' | 'check';
export type ColorKey = 'study' | 'health' | 'home' | 'sun' | 'c4' | 'c5';
export type ClosedBy = 'user' | 'auto';
export type CloseOutcome = 'moved' | 'let_go';

export interface Topic {
  id: string;
  name: string;
  colorKey: ColorKey;
  sortOrder: number;
  isOpen: boolean;
  deletedAt: Epoch | null;
}

export interface Task {
  id: string;
  topicId: string;
  name: string;
  kind: TaskKind;
  minutes: number;
  repeatMask: number; // bit 0 = Monday … bit 6 = Sunday
  isDefault: boolean;
  cue: string | null;
  treat: string | null;
  note: string;
  sortOrder: number;
  deletedAt: Epoch | null;
}

export interface Day {
  dayKey: DayKey;
  planConfirmedAt: Epoch | null;
  closedAt: Epoch | null;
  closedBy: ClosedBy | null;
  dayStartHour: number;
}

export interface DayTask {
  id: string;
  dayKey: DayKey;
  taskId: string | null;
  topicId: string;
  name: string;
  colorKey: ColorKey;
  kind: TaskKind;
  budgetSec: number;
  cue: string | null;
  treat: string | null;
  forwardedFromDayKey: DayKey | null;
  completedAt: Epoch | null;
  closeOutcome: CloseOutcome | null;
  sortOrder: number;
}

export interface Session {
  id: string;
  dayTaskId: string;
  startedAt: Epoch;
  endedAt: Epoch | null;
}

export type DayTaskDraft = Omit<DayTask, 'id'>;

export const MINUTES = { min: 5, max: 180, step: 5 } as const;
export const GOLD_OVERTIME_MS = 60_000;
export const DEFAULT_DAY_START_HOUR = 4;

/** One day with its tasks and their sessions; shared by collection and rollover. */
export interface DayBundle {
  day: Day;
  dayTasks: DayTask[];
  sessionsByDayTask: Record<string, Session[]>;
}
