import type { UserEvent } from '@testing-library/user-event';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function toRect(b: Box): DOMRect {
  return {
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    top: b.y,
    left: b.x,
    right: b.x + b.width,
    bottom: b.y + b.height,
    toJSON() {},
  } as DOMRect;
}

const ZERO = toRect({ x: 0, y: 0, width: 0, height: 0 });

/**
 * jsdom has no layout, so dnd-kit's keyboard sensor can't resolve collisions.
 * Mock getBoundingClientRect to return a fixed box per draggable/droppable id
 * (matched via the data-draggable-id / data-droppable-id attrs SortableBoard sets).
 * Returns an uninstall fn (call in afterEach).
 */
export function installDndRects(layout: Record<string, Box>) {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element) {
    const id =
      this.getAttribute?.('data-draggable-id') ?? this.getAttribute?.('data-droppable-id') ?? undefined;
    return id && layout[id] ? toRect(layout[id]) : ZERO;
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
}

/**
 * Drive a dnd-kit keyboard drag: focus the source handle, Space to pick up,
 * the given arrow keys to move, Space to drop.
 *   await keyboardDrag(user, handle, ['{ArrowDown}'])
 */
export async function keyboardDrag(user: UserEvent, handle: HTMLElement, moves: string[]) {
  handle.focus();
  await user.keyboard('{ }'); // pick up (Space)
  for (const move of moves) await user.keyboard(move);
  await user.keyboard('{ }'); // drop (Space)
}

/** The draggable wrapper SortableBoard renders for a given item id. */
export function draggable(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-draggable-id="${id}"]`);
  if (!el) throw new Error(`No draggable for id "${id}"`);
  return el;
}
