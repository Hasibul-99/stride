/**
 * Test data factories. Each returns a valid, API-shaped object with sensible
 * defaults; pass a partial to override any field. Shapes mirror the web feature
 * types (which mirror the API responses) — never hand-roll shapes in tests.
 */
import type { AuthUser } from '@teamboard/shared';
import type { Project } from '@/features/workspaces/api';
import type { Task, TaskStatus } from '@/features/tasks/api';
import type { CalEvent } from '@/features/events/api';

let seq = 0;
const id = (p: string) => `${p}_${(seq += 1).toString().padStart(4, '0')}`;

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: id('user'),
    email: 'test@teamboard.local',
    name: 'Test User',
    avatarUrl: null,
    timezone: 'America/New_York',
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: id('proj'),
    workspaceId: 'ws_0001',
    folderId: null,
    name: 'Test Project',
    color: 'blue',
    description: null,
    position: 1000,
    archivedAt: null,
    ...overrides,
  };
}

export function makeStatus(overrides: Partial<TaskStatus> = {}): TaskStatus {
  return {
    id: id('status'),
    projectId: 'proj_0001',
    name: 'New',
    color: 'slate',
    position: 1000,
    isDefault: true,
    isCompleted: false,
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: id('task'),
    projectId: 'proj_0001',
    title: 'Test task',
    description: null,
    statusId: 'status_0001',
    assigneeId: null,
    scheduledDate: null,
    position: 1000,
    timeEstimateMinutes: null,
    completedAt: null,
    recurrenceId: null,
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<CalEvent> = {}): CalEvent {
  const start = '2026-06-15T10:00:00.000Z';
  const end = '2026-06-15T11:00:00.000Z';
  return {
    id: id('event'),
    projectId: 'proj_0001',
    title: 'Test event',
    description: null,
    startAt: start,
    endAt: end,
    allDay: false,
    location: null,
    color: 'blue',
    reminderMinutesBefore: null,
    recurrenceId: null,
    googleEventId: null,
    participants: [],
    ...overrides,
  };
}
