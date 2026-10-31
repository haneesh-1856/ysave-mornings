export type Epoch = number; // ms since 1970 UTC
export type DayKey = string; // 'YYYY-MM-DD', local calendar date
export type MonthKey = string; // 'YYYY-MM'
export type TaskKind = 'timed' | 'check';
/** The six topic colours a user picks from, plus 'none': the neutral colour of the built-in No topic (ADR-012). */
export type ColorKey = 'study' | 'health' | 'home' | 'sun' | 'c4' | 'c5' | 'none';
export type ClosedBy = 'user' | 'auto';
export type CloseOutcome = 'moved' | 'let_go';

/** The built-in topic that holds tasks without a topic (ADR-012): one row made by a migration, never renamed or deleted. */
export const NO_TOPIC_ID = 'no-topic';
export const NO_TOPIC_NAME = 'No topic';

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
  /** When isDefault last changed (also set when created as default); null = never. Compared with a plan's time. */
  defaultChangedAt: Epoch | null;
}

export interface Day {
  dayKey: DayKey;
  planConfirmedAt: Epoch | null;
  planDraftedAt: Epoch | null;
  /** Last time the user saved this plan (every confirm, re-confirm and draft save); null on old rows. */
  planUpdatedAt: Epoch | null;
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
  /** This day's note for the row (ADR-011). Never copied to or from the library task note. */
  note: string | null;
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
