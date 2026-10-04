import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, GuideAnchor, ProgressBar, Screen, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

function pieSlicePath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const toPoint = (angle: number) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(radians),
      y: cy + radius * Math.sin(radians),
    };
  };
  const start = toPoint(startAngle);
  const end = toPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function AnalysisSectionTitle({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>;
}

export default function AssessmentAnalysisScreen() {
  const colors = useColors();
  const data = useAppData();
  const { assessmentId } = useLocalSearchParams<{ assessmentId: string }>();

  const currentAssessment = useMemo(() => {
    return (assessmentId ? data.getAssessment(assessmentId) : null) ?? data.assessment;
  }, [assessmentId, data.assessments, data.assessment]);

  const currentClass = useMemo(() => {
    return data.classes.find((c) => c.id === currentAssessment.classId) ?? data.activeClass;
  }, [data.classes, currentAssessment.classId, data.activeClass]);

  const currentPupils = useMemo(() => {
    return data.getPupilsForClass(currentAssessment.classId);
  }, [data.pupils, currentAssessment.classId]);

  const absentPupilIds = useMemo(() => {
    const classPupilIds = new Set(currentPupils.map((pupil) => pupil.id));
    return new Set(
      data.getAbsentPupilIdsForAssessment(currentAssessment.id)
        .filter((pupilId) => classPupilIds.has(pupilId)),
    );
  }, [data.absentPupilIds, currentAssessment.id, currentPupils]);
  const presentPupilCount = currentPupils.length - absentPupilIds.size;

  const currentObjectives = useMemo(() => {
    return data.getObjectivesForAssessment(currentAssessment.id);
  }, [data.objectives, currentAssessment.id]);

  const currentRemediation = useMemo(() => {
    return data.getRemediationForAssessment(currentAssessment.id);
  }, [data.allRemediations, currentAssessment.id]);

  const localStatistics = useMemo(() => {
    return data.getStatisticsForAssessment(currentAssessment.id);
  }, [data.pupils, data.objectives, data.evaluations, data.absentPupilIds, currentAssessment.id]);

  const [editingRemediation, setEditingRemediation] = useState(false);
  const [individualRemediation, setIndividualRemediation] = useState(
    currentRemediation.individual,
  );
  const [classRemediation, setClassRemediation] = useState(
    currentRemediation.classroom,
  );

  useEffect(() => {
    setIndividualRemediation(currentRemediation.individual);
    setClassRemediation(currentRemediation.classroom);
  }, [currentRemediation]);

  const statistics = useMemo(
    () =>
      currentObjectives.map((objective) => ({
        objective,
        stat: localStatistics.find((item) => item.objectiveId === objective.id),
      })),
    [currentObjectives, localStatistics],
  );

  const evaluatedTotal = statistics.reduce((sum, item) => sum + (item.stat?.evaluated ?? 0), 0);
  const total = Math.max(presentPupilCount * currentObjectives.length, 1);
  const pieSize = 112;
  const pieRadius = 58;
  const presentAngle = currentPupils.length ? presentPupilCount / currentPupils.length * 360 : 0;

  const handleSaveRemediation = () => {
    data.updateRemediation(individualRemediation, classRemediation, currentAssessment.id);
    setEditingRemediation(false);
    Alert.alert('Remédiation enregistrée', 'Les décisions sont disponibles hors connexion.');
  };

  return (
    <Screen>
      <AppHeader
        eyebrow="Analyse"
        title={`Analyse — ${currentAssessment.title}`}
        onBack={() => router.back()}
        compact
      />

      <Surface
        style={styles.summary}
        guideTitle="Progression globale"
        guideDescription={`${evaluatedTotal} réponses évaluées sur ${total}. Ce résumé donne l’avancement de l’évaluation.`}
      >
        <View style={styles.summaryCopy}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>PROGRESSION GLOBALE</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>
            {Math.round((evaluatedTotal / total) * 100)}%
          </Text>
          <Text style={[styles.summaryNote, { color: colors.mutedForeground }]}>
            {evaluatedTotal} réponses évaluées sur {total}
          </Text>
        </View>
        <View style={[styles.summaryIcon, { backgroundColor: colors.accent }]}>
          <Feather name="bar-chart-2" size={24} color={colors.primary} />
        </View>
      </Surface>

      <AnalysisSectionTitle title="Statistiques visuelles" />
      <Surface
        style={styles.chartsCard}
        guideTitle="Statistiques visuelles"
        guideDescription="Cette zone compare les présences et les taux d’acquisition par objectif."
      >
        <Text style={[styles.chartTitle, { color: colors.foreground }]}>Présence à l’évaluation</Text>
        <View style={styles.attendanceChart}>
          <View
            accessible
            accessibilityLabel={`${presentPupilCount} présents, ${absentPupilIds.size} absents sur ${currentPupils.length} élèves`}
          >
            <Svg width={pieSize} height={pieSize} viewBox="0 0 132 132" accessibilityElementsHidden>
              {currentPupils.length === 0 ? (
                <Circle cx={66} cy={66} r={pieRadius} fill={colors.muted} />
              ) : presentPupilCount === 0 ? (
                <Circle cx={66} cy={66} r={pieRadius} fill={colors.errorForeground} />
              ) : absentPupilIds.size === 0 ? (
                <Circle cx={66} cy={66} r={pieRadius} fill={colors.successForeground} />
              ) : (
                <>
                  <Path d={pieSlicePath(66, 66, pieRadius, 0, presentAngle)} fill={colors.successForeground} />
                  <Path d={pieSlicePath(66, 66, pieRadius, presentAngle, 360)} fill={colors.errorForeground} />
                </>
              )}
            </Svg>
          </View>
          <View style={styles.pieLegend}>
            <View style={styles.pieLegendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.successForeground }]} />
              <Text style={[styles.pieLegendLabel, { color: colors.mutedForeground }]}>Présents</Text>
              <Text style={[styles.pieLegendValue, { color: colors.foreground }]}>{presentPupilCount}</Text>
            </View>
            <View style={styles.pieLegendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.errorForeground }]} />
              <Text style={[styles.pieLegendLabel, { color: colors.mutedForeground }]}>Absents</Text>
              <Text style={[styles.pieLegendValue, { color: colors.foreground }]}>{absentPupilIds.size}</Text>
            </View>
            <Text style={[styles.chartSubtitle, { color: colors.mutedForeground }]}>
              {currentPupils.length} élèves au total
            </Text>
          </View>
        </View>

        <View style={[styles.chartDivider, { backgroundColor: colors.border }]} />
        <Text style={[styles.chartTitle, { color: colors.foreground }]}>Taux d’acquisition par objectif</Text>
        <Text style={[styles.chartSubtitle, { color: colors.mutedForeground }]}>
          Pourcentage d’élèves présents ayant acquis chaque objectif.
        </Text>
        {statistics.length > 0 && presentPupilCount > 0 ? (
          <View style={styles.barChart}>
            {statistics.map(({ objective, stat }) => {
              const acquiredPercent = stat?.acquiredPercent ?? 0;
              return (
                <View key={objective.id} style={styles.barRow}>
                  <View style={styles.barLabelRow}>
                    <Text style={[styles.barObjectiveNumber, { color: colors.primary }]}>
                      {String(objective.order).padStart(2, '0')}
                    </Text>
                    <Text numberOfLines={1} style={[styles.barObjectiveDescription, { color: colors.foreground }]}>
                      {objective.description}
                    </Text>
                    <Text style={[styles.barPercent, { color: colors.primary }]}>{acquiredPercent}%</Text>
                  </View>
                  <View
                    accessible
                    accessibilityLabel={`Objectif ${objective.order} : ${acquiredPercent}% acquis`}
                    style={[styles.barTrack, { backgroundColor: colors.muted }]}
                  >
                    <View style={[styles.barFill, { width: `${acquiredPercent}%`, backgroundColor: colors.successForeground }]} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.chartSubtitle, { color: colors.mutedForeground }]}>
            {statistics.length === 0 ? 'Ajoutez des objectifs pour afficher le graphique.' : 'Aucun élève présent pour cette évaluation.'}
          </Text>
        )}
      </Surface>

      <AnalysisSectionTitle title={`Résultats par objectif (${currentObjectives.length})`} />
      <View style={styles.objectives}>
        {statistics.map(({ objective, stat }) => (
          <Surface
            key={objective.id}
            style={styles.objectiveCard}
            guideTitle={`Objectif ${objective.order}`}
            guideDescription="Cette carte détaille le taux d’acquisition et le nombre d’élèves dans chaque catégorie de résultat."
          >
            <View style={styles.objectiveHeader}>
              <View style={styles.objectiveCopy}>
                <Text style={[styles.objectiveNumber, { color: colors.primary }]}>
                  OBJECTIF {String(objective.order).padStart(2, '0')}
                </Text>
                <Text style={[styles.objectiveText, { color: colors.foreground }]}>
                  {objective.description}
                </Text>
              </View>
              <Text style={[styles.percent, { color: colors.primary }]}>
                {stat?.acquiredPercent ?? 0}%
              </Text>
            </View>
            <ProgressBar value={stat?.acquiredPercent ?? 0} />
            <View style={styles.statLine}>
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                + {stat?.acquired ?? 0} acquis
              </Text>
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                ± {stat?.partiallyAcquired ?? 0} partiels
              </Text>
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                - {stat?.notAcquired ?? 0} à renforcer
              </Text>
            </View>
          </Surface>
        ))}
      </View>

      <AnalysisSectionTitle title="Remédiation pédagogique" />
      {editingRemediation ? (
        <Surface
          style={styles.editor}
          guideTitle="Modifier les décisions"
          guideDescription="Saisissez les décisions individuelles et celles prévues pour la classe, puis enregistrez-les."
        >
          <Text style={[styles.editorLabel, { color: colors.mutedForeground }]}>DÉCISION INDIVIDUELLE</Text>
          <TextInput
            multiline
            value={individualRemediation}
            onChangeText={setIndividualRemediation}
            style={[styles.editorInput, { color: colors.foreground, borderColor: colors.border }]}
          />
          <Text style={[styles.editorLabel, { color: colors.mutedForeground }]}>DÉCISION POUR LA CLASSE</Text>
          <TextInput
            multiline
            value={classRemediation}
            onChangeText={setClassRemediation}
            style={[styles.editorInput, { color: colors.foreground, borderColor: colors.border }]}
          />
          <View style={styles.editorActions}>
            <Button label="Annuler" compact secondary onPress={() => setEditingRemediation(false)} />
            <Button label="Enregistrer" compact onPress={handleSaveRemediation} />
          </View>
        </Surface>
      ) : (
        <>
          <GuideAnchor
            id="analysis-remediation"
            title="Décisions de remédiation"
            description="Consultez les recommandations individuelles et celles prévues pour la classe."
          >
          <View>
          <Surface style={styles.remediation}>
            <View style={[styles.remediationIcon, { backgroundColor: colors.accent }]}>
              <Feather name="user" size={17} color={colors.primary} />
            </View>
            <View style={styles.remediationCopy}>
              <Text style={[styles.remediationTitle, { color: colors.foreground }]}>
                Décisions individuelles
              </Text>
              <Text style={[styles.remediationText, { color: colors.mutedForeground }]}>
                {currentRemediation.individual || 'Aucune décision individuelle saisie.'}
              </Text>
            </View>
          </Surface>
          <Surface style={styles.remediation}>
            <View style={[styles.remediationIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="users" size={17} color={colors.primary} />
            </View>
            <View style={styles.remediationCopy}>
              <Text style={[styles.remediationTitle, { color: colors.foreground }]}>
                Décision pour la classe
              </Text>
              <Text style={[styles.remediationText, { color: colors.mutedForeground }]}>
                {currentRemediation.classroom || 'Aucune décision de classe saisie.'}
              </Text>
            </View>
          </Surface>
          </View>
          </GuideAnchor>
        </>
      )}

      <View style={styles.footerActions}>
        {!editingRemediation && (
          <Button
            label="Modifier les décisions"
            icon="edit-3"
            secondary
            onPress={() => setEditingRemediation(true)}
          />
        )}
        <Button
          label="Exporter"
          icon="file-text"
          onPress={() => router.push(`/assessments/${currentAssessment.id}/document`)}
        />
        <Button label="Retour à l’évaluation" icon="arrow-left" secondary onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  summaryCopy: { gap: 4 },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  summaryValue: { fontSize: 34, lineHeight: 38, fontWeight: '800' },
  summaryNote: { fontSize: 12 },
  summaryIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, marginTop: 19, marginBottom: 10 },
  chartsCard: { gap: 10, padding: 14 },
  chartTitle: { fontSize: 14, fontWeight: '800' },
  chartSubtitle: { fontSize: 11, lineHeight: 16 },
  attendanceChart: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 2 },
  pieLegend: { gap: 9, minWidth: 108 },
  pieLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendSwatch: { width: 9, height: 9, borderRadius: 3 },
  pieLegendLabel: { flex: 1, fontSize: 11, fontWeight: '600' },
  pieLegendValue: { fontSize: 12, fontWeight: '800' },
  chartDivider: { height: StyleSheet.hairlineWidth, marginVertical: 1 },
  barChart: { gap: 12, paddingTop: 3 },
  barRow: { gap: 5 },
  barLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  barObjectiveNumber: { width: 21, fontSize: 10, fontWeight: '800' },
  barObjectiveDescription: { flex: 1, fontSize: 11, fontWeight: '600' },
  barPercent: { width: 38, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  barTrack: { height: 9, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  objectives: { gap: 10 },
  objectiveCard: { gap: 9, padding: 13 },
  objectiveHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  objectiveCopy: { flex: 1, gap: 5 },
  objectiveNumber: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  objectiveText: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  percent: { fontSize: 20, fontWeight: '800' },
  statLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statText: { fontSize: 11, fontWeight: '600' },
  remediation: { flexDirection: 'row', gap: 10, marginBottom: 10, padding: 14 },
  remediationIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  remediationCopy: { flex: 1, gap: 4 },
  remediationTitle: { fontSize: 14, fontWeight: '700' },
  remediationText: { fontSize: 13, lineHeight: 19 },
  editor: { gap: 10, marginBottom: 10, padding: 14 },
  editorLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  editorInput: { minHeight: 76, borderWidth: 1, borderRadius: 11, padding: 10, fontSize: 13, lineHeight: 18, textAlignVertical: 'top' },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 6 },
  footerActions: { gap: 12, marginTop: 16 },
});
