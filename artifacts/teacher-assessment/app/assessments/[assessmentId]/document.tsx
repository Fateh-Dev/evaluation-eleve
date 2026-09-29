import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface, ValueMark } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

function valueLabel(value: string) {
  return value === 'Acquired' ? '+' : value === 'PartiallyAcquired' ? '±' : value === 'NotAcquired' ? '-' : '·';
}

export default function AssessmentDocumentScreen() {
  const colors = useColors();
  const data = useAppData();

  const reportText = [
    data.school.name,
    `${data.assessment.title} — ${data.className}`,
    `Niveau : ${data.level}`,
    `Compétence : ${data.assessment.competency}`,
    `Date : ${data.assessment.date}`,
    '',
    ...data.pupils.map((pupil) => `${pupil.registrationNumber}. ${pupil.firstName} ${pupil.lastName} — ${data.objectives.map((objective) => valueLabel(data.evaluations[pupil.id]?.[objective.id] ?? 'NotEvaluated')).join(' ')}`),
    '',
    'DÉCISIONS À PRENDRE',
    `Au plan individuel : ${data.individualRemediation}`,
    `Au plan de la classe : ${data.classRemediation}`,
  ].join('\n');

  const shareReport = async () => {
    try {
      await Share.share({ title: `Évaluation — ${data.className}`, message: reportText });
    } catch {
      Alert.alert('Partage impossible', 'Le rapport reste disponible dans cet aperçu.');
    }
  };

  const printReport = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    } else {
      shareReport();
    }
  };

  return (
    <Screen>
      <AppHeader eyebrow={`${data.assessment.subject} · ${data.className}`} title="Document d’évaluation" onBack={() => router.back()} />
      <View style={styles.actions}>
        <Button label="Imprimer / PDF" icon="printer" onPress={printReport} />
        <Button label="Partager" icon="share-2" secondary onPress={shareReport} />
      </View>
      <Surface style={[styles.paper, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.paperHeader}>
          <View style={styles.headerCopy}>
            <Text style={[styles.school, { color: colors.foreground }]}>{data.school.name}</Text>
            <Text style={[styles.address, { color: colors.mutedForeground }]}>{data.school.address} · {data.school.wilaya}</Text>
          </View>
          <Feather name="file-text" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.reportTitle, { color: colors.foreground }]}>{data.assessment.title}</Text>
        <View style={styles.metaGrid}>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>NIVEAU <Text style={[styles.metaValue, { color: colors.foreground }]}>{data.level}</Text></Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>CLASSE <Text style={[styles.metaValue, { color: colors.foreground }]}>{data.className}</Text></Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>DATE <Text style={[styles.metaValue, { color: colors.foreground }]}>{data.assessment.date}</Text></Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>COMPÉTENCE <Text style={[styles.metaValue, { color: colors.foreground }]}>{data.assessment.competency}</Text></Text>
        </View>
        <SectionTitle title="Grille d’analyse" />
        <View style={[styles.table, { borderColor: colors.border }]}>
          <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: colors.secondary }]}><Text style={[styles.pupilCell, styles.headerText, { color: colors.foreground }]}>Élève</Text>{data.objectives.map((objective) => <Text key={objective.id} style={[styles.objectiveCell, styles.headerText, { color: colors.foreground }]}>Obj. {objective.order}</Text>)}</View>
          {data.pupils.map((pupil, index) => <View key={pupil.id} style={[styles.tableRow, { backgroundColor: index % 2 ? colors.card : colors.background, borderTopColor: colors.border }]}><Text style={[styles.pupilCell, { color: colors.foreground }]}>{pupil.registrationNumber}. {pupil.firstName} {pupil.lastName}</Text>{data.objectives.map((objective) => <View key={objective.id} style={styles.objectiveCell}><ValueMark value={data.evaluations[pupil.id]?.[objective.id] ?? 'NotEvaluated'} size="small" /></View>)}</View>)}
        </View>
        <SectionTitle title="DÉCISIONS À PRENDRE" />
        <View style={styles.decisions}>
          <Text style={[styles.decisionTitle, { color: colors.foreground }]}>A) Au plan individuel</Text>
          <Text style={[styles.decisionText, { color: colors.mutedForeground }]}>{data.individualRemediation}</Text>
          <Text style={[styles.decisionTitle, { color: colors.foreground }]}>B) Au plan de la classe</Text>
          <Text style={[styles.decisionText, { color: colors.mutedForeground }]}>{data.classRemediation}</Text>
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  paper: { borderRadius: 8, padding: 22 },
  paperHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerCopy: { gap: 4 },
  school: { fontSize: 17, fontWeight: '800' },
  address: { fontSize: 11 },
  reportTitle: { fontSize: 22, fontWeight: '800', marginTop: 22 },
  metaGrid: { gap: 6, marginTop: 12 },
  meta: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  metaValue: { fontWeight: '800' },
  table: { borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', minHeight: 42, alignItems: 'center' },
  tableHeader: { minHeight: 48 },
  pupilCell: { flex: 2, paddingHorizontal: 8, fontSize: 10 },
  objectiveCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  headerText: { fontWeight: '800', textAlign: 'center' },
  decisions: { gap: 7 },
  decisionTitle: { fontSize: 13, fontWeight: '800', marginTop: 3 },
  decisionText: { fontSize: 12, lineHeight: 18 },
});
