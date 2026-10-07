import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData, type ContinuousEvaluationPeriod } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { getContinuousEvaluationProgress } from '@/services/continuousEvaluation';

export default function ContinuousEvaluationScreen() {
  const colors = useColors();
  const data = useAppData();
  const years = [...new Set([
    ...data.schoolYearConfigurations.map((configuration) => configuration.year),
    ...data.classes.map((classItem) => classItem.academicYear),
  ])];
  const yearsKey = years.join('|');
  const [selectedYear, setSelectedYear] = useState(
    data.activeClass.academicYear || data.academicYear,
  );
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodName, setPeriodName] = useState('');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [activeDateField, setActiveDateField] = useState<'start' | 'end' | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const periods = data.getContinuousEvaluationPeriods(selectedYear);
  const activePeriod = data.getActiveContinuousEvaluationPeriod(selectedYear);

  useEffect(() => {
    if (!data.hydrated) return;
    const activeYear = data.activeClass.academicYear;
    if (activeYear && years.includes(activeYear)) {
      setSelectedYear(activeYear);
    } else if (!years.includes(selectedYear)) {
      setSelectedYear(data.academicYear);
    }
  }, [data.hydrated, data.activeClass.academicYear, data.academicYear, yearsKey]);

  const openPeriodEditor = (period?: ContinuousEvaluationPeriod) => {
    setActiveDateField(null);
    setEditingPeriodId(period?.id ?? null);
    setPeriodName(period?.name ?? '');
    setPeriodStartDate(period?.startDate ?? '');
    setPeriodEndDate(period?.endDate ?? '');
    setEditorVisible(true);
  };

  const getDateValue = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    const value = new Date(year, month - 1, day);
    return Number.isNaN(value.getTime()) ? new Date() : value;
  };

  const formatDateValue = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const updatePeriodDate = (field: 'start' | 'end', value: string) => {
    if (field === 'start') setPeriodStartDate(value);
    else setPeriodEndDate(value);
  };

  const savePeriod = () => {
    const saved = editingPeriodId
      ? data.updateContinuousEvaluationPeriod(
          editingPeriodId,
          periodName,
          periodStartDate,
          periodEndDate,
        )
      : data.addContinuousEvaluationPeriod(
          selectedYear,
          periodName,
          periodStartDate,
          periodEndDate,
        );
    if (!saved) {
      Alert.alert(
        'Période invalide',
        'Vérifiez le nom et les dates (AAAA-MM-JJ). Les périodes d’une même année ne peuvent pas se chevaucher.',
      );
      return;
    }
    setEditorVisible(false);
  };

  const removePeriod = (period: ContinuousEvaluationPeriod) => {
    Alert.alert(
      'Supprimer cette période ?',
      'Cette action est possible uniquement si aucune note n’a encore été saisie pour cette période.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            if (!data.deleteContinuousEvaluationPeriod(period.id)) {
              Alert.alert(
                'Suppression impossible',
                'Cette période contient déjà des évaluations. Les notes sont conservées.',
              );
              return;
            }
            setEditorVisible(false);
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <AppHeader eyebrow="Suivi de l’année scolaire" title="Mes évaluations" />
      <Surface style={[styles.levelTestCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
        <View style={[styles.levelTestIcon, { backgroundColor: colors.card }]}>
          <Feather name="target" size={19} color={colors.primary} />
        </View>
        <View style={styles.levelTestCopy}>
          <Text style={[styles.levelTestTitle, { color: colors.foreground }]}>Test de niveau initial</Text>
          <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>
            Évaluer les compétences en début d’année scolaire
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ouvrir les tests de niveau initial"
          onPress={() => router.push('/assessments')}
          style={[styles.levelTestAction, { backgroundColor: colors.card }]}
        >
          <Feather name="arrow-right" size={17} color={colors.primary} />
        </Pressable>
      </Surface>
      <SectionTitle title="Évaluation continue" />
      <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
        Choisissez le trimestre pour consulter ou saisir les notes. Chaque période conserve ses propres résultats.
      </Text>
      <SectionTitle title="Périodes d’évaluation" action="+ Ajouter" onAction={() => openPeriodEditor()} />
      {years.length > 1 ? (
        <View style={styles.yearSelector}>
          {years.map((year) => (
            <Pressable
              key={year}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedYear === year }}
              onPress={() => setSelectedYear(year)}
              style={[
                styles.periodChip,
                {
                  backgroundColor: selectedYear === year ? colors.primary : colors.card,
                  borderColor: selectedYear === year ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: selectedYear === year ? colors.primaryForeground : colors.foreground, fontWeight: '700' }}>
                {year}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {periods.length ? (
        <View style={styles.periodList}>
          {periods.map((period) => {
            const selected = period.id === activePeriod?.id;
            return (
              <View key={period.id} style={styles.periodRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => data.setActiveContinuousEvaluationPeriod(selectedYear, period.id)}
                  style={[
                    styles.periodChoice,
                    {
                      backgroundColor: selected ? colors.accent : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={selected ? 'check-circle' : 'circle'}
                    size={18}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                  <View style={styles.periodCopy}>
                    <Text style={[styles.periodName, { color: colors.foreground }]}>{period.name}</Text>
                    <Text style={[styles.periodDates, { color: colors.mutedForeground }]}>
                      {period.startDate} – {period.endDate}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Modifier ${period.name}`}
                  onPress={() => openPeriodEditor(period)}
                  style={[styles.editButton, { backgroundColor: colors.secondary }]}
                >
                  <Feather name="edit-2" size={16} color={colors.foreground} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <Surface style={[styles.emptyCard, { borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Aucune période définie</Text>
          <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>
            Ajoutez une période pour commencer à saisir les évaluations de cette année.
          </Text>
          <Button label="Ajouter une période" icon="plus" compact onPress={() => openPeriodEditor()} />
        </Surface>
      )}

      <SectionTitle title="Choisir une classe" />
      {data.classes.length ? (
        <View style={styles.classList}>
          {data.classes.map((classItem) => {
            const pupils = data.getPupilsForClass(classItem.id);
            const classPeriod = data.getActiveContinuousEvaluationPeriod(classItem.academicYear);
            const progress = getContinuousEvaluationProgress(
              pupils.map((pupil) => pupil.id),
              classItem.id,
              classItem.academicYear,
              data.continuousEvaluations,
              classPeriod?.id,
            );

            return (
              <Pressable
                key={classItem.id}
                accessibilityRole="button"
                onPress={() => {
                  data.setActiveClass(classItem.id);
                  router.push(`/classes/${classItem.id}`);
                }}
              >
                <Surface style={[styles.classCard, { borderColor: colors.border }]}>
                  <View style={[styles.classIcon, { backgroundColor: colors.accent }]}>
                    <Feather name="users" size={19} color={colors.primary} />
                  </View>
                  <View style={styles.classCopy}>
                    <Text style={[styles.className, { color: colors.foreground }]}>
                      {classItem.name}
                    </Text>
                    <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>
                      {classItem.level} · {classItem.academicYear} · {pupils.length} élève{pupils.length > 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.progressLabel, { color: colors.primary }]}>
                      {classPeriod?.name ?? 'Aucune période'} · {progress.completedCount}/{pupils.length} évaluation(s) complète(s)
                      {progress.incompleteCount
                        ? ` · ${progress.incompleteCount} à compléter`
                        : ''}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
                </Surface>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Surface style={[styles.emptyCard, { borderColor: colors.border }]}>
          <Feather name="users" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucune classe pour le moment
          </Text>
          <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>
            Créez une classe pour commencer les évaluations continues de l’année.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/classes')}
            style={[styles.createButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.createButtonText, { color: colors.primaryForeground }]}>
              Créer une classe
            </Text>
          </Pressable>
        </Surface>
      )}
      <Modal
        visible={editorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditorVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Surface style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingPeriodId ? 'Modifier la période' : 'Nouvelle période'}
            </Text>
            <TextInput
              accessibilityLabel="Nom de la période"
              value={periodName}
              onChangeText={setPeriodName}
              placeholder="Ex. 1er trimestre"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            />
            {([
              ['start', 'Date de début', periodStartDate],
              ['end', 'Date de fin', periodEndDate],
            ] as const).map(([field, label, value]) => (
              <View key={field} style={styles.dateField}>
                <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>{label}</Text>
                {Platform.OS === 'web' ? (
                  React.createElement('input', {
                    type: 'date',
                    'aria-label': label,
                    value,
                    onChange: (event: { currentTarget: { value: string } }) =>
                      updatePeriodDate(field, event.currentTarget.value),
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
                    },
                  })
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${label} : ${value || 'Choisir une date'}`}
                    onPress={() => setActiveDateField(activeDateField === field ? null : field)}
                    style={[styles.datePickerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                  >
                    <Feather name="calendar" size={16} color={colors.primary} />
                    <Text style={[styles.datePickerText, { color: colors.foreground }]}>
                      {value || 'Choisir une date'}
                    </Text>
                  </Pressable>
                )}
                {activeDateField === field && Platform.OS !== 'web' ? (
                  <View style={[styles.pickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <DateTimePicker
                      value={getDateValue(value)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onValueChange={(_, selectedDate) => {
                        updatePeriodDate(field, formatDateValue(selectedDate));
                        if (Platform.OS !== 'ios') setActiveDateField(null);
                      }}
                      onDismiss={() => setActiveDateField(null)}
                    />
                    {Platform.OS === 'ios' ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setActiveDateField(null)}
                        style={styles.pickerDone}
                      >
                        <Text style={[styles.pickerDoneText, { color: colors.primary }]}>Terminé</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
            <View style={styles.modalActions}>
              {editingPeriodId && periods.length > 1 ? (
                <Button
                  label="Supprimer"
                  secondary
                  compact
                  onPress={() => {
                    const period = periods.find((item) => item.id === editingPeriodId);
                    if (period) removePeriod(period);
                  }}
                />
              ) : null}
              <Button label="Annuler" secondary compact onPress={() => {
                setActiveDateField(null);
                setEditorVisible(false);
              }} />
              <Button label="Enregistrer" compact onPress={savePeriod} />
            </View>
          </Surface>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  levelTestCard: { minHeight: 74, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  levelTestIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  levelTestCopy: { flex: 1, gap: 3 },
  levelTestTitle: { fontSize: 14, fontWeight: '800' },
  levelTestAction: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionHint: { fontSize: 12, lineHeight: 17, marginTop: -8, marginBottom: 10 },
  yearSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  periodChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  periodList: { gap: 8, marginBottom: 16 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodChoice: { minHeight: 54, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  periodCopy: { flex: 1, gap: 3 },
  periodName: { fontSize: 13, fontWeight: '700' },
  periodDates: { fontSize: 11 },
  editButton: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  classList: { gap: 10 },
  classCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  classIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  classCopy: { flex: 1, minWidth: 0, gap: 4 },
  className: { fontSize: 15, fontWeight: '700' },
  classMeta: { fontSize: 12, lineHeight: 17 },
  progressLabel: { fontSize: 11, fontWeight: '700' },
  emptyCard: { alignItems: 'center', gap: 10, padding: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  createButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10 },
  createButtonText: { fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#00000066' },
  modalCard: { gap: 12, padding: 18, borderRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  dateField: { gap: 5 },
  dateLabel: { fontSize: 11, fontWeight: '700' },
  datePickerButton: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  datePickerText: { fontSize: 14, fontWeight: '600' },
  pickerContainer: { alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 8 },
  pickerDone: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 7 },
  pickerDoneText: { fontSize: 14, fontWeight: '700' },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
