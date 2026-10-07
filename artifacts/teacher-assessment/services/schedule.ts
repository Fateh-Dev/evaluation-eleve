import type {
  ScheduleOccurrenceOverride,
  ScheduleSession,
} from '@/context/AppDataContext';

export const WEEKDAYS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

export type ScheduleOccurrenceView = ScheduleSession & {
  occurrenceDate: string;
  originalDate: string;
  isExtra: boolean;
  isRescheduled: boolean;
};

export function getScheduleOccurrencesForDate(
  sessions: ScheduleSession[],
  overrides: ScheduleOccurrenceOverride[],
  date: string,
): ScheduleOccurrenceView[] {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = (new Date(year, month - 1, day).getDay() + 6) % 7;
  const occurrences: ScheduleOccurrenceView[] = [];

  for (const session of sessions) {
    if (session.dayOfWeek !== weekday) continue;
    const override = overrides.find(
      (item) =>
        item.status !== 'extra' &&
        item.sourceSessionId === session.id &&
        item.originalDate === date,
    );
    if (override) continue;
    occurrences.push({
      ...session,
      occurrenceDate: date,
      originalDate: date,
      isExtra: false,
      isRescheduled: false,
    });
  }

  for (const override of overrides) {
    if (override.date !== date || override.status === 'cancelled') continue;
    const source = override.sourceSessionId
      ? sessions.find((session) => session.id === override.sourceSessionId)
      : undefined;
    if (override.status === 'rescheduled' && !source) continue;
    occurrences.push({
      id: source?.id ?? override.id,
      dayOfWeek: weekday,
      startTime: override.startTime,
      endTime: override.endTime,
      classId: override.classId,
      subject: override.subject,
      room: override.room,
      notes: override.notes,
      occurrenceDate: date,
      originalDate: override.originalDate,
      isExtra: override.status === 'extra',
      isRescheduled: override.status === 'rescheduled',
    });
  }

  return occurrences.sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  );
}

export function findScheduleOccurrenceConflict(
  occurrences: ScheduleOccurrenceView[],
  input: {
    classId: string;
    startTime: string;
    endTime: string;
    sourceSessionId: string;
  },
): ScheduleOccurrenceView | undefined {
  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  return occurrences.find((occurrence) =>
    occurrence.id !== input.sourceSessionId &&
    occurrence.classId === input.classId &&
    start < timeToMinutes(occurrence.endTime) &&
    timeToMinutes(occurrence.startTime) < end,
  );
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getScheduleTimeline(
  sessions: ScheduleSession[],
  now: Date,
  overrides: ScheduleOccurrenceOverride[] = [],
) {
  const dayOfWeek = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const current = getScheduleOccurrencesForDate(sessions, overrides, today).find((session) =>
    timeToMinutes(session.startTime) <= currentMinutes &&
    currentMinutes < timeToMinutes(session.endTime),
  ) ?? null;

  const upcoming = Array.from({ length: 8 }, (_, offset) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return getScheduleOccurrencesForDate(sessions, overrides, dateValue)
      .filter((session) => {
        if (offset > 0) return true;
        return timeToMinutes(session.startTime) > currentMinutes;
      })
      .map((session) => ({ session, offset }));
  }).flat();
  const next = upcoming.sort((left, right) =>
    left.offset - right.offset ||
    timeToMinutes(left.session.startTime) - timeToMinutes(right.session.startTime),
  )[0]?.session ?? null;

  return { current, next };
}