import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function AssessmentsScreen() {
  const colors = useColors();
  const data = useAppData();
  const evaluated = data.statistics.reduce((total, stat) => total + stat.evaluated, 0);
  const total = data.pupils.length * data.objectives.length;
  return (
    <Screen>
      <AppHeader eyebrow="Suivi pédagogique" title="Évaluations" />
      <Button label="Nouvelle évaluation" icon="plus" onPress={() => router.push('/assessments/new')} />
      <SectionTitle title="Récentes" />
      <Pressable onPress={() => router.push(`/assessments/${data.assessment.id}`)} style={({ pressed }) => [styles.assessmentCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}>
        <View style={[styles.assessmentAccent, { backgroundColor: colors.primary }]} />
        <View style={styles.assessmentCopy}><Text style={[styles.subject, { color: colors.primary }]}>{data.assessment.subject}</Text><Text style={[styles.assessmentTitle, { color: colors.foreground }]}>{data.assessment.title}</Text><Text style={[styles.assessmentMeta, { color: colors.mutedForeground }]}>{data.className} · {data.assessment.date}</Text><View style={styles.statusLine}><View style={[styles.statusDot, { backgroundColor: colors.primary }]} /><Text style={[styles.statusText, { color: colors.mutedForeground }]}>{Math.round((evaluated / total) * 100)}% évalué · En cours</Text></View></View><Feather name="chevron-right" size={19} color={colors.mutedForeground} />
      </Pressable>
      <SectionTitle title="Étapes de l’évaluation" />
      <Surface style={styles.steps}>
        {['Informations', 'Objectifs', 'Évaluation', 'Analyse', 'Remédiation', 'Document'].map((step, index) => (
          <View key={step} style={styles.stepRow}><View style={[styles.stepNumber, { backgroundColor: index === 2 ? colors.primary : colors.secondary }]}><Text style={[styles.stepNumberText, { color: index === 2 ? colors.primaryForeground : colors.foreground }]}>{index + 1}</Text></View><Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text><Feather name={index < 2 ? 'check' : index === 2 ? 'arrow-right' : 'lock'} size={15} color={index < 2 ? colors.successForeground : colors.mutedForeground} /></View>
        ))}
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  assessmentCard: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  assessmentAccent: { width: 5, height: 78, borderRadius: 4 },
  assessmentCopy: { flex: 1, gap: 4 },
  subject: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  assessmentTitle: { fontSize: 17, fontWeight: '700' },
  assessmentMeta: { fontSize: 13 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  steps: { gap: 4 },
  stepRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 12, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 14, fontWeight: '600' },
});
