import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useGetAssessmentStatistics } from '@workspace/api-client-react';
import { AppHeader, Button, ProgressBar, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

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

  const currentObjectives = useMemo(() => {
    return data.getObjectivesForAssessment(currentAssessment.id);
  }, [data.objectives, currentAssessment.id]);

  const currentRemediation = useMemo(() => {
    return data.getRemediationForAssessment(currentAssessment.id);
  }, [data.allRemediations, currentAssessment.id]);

  const localStatistics = useMemo(() => {
    return data.getStatisticsForAssessment(currentAssessment.id);
  }, [data.pupils, data.objectives, data.evaluations, currentAssessment.id]);

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

  const { data: serverStatistics } = useGetAssessmentStatistics(currentAssessment.id);

  const statistics = useMemo(
    () =>
      currentObjectives.map((objective) => {
        const local = localStatistics.find((item) => item.objectiveId === objective.id);
        const remote = Array.isArray(serverStatistics)
          ? serverStatistics.find((item) => item.objectiveId === objective.id)
          : undefined;
        return { objective, stat: remote ?? local };
      }),
    [currentObjectives, localStatistics, serverStatistics],
  );

  const evaluatedTotal = statistics.reduce((sum, item) => sum + (item.stat?.evaluated ?? 0), 0);
  const total = Math.max(currentPupils.length * currentObjectives.length, 1);

  const handleSaveRemediation = () => {
    data.updateRemediation(individualRemediation, classRemediation, currentAssessment.id);
    setEditingRemediation(false);
    Alert.alert('Remédiation enregistrée', 'Les décisions sont disponibles hors connexion.');
  };

  return (
    <Screen>
      <AppHeader
        eyebrow={`${currentClass.name} · ${currentAssessment.competency}`}
        title={`Analyse — ${currentAssessment.title}`}
        onBack={() => router.back()}
      />

      <Surface style={styles.summary}>
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

      <SectionTitle title={`Résultats par objectif (${currentObjectives.length})`} />
      <View style={styles.objectives}>
        {statistics.map(({ objective, stat }) => (
          <Surface key={objective.id} style={styles.objectiveCard}>
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

      <SectionTitle title="Remédiation pédagogique" />
      {editingRemediation ? (
        <Surface style={styles.editor}>
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
          <Button
            label="Modifier les décisions"
            icon="edit-3"
            compact
            secondary
            onPress={() => setEditingRemediation(true)}
          />
        </>
      )}

      <Button
        label="Document & Exporter (Excel / Word)"
        icon="file-text"
        onPress={() => router.push(`/assessments/${currentAssessment.id}/document`)}
      />
      <Button label="Retour à l’évaluation" icon="arrow-left" secondary onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryCopy: { gap: 4 },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  summaryValue: { fontSize: 34, lineHeight: 38, fontWeight: '800' },
  summaryNote: { fontSize: 12 },
  summaryIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  objectives: { gap: 10 },
  objectiveCard: { gap: 12 },
  objectiveHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  objectiveCopy: { flex: 1, gap: 5 },
  objectiveNumber: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  objectiveText: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  percent: { fontSize: 20, fontWeight: '800' },
  statLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statText: { fontSize: 11, fontWeight: '600' },
  remediation: { flexDirection: 'row', gap: 11, marginBottom: 10 },
  remediationIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  remediationCopy: { flex: 1, gap: 4 },
  remediationTitle: { fontSize: 14, fontWeight: '700' },
  remediationText: { fontSize: 13, lineHeight: 19 },
  editor: { gap: 9, marginBottom: 10 },
  editorLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  editorInput: { minHeight: 76, borderWidth: 1, borderRadius: 11, padding: 10, fontSize: 13, lineHeight: 18, textAlignVertical: 'top' },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 3 },
});
