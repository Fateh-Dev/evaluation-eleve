import { Alert } from '@/components/AppDialog';
import { AppHeader, Button, Screen, Surface } from '@/components/AppShell';
import { useAppData, type AttendanceStatus } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { exportDailyAttendancePdf } from '@/services/exportService';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  return parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day;
};

const dateValue = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDateValue = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

export default function ClassAttendanceScreen() {
  const colors = useColors();
  const data = useAppData();
  const params = useLocalSearchParams<{ classId: string; sessionId?: string; date?: string }>();
  const currentClass = data.classes.find((item) => item.id === params.classId);
  const [selectedSessionId, setSelectedSessionId] = useState(params.sessionId ?? '');
  const pupils = useMemo(
    () => data.getPupilsForClass(params.classId),
    [data.pupils, params.classId],
  );
  const [date, setDate] = useState(
    params.date && isValidDate(params.date) ? params.date : getLocalDate(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const weekday = isValidDate(date)
    ? (new Date(`${date}T00:00:00`).getDay() + 6) % 7
    : -1;
  const sessionsForDate = useMemo(
    () => data.scheduleSessions
      .filter((item) => item.classId === params.classId && item.dayOfWeek === weekday)
      .sort((left, right) => left.startTime.localeCompare(right.startTime)),
    [data.scheduleSessions, params.classId, weekday],
  );
  const session = sessionsForDate.find((item) => item.id === selectedSessionId) ?? sessionsForDate[0];
  const sessionId = session?.id;
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [isExporting, setIsExporting] = useState(false);
  const existingRecord = data.getAttendanceRecord(params.classId, sessionId, date);

  useEffect(() => {
    if (sessionId && sessionId !== selectedSessionId) setSelectedSessionId(sessionId);
  }, [sessionId, selectedSessionId]);

  useEffect(() => {
    setStatuses(existingRecord?.statuses ?? {});
  }, [params.classId, sessionId, date, data.attendanceRecords]);

  if (!currentClass) {
    return (
      <Screen>
        <AppHeader eyebrow="Présences" title="Classe introuvable" onBack={() => router.back()} />
        <Button label="Retour" icon="arrow-left" onPress={() => router.back()} />
      </Screen>
    );
  }

  const markedCount = pupils.filter((pupil) => statuses[pupil.id] === 'present' || statuses[pupil.id] === 'absent').length;
  const presentCount = pupils.filter((pupil) => statuses[pupil.id] === 'present').length;
  const absentCount = markedCount - presentCount;

  const save = () => {
    if (!isValidDate(date)) {
      Alert.alert('Date invalide', 'Saisissez une date au format AAAA-MM-JJ.');
      return;
    }
    if (date > getLocalDate()) {
      Alert.alert('Date future', 'L’appel ne peut être enregistré que pour aujourd’hui ou une date passée.');
      return;
    }
    if (pupils.length === 0) {
      Alert.alert('Aucun élève', 'Ajoutez les élèves de la classe avant de faire l’appel.');
      return;
    }
    if (!session) {
      Alert.alert('Séance non programmée', 'Choisissez une date avec une séance programmée pour cette classe dans l’emploi du temps.');
      return;
    }
    if (markedCount !== pupils.length) {
      Alert.alert('Appel incomplet', `Indiquez présent ou absent pour chaque élève (${markedCount}/${pupils.length} renseignés).`);
      return;
    }
    const isUpdate = Boolean(existingRecord);
    const wasSaved = data.saveAttendanceRecord({
      classId: currentClass.id,
      sessionId: session.id,
      date,
      startTime: session?.startTime,
      endTime: session?.endTime,
      subject: session?.subject,
      room: session?.room,
      statuses,
    });
    if (!wasSaved) {
      Alert.alert('Enregistrement impossible', 'Vérifiez la classe, la date et le statut de chaque élève.');
      return;
    }
    Alert.alert(
      isUpdate ? 'Appel mis à jour' : 'Appel enregistré',
      isUpdate
        ? 'Les présences de cette séance ont été mises à jour.'
        : 'Les présences de cette séance sont sauvegardées indépendamment des évaluations.',
    );
  };

  const markAllPresent = () => {
    setStatuses(Object.fromEntries(pupils.map((pupil) => [pupil.id, 'present' as const])));
  };

  const exportDailyAttendance = async () => {
    if (!session) {
      Alert.alert('Séance requise', 'Choisissez une séance programmée avant d’exporter l’appel.');
      return;
    }
    if (!isValidDate(date)) {
      Alert.alert('Date invalide', 'Saisissez une date au format AAAA-MM-JJ.');
      return;
    }
    setIsExporting(true);
    try {
      await exportDailyAttendancePdf({
        schoolName: data.school.name,
        teacherName: data.teacherName,
        className: currentClass.name,
        level: currentClass.level,
        academicYear: currentClass.academicYear,
        date: new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR'),
        session: {
          startTime: session.startTime,
          endTime: session.endTime,
          subject: session.subject,
          room: session.room,
        },
        pupils: pupils.map((pupil) => ({
          registrationNumber: pupil.registrationNumber,
          firstName: pupil.firstName,
          lastName: pupil.lastName,
          status: statuses[pupil.id],
        })),
      });
    } catch (error) {
      Alert.alert('Export impossible', error instanceof Error ? error.message : 'Impossible de générer le PDF de l’appel.');
    } finally {
      setIsExporting(false);
    }
  };

  const formattedDate = isValidDate(date)
    ? new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <Screen>
      <AppHeader eyebrow="Présences de la classe" title={currentClass.name} onBack={() => router.back()} compact />
      <Surface style={[styles.sessionCard, { borderColor: colors.border }]}>
        <View style={[styles.sessionIcon, { backgroundColor: colors.accent }]}>
          <Feather name="calendar" size={18} color={colors.primary} />
        </View>
        <View style={styles.sessionCopy}>
          <Text style={[styles.sessionTitle, { color: colors.foreground }]}>
            {session ? [session.subject, session.room].filter(Boolean).join(' · ') || 'Séance programmée' : 'Choisissez une séance programmée'}
          </Text>
          <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
            {session ? `${session.startTime}–${session.endTime} · ` : ''}{formattedDate}
          </Text>
        </View>
      </Surface>

      <View style={styles.dateRow}>
        <View style={styles.dateInputGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DATE DE L’APPEL</Text>
          {Platform.OS === 'web' ? (
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="AAAA-MM-JJ"
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Date de l’appel"
              style={[styles.dateInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Date de l’appel : ${formattedDate || date}`}
              onPress={() => setShowDatePicker(true)}
              style={[styles.datePickerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Feather name="calendar" size={16} color={colors.primary} />
              <Text style={[styles.datePickerText, { color: colors.foreground }]}>{formattedDate || date}</Text>
            </Pressable>
          )}
        </View>
      </View>
      {showDatePicker && Platform.OS !== 'web' ? (
        <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DateTimePicker
            value={isValidDate(date) ? dateValue(date) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={dateValue(getLocalDate())}
            onValueChange={(_, selectedDate) => {
              setDate(formatDateValue(selectedDate));
              if (Platform.OS !== 'ios') setShowDatePicker(false);
            }}
            onDismiss={() => setShowDatePicker(false)}
          />
          {Platform.OS === 'ios' ? (
            <Pressable accessibilityRole="button" onPress={() => setShowDatePicker(false)} style={styles.pickerDone}>
              <Text style={[styles.pickerDoneText, { color: colors.primary }]}>Terminé</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.fieldLabel, styles.sessionLabel, { color: colors.mutedForeground }]}>
        SÉANCE PROGRAMMÉE · {formattedDate || 'DATE À VÉRIFIER'}
      </Text>
      {sessionsForDate.length === 0 ? (
        <Surface style={[styles.noSessionCard, { borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Aucune séance de cette classe n’est prévue à cette date. Choisissez une autre date ou ajoutez la séance à l’emploi du temps.
          </Text>
          <Button label="Gérer l’emploi du temps" icon="calendar" compact secondary onPress={() => router.push('/schedule')} />
        </Surface>
      ) : (
        <View style={styles.sessionChoices}>
          {sessionsForDate.map((item) => {
            const selected = item.id === session?.id;
            const hasRecord = Boolean(data.getAttendanceRecord(currentClass.id, item.id, date));
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Choisir la séance ${item.startTime} à ${item.endTime}${item.subject ? `, ${item.subject}` : ''}`}
                accessibilityState={{ selected }}
                onPress={() => setSelectedSessionId(item.id)}
                style={[styles.sessionChoice, {
                  backgroundColor: selected ? colors.accent : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                }]}
              >
                <View style={styles.sessionChoiceCopy}>
                  <Text style={[styles.sessionChoiceTime, { color: selected ? colors.primary : colors.foreground }]}>
                    {item.startTime}–{item.endTime}
                  </Text>
                  <Text style={[styles.sessionChoiceMeta, { color: colors.mutedForeground }]}>
                    {[item.subject, item.room].filter(Boolean).join(' · ') || 'Séance'}
                  </Text>
                </View>
                <Text style={[styles.sessionRecordStatus, { color: hasRecord ? colors.successForeground : colors.mutedForeground }]}>
                  {hasRecord ? 'Appel fait · modifiable' : 'Appel à faire'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {sessionsForDate.length > 0 ? (
        <View style={styles.attendanceActions}>
          <View style={styles.attendanceActionButton}>
            <Button label="Tous présents" icon="check" compact secondary onPress={markAllPresent} />
          </View>
          <View style={styles.attendanceActionButton}>
            <Button
              label={isExporting ? 'Préparation…' : 'Exporter PDF'}
              icon="download"
              compact
              secondary
              disabled={isExporting}
              onPress={() => { void exportDailyAttendance(); }}
            />
          </View>
        </View>
      ) : null}

      <Surface style={[styles.countsCard, { borderColor: colors.border }]}>
        <Text style={[styles.countText, { color: colors.successForeground }]}>{presentCount} présent{presentCount !== 1 ? 's' : ''}</Text>
        <Text style={[styles.countText, { color: colors.errorForeground }]}>{absentCount} absent{absentCount !== 1 ? 's' : ''}</Text>
        <Text style={[styles.countText, { color: colors.mutedForeground }]}>{pupils.length - markedCount} à renseigner</Text>
      </Surface>

      {pupils.length === 0 ? (
        <Surface style={styles.emptyCard}>
          <Feather name="users" size={26} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Aucun élève dans cette classe</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Ajoutez les élèves avant d’enregistrer un appel.</Text>
        </Surface>
      ) : pupils.map((pupil) => {
        const status = statuses[pupil.id];
        return (
          <Surface key={pupil.id} style={[styles.pupilRow, { borderColor: colors.border }]}>
            <View style={styles.pupilCopy}>
              <Text style={[styles.pupilName, { color: colors.foreground }]}>{pupil.lastName} {pupil.firstName}</Text>
              <Text style={[styles.pupilNumber, { color: colors.mutedForeground }]}>N° {pupil.registrationNumber}</Text>
            </View>
            <View style={styles.statusActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Marquer ${pupil.firstName} présent`}
                accessibilityState={{ selected: status === 'present' }}
                onPress={() => setStatuses((previous) => ({ ...previous, [pupil.id]: 'present' }))}
                style={[styles.statusButton, { backgroundColor: status === 'present' ? colors.successSurface : colors.card, borderColor: status === 'present' ? colors.successForeground : colors.border }]}
              >
                <Feather name="check" size={15} color={status === 'present' ? colors.successForeground : colors.mutedForeground} />
                <Text style={[styles.statusText, { color: status === 'present' ? colors.successForeground : colors.mutedForeground }]}>Présent</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Marquer ${pupil.firstName} absent`}
                accessibilityState={{ selected: status === 'absent' }}
                onPress={() => setStatuses((previous) => ({ ...previous, [pupil.id]: 'absent' }))}
                style={[styles.statusButton, { backgroundColor: status === 'absent' ? colors.errorSurface : colors.card, borderColor: status === 'absent' ? colors.errorForeground : colors.border }]}
              >
                <Feather name="x" size={15} color={status === 'absent' ? colors.errorForeground : colors.mutedForeground} />
                <Text style={[styles.statusText, { color: status === 'absent' ? colors.errorForeground : colors.mutedForeground }]}>Absent</Text>
              </Pressable>
            </View>
          </Surface>
        );
      })}

      <Button
        label={existingRecord ? 'Mettre à jour l’appel' : 'Enregistrer l’appel'}
        icon={existingRecord ? 'refresh-cw' : 'save'}
        disabled={pupils.length === 0 || markedCount !== pupils.length || !session}
        onPress={save}
      />
      <Text style={[styles.help, { color: colors.mutedForeground }]}>
        Les appels enregistrés serviront à calculer le taux de présence de chaque élève. Les jours sans appel ne sont pas comptés.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderWidth: 1, borderRadius: 13, marginBottom: 14 },
  sessionIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sessionCopy: { flex: 1, gap: 3 },
  sessionTitle: { fontSize: 14, fontWeight: '700' },
  sessionMeta: { fontSize: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 12 },
  dateInputGroup: { flex: 1, gap: 5 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  dateInput: { height: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, fontSize: 14 },
  datePickerButton: { height: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  datePickerText: { fontSize: 14, fontWeight: '600' },
  pickerContainer: { alignItems: 'center', borderWidth: 1, borderRadius: 10, marginBottom: 12, padding: 8 },
  pickerDone: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 7 },
  pickerDoneText: { fontSize: 14, fontWeight: '700' },
  sessionLabel: { marginBottom: 7 },
  sessionChoices: { gap: 7, marginBottom: 12 },
  sessionChoice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 54, padding: 10, borderWidth: 1, borderRadius: 10 },
  sessionChoiceCopy: { flex: 1, gap: 3 },
  sessionChoiceTime: { fontSize: 13, fontWeight: '800' },
  sessionChoiceMeta: { fontSize: 11 },
  sessionRecordStatus: { fontSize: 10, fontWeight: '700', textAlign: 'right' },
  noSessionCard: { gap: 10, padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 12 },
  attendanceActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  attendanceActionButton: { flex: 1, minWidth: 0 },
  countsCard: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, padding: 11, borderWidth: 1, borderRadius: 11, marginBottom: 10 },
  countText: { fontSize: 12, fontWeight: '700' },
  pupilRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderRadius: 11, marginBottom: 8 },
  pupilCopy: { flex: 1, gap: 3 },
  pupilName: { fontSize: 13, fontWeight: '700' },
  pupilNumber: { fontSize: 11 },
  statusActions: { flexDirection: 'row', gap: 5 },
  statusButton: { minHeight: 36, paddingHorizontal: 7, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  emptyCard: { alignItems: 'center', gap: 9, padding: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 12, textAlign: 'center' },
  help: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 9, marginBottom: 16 },
});
