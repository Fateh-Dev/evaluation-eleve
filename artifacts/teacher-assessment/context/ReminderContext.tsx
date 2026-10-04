import AsyncStorage from '@react-native-async-storage/async-storage';
// Import local APIs directly; the package barrel initializes remote push-token registration in Expo Go.
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppData } from '@/context/AppDataContext';

const SETTINGS_KEY = '@teacher-assessment/reminders-v1';
const NOTIFICATION_IDS_KEY = '@teacher-assessment/reminder-notification-ids-v1';
const ANDROID_CHANNEL_ID = 'teacher-class-reminders';
const REMINDER_WINDOW_DAYS = 7;
const MAX_SCHEDULED_REMINDERS = 40;

type ReminderContextValue = {
  enabled: boolean;
  minutesBefore: number;
  ready: boolean;
  available: boolean;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  setMinutesBefore: (minutes: number) => void;
};

type UpcomingReminder = {
  triggerAt: Date;
  title: string;
  body: string;
  data: Record<string, string>;
};

const ReminderContext = createContext<ReminderContextValue | null>(null);

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function assessmentDateAtStart(dateValue: string): Date | null {
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(dateValue.trim());
  const frenchMatch = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(dateValue.trim());
  let date: Date;
  if (isoMatch) {
    date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 8, 0, 0, 0);
  } else if (frenchMatch) {
    date = new Date(Number(frenchMatch[3]), Number(frenchMatch[2]) - 1, Number(frenchMatch[1]), 8, 0, 0, 0);
  } else {
    date = new Date(dateValue);
    if (!Number.isNaN(date.getTime())) date.setHours(8, 0, 0, 0);
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

function getUpcomingReminders(
  sessions: ReturnType<typeof useAppData>['scheduleSessions'],
  assessments: ReturnType<typeof useAppData>['assessments'],
  classes: ReturnType<typeof useAppData>['classes'],
  minutesBefore: number,
  now: Date,
): UpcomingReminder[] {
  const reminders: UpcomingReminder[] = [];
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + REMINDER_WINDOW_DAYS);

  for (let offset = 0; offset <= REMINDER_WINDOW_DAYS; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    const dayOfWeek = (date.getDay() + 6) % 7;
    sessions.filter((session) => session.dayOfWeek === dayOfWeek).forEach((session) => {
      const [hours, minutes] = session.startTime.split(':').map(Number);
      const startsAt = new Date(date);
      startsAt.setHours(hours, minutes, 0, 0);
      const triggerAt = new Date(startsAt.getTime() - minutesBefore * 60_000);
      if (triggerAt <= now || startsAt > cutoff) return;
      const className = classes.find((item) => item.id === session.classId)?.name ?? 'Votre classe';
      reminders.push({
        triggerAt,
        title: 'Cours à venir',
        body: `${className} · ${session.startTime}–${session.endTime}${session.room ? ` · ${session.room}` : ''}`,
        data: { kind: 'class', classId: session.classId },
      });
    });
  }

  assessments.forEach((assessment) => {
    if (assessment.status === 'Completed' || assessment.status === 'Archived') return;
    const startsAt = assessmentDateAtStart(assessment.date);
    if (!startsAt || startsAt <= now || startsAt > cutoff) return;
    const triggerAt = new Date(startsAt.getTime() - minutesBefore * 60_000);
    if (triggerAt <= now) return;
    const className = classes.find((item) => item.id === assessment.classId)?.name ?? 'Votre classe';
    reminders.push({
      triggerAt,
      title: 'Évaluation à venir',
      body: `${assessment.title} · ${className}`,
      data: { kind: 'assessment', assessmentId: assessment.id },
    });
  });

  return reminders.sort((left, right) => left.triggerAt.getTime() - right.triggerAt.getTime()).slice(0, MAX_SCHEDULED_REMINDERS);
}

export function ReminderProvider({ children }: PropsWithChildren) {
  const data = useAppData();
  const [enabled, setEnabledState] = useState(false);
  const [minutesBefore, setMinutesBeforeState] = useState(15);
  const [ready, setReady] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const scheduleGeneration = useRef(0);
  const available = Platform.OS !== 'web';

  useEffect(() => {
    void AsyncStorage.getItem(SETTINGS_KEY).then((stored) => {
      if (!stored) return;
      const settings = JSON.parse(stored) as { enabled?: unknown; minutesBefore?: unknown };
      if (typeof settings.enabled === 'boolean') setEnabledState(settings.enabled);
      if (typeof settings.minutesBefore === 'number' && [5, 10, 15, 30, 60].includes(settings.minutesBefore)) {
        setMinutesBeforeState(settings.minutesBefore);
      }
    }).catch(() => undefined).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) {
      void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ enabled, minutesBefore }));
    }
  }, [enabled, minutesBefore, ready]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRefreshVersion((version) => version + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const generation = ++scheduleGeneration.current;
    const reschedule = async () => {
      const storedIds = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
      const previousIds = storedIds ? JSON.parse(storedIds) as string[] : [];
      await Promise.all(previousIds.map((id) => cancelScheduledNotificationAsync(id).catch(() => undefined)));
      await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify([]));
      if (!enabled || !available || generation !== scheduleGeneration.current) return;

      const permission = await getPermissionsAsync();
      if (!permission.granted || generation !== scheduleGeneration.current) return;
      if (Platform.OS === 'android') {
        await setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: 'Rappels de cours et évaluations',
          importance: AndroidImportance.DEFAULT,
        });
      }

      const reminders = getUpcomingReminders(
        data.scheduleSessions,
        data.assessments,
        data.classes,
        minutesBefore,
        new Date(),
      );
      const ids: string[] = [];
      for (const reminder of reminders) {
        if (generation !== scheduleGeneration.current) break;
        const id = await scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            data: reminder.data,
            sound: false,
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: reminder.triggerAt,
            ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
          },
        });
        if (generation !== scheduleGeneration.current) {
          await cancelScheduledNotificationAsync(id).catch(() => undefined);
          break;
        }
        ids.push(id);
      }
      if (generation === scheduleGeneration.current) {
        await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(ids));
      }
    };
    void reschedule().catch(() => undefined);
    return () => { scheduleGeneration.current += 1; };
  }, [available, data.assessments, data.classes, data.scheduleSessions, enabled, minutesBefore, ready, refreshVersion]);

  const setEnabled = async (next: boolean) => {
    if (next) {
      if (!available) return false;
      try {
        let permission = await getPermissionsAsync();
        if (!permission.granted) permission = await requestPermissionsAsync();
        if (!permission.granted) return false;
      } catch {
        return false;
      }
    }
    setEnabledState(next);
    return true;
  };

  const value = useMemo<ReminderContextValue>(() => ({
    enabled,
    minutesBefore,
    ready,
    available,
    setEnabled,
    setMinutesBefore: setMinutesBeforeState,
  }), [available, enabled, minutesBefore, ready]);

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) throw new Error('useReminders must be used within ReminderProvider');
  return context;
}