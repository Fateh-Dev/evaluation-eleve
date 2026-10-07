import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
    setEditingPeriodId(period?.id ?? null);
    setPeriodName(period?.name ?? '');
    setPeriodStartDate(period?.startDate ?? '');
    setPeriodEndDate(period?.endDate ?? '');
    setEditorVisible(true);
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
      <AppHeader eyebrow="Suivi de l’année scolaire" title="Évaluation continue" />
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
            <TextInput
              accessibilityLabel="Date de début"
              value={periodStartDate}
              onChangeText={setPeriodStartDate}
              placeholder="Date de début (AAAA-MM-JJ)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            />
            <TextInput
              accessibilityLabel="Date de fin"
              value={periodEndDate}
              onChangeText={setPeriodEndDate}
              placeholder="Date de fin (AAAA-MM-JJ)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
            />
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
              <Button label="Annuler" secondary compact onPress={() => setEditorVisible(false)} />
              <Button label="Enregistrer" compact onPress={savePeriod} />
            </View>
          </Surface>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
