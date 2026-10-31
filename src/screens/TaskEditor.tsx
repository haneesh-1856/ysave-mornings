import { useCallback, useEffect, useRef, useState } from 'react';

import type { Task } from '@/domain/types';
import { createTask, DEFAULT_TASK, removeTask, setTaskNote, updateTask } from '@/state/actions/library';
import { ValidationError } from '@/state/errors';
import { TaskCard, type TaskCardPatch, type TaskCardValue } from '@/ui/TaskCard';
import type { TopicOption } from '@/ui/TopicPicker';

const DEBOUNCE_MS = 400;

const TOPIC_GONE = 'That topic no longer exists. Pick another.';

type Props = {
  /** The topic this card sits in; a new draft starts with it chosen. */
  topicId: string;
  /** What the topic picker offers (No topic included). */
  topics: TopicOption[];
  /** The saved task, or null for a draft that has no name yet. */
  task: Task | null;
  flipped: boolean;
  onFlip: () => void;
  /** Done / delete / a draft that was never named: the card should close. */
  onClose: () => void;
  /** A draft got its first non-blank name and is now a real task. */
  onCreated: (id: string, topicId: string) => void;
  /** A saved task was moved to another topic (so the screen can open that group). */
  onMoved?: (topicId: string) => void;
  onDeleted: () => void;
};

const draftValue = (topicId: string): TaskCardValue => ({ ...DEFAULT_TASK, topicId, name: '', note: '' });

/** Connects one TaskCard to the actions: saves on change, debounces text, flushes on Done / flip-away / unmount. */
export function TaskEditor({ topicId, topics, task, flipped, onFlip, onClose, onCreated, onMoved, onDeleted }: Props) {
  const [draft, setDraft] = useState<TaskCardValue>(() => draftValue(topicId));
  const [topicError, setTopicError] = useState<string | undefined>();
  const idRef = useRef<string | null>(task?.id ?? null);
  const draftRef = useRef(draft);
  const pending = useRef<{ name?: string; note?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const callbacks = useRef({ onCreated });

  useEffect(() => {
    idRef.current = task?.id ?? idRef.current;
    draftRef.current = draft;
    callbacks.current = { onCreated };
  });

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = {};
    if (p.name !== undefined && p.name.trim() !== '') {
      if (idRef.current) {
        updateTask(idRef.current, { name: p.name });
      } else {
        const { name: _n, note: _o, ...fields } = draftRef.current;
        let created;
        try {
          created = createTask(fields.topicId, { ...fields, name: p.name });
        } catch (e) {
          if (!(e instanceof ValidationError)) throw e;
          pending.current = { ...p, ...pending.current }; // the chosen topic was removed meanwhile; the name waits for a good one
          if (mounted.current) setTopicError(TOPIC_GONE);
          return;
        }
        idRef.current = created.id;
        if (draftRef.current.note.trim() !== '') setTaskNote(created.id, draftRef.current.note);
        if (mounted.current) callbacks.current.onCreated(created.id, created.topicId);
      }
    }
    if (p.note !== undefined) {
      if (idRef.current) setTaskNote(idRef.current, p.note);
      else draftRef.current = { ...draftRef.current, note: p.note }; // kept until the draft gets a name
    }
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  // Save whatever is pending when the card flips away or goes away.
  useEffect(() => {
    if (!flipped) flush();
  }, [flipped, flush]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      flush();
    };
  }, [flush]);

  const onName = (text: string) => {
    pending.current.name = text;
    schedule();
  };
  const onNote = (text: string) => {
    pending.current.note = text;
    if (!idRef.current) setDraft(d => ({ ...d, note: text }));
    schedule();
  };
  const onChange = (patch: TaskCardPatch) => {
    flush(); // a named draft is created first, then patched
    if (!idRef.current) {
      setDraft(d => ({ ...d, ...patch }));
      draftRef.current = { ...draftRef.current, ...patch }; // a later flush in this tick must see it
      setTopicError(undefined);
      if (pending.current.name !== undefined) flush(); // a name still pending here failed to create: retry with this choice
      return;
    }
    try {
      updateTask(idRef.current, patch);
      setTopicError(undefined);
      if (patch.topicId) onMoved?.(patch.topicId);
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
      setTopicError(TOPIC_GONE);
    }
  };
  const onDone = () => {
    flush();
    if (!idRef.current && pending.current.name !== undefined) return; // not created (topic gone): stay open on the error
    onClose();
  };
  const onDelete = () => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = {};
    if (idRef.current) removeTask(idRef.current);
    onDeleted();
  };

  const value: TaskCardValue = task
    ? { name: task.name, topicId: task.topicId, kind: task.kind, minutes: task.minutes, repeatMask: task.repeatMask, isDefault: task.isDefault, cue: task.cue, treat: task.treat, note: task.note }
    : draft;

  return <TaskCard value={value} topics={topics} topicError={topicError} flipped={flipped} onFlip={onFlip} onDone={onDone} onName={onName} onNote={onNote} onChange={onChange} onDelete={onDelete} />;
}
