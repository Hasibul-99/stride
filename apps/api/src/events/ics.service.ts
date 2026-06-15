import { Injectable } from '@nestjs/common';
import * as ics from 'ics';

export interface IcsEvent {
  uid: string;
  sequence: number;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: Date;
  endAt: Date;
  organizerName: string;
  organizerEmail: string;
  attendees: { name?: string; email: string }[];
  method: 'REQUEST' | 'CANCEL';
}

function toArray(d: Date): ics.DateArray {
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

@Injectable()
export class IcsService {
  /** Build an ICS string with the given METHOD + sequence for invite/update/cancel. */
  build(event: IcsEvent): string {
    const { error, value } = ics.createEvent({
      uid: event.uid,
      sequence: event.sequence,
      start: toArray(event.startAt),
      startInputType: 'utc',
      end: toArray(event.endAt),
      endInputType: 'utc',
      title: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      status: event.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED',
      method: event.method,
      organizer: { name: event.organizerName, email: event.organizerEmail },
      attendees: event.attendees.map((a) => ({
        name: a.name ?? a.email,
        email: a.email,
        rsvp: true,
        partstat: 'NEEDS-ACTION',
        role: 'REQ-PARTICIPANT',
      })),
    });
    if (error || !value) {
      throw new Error(`Failed to build ICS: ${error?.message ?? 'unknown'}`);
    }
    return value;
  }
}
