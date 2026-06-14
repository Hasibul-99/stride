/** Fixed 12-color palette for projects & statuses. */
export const PROJECT_COLORS = [
  'slate',
  'red',
  'orange',
  'amber',
  'green',
  'emerald',
  'teal',
  'sky',
  'blue',
  'indigo',
  'violet',
  'pink',
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

export const WORKSPACE_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PROJECT_ROLES = ['MANAGER', 'MEMBER', 'GUEST'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RSVP_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

/** Default statuses seeded on every new project. */
export const DEFAULT_STATUSES = [
  { name: 'New', color: 'slate', isCompleted: false },
  { name: 'In progress', color: 'blue', isCompleted: false },
  { name: 'Completed', color: 'green', isCompleted: true },
] as const;

/** Default daily capacity in minutes (8h). */
export const DEFAULT_CAPACITY_MINUTES = 480;

/** Workload thresholds (minutes) for amber / red day tinting. */
export const WORKLOAD_AMBER_MINUTES = 480; // > 8h
export const WORKLOAD_RED_MINUTES = 600; // > 10h

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB
