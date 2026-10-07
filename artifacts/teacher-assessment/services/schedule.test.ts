import {
  findScheduleOccurrenceConflict,
  getScheduleOccurrencesForDate,
} from './schedule.ts';
import type { ScheduleOccurrenceOverride, ScheduleSession } from '@/context/AppDataContext';

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: attendu ${String(expected)}, obtenu ${String(actual)}.`);
  }
}

function runScheduleOccurrenceTests() {
  const sessions: ScheduleSession[] = [
    { id: 'sunday', classId: 'class-a', dayOfWeek: 6, startTime: '09:00', endTime: '10:00' },
    { id: 'thursday', classId: 'class-a', dayOfWeek: 3, startTime: '13:00', endTime: '14:00' },
    { id: 'other-class', classId: 'class-b', dayOfWeek: 3, startTime: '10:00', endTime: '11:00' },
  ];
  const overrides: ScheduleOccurrenceOverride[] = [
    {
      id: 'rescheduled-sunday',
      sourceSessionId: 'sunday',
      originalDate: '2026-10-04',
      status: 'rescheduled',
      date: '2026-10-08',
      classId: 'class-a',
      startTime: '11:00',
      endTime: '12:00',
    },
    {
      id: 'cancelled-sunday',
      sourceSessionId: 'sunday',
      originalDate: '2026-10-11',
      status: 'cancelled',
      classId: 'class-a',
      startTime: '09:00',
      endTime: '10:00',
    },
    {
      id: 'extra-thursday',
      originalDate: '2026-10-08',
      status: 'extra',
      date: '2026-10-08',
      classId: 'class-a',
      startTime: '15:00',
      endTime: '16:00',
    },
  ];

  const thursday = getScheduleOccurrencesForDate(sessions, overrides, '2026-10-08');
  assertEqual(thursday.length, 4, 'Les créneaux habituels, reportés et ponctuels du jeudi sont affichés');
  assertEqual(thursday.some((item) => item.id === 'sunday' && item.isRescheduled), true, 'Le cours déplacé est identifié');
  assertEqual(thursday.some((item) => item.id === 'extra-thursday' && item.isExtra), true, 'Le cours ponctuel est identifié');

  const freeSlotConflict = findScheduleOccurrenceConflict(thursday, {
    classId: 'class-a',
    startTime: '11:00',
    endTime: '12:00',
    sourceSessionId: 'sunday',
  });
  assertEqual(freeSlotConflict, undefined, 'Le cours déplacé ne se bloque pas lui-même');

  const crossClassConflict = findScheduleOccurrenceConflict(thursday, {
    classId: 'class-a',
    startTime: '10:00',
    endTime: '11:00',
    sourceSessionId: 'sunday',
  });
  assertEqual(crossClassConflict, undefined, 'Une séance d’une autre classe ne bloque pas le report');

  const changedClassConflict = findScheduleOccurrenceConflict(thursday, {
    classId: 'class-b',
    startTime: '10:30',
    endTime: '11:30',
    sourceSessionId: 'sunday',
  });
  assertEqual(changedClassConflict?.id, 'other-class', 'Le changement de classe vérifie les conflits de la classe cible');

  const realConflict = findScheduleOccurrenceConflict(thursday, {
    classId: 'class-a',
    startTime: '15:30',
    endTime: '16:30',
    sourceSessionId: 'sunday',
  });
  assertEqual(realConflict?.id, 'extra-thursday', 'Un chevauchement avec une séance ponctuelle est bloqué');

  const cancelledOriginDay = getScheduleOccurrencesForDate(sessions, overrides, '2026-10-11');
  assertEqual(cancelledOriginDay.some((item) => item.id === 'sunday'), false, 'Le cours annulé est absent de ses occurrences');
}

runScheduleOccurrenceTests();
console.log('Tests de planning réussis.');
