/** Typed errors thrown by the repositories. Callers (state layer) catch these by class. */

/** Input broke a documented limit (doc 07: all user text has length limits). */
export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** A write collided with a uniqueness invariant (e.g. a second open session). */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/** A write targeted a row that does not exist. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Anything with a string `message`. Realm-independent: an Error built in another JS realm
 * (e.g. a native addon cached across jest vm contexts) fails `instanceof Error` but still matches. */
function hasMessage(v: unknown): v is { message: string; cause?: unknown } {
  return typeof v === 'object' && v !== null && typeof (v as { message?: unknown }).message === 'string';
}

/** Drizzle v1 wraps driver errors; the SQLite message lives on `error.cause`. */
export function sqliteMessage(error: unknown): string {
  const parts: string[] = [];
  let cur: unknown = error;
  for (let i = 0; i < 4 && hasMessage(cur); i++) {
    parts.push(cur.message);
    cur = cur.cause;
  }
  return parts.join(' | ');
}
