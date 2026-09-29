import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useGetAssessmentStatistics } from '@workspace/api-client-react';
import { AppHeader, Button, ProgressBar, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function AssessmentAnalysisScreen() {
  const colors = useColors();
  const data = useAppData();
  const { data: serverStatistics } = useGetAssessmentStatistics(data.assessment.id);
  const statistics = useMemo(
    () => data.objectives.map((objective) => {
      const local = data.statistics.find((item) => item.objectiveId === objective.id);
      const remote = Array.isArray(serverStatistics)
        ? serverStatistics.find((item) => item.objectiveId === objective.id)
        : undefined;
      return { objective, stat: remote ?? local };
    }),
    [data.objectives, data.statistics, serverStatistics],
  );
  const evaluatedTotal = statistics.reduce((sum, item) => sum + (item.stat?.evaluated ?? 0), 0);
  const total = data.pupils.length * data.objectives.length;

  return (
    <Screen>
      <AppHeader eyebrow={`${data.assessment.subject} · ${data.className}`} title="Analyse" onBack={() => router.back()} />
      <Surface style={styles.summary}>
        <View style={styles.summaryCopy}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>PROGRESSION GLOBALE</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>{total ? Math.round((evaluatedTotal / total) * 100) : 0}%</Text>
          <Text style={[styles.summaryNote, { color: colors.mutedForeground }]}>{evaluatedTotal} réponses évaluées sur {total}</Text>
        </View>
        <View style={[styles.summaryIcon, { backgroundColor: colors.accent }]}><Feather name="bar-chart-2" size={24} color={colors.primary} /></View>
      </Surface>

      <SectionTitle title="Résultats par objectif" />
      <View style={styles.objectives}>
        {statistics.map(({ objective, stat }) => (
          <Surface key={objective.id} style={styles.objectiveCard}>
            <View style={styles.objectiveHeader}>
              <View style={styles.objectiveCopy}>
                <Text style={[styles.objectiveNumber, { color: colors.primary }]}>OBJECTIF {String(objective.order).padStart(2, '0')}</Text>
                <Text style={[styles.objectiveText, { color: colors.foreground }]}>{objective.description}</Text>
              </View>
              <Text style={[styles.percent, { color: colors.primary }]}>{stat?.acquiredPercent ?? 0}%</Text>
            </View>
            <ProgressBar value={stat?.acquiredPercent ?? 0} />
            <View style={styles.statLine}>
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>+ {stat?.acquired ?? 0} acquis</Text>
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>± {stat?.partiallyAcquired ?? 0} partiels</Text>
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>- {stat?.notAcquired ?? 0} à renforcer</Text>
            </View>
          </Surface>
        ))}
      </View>

      <SectionTitle title="Remédiation" />
      <Surface style={styles.remediation}>
        <View style={[styles.remediationIcon, { backgroundColor: colors.accent }]}><Feather name="user" size={17} color={colors.primary} /></View>
        <View style={styles.remediationCopy}>
          <Text style={[styles.remediationTitle, { color: colors.foreground }]}>Décisions individuelles</Text>
          <Text style={[styles.remediationText, { color: colors.mutedForeground }]}>{data.individualRemediation}</Text>
        </View>
      </Surface>
      <Surface style={styles.remediation}>
        <View style={[styles.remediationIcon, { backgroundColor: colors.secondary }]}><Feather name="users" size={17} color={colors.primary} /></View>
        <View style={styles.remediationCopy}>
          <Text style={[styles.remediationTitle, { color: colors.foreground }]}>Décision pour la classe</Text>
          <Text style={[styles.remediationText, { color: colors.mutedForeground }]}>{data.classRemediation}</Text>
        </View>
      </Surface>
      <Button label="Retour à l’évaluation" icon="arrow-left" secondary onPress={() => router.back()} />
      <Button label="Préparer le document" icon="file-text" onPress={() => Alert.alert('Document', 'La génération Word/PDF sera activée avec le service de documents.')} />
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
});