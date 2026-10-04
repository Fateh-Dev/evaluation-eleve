import type { ScheduleSession } from '@/context/AppDataContext';

export const WEEKDAYS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getScheduleTimeline(sessions: ScheduleSession[], now: Date) {
  const dayOfWeek = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const current = sessions.find((session) => {
    if (session.dayOfWeek !== dayOfWeek) return false;
    return timeToMinutes(session.startTime) <= currentMinutes && currentMinutes < timeToMinutes(session.endTime);
  }) ?? null;

  const next = sessions
    .map((session) => {
      let dayOffset = (session.dayOfWeek - dayOfWeek + 7) % 7;
      if (dayOffset === 0 && timeToMinutes(session.startTime) <= currentMinutes) dayOffset = 7;
      return { session, dayOffset };
    })
    .sort((left, right) => left.dayOffset - right.dayOffset || timeToMinutes(left.session.startTime) - timeToMinutes(right.session.startTime))[0]?.session ?? null;

  return { current, next };
}