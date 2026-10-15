import type { ScheduleSession } from '@/context/AppDataContext';

export function createRecommendedSchedule(
  classIds: {
    lph1: string;
    lph2: string;
    tcs3: string;
    tcs5: string;
  },
  createId: (prefix: string) => string,
): ScheduleSession[] {
  const entries: Array<[
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    classId: string,
  ]> = [
    [6, '08:00', '10:00', classIds.lph1],
    [6, '10:00', '11:00', classIds.lph2],
    [0, '13:00', '14:00', classIds.lph1],
    [0, '15:00', '16:00', classIds.tcs3],
    [0, '16:00', '17:00', classIds.tcs5],
    [2, '13:00', '15:00', classIds.lph2],
    [2, '15:00', '16:00', classIds.tcs3],
    [2, '16:00', '17:00', classIds.tcs5],
    [3, '08:00', '09:00', classIds.tcs5],
    [3, '09:00', '10:00', classIds.lph1],
    [3, '10:00', '11:00', classIds.tcs3],
    [3, '11:00', '12:00', classIds.lph2],
  ];

  return entries.map(([dayOfWeek, startTime, endTime, classId]) => ({
    id: createId('schedule'),
    dayOfWeek,
    startTime,
    endTime,
    classId,
    subject: 'Français',
  }));
}
