import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

export interface BoardContainer {
  id: string;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

interface Item {
  id: string;
}

interface Props<T extends Item> {
  containers: BoardContainer[];
  itemsByContainer: Record<string, T[]>;
  renderItem: (item: T) => ReactNode;
  /** Persist a move: item dropped into `toContainer` at `toIndex`. */
  onDrop: (itemId: string, toContainer: string, toIndex: number) => void;
  className?: string;
}

export function SortableBoard<T extends Item>({
  containers,
  itemsByContainer,
  renderItem,
  onDrop,
  className,
}: Props<T>) {
  // Local ordering of ids per container; synced from props while not dragging.
  const [order, setOrder] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (activeId) return;
    const next: Record<string, string[]> = {};
    for (const c of containers) next[c.id] = (itemsByContainer[c.id] ?? []).map((i) => i.id);
    setOrder(next);
  }, [itemsByContainer, containers, activeId]);

  const itemIndex = useMemo(() => {
    const map = new Map<string, T>();
    for (const list of Object.values(itemsByContainer)) for (const it of list) map.set(it.id, it);
    return map;
  }, [itemsByContainer]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function containerOf(id: string): string | undefined {
    if (order[id]) return id; // id is a container
    return Object.keys(order).find((c) => order[c].includes(id));
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeContainer = containerOf(String(active.id));
    const overContainer = containerOf(String(over.id)) ?? String(over.id);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setOrder((prev) => {
      const activeItems = [...(prev[activeContainer] ?? [])];
      const overItems = [...(prev[overContainer] ?? [])];
      const activeIdx = activeItems.indexOf(String(active.id));
      if (activeIdx === -1) return prev;
      activeItems.splice(activeIdx, 1);
      const overIdx = overItems.indexOf(String(over.id));
      const insertAt = overIdx === -1 ? overItems.length : overIdx;
      overItems.splice(insertAt, 0, String(active.id));
      return { ...prev, [activeContainer]: activeItems, [overContainer]: overItems };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeContainer = containerOf(String(active.id));
    const overContainer = containerOf(String(over.id)) ?? String(over.id);
    if (!activeContainer || !overContainer) return;

    let toIndex: number;
    setOrder((prev) => {
      const list = [...(prev[overContainer] ?? [])];
      const oldIndex = list.indexOf(String(active.id));
      const overIdx = list.indexOf(String(over.id));
      const target = overIdx === -1 ? list.length : overIdx;
      const reordered =
        activeContainer === overContainer && oldIndex !== -1
          ? arrayMove(list, oldIndex, target)
          : list;
      toIndex = reordered.indexOf(String(active.id));
      return { ...prev, [overContainer]: reordered };
    });
    // toIndex is set synchronously inside the updater above.
    queueMicrotask(() => onDrop(String(active.id), overContainer, toIndex));
  }

  const activeItem = activeId ? itemIndex.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className={className}>
        {containers.map((c) => (
          <Container key={c.id} id={c.id} className={c.className}>
            {c.header}
            <SortableContext items={order[c.id] ?? []} strategy={verticalListSortingStrategy}>
              <div className="flex flex-1 flex-col gap-2">
                {(order[c.id] ?? []).map((id) => {
                  const item = itemIndex.get(id);
                  return item ? (
                    <SortableItem key={id} id={id}>
                      {renderItem(item)}
                    </SortableItem>
                  ) : null;
                })}
              </div>
            </SortableContext>
            {c.footer}
          </Container>
        ))}
      </div>
      <DragOverlay>{activeItem ? <div className="rotate-3">{renderItem(activeItem)}</div> : null}</DragOverlay>
    </DndContext>
  );
}

function Container({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'ring-2 ring-primary/40')}>
      {children}
    </div>
  );
}

function SortableItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
