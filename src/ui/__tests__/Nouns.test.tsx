import { fireEvent, screen } from '@testing-library/react-native';

import type { CollectionItem } from '@/domain/collection';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DEFAULT_LOOK } from '@/theme/look';

import { dayCardLine } from '../dayCardLine';
import { Dock } from '../Dock';
import { cellLabel, type MonthGridCell } from '../MonthGrid';
import { TopicForm } from '../TopicForm';
import { renderThemed } from '../testing';

const item = (i: number): CollectionItem => ({ kind: 'task', dayTaskId: `d${i}`, colorKey: 'study', small: false, gold: false, at: i });
const cell = (over: Partial<MonthGridCell> = {}): MonthGridCell => ({
  dayKey: '2026-10-22', isToday: false, isTomorrow: false, isFuture: false, glows: false, closed: false, drafted: false, items: [item(1), item(2)], ...over,
});
const withLook = (art: 'garden' | 'card', ui: React.ReactElement) => (
  <ThemeProvider look={{ ...DEFAULT_LOOK, art }}>{ui}</ThemeProvider>
);

describe('collection nouns in copy', () => {
  it('cellLabel and dayCardLine default to marbles and follow the look', () => {
    expect(cellLabel(cell(), 'en-US')).toBe('Thursday 22 October, 2 marbles');
    expect(cellLabel(cell(), 'en-US', 'garden')).toBe('Thursday 22 October, 2 flowers');
    expect(cellLabel(cell({ items: [item(1)] }), 'en-US', 'card')).toBe('Thursday 22 October, 1 stamp');
    const base = { kind: 'tomorrow', glows: false, planned: false, done: 0, total: 0, focusedMs: 0 } as const;
    expect(dayCardLine(base)).toBe('Plan it tonight. One marble waiting.');
    expect(dayCardLine({ ...base, planned: true, total: 2 }, undefined, 'garden')).toBe('Planned: 2 tasks. One flower waiting.');
    expect(dayCardLine(base, undefined, 'card')).toBe('Plan it tonight. One stamp waiting.');
  });

  it('Dock names its collection in the garden and stamp-card looks', async () => {
    const view = await renderThemed(withLook('garden', <Dock items={[item(1), item(2)] } closed={false} onPress={() => {}} />));
    expect(screen.getByRole('button', { name: "Today's garden, 2 flowers" })).toBeTruthy();
    expect(screen.getByText('2 flowers')).toBeTruthy();
    await view.unmount();
    await renderThemed(withLook('card', <Dock items={[item(1)]} closed onClose={() => {}} />));
    expect(screen.getByText("Today's stamp card")).toBeTruthy();
    expect(screen.getByText('1 stamp')).toBeTruthy();
  });

  it('Dock Close button calls onClose', async () => {
    const onClose = jest.fn();
    await renderThemed(<Dock items={[]} closed={false} onClose={onClose} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close today' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('TopicForm remove warning uses the look\'s plural', async () => {
    await renderThemed(withLook('garden', <TopicForm initialName="Study" initialColor="study" onSave={() => {}} onRemove={() => {}} />));
    await fireEvent.press(screen.getByLabelText('Remove topic'));
    expect(screen.getByText('Remove Study? Removes its tasks from your library. Past days keep their flowers.')).toBeTruthy();
  });
});
