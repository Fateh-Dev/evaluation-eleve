import { Alert } from '@/components/AppDialog';
import { AppHeader, Button, Screen, SectionTitle } from '@/components/AppShell';
import type { ScheduleSession } from '@/context/AppDataContext';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { exportSchedulePdf } from '@/services/exportService';
import { WEEKDAYS } from '@/services/schedule';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type SessionForm = Omit<ScheduleSession, 'id'>;

const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

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
  const [modalVisible, setModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteArmedSessionId, setDeleteArmedSessionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionForm>(blankForm((new Date().getDay() + 6) % 7));

  const openNewSession = () => {
    if (data.classes.length === 0) {
      Alert.alert('Aucune classe', 'Créez une classe avant de planifier une séance.');
      return;
    }
    setEditingId(null);
    setForm({ ...blankForm((new Date().getDay() + 6) % 7), classId: data.activeClassId || data.classes[0].id });
    setModalVisible(true);
  };

  const openEditSession = (session: ScheduleSession) => {
    setEditingId(session.id);
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

  const confirmDelete = (session: ScheduleSession) => {
    const className = data.classes.find((item) => item.id === session.classId)?.name ?? 'cette classe';
    Alert.alert('Supprimer la séance', `Supprimer la séance de ${className} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => data.deleteScheduleSession(session.id) },
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
    <Screen onTouchStart={() => setDeleteArmedSessionId(null)}>
      <AppHeader eyebrow="Organisation" title="Emploi du temps" onBack={() => router.back()} />
      <View style={styles.introRow}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Votre semaine de cours, organisée par jour.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter une séance"
          onPress={openNewSession}
          style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="plus" size={17} color={colors.primaryForeground} />
          <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>Séance</Text>
        </Pressable>
      </View>
      <View style={styles.exportAction}>
        <Button
          label={isExporting ? 'Préparation du PDF…' : 'Imprimer / exporter en PDF'}
          secondary
          compact
          icon="printer"
          disabled={isExporting}
          onPress={handleExportPdf}
        />
      </View>

      {WEEKDAY_ORDER.map((dayOfWeek) => {
        const day = WEEKDAYS[dayOfWeek];
        const sessions = data.scheduleSessions
          .filter((session) => session.dayOfWeek === dayOfWeek)
          .sort((left, right) => left.startTime.localeCompare(right.startTime));
        return (
          <View key={day} style={styles.daySection}>
            <SectionTitle title={day} />
            {sessions.length === 0 ? (
              <Text style={[styles.emptyDay, { color: colors.mutedForeground }]}>Aucune séance programmée</Text>
            ) : sessions.map((session) => {
              const classItem = data.classes.find((item) => item.id === session.classId);
              return (
                <View
                  key={session.id}
                  style={[
                    styles.sessionRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: deleteArmedSessionId === session.id ? colors.destructive : colors.border,
                      borderWidth: deleteArmedSessionId === session.id ? 2 : 1,
                    },
                  ]}
                >
                  <View style={[styles.timeBlock, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.timeText, { color: colors.foreground }]}>{session.startTime}</Text>
                    <View style={[styles.timeLine, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.timeText, { color: colors.foreground }]}>{session.endTime}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ouvrir la classe ${classItem?.name ?? ''}`}
                    delayLongPress={500}
                    accessibilityHint="Maintenez appuyé pour afficher l’action Supprimer."
                    onTouchStart={(event) => event.stopPropagation()}
                    onLongPress={() => setDeleteArmedSessionId(session.id)}
                    onPress={() => {
                      if (deleteArmedSessionId !== null) {
                        setDeleteArmedSessionId(session.id);
                        return;
                      }
                      if (!classItem) return;
                      data.setActiveClass(classItem.id);
                      router.push(`/classes/${classItem.id}`);
                    }}
                    style={styles.sessionInfo}
                  >
                    <Text style={[styles.className, { color: colors.foreground }]} numberOfLines={1}>{classItem?.name ?? 'Classe supprimée'}</Text>
                    <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {[session.subject, session.room, session.notes].filter(Boolean).join(' · ') || classItem?.level}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Modifier la séance"
                    onPress={() => openEditSession(session)}
                    style={styles.iconAction}
                  >
                    <Feather name="edit-2" size={16} color={colors.primary} />
                  </Pressable>
                  {deleteArmedSessionId === session.id ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer la séance"
                      onTouchStart={(event) => event.stopPropagation()}
                      onPress={() => {
                        setDeleteArmedSessionId(null);
                        confirmDelete(session);
                      }}
                      style={styles.iconAction}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </Pressable>
                  ) : null}
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
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DÉBUT · HH:MM</Text>
                  <TextInput value={form.startTime} onChangeText={(value) => updateForm('startTime', value)} placeholder="08:00" keyboardType="numbers-and-punctuation" style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
                </View>
                <View style={styles.timeField}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FIN · HH:MM</Text>
                  <TextInput value={form.endTime} onChangeText={(value) => updateForm('endTime', value)} placeholder="09:00" keyboardType="numbers-and-punctuation" style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
                </View>
              </View>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  intro: { flex: 1, fontSize: 13, lineHeight: 19 },
  exportAction: { alignItems: 'flex-start', marginTop: 8 },
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
  input: { minHeight: 44, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, fontSize: 14 },
  notesInput: { minHeight: 70, textAlignVertical: 'top', paddingTop: 10, marginBottom: 16 },
});