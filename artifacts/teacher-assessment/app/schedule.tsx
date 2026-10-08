import { Alert } from '@/components/AppDialog';
import { AppHeader, Button, ListSelectionToolbar, Screen, SectionTitle, SelectionCheckbox } from '@/components/AppShell';
import type { ScheduleOccurrenceOverride, ScheduleSession } from '@/context/AppDataContext';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { exportSchedulePdf } from '@/services/exportService';
import { getScheduleOccurrencesForDate, WEEKDAYS } from '@/services/schedule';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useListSelection } from '@/hooks/useListSelection';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type SessionForm = Omit<ScheduleSession, 'id'>;

const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

const getSundayStart = (value: Date) => {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const blankForm = (dayOfWeek: number): SessionForm => ({
  dayOfWeek,
  startTime: '08:00',
  endTime: '09:00',
  classId: '',
  subject: '',
  room: '',
  notes: '',
});

export default function ScheduleScreen() {
  const colors = useColors();
  const data = useAppData();
  const selection = useListSelection();
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getSundayStart(new Date()));
  const [modalVisible, setModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTimeField, setActiveTimeField] = useState<'startTime' | 'endTime' | null>(null);
  const [form, setForm] = useState<SessionForm>(blankForm((new Date().getDay() + 6) % 7));
  const [occurrenceModalVisible, setOccurrenceModalVisible] = useState(false);
  const [occurrenceSession, setOccurrenceSession] = useState<ScheduleSession | null>(null);
  const [occurrenceIsExtra, setOccurrenceIsExtra] = useState(false);
  const [occurrenceDate, setOccurrenceDate] = useState('');
  const [rescheduledDate, setRescheduledDate] = useState('');
  const [occurrenceClassId, setOccurrenceClassId] = useState('');
  const [occurrenceStartTime, setOccurrenceStartTime] = useState('08:00');
  const [occurrenceEndTime, setOccurrenceEndTime] = useState('09:00');
  const [cancellationReason, setCancellationReason] = useState('');
  const [occurrenceMode, setOccurrenceMode] = useState<'rescheduled' | 'cancelled'>('rescheduled');
  const [occurrenceDateField, setOccurrenceDateField] = useState<'occurrence' | 'rescheduled' | null>(null);
  const [occurrenceTimeField, setOccurrenceTimeField] = useState<'start' | 'end' | null>(null);

  const localDateString = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

  const getNextOccurrenceDate = (dayOfWeek: number, time: string) => {
    const date = new Date();
    const offset = (dayOfWeek - ((date.getDay() + 6) % 7) + 7) % 7;
    date.setDate(date.getDate() + (offset === 0 && time <= `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` ? 7 : offset));
    return localDateString(date);
  };

  const openOccurrenceManager = (session: ScheduleSession, extra = false, requestedDate?: string) => {
    const today = new Date();
    const date = requestedDate ?? (extra ? localDateString(today) : getNextOccurrenceDate(session.dayOfWeek, session.startTime));
    const existing = data.scheduleOccurrenceOverrides.find(
      (item) =>
        item.sourceSessionId === session.id &&
        item.originalDate === date &&
        item.status !== 'extra',
    );
    setOccurrenceSession(session);
    setOccurrenceIsExtra(extra);
    setOccurrenceDate(date);
    setRescheduledDate(existing?.date ?? date);
    setOccurrenceClassId(existing?.classId ?? session.classId);
    setOccurrenceStartTime(existing?.startTime ?? session.startTime);
    setOccurrenceEndTime(existing?.endTime ?? session.endTime);
    setCancellationReason(existing?.cancellationReason ?? '');
    setOccurrenceMode(existing?.status === 'cancelled' ? 'cancelled' : 'rescheduled');
    setOccurrenceDateField(null);
    setOccurrenceTimeField(null);
    setOccurrenceModalVisible(true);
  };

  const openExtraSession = () => {
    const date = localDateString(selectedWeekStart);
    const baseSession = data.scheduleSessions.find((item) => item.classId === data.activeClassId) ?? data.scheduleSessions[0];
    setOccurrenceSession(baseSession ?? null);
    setOccurrenceIsExtra(true);
    setOccurrenceDate(date);
    setRescheduledDate(date);
    setOccurrenceClassId(data.activeClassId || data.classes[0]?.id || '');
    setOccurrenceStartTime('08:00');
    setOccurrenceEndTime('09:00');
    setOccurrenceMode('rescheduled');
    setOccurrenceDateField(null);
    setOccurrenceTimeField(null);
    setOccurrenceModalVisible(true);
  };

  const saveOccurrence = () => {
    if (!occurrenceClassId || !occurrenceDate) {
      Alert.alert('Informations manquantes', 'Choisissez une classe et une date pour la séance.');
      return;
    }
    if (occurrenceIsExtra) {
      const saved = data.addExtraScheduleSession({
          originalDate: occurrenceDate,
          date: occurrenceDate,
          classId: occurrenceClassId,
          startTime: occurrenceStartTime,
          endTime: occurrenceEndTime,
      });
      if (!saved) {
        Alert.alert(
          'Créneau indisponible',
          'La date ou les heures sont invalides, ou une séance de cette classe chevauche ce créneau.',
        );
        return;
      }
      setOccurrenceModalVisible(false);
      return;
    }
    if (!occurrenceSession) {
      Alert.alert('Séance introuvable', 'Le créneau hebdomadaire associé à cette séance n’existe plus.');
      return;
    }
    const saved = data.saveScheduleOccurrenceOverride({
      sourceSessionId: occurrenceSession.id,
      originalDate: occurrenceDate,
      date: rescheduledDate,
      classId: occurrenceClassId,
      startTime: occurrenceStartTime,
      endTime: occurrenceEndTime,
      subject: occurrenceSession.subject,
      room: occurrenceSession.room,
      notes: occurrenceSession.notes,
      status: occurrenceMode,
      cancellationReason: occurrenceMode === 'cancelled' ? cancellationReason.trim() || undefined : undefined,
    });
    if (!saved.success) {
      if (saved.reason === 'overlap' && saved.conflictingOccurrence) {
        const conflictingClass = data.classes.find(
          (item) => item.id === saved.conflictingOccurrence?.classId,
        );
        Alert.alert(
          'Créneau indisponible',
          `Une séance de ${conflictingClass?.name ?? 'cette classe'} (${saved.conflictingOccurrence.startTime}–${saved.conflictingOccurrence.endTime}) chevauche cet horaire.`,
        );
        return;
      }
      const errorMessages = {
        'session-not-found': 'Le créneau hebdomadaire associé à cette séance n’existe plus.',
        'invalid-original-date': 'La date d’origine ne correspond pas au jour du créneau hebdomadaire.',
        'invalid-target-date': 'La nouvelle date est invalide.',
        'invalid-class': 'Choisissez une classe existante.',
        'invalid-time': 'Saisissez des heures valides au format HH:MM.',
        'invalid-time-range': 'L’heure de fin doit être postérieure à l’heure de début.',
        overlap: 'Une autre séance chevauche ce créneau.',
      };
      Alert.alert(
        'Impossible d’enregistrer le report',
        errorMessages[saved.reason],
      );
      return;
    }
    setOccurrenceModalVisible(false);
  };

  const dateFromString = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const currentWeekStart = getSundayStart(new Date());
  const weekTabs = [-2, -1, 0, 1, 2].map((offset) => {
    const start = new Date(selectedWeekStart);
    start.setDate(start.getDate() + offset * 7);
    return start;
  });
  const shiftSelectedWeek = (offset: number) => {
    setSelectedWeekStart((week) => {
      const next = new Date(week);
      next.setDate(next.getDate() + offset * 7);
      return next;
    });
  };
  const formatWeekTab = (start: Date) => {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startMonth = start.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    const endMonth = end.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    return start.getMonth() === end.getMonth()
      ? `${start.getDate()} – ${end.getDate()} ${endMonth}`
      : `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
  };

  const updateOccurrenceDate = (field: 'occurrence' | 'rescheduled', value: string) => {
    if (field === 'occurrence') {
      setOccurrenceDate(value);
      setRescheduledDate(value);
    } else {
      setRescheduledDate(value);
    }
  };

  const openNewSession = () => {
    if (data.classes.length === 0) {
      Alert.alert('Aucune classe', 'Créez une classe avant de planifier une séance.');
      return;
    }
    setEditingId(null);
    setActiveTimeField(null);
    setForm({ ...blankForm((new Date().getDay() + 6) % 7), classId: data.activeClassId || data.classes[0].id });
    setModalVisible(true);
  };

  const openEditSession = (session: ScheduleSession) => {
    setEditingId(session.id);
    setActiveTimeField(null);
    setForm({
      dayOfWeek: session.dayOfWeek,
      startTime: session.startTime,
      endTime: session.endTime,
      classId: session.classId,
      subject: session.subject ?? '',
      room: session.room ?? '',
      notes: session.notes ?? '',
    });
    setModalVisible(true);
  };

  const saveSession = () => {
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!form.classId || !validTime.test(form.startTime) || !validTime.test(form.endTime)) {
      Alert.alert('Informations à vérifier', 'Choisissez une classe et saisissez les heures au format HH:MM.');
      return;
    }
    if (form.startTime >= form.endTime) {
      Alert.alert('Horaires invalides', 'L’heure de fin doit être postérieure à l’heure de début.');
      return;
    }

    const sessionInput = {
      ...form,
      subject: form.subject?.trim() || undefined,
      room: form.room?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };
    const saved = editingId
      ? data.updateScheduleSession(editingId, sessionInput)
      : data.addScheduleSession(sessionInput);
    if (!saved) {
      Alert.alert('Créneau indisponible', 'Une autre séance chevauche cet horaire. Choisissez un autre créneau.');
      return;
    }
    setModalVisible(false);
  };

  const deleteSelectedSessions = () => {
    const selected = data.scheduleSessions.filter((session) => selection.selectedIds.includes(session.id));
    if (selected.length === 0) return;
    Alert.alert('Supprimer les séances sélectionnées', `Supprimer ${selected.length} séance${selected.length > 1 ? 's' : ''} de l’emploi du temps ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { selected.forEach((session) => data.deleteScheduleSession(session.id)); selection.cancelSelection(); } },
    ]);
  };

  const updateForm = <K extends keyof SessionForm>(key: K, value: SessionForm[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportSchedulePdf({
        teacherName: data.teacherName,
        schoolName: data.school.name,
        city: data.school.wilaya,
        academicYear: data.academicYear,
        sessions: data.scheduleSessions.map((session) => ({
          dayOfWeek: session.dayOfWeek,
          startTime: session.startTime,
          endTime: session.endTime,
          className: data.classes.find((item) => item.id === session.classId)?.name ?? 'Classe supprimée',
          subject: session.subject,
          room: session.room,
          notes: session.notes,
        })),
      });
    } catch (error) {
      Alert.alert('Export impossible', error instanceof Error ? error.message : 'Impossible de créer le PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Screen>
      <AppHeader eyebrow="Organisation" title="Emploi du temps" onBack={() => router.back()} />
      <View style={styles.introRow}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Votre semaine de cours, organisée par jour.</Text>
        <View style={styles.addActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter une séance hebdomadaire"
            onPress={openNewSession}
            style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="plus" size={17} color={colors.primaryForeground} />
            <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>Récurrente</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter une séance ponctuelle"
            onPress={openExtraSession}
            style={({ pressed }) => [styles.addButton, { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="plus" size={17} color={colors.primary} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>Ponctuelle</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.scheduleActionsRow}>
        <View style={styles.exportAction}>
          <Button
            label={isExporting ? 'Préparation du PDF…' : 'Exporter PDF'}
            secondary
            compact
            icon="printer"
            disabled={isExporting}
            onPress={handleExportPdf}
          />
        </View>
        <ListSelectionToolbar
          style={styles.scheduleSelectionToolbar}
          active={selection.isSelecting}
          selectedCount={selection.selectedIds.length}
          onStart={() => selection.startSelecting()}
          onCancel={selection.cancelSelection}
          onDelete={deleteSelectedSessions}
        />
      </View>
      <View style={[styles.weekNavigator, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Afficher la semaine précédente"
          onPress={() => shiftSelectedWeek(-1)}
          style={styles.weekArrow}
        >
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekTabs}
        >
          {weekTabs.map((weekStart) => {
            const selected = weekStart.getTime() === selectedWeekStart.getTime();
            return (
              <Pressable
                key={localDateString(weekStart)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`Semaine du ${formatWeekTab(weekStart)}`}
                onPress={() => setSelectedWeekStart(weekStart)}
                style={[
                  styles.weekTab,
                  {
                    borderBottomColor: selected ? colors.primary : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.weekTabText, { color: selected ? colors.primary : colors.foreground }]}>
                  {formatWeekTab(weekStart)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Afficher la semaine suivante"
          onPress={() => shiftSelectedWeek(1)}
          style={styles.weekArrow}
        >
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </Pressable>
      </View>
      {selectedWeekStart.getTime() !== currentWeekStart.getTime() ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedWeekStart(currentWeekStart)}
          style={styles.currentWeekAction}
        >
          <Feather name="corner-up-left" size={14} color={colors.primary} />
          <Text style={[styles.currentWeekText, { color: colors.primary }]}>Revenir à cette semaine</Text>
        </Pressable>
      ) : null}
      {WEEKDAY_ORDER.map((dayOfWeek) => {
        const day = WEEKDAYS[dayOfWeek];
        const date = new Date(selectedWeekStart);
        date.setDate(selectedWeekStart.getDate() + ((dayOfWeek + 1) % 7));
        const dateValue = localDateString(date);
        const dateLabel = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        const isToday = dateValue === localDateString(new Date());
        const daySessions = getScheduleOccurrencesForDate(
          data.scheduleSessions,
          data.scheduleOccurrenceOverrides,
          dateValue,
        ).map((session) => ({
          session,
          cancelled: false,
          cancelledLabel: undefined as string | undefined,
          overrideId: undefined as string | undefined,
        }));
        const cancelledSessions = data.scheduleOccurrenceOverrides
          .filter((item) => item.status !== 'extra' && item.originalDate === dateValue)
          .map((item) => {
            const source = data.scheduleSessions.find((session) => session.id === item.sourceSessionId);
            return {
              session: {
                id: item.sourceSessionId ?? item.id,
                dayOfWeek,
                startTime: source?.startTime ?? item.startTime,
                endTime: source?.endTime ?? item.endTime,
                classId: source?.classId ?? item.classId,
                subject: source?.subject ?? item.subject,
                room: source?.room ?? item.room,
                notes: source?.notes ?? item.notes,
                occurrenceDate: dateValue,
                originalDate: dateValue,
                isExtra: false,
                isRescheduled: false,
              },
              cancelled: true,
              cancelledLabel: item.status === 'rescheduled' ? 'Séance reportée' : 'Séance annulée',
              overrideId: item.id,
            };
          });
        const sessions = [...daySessions, ...cancelledSessions]
          .sort((left, right) => left.session.startTime.localeCompare(right.session.startTime));
        return (
          <View key={day} style={styles.daySection}>
            <SectionTitle title={`${day} · ${dateLabel}${isToday ? ' · Aujourd’hui' : ''}`} />
            {sessions.length === 0 ? (
              <Text style={[styles.emptyDay, { color: colors.mutedForeground }]}>Aucune séance cette semaine</Text>
            ) : sessions.map(({ session, cancelled, cancelledLabel, overrideId }) => {
              const classItem = data.classes.find((item) => item.id === session.classId);
              const isPunctualStyle = session.isExtra || session.isRescheduled;
              const hasOccurrenceOverride = data.scheduleOccurrenceOverrides.some(
                (item) =>
                  item.status !== 'extra' &&
                  item.sourceSessionId === session.id &&
                  item.originalDate === session.originalDate,
              );
              const canSelect = !cancelled && !session.isExtra;
              return (
                <View
                  key={`${cancelled ? 'cancelled' : session.isExtra ? 'extra' : 'session'}-${session.id}-${session.originalDate}`}
                  style={[
                    styles.sessionRow,
                    {
                      backgroundColor: cancelled
                        ? colors.muted
                        : isPunctualStyle
                          ? colors.accent
                          : colors.card,
                      borderColor: selection.selectedIds.includes(session.id)
                        ? colors.destructive
                        : isPunctualStyle
                          ? colors.primary
                          : colors.border,
                      borderWidth: selection.selectedIds.includes(session.id) ? 2 : 1,
                      opacity: cancelled ? 0.78 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.timeBlock,
                      { backgroundColor: cancelled || isPunctualStyle ? colors.background : colors.accent },
                    ]}
                  >
                    <Text style={[styles.timeText, { color: cancelled ? colors.mutedForeground : colors.foreground }]}>{session.startTime}</Text>
                    <View style={[styles.timeLine, { backgroundColor: cancelled ? colors.mutedForeground : colors.primary }]} />
                    <Text style={[styles.timeText, { color: cancelled ? colors.mutedForeground : colors.foreground }]}>{session.endTime}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={cancelled
                      ? `Séance annulée : ${classItem?.name ?? ''}`
                      : `Ouvrir la classe ${classItem?.name ?? ''}`}
                    disabled={cancelled}
                    delayLongPress={500}
                    accessibilityHint={canSelect && selection.isSelecting ? 'Touchez pour sélectionner cette séance.' : undefined}
                    onTouchStart={(event) => event.stopPropagation()}
                    onPress={() => {
                      if (canSelect && selection.isSelecting) {
                        selection.toggleSelection(session.id);
                        return;
                      }
                      if (!classItem) return;
                      data.setActiveClass(classItem.id);
                      router.push({
                        pathname: '/classes/[classId]',
                        params: {
                          classId: classItem.id,
                          sessionId: session.id,
                          attendanceDate: session.occurrenceDate,
                        },
                      });
                    }}
                    style={styles.sessionInfo}
                  >
                    <Text style={[styles.className, { color: cancelled ? colors.mutedForeground : colors.foreground }]} numberOfLines={1}>
                      {classItem?.name ?? 'Classe supprimée'}
                    </Text>
                    <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {cancelled
                        ? [cancelledLabel, data.scheduleOccurrenceOverrides.find((item) => item.id === overrideId)?.cancellationReason]
                            .filter(Boolean)
                            .join(' · ')
                        : [
                            session.subject,
                            session.room,
                            session.notes,
                            session.isExtra ? 'Séance ponctuelle' : session.isRescheduled ? 'Séance reportée' : undefined,
                          ]
                            .filter(Boolean)
                            .join(' · ') || classItem?.level}
                    </Text>
                  </Pressable>
                  {cancelled ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Rétablir cette séance"
                      onPress={() => overrideId && data.deleteScheduleOccurrenceOverride(overrideId)}
                      style={styles.iconAction}
                    >
                      <Feather name="rotate-ccw" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  ) : session.isExtra ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer la séance ponctuelle"
                      onPress={() => data.deleteScheduleOccurrenceOverride(session.id)}
                      style={styles.iconAction}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </Pressable>
                  ) : selection.isSelecting ? (
                    <SelectionCheckbox checked={selection.selectedIds.includes(session.id)} />
                  ) : (
                    <View style={styles.sessionActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Gérer la séance du ${dateLabel} pour ${classItem?.name ?? ''}`}
                        onPress={() => openOccurrenceManager(session, false, session.originalDate)}
                        style={[styles.iconAction, { backgroundColor: colors.accent }]}
                      >
                        <Feather name="calendar" size={16} color={colors.primary} />
                      </Pressable>
                      {!hasOccurrenceOverride ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Modifier le créneau hebdomadaire"
                          onPress={() => openEditSession(session)}
                          style={styles.iconAction}
                        >
                          <Feather name="edit-2" size={16} color={colors.primary} />
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingId ? 'Modifier la séance' : 'Nouvelle séance'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setModalVisible(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <KeyboardAwareScrollViewCompat bottomOffset={80} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>JOUR</Text>
              <View style={styles.choiceWrap}>
                {WEEKDAY_ORDER.map((dayOfWeek) => {
                  const day = WEEKDAYS[dayOfWeek];
                  const selected = form.dayOfWeek === dayOfWeek;
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => updateForm('dayOfWeek', dayOfWeek)}
                      style={[styles.choice, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
                    >
                      <Text style={[styles.choiceText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{day.slice(0, 3)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CLASSE OU GROUPE</Text>
              <View style={styles.choiceWrap}>
                {data.classes.map((classItem) => {
                  const selected = form.classId === classItem.id;
                  return (
                    <Pressable
                      key={classItem.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => updateForm('classId', classItem.id)}
                      style={[styles.choice, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}
                    >
                      <Text style={[styles.choiceText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{classItem.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.timeFields}>
                <View style={styles.timeField}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DÉBUT</Text>
                  {Platform.OS === 'web' ? (
                    React.createElement('input', {
                      type: 'time',
                      'aria-label': 'Heure de début',
                      value: form.startTime,
                      onChange: (event: { currentTarget: { value: string } }) => updateForm('startTime', event.currentTarget.value),
                      style: { height: 44, padding: '0 12px', borderWidth: 1, borderStyle: 'solid', borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, color: colors.foreground, fontSize: 14 },
                    })
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Heure de début : ${form.startTime}`}
                      onPress={() => setActiveTimeField('startTime')}
                      style={[styles.timePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Feather name="clock" size={15} color={colors.primary} />
                      <Text style={[styles.timePickerText, { color: colors.foreground }]}>{form.startTime}</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.timeField}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FIN</Text>
                  {Platform.OS === 'web' ? (
                    React.createElement('input', {
                      type: 'time',
                      'aria-label': 'Heure de fin',
                      value: form.endTime,
                      onChange: (event: { currentTarget: { value: string } }) => updateForm('endTime', event.currentTarget.value),
                      style: { height: 44, padding: '0 12px', borderWidth: 1, borderStyle: 'solid', borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, color: colors.foreground, fontSize: 14 },
                    })
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Heure de fin : ${form.endTime}`}
                      onPress={() => setActiveTimeField('endTime')}
                      style={[styles.timePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Feather name="clock" size={15} color={colors.primary} />
                      <Text style={[styles.timePickerText, { color: colors.foreground }]}>{form.endTime}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {activeTimeField ? (
                <View style={[styles.timePickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <DateTimePicker
                    value={(() => {
                      const [hours, minutes] = form[activeTimeField].split(':').map(Number);
                      const value = new Date();
                      value.setHours(hours, minutes, 0, 0);
                      return value;
                    })()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={(_, selectedTime) => {
                      updateForm(
                        activeTimeField,
                        `${String(selectedTime.getHours()).padStart(2, '0')}:${String(selectedTime.getMinutes()).padStart(2, '0')}`,
                      );
                      if (Platform.OS !== 'ios') setActiveTimeField(null);
                    }}
                    onDismiss={() => setActiveTimeField(null)}
                  />
                  {Platform.OS === 'ios' ? (
                    <Pressable accessibilityRole="button" onPress={() => setActiveTimeField(null)} style={styles.pickerDone}>
                      <Text style={[styles.pickerDoneText, { color: colors.primary }]}>Terminé</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MATIÈRE · FACULTATIF</Text>
              <TextInput value={form.subject} onChangeText={(value) => updateForm('subject', value)} placeholder="Français" style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SALLE · FACULTATIF</Text>
              <TextInput value={form.room} onChangeText={(value) => updateForm('room', value)} placeholder="Salle 12" style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>INFORMATIONS COMPLÉMENTAIRES</Text>
              <TextInput value={form.notes} onChangeText={(value) => updateForm('notes', value)} placeholder="Groupe, remarque…" style={[styles.input, styles.notesInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} multiline />
              <Button label={editingId ? 'Enregistrer les modifications' : 'Ajouter la séance'} icon="check" onPress={saveSession} />
            </KeyboardAwareScrollViewCompat>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={occurrenceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOccurrenceModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOccurrenceModalVisible(false)} />
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {occurrenceIsExtra ? 'Séance ponctuelle' : 'Gérer une séance'}
                </Text>
                <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                  {occurrenceSession?.subject || 'Séance de classe'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={() => setOccurrenceModalVisible(false)}
                hitSlop={10}
              >
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <KeyboardAwareScrollViewCompat
              bottomOffset={80}
              contentContainerStyle={styles.occurrenceFormContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!occurrenceIsExtra ? (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ACTION POUR CETTE DATE</Text>
                  <View style={styles.choiceWrap}>
                    {(['rescheduled', 'cancelled'] as const).map((mode) => {
                      const selected = occurrenceMode === mode;
                      return (
                        <Pressable
                          key={mode}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setOccurrenceMode(mode)}
                          style={[
                            styles.choice,
                            {
                              backgroundColor: selected ? colors.primary : colors.card,
                              borderColor: selected ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text style={[styles.choiceText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                            {mode === 'rescheduled' ? 'Modifier / reporter' : 'Annuler'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {data.scheduleOccurrenceOverrides.some(
                    (item) =>
                      item.sourceSessionId === occurrenceSession?.id &&
                      item.originalDate === occurrenceDate &&
                      item.status !== 'extra',
                  ) ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const existing = data.scheduleOccurrenceOverrides.find(
                          (item) =>
                            item.sourceSessionId === occurrenceSession?.id &&
                            item.originalDate === occurrenceDate &&
                            item.status !== 'extra',
                        );
                        if (existing) data.deleteScheduleOccurrenceOverride(existing.id);
                        setOccurrenceModalVisible(false);
                      }}
                      style={[styles.restoreButton, { borderColor: colors.border }]}
                    >
                      <Feather name="rotate-ccw" size={16} color={colors.primary} />
                      <Text style={[styles.restoreButtonText, { color: colors.primary }]}>Rétablir le créneau habituel</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}

              {!occurrenceIsExtra && occurrenceMode === 'cancelled' ? (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MOTIF D’ANNULATION · FACULTATIF</Text>
                  <TextInput
                    value={cancellationReason}
                    onChangeText={setCancellationReason}
                    placeholder="Indiquez la raison de l’annulation"
                    accessibilityLabel="Motif d’annulation"
                    style={[
                      styles.input,
                      styles.cancellationReasonInput,
                      { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                    ]}
                    multiline
                    maxLength={240}
                    textAlignVertical="top"
                  />
                </>
              ) : null}

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                {occurrenceIsExtra ? 'DATE DE LA SÉANCE' : 'DATE DU CRÉNEAU HABITUEL'}
              </Text>
              {Platform.OS === 'web' ? (
                React.createElement('input', {
                  type: 'date',
                  'aria-label': occurrenceIsExtra ? 'Date de la séance' : 'Date du créneau habituel',
                  value: occurrenceDate,
                  onChange: (event: { currentTarget: { value: string } }) => updateOccurrenceDate('occurrence', event.currentTarget.value),
                  style: {
                    height: 44,
                    padding: '0 12px',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: colors.border,
                    borderRadius: 10,
                    backgroundColor: colors.card,
                    color: colors.foreground,
                    fontSize: 14,
                    width: '100%',
                    boxSizing: 'border-box',
                  },
                })
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Date du créneau : ${occurrenceDate}`}
                  onPress={() => setOccurrenceDateField(occurrenceDateField === 'occurrence' ? null : 'occurrence')}
                  style={[styles.timePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Feather name="calendar" size={15} color={colors.primary} />
                  <Text style={[styles.timePickerText, { color: colors.foreground }]}>
                    {dateFromString(occurrenceDate).toLocaleDateString('fr-FR')}
                  </Text>
                </Pressable>
              )}
              {occurrenceDateField === 'occurrence' ? (
                <View style={[styles.timePickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <DateTimePicker
                    value={dateFromString(occurrenceDate)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={(_, selectedDate) => {
                      updateOccurrenceDate('occurrence', localDateString(selectedDate));
                      if (Platform.OS !== 'ios') setOccurrenceDateField(null);
                    }}
                    onDismiss={() => setOccurrenceDateField(null)}
                  />
                  {Platform.OS === 'ios' ? (
                    <Pressable accessibilityRole="button" onPress={() => setOccurrenceDateField(null)} style={styles.pickerDone}>
                      <Text style={[styles.pickerDoneText, { color: colors.primary }]}>Terminé</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {occurrenceMode !== 'cancelled' || occurrenceIsExtra ? (
                <>
                  {!occurrenceIsExtra ? (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>NOUVELLE DATE (FACULTATIF)</Text>
                      {Platform.OS === 'web' ? (
                        React.createElement('input', {
                          type: 'date',
                          'aria-label': 'Nouvelle date de la séance',
                          value: rescheduledDate,
                          onChange: (event: { currentTarget: { value: string } }) =>
                            updateOccurrenceDate('rescheduled', event.currentTarget.value),
                          style: {
                            height: 44,
                            padding: '0 12px',
                            borderWidth: 1,
                            borderStyle: 'solid',
                            borderColor: colors.border,
                            borderRadius: 10,
                            backgroundColor: colors.card,
                            color: colors.foreground,
                            fontSize: 14,
                            width: '100%',
                            boxSizing: 'border-box',
                          },
                        })
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Nouvelle date : ${rescheduledDate}`}
                          onPress={() => setOccurrenceDateField(occurrenceDateField === 'rescheduled' ? null : 'rescheduled')}
                          style={[styles.timePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                        >
                          <Feather name="calendar" size={15} color={colors.primary} />
                          <Text style={[styles.timePickerText, { color: colors.foreground }]}>
                            {dateFromString(rescheduledDate).toLocaleDateString('fr-FR')}
                          </Text>
                        </Pressable>
                      )}
                      {occurrenceDateField === 'rescheduled' ? (
                        <View style={[styles.timePickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <DateTimePicker
                            value={dateFromString(rescheduledDate)}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onValueChange={(_, selectedDate) => {
                              updateOccurrenceDate('rescheduled', localDateString(selectedDate));
                              if (Platform.OS !== 'ios') setOccurrenceDateField(null);
                            }}
                            onDismiss={() => setOccurrenceDateField(null)}
                          />
                          {Platform.OS === 'ios' ? (
                            <Pressable accessibilityRole="button" onPress={() => setOccurrenceDateField(null)} style={styles.pickerDone}>
                              <Text style={[styles.pickerDoneText, { color: colors.primary }]}>Terminé</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </>
                  ) : null}
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CLASSE</Text>
                  <View style={styles.occurrenceChoiceWrap}>
                    {data.classes.map((classItem) => {
                      const selected = occurrenceClassId === classItem.id;
                      return (
                        <Pressable
                          key={classItem.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setOccurrenceClassId(classItem.id)}
                          style={[
                            styles.choice,
                            {
                              backgroundColor: selected ? colors.primary : colors.card,
                              borderColor: selected ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text style={[styles.choiceText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                            {classItem.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.timeFields}>
                    {([
                      ['start', 'DÉBUT', occurrenceStartTime, setOccurrenceStartTime],
                      ['end', 'FIN', occurrenceEndTime, setOccurrenceEndTime],
                    ] as const).map(([field, label, value, setValue]) => (
                      <View key={field} style={styles.timeField}>
                        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                        {Platform.OS === 'web' ? (
                          React.createElement('input', {
                            type: 'time',
                            'aria-label': label === 'DÉBUT' ? 'Heure de début' : 'Heure de fin',
                            value,
                            onChange: (event: { currentTarget: { value: string } }) => setValue(event.currentTarget.value),
                            style: {
                              height: 44,
                              padding: '0 12px',
                              borderWidth: 1,
                              borderStyle: 'solid',
                              borderColor: colors.border,
                              borderRadius: 10,
                              backgroundColor: colors.card,
                              color: colors.foreground,
                              fontSize: 14,
                              width: '100%',
                              boxSizing: 'border-box',
                            },
                          })
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${label === 'DÉBUT' ? 'Début' : 'Fin'} : ${value}`}
                            onPress={() => setOccurrenceTimeField(occurrenceTimeField === field ? null : field)}
                            style={[styles.timePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                          >
                            <Feather name="clock" size={15} color={colors.primary} />
                            <Text style={[styles.timePickerText, { color: colors.foreground }]}>{value}</Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                  {occurrenceTimeField ? (
                    <View style={[styles.timePickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <DateTimePicker
                        value={(() => {
                          const [hours, minutes] = (occurrenceTimeField === 'start' ? occurrenceStartTime : occurrenceEndTime).split(':').map(Number);
                          const value = new Date();
                          value.setHours(hours, minutes, 0, 0);
                          return value;
                        })()}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onValueChange={(_, selectedTime) => {
                          const value = `${String(selectedTime.getHours()).padStart(2, '0')}:${String(selectedTime.getMinutes()).padStart(2, '0')}`;
                          if (occurrenceTimeField === 'start') setOccurrenceStartTime(value);
                          else setOccurrenceEndTime(value);
                          if (Platform.OS !== 'ios') setOccurrenceTimeField(null);
                        }}
                        onDismiss={() => setOccurrenceTimeField(null)}
                      />
                      {Platform.OS === 'ios' ? (
                        <Pressable accessibilityRole="button" onPress={() => setOccurrenceTimeField(null)} style={styles.pickerDone}>
                          <Text style={[styles.pickerDoneText, { color: colors.primary }]}>Terminé</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : null}
              <View style={styles.occurrenceSubmitAction}>
                <Button
                  label={occurrenceMode === 'cancelled' && !occurrenceIsExtra ? 'Annuler cette séance' : 'Enregistrer'}
                  icon={occurrenceMode === 'cancelled' && !occurrenceIsExtra ? 'slash' : 'check'}
                  onPress={saveOccurrence}
                />
              </View>
            </KeyboardAwareScrollViewCompat>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  addActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  intro: { flex: 1, fontSize: 13, lineHeight: 19 },
  scheduleActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  exportAction: { flex: 1, alignItems: 'flex-start' },
  scheduleSelectionToolbar: { flex: 1, marginTop: 0, marginBottom: 0 },
  weekNavigator: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, marginTop: 14, marginHorizontal: -20 },
  weekArrow: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
  weekTabs: { flexGrow: 1, alignItems: 'center', gap: 12 },
  weekTab: { minHeight: 52, borderBottomWidth: 2, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  weekTabText: { fontSize: 13, fontWeight: '700' },
  currentWeekAction: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 5, paddingVertical: 8, paddingHorizontal: 4 },
  currentWeekText: { fontSize: 12, fontWeight: '700' },
  addButton: { minHeight: 40, borderRadius: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addButtonText: { fontSize: 13, fontWeight: '700' },
  daySection: { marginBottom: 6 },
  emptyDay: { paddingVertical: 12, fontSize: 13 },
  sessionRow: { minHeight: 78, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  timeBlock: { width: 68, height: 58, borderRadius: 9, alignItems: 'center', justifyContent: 'center', gap: 2 },
  timeText: { fontSize: 11, fontWeight: '700' },
  timeLine: { width: 22, height: 1 },
  sessionInfo: { flex: 1, minWidth: 0, gap: 4 },
  className: { fontSize: 14, fontWeight: '700' },
  sessionMeta: { fontSize: 11, lineHeight: 15 },
  iconAction: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  sessionActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  restoreButton: { minHeight: 40, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  restoreButtonText: { fontSize: 13, fontWeight: '700' },
  occurrenceFormContent: { paddingBottom: 16 },
  occurrenceChoiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  occurrenceSubmitAction: { marginTop: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10, 15, 25, 0.45)' },
  modalCard: { maxHeight: '92%', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 26 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle: { fontSize: 19, fontWeight: '700' },
  fieldLabel: { fontSize: 10, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 36, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontSize: 12, fontWeight: '700' },
  timeFields: { flexDirection: 'row', gap: 10 },
  timeField: { flex: 1 },
  timePickerButton: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  timePickerText: { fontSize: 14, fontWeight: '600' },
  timePickerContainer: { alignItems: 'center', borderWidth: 1, borderRadius: 10, marginTop: 10, padding: 8 },
  pickerDone: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 7 },
  pickerDoneText: { fontSize: 14, fontWeight: '700' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, fontSize: 14 },
  cancellationReasonInput: { minHeight: 76, paddingTop: 10, marginBottom: 6 },
  notesInput: { minHeight: 70, textAlignVertical: 'top', paddingTop: 10, marginBottom: 16 },
});