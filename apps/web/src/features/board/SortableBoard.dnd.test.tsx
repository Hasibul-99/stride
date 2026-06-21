import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@/test/utils';
import { SortableBoard, type BoardContainer } from './SortableBoard';
import { installDndRects, keyboardDrag, draggable } from '@/test/dnd';

/**
 * Exercises the real dnd-kit KeyboardSensor (Space → Arrow → Space) against
 * SortableBoard, with per-id rect mocks so collision detection resolves in jsdom.
 *
 * Note: cross-*container* keyboard nav is intentionally not covered here — each
 * column is its own SortableContext, so arrow keys reorder within the active
 * list (a dnd-kit constraint). Cross-container *outcomes* (status/day/waiting)
 * are asserted at the request-payload level in the Kanban/Calendar drop tests.
 */
interface Item {
  id: string;
  title: string;
}

const containers: BoardContainer[] = [{ id: 'colA', className: 'col' }];
const layout = {
  colA: { x: 0, y: 0, width: 200, height: 400 },
  a1: { x: 10, y: 10, width: 180, height: 40 },
  a2: { x: 10, y: 60, width: 180, height: 40 },
  a3: { x: 10, y: 110, width: 180, height: 40 },
};

let uninstall: (() => void) | undefined;
afterEach(() => uninstall?.());

function setup(onDrop = vi.fn()) {
  uninstall = installDndRects(layout);
  const utils = render(
    <SortableBoard
      containers={containers}
      itemsByContainer={{
        colA: [
          { id: 'a1', title: 'A1' },
          { id: 'a2', title: 'A2' },
          { id: 'a3', title: 'A3' },
        ],
      }}
      onDrop={onDrop}
      renderItem={(it: Item) => <span>{it.title}</span>}
    />,
  );
  return { onDrop, ...utils };
}

describe('SortableBoard keyboard DnD', () => {
  it('reordering down keeps the card in the same container at a later index', async () => {
    const { onDrop, user, container } = setup();
    await keyboardDrag(user, draggable(container, 'a1'), ['{ArrowDown}']);
    expect(onDrop).toHaveBeenCalledTimes(1);
    const [id, toContainer, toIndex] = onDrop.mock.calls[0];
    expect(id).toBe('a1');
    expect(toContainer).toBe('colA');
    expect(toIndex).toBeGreaterThan(0); // moved down from index 0
  });

  it('reordering up keeps the card in the same container at an earlier index', async () => {
    const { onDrop, user, container } = setup();
    await keyboardDrag(user, draggable(container, 'a3'), ['{ArrowUp}']);
    expect(onDrop).toHaveBeenCalledTimes(1);
    const [id, toContainer, toIndex] = onDrop.mock.calls[0];
    expect(id).toBe('a3');
    expect(toContainer).toBe('colA');
    expect(toIndex).toBeLessThan(2); // moved up from index 2
  });
});
