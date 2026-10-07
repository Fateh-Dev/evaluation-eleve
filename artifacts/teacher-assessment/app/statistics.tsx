import { Feather } from '@expo/vector-icons';
import { Alert } from '@/components/AppDialog';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, ProgressBar, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { calculateAbsenceScore, calculateDisciplineScore } from '@/services/continuousEvaluation';

type EvaluationType = 'all' | 'assessments' | 'continuous';
type StatisticRow = {
  id: string;
  label: string;
  source: 'assessment' | 'continuous';
  count: number;
  acquired: number;
  partial: number;
  notAcquired: number;
  percent: number;
};

function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const colors = useColors();
  if (!options.length) return null;
  return (
    <View style={styles.filterGroup}>
      <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function StatisticsScreen() {
  const colors = useColors();
  const data = useAppData();
  const [classId, setClassId] = useState(data.activeClassId || data.classes[0]?.id || '');
  const [periodId, setPeriodId] = useState('all');
  const [pupilId, setPupilId] = useState('all');
  const [competencyKey, setCompetencyKey] = useState('all');
  const [evaluationType, setEvaluationType] = useState<EvaluationType>('all');
  const [criteriaExpanded, setCriteriaExpanded] = useState(true);

  useEffect(() => {
    if (!data.hydrated || data.classes.length === 0) return;
    if (data.classes.some((item) => item.id === classId)) return;
    setClassId(
      data.classes.some((item) => item.id === data.activeClassId)
        ? data.activeClassId
        : data.classes[0].id,
    );
  }, [classId, data.activeClassId, data.classes, data.hydrated]);

  const selectedClass = data.classes.find((item) => item.id === classId);
  const pupils = data.pupils.filter((pupil) => pupil.classId === classId);
  useEffect(() => {
    if (pupilId !== 'all' && !pupils.some((pupil) => pupil.id === pupilId)) {
      setPupilId('all');
    }
  }, [pupilId, pupils]);

  const periods = selectedClass
    ? data.getContinuousEvaluationPeriods(selectedClass.academicYear)
    : [];
  const selectedPeriod = periods.find((period) => period.id === periodId);
  const classAssessments = data.assessments.filter((assessment) => assessment.classId === classId);
  const competencyOptions = useMemo(() => {
    const assessmentCompetencies = classAssessments
      .map((assessment) => assessment.competency.trim())
      .filter(Boolean)
      .map((label) => ({ value: `assessment:${label}`, label }));
    const uniqueAssessments = Array.from(
      new Map(assessmentCompetencies.map((item) => [item.value.toLocaleLowerCase(), item])).values(),
    );
    return [
      { value: 'all', label: 'Toutes' },
      ...uniqueAssessments,
      { value: 'continuous:cahier', label: 'Cahier' },
      { value: 'continuous:participation', label: 'Participation' },
      { value: 'continuous:discipline', label: 'Discipline' },
      { value: 'continuous:absence', label: 'Absences' },
    ];
  }, [classAssessments]);

  const rows = useMemo(() => {
    const aggregate = new Map<string, {
      label: string;
      source: 'assessment' | 'continuous';
      count: number;
      acquired: number;
      partial: number;
      notAcquired: number;
      scoreTotal: number;
    }>();

    if (evaluationType !== 'continuous') {
      for (const assessment of classAssessments) {
        if (
          selectedPeriod &&
          (assessment.date < selectedPeriod.startDate || assessment.date > selectedPeriod.endDate)
        ) continue;
        const competency = assessment.competency.trim() || 'Sans compétence';
        if (competencyKey !== 'all' && competencyKey !== `assessment:${competency}`) continue;
        const absent = new Set(data.absentPupilIds[assessment.id] ?? []);
        const assessmentValues = data.allEvaluations[assessment.id] ?? {};
        const objectives = data.allObjectives[assessment.id] ?? [];
        const key = `assessment:${competency}`;
        const item = aggregate.get(key) ?? {
          label: competency,
          source: 'assessment' as const,
          count: 0,
          acquired: 0,
          partial: 0,
          notAcquired: 0,
          scoreTotal: 0,
        };
        for (const pupil of pupils) {
          if (absent.has(pupil.id) || (pupilId !== 'all' && pupil.id !== pupilId)) continue;
          for (const objective of objectives) {
            const value = assessmentValues[pupil.id]?.[objective.id];
            if (value === 'Acquired') {
              item.count += 1;
              item.acquired += 1;
              item.scoreTotal += 100;
            } else if (value === 'PartiallyAcquired') {
              item.count += 1;
              item.partial += 1;
              item.scoreTotal += 50;
            } else if (value === 'NotAcquired') {
              item.count += 1;
              item.notAcquired += 1;
            }
          }
        }
        aggregate.set(key, item);
      }
    }

    if (evaluationType !== 'assessments' && selectedClass) {
      const continuousRecords = data.continuousEvaluations.filter((record) =>
        record.classId === classId &&
        record.schoolYearId === selectedClass.academicYear &&
        (pupilId === 'all' || record.pupilId === pupilId) &&
        (!selectedPeriod || record.evaluationPeriodId === selectedPeriod.id),
      );
      const addScore = (key: string, label: string, pupilScore: number) => {
        if (competencyKey !== 'all' && competencyKey !== key) return;
        const item = aggregate.get(key) ?? {
          label,
          source: 'continuous' as const,
          count: 0,
          acquired: 0,
          partial: 0,
          notAcquired: 0,
          scoreTotal: 0,
        };
        item.count += 1;
        item.scoreTotal += (pupilScore / 5) * 100;
        aggregate.set(key, item);
      };

      for (const record of continuousRecords) {
        for (const criterion of [
          { key: 'continuous:cahier', label: 'Cahier', score: record.cahierScore },
          { key: 'continuous:participation', label: 'Participation', score: record.participationScore },
        ]) {
          if (typeof criterion.score === 'number') {
            addScore(criterion.key, criterion.label, criterion.score);
          }
        }
        const disciplinePenalty = data.disciplineEvents
          .filter((event) => event.evaluationId === record.id)
          .reduce((total, event) => total + event.penalty, 0);
        addScore(
          'continuous:discipline',
          'Discipline',
          calculateDisciplineScore([disciplinePenalty]),
        );
      }

      const attendanceRecords = data.attendanceRecords.filter((record) =>
        record.classId === classId &&
        (!selectedPeriod ||
          (record.date >= selectedPeriod.startDate && record.date <= selectedPeriod.endDate)),
      );
      for (const pupil of pupils) {
        if (pupilId !== 'all' && pupil.id !== pupilId) continue;
        let totalSessions = 0;
        let presentCount = 0;
        let absentCount = 0;
        for (const record of attendanceRecords) {
          const status = record.statuses[pupil.id];
          if (status === 'present') {
            totalSessions += 1;
            presentCount += 1;
          } else if (status === 'absent') {
            totalSessions += 1;
            absentCount += 1;
          }
        }
        if (totalSessions > 0) {
          addScore(
            'continuous:absence',
            'Absences',
            calculateAbsenceScore(
              { totalSessions, presentCount, absentCount },
              {
                penaltyPerAbsence: data.continuousEvaluationSettings.absencePenaltyPerAbsence,
                maximumScore: 5,
              },
            ),
          );
        }
      }
    }

    return Array.from(aggregate.entries())
      .filter(([, item]) => item.count > 0)
      .map(([id, item]): StatisticRow => ({
        id,
        label: item.label,
        source: item.source,
        count: item.count,
        acquired: item.acquired,
        partial: item.partial,
        notAcquired: item.notAcquired,
        percent: Math.round(item.scoreTotal / item.count),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'fr'));
  }, [
    classAssessments,
    classId,
    competencyKey,
    data.absentPupilIds,
    data.continuousEvaluations,
    data.disciplineEvents,
    data.attendanceRecords,
    data.continuousEvaluationSettings,
    data.allEvaluations,
    data.allObjectives,
    evaluationType,
    pupilId,
    pupils,
    selectedClass,
    selectedPeriod,
  ]);

  const responseCount = rows.reduce((total, item) => total + item.count, 0);
  const average = responseCount
    ? Math.round(rows.reduce((total, item) => total + item.percent * item.count, 0) / responseCount)
    : null;
  const activeFilters = [
    selectedClass?.name,
    selectedPeriod?.name ?? (periodId === 'all' ? 'Toutes les périodes' : undefined),
    pupilId === 'all'
      ? 'Tous les élèves'
      : pupils.find((pupil) => pupil.id === pupilId)
        ? `${pupils.find((pupil) => pupil.id === pupilId)?.firstName} ${pupils.find((pupil) => pupil.id === pupilId)?.lastName}`
        : undefined,
    competencyOptions.find((option) => option.value === competencyKey)?.label,
    evaluationType === 'all' ? 'Tous les types' : evaluationType === 'assessments' ? 'Évaluations' : 'Suivi continu',
  ].filter(Boolean);

  const exportStatistics = async () => {
    const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csvRows = [
      ['Classe', selectedClass?.name ?? ''],
      ['Période', selectedPeriod?.name ?? 'Toutes les périodes'],
      ['Élève', pupilId === 'all' ? 'Tous les élèves' : activeFilters[2] ?? ''],
      ['Critère', competencyOptions.find((option) => option.value === competencyKey)?.label ?? 'Tous'],
      ['Type', evaluationType === 'all' ? 'Tous' : evaluationType === 'assessments' ? 'Évaluations' : 'Suivi continu'],
      [],
      ['Résultat', 'Source', 'Nombre', 'Acquis', 'Partiels', 'À renforcer', 'Moyenne'],
      ...rows.map((row) => [
        row.label,
        row.source === 'assessment' ? 'Évaluations' : 'Suivi continu',
        row.count,
        row.acquired,
        row.partial,
        row.notAcquired,
        row.source === 'continuous' ? `${(row.percent / 20).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}/5` : `${row.percent}%`,
      ]),
    ];
    const content = `\uFEFF${csvRows.map((row) => row.map((cell) => escapeCell(cell ?? '')).join(';')).join('\r\n')}`;
    try {
      if (!FileSystem.cacheDirectory) throw new Error('Le dossier temporaire est indisponible.');
      const uri = `${FileSystem.cacheDirectory}statistiques-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
      if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage de fichiers n’est pas disponible sur cet appareil.');
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Exporter les statistiques' });
    } catch (error) {
      Alert.alert('Export impossible', error instanceof Error ? error.message : 'Impossible de créer le fichier CSV.');
    }
  };

  return (
    <Screen>
      <AppHeader eyebrow="Analyse" title="Statistiques multicritères" onBack={() => router.back()} />
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>
        Croisez les classes, périodes, élèves, compétences et types d’évaluation.
      </Text>

      <Surface style={styles.filters}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: criteriaExpanded }}
          accessibilityLabel={criteriaExpanded ? 'Replier les critères' : 'Afficher les critères'}
          onPress={() => setCriteriaExpanded((expanded) => !expanded)}
          style={styles.criteriaHeader}
        >
          <View style={styles.criteriaHeading}>
            <Feather name="sliders" size={17} color={colors.primary} />
            <Text style={[styles.criteriaTitle, { color: colors.foreground }]}>Critères</Text>
          </View>
          <Feather name={criteriaExpanded ? 'chevron-up' : 'chevron-down'} size={19} color={colors.mutedForeground} />
        </Pressable>
        {criteriaExpanded ? (
          <View style={styles.criteriaContent}>
            <FilterChips
              label="CLASSE"
              value={classId}
              onChange={(value) => {
                setClassId(value);
                setPeriodId('all');
                setPupilId('all');
                setCompetencyKey('all');
              }}
              options={data.classes.map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterChips
              label="PÉRIODE / TRIMESTRE"
              value={periodId}
              onChange={setPeriodId}
              options={[
                { value: 'all', label: 'Toutes' },
                ...periods.map((period) => ({ value: period.id, label: period.name })),
              ]}
            />
            <FilterChips
              label="ÉLÈVE"
              value={pupilId}
              onChange={setPupilId}
              options={[
                { value: 'all', label: 'Tous' },
                ...pupils.map((pupil) => ({
                  value: pupil.id,
                  label: `${pupil.firstName} ${pupil.lastName}`,
                })),
              ]}
            />
            <FilterChips
              label="COMPÉTENCE / CRITÈRE"
              value={competencyKey}
              onChange={setCompetencyKey}
              options={competencyOptions}
            />
            <FilterChips
              label="TYPE D’ÉVALUATION"
              value={evaluationType}
              onChange={(value) => setEvaluationType(value as EvaluationType)}
              options={[
                { value: 'all', label: 'Tous les types' },
                { value: 'assessments', label: 'Évaluations' },
                { value: 'continuous', label: 'Suivi continu' },
              ]}
            />
          </View>
        ) : null}
      </Surface>

      <View style={[styles.activeFilters, { backgroundColor: colors.accent }]}>
        <Feather name="filter" size={14} color={colors.primary} />
        <Text style={[styles.activeFiltersText, { color: colors.foreground }]} numberOfLines={2}>
          {activeFilters.join(' · ')}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Surface style={styles.summaryCard}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>RÉSULTATS</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>{responseCount}</Text>
          <Text style={[styles.summaryHint, { color: colors.mutedForeground }]}>réponses notées</Text>
        </Surface>
        <Surface style={styles.summaryCard}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>MOYENNE</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{average === null ? '—' : `${average}%`}</Text>
          <Text style={[styles.summaryHint, { color: colors.mutedForeground }]}>acquisition / score</Text>
        </Surface>
      </View>

      <SectionTitle title={`Résultats par compétence (${rows.length})`} />
      <View style={styles.exportAction}>
        <Button
          label="Exporter les résultats (CSV)"
          icon="download"
          secondary
          compact
          onPress={() => { void exportStatistics(); }}
        />
      </View>
      {rows.length ? rows.map((row) => (
        <Surface key={row.id} style={styles.resultCard}>
          <View style={styles.resultHeading}>
            <View style={styles.resultCopy}>
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>{row.label}</Text>
              <Text style={[styles.resultSubtitle, { color: colors.mutedForeground }]}>
                {row.source === 'assessment' ? 'Évaluations ·' : 'Suivi continu ·'} {row.count} {row.count === 1 ? 'résultat' : 'résultats'}
              </Text>
            </View>
            <Text style={[styles.resultPercent, { color: colors.primary }]}>
              {row.source === 'continuous'
                ? `${(row.percent / 20).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} / 5`
                : `${row.percent}%`}
            </Text>
          </View>
          <ProgressBar value={row.percent} />
          {row.source === 'assessment' ? (
            <View style={styles.breakdown}>
              <Text style={[styles.breakdownText, { color: colors.successForeground }]}>{row.acquired} acquis</Text>
              <Text style={[styles.breakdownText, { color: colors.warningForeground }]}>{row.partial} partiels</Text>
              <Text style={[styles.breakdownText, { color: colors.errorForeground }]}>{row.notAcquired} à renforcer</Text>
            </View>
          ) : (
            <Text style={[styles.resultSubtitle, { color: colors.mutedForeground }]}>Moyenne calculée sur 5 points</Text>
          )}
        </Surface>
      )) : (
        <Surface style={styles.emptyState}>
          <Feather name="bar-chart-2" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Aucun résultat pour ces filtres</Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            Choisissez une autre période ou vérifiez que des évaluations ont été saisies.
          </Text>
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  filters: { padding: 14 },
  criteriaHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  criteriaHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  criteriaTitle: { fontSize: 14, fontWeight: '700' },
  criteriaContent: { gap: 16, marginTop: 14 },
  activeFilters: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, marginTop: 10 },
  activeFiltersText: { flex: 1, fontSize: 11, fontWeight: '600' },
  filterGroup: { gap: 8 },
  filterLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  chips: { gap: 7, paddingRight: 4 },
  chip: { minHeight: 34, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  summaryCard: { flex: 1, gap: 4, padding: 13 },
  summaryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  summaryValue: { fontSize: 25, lineHeight: 30, fontWeight: '800' },
  summaryHint: { fontSize: 10 },
  resultCard: { gap: 10, marginBottom: 9, padding: 14 },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultCopy: { flex: 1, gap: 3 },
  resultTitle: { fontSize: 14, fontWeight: '700' },
  resultSubtitle: { fontSize: 11 },
  resultPercent: { fontSize: 20, fontWeight: '800' },
  breakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  breakdownText: { fontSize: 11, fontWeight: '600' },
  exportAction: { alignItems: 'flex-start', marginBottom: 10 },
  emptyState: { alignItems: 'center', gap: 8, padding: 22 },
  emptyTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
