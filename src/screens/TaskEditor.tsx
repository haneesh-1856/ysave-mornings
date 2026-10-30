import { useCallback, useEffect, useRef, useState } from 'react';

import type { Task } from '@/domain/types';
import { createTask, DEFAULT_TASK, removeTask, setTaskNote, updateTask } from '@/state/actions/library';
import { TaskCard, type TaskCardPatch, type TaskCardValue } from '@/ui/TaskCard';

const DEBOUNCE_MS = 400;

type Props = {
  topicId: string;
  /** The saved task, or null for a draft that has no name yet. */
  task: Task | null;
  flipped: boolean;
  onFlip: () => void;
  /** Done / delete / a draft that was never named: the card should close. */
  onClose: () => void;
  /** A draft got its first non-blank name and is now a real task. */
  onCreated: (id: string) => void;
  onDeleted: () => void;
};

const draftValue = (): TaskCardValue => ({ ...DEFAULT_TASK, name: '', note: '' });

/** Connects one TaskCard to the actions: saves on change, debounces text, flushes on Done / flip-away / unmount. */
export function TaskEditor({ topicId, task, flipped, onFlip, onClose, onCreated, onDeleted }: Props) {
  const [draft, setDraft] = useState<TaskCardValue>(draftValue);
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
        const created = createTask(topicId, { ...fields, name: p.name });
        idRef.current = created.id;
        if (draftRef.current.note.trim() !== '') setTaskNote(created.id, draftRef.current.note);
        if (mounted.current) callbacks.current.onCreated(created.id);
      }
    }
    if (p.note !== undefined) {
      if (idRef.current) setTaskNote(idRef.current, p.note);
      else draftRef.current = { ...draftRef.current, note: p.note }; // kept until the draft gets a name
    }
  }, [topicId]);

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
    if (idRef.current) updateTask(idRef.current, patch);
    else setDraft(d => ({ ...d, ...patch }));
  };
  const onDone = () => {
    flush();
    onClose();
  };
  const onDelete = () => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = {};
    if (idRef.current) removeTask(idRef.current);
    onDeleted();
  };

  const value: TaskCardValue = task
    ? { name: task.name, kind: task.kind, minutes: task.minutes, repeatMask: task.repeatMask, isDefault: task.isDefault, cue: task.cue, treat: task.treat, note: task.note }
    : draft;

  return <TaskCard value={value} flipped={flipped} onFlip={onFlip} onDone={onDone} onName={onName} onNote={onNote} onChange={onChange} onDelete={onDelete} />;
}
