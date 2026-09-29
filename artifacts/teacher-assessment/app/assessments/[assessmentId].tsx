import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface, SyncPill, ValueMark } from '@/components/AppShell';
import { EvaluationValue, useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

function displayValue(value: EvaluationValue) {
  return value === 'Acquired' ? '+' : value === 'PartiallyAcquired' ? '±' : value === 'NotAcquired' ? '-' : '·';
}

export default function AssessmentEvaluationScreen() {
  const colors = useColors();
  const data = useAppData();
  useLocalSearchParams();
  const [pupilIndex, setPupilIndex] = useState(0);
  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= 850;
  const currentPupil = data.pupils[pupilIndex];
  const evaluatedTotal = data.statistics.reduce((sum, stat) => sum + stat.evaluated, 0);
  const total = data.pupils.length * data.objectives.length;
  const currentValues = useMemo(() => data.evaluations[currentPupil.id] ?? {}, [data.evaluations, currentPupil.id]);

  const confirmMarkAll = (objectiveId: string) => {
    Alert.alert('Marquer tous les élèves', 'Cette action remplacera les valeurs de la colonne sélectionnée.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Marquer +', onPress: () => data.setAllForObjective(objectiveId, 'Acquired') },
    ]);
  };

  const save = () => {
    data.saveDraft();
    if (Platform.OS !== 'web') Alert.alert('Évaluation enregistrée', 'Le brouillon est disponible hors connexion.');
  };

  return (
    <Screen scroll={false}>
      <AppHeader eyebrow={`${data.assessment.subject} · ${data.className}`} title="Évaluation" onBack={() => router.back()} />
      <View style={styles.topLine}><SyncPill status={data.isDirty ? 'pending' : data.syncStatus} /><View style={styles.topActions}><Button label="Enregistrer" icon="save" compact onPress={save} /><Button label="Analyse" icon="bar-chart-2" compact secondary onPress={() => router.push(`/assessments/${data.assessment.id}/analysis`)} /></View></View>
      <Surface style={styles.metaCard}><View style={styles.metaItem}><Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>COMPÉTENCE</Text><Text style={[styles.metaValue, { color: colors.foreground }]}>{data.assessment.competency}</Text></View><View style={styles.metaItem}><Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>OBJECTIFS</Text><Text style={[styles.metaValue, { color: colors.foreground }]}>{data.objectives.length}</Text></View><View style={styles.metaItem}><Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>PROGRESSION</Text><Text style={[styles.metaValue, { color: colors.primary }]}>{Math.round((evaluatedTotal / total) * 100)}%</Text></View></Surface>
      {isDesktop ? (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.gridScroll}>
          <View style={styles.grid}>
            <View style={[styles.gridRow, styles.gridHeader, { backgroundColor: colors.secondary, borderColor: colors.border }]}><View style={[styles.nameCell, styles.headerCell]}><Text style={[styles.headerText, { color: colors.foreground }]}>Élève</Text></View>{data.objectives.map((objective) => <View key={objective.id} style={styles.objectiveCell}><Text style={[styles.objectiveNumber, { color: colors.foreground }]}>{String(objective.order).padStart(2, '0')}</Text><Pressable onPress={() => confirmMarkAll(objective.id)}><Text style={[styles.markAll, { color: colors.primary }]}>marquer +</Text></Pressable></View>)}</View>
            {data.pupils.map((pupil, rowIndex) => <View key={pupil.id} style={[styles.gridRow, { borderBottomColor: colors.border, backgroundColor: rowIndex % 2 ? colors.card : '#fffdfa' }]}><View style={styles.nameCell}><Text style={[styles.pupilName, { color: colors.foreground }]} numberOfLines={1}>{pupil.firstName} {pupil.lastName}</Text><Text style={[styles.pupilNumber, { color: colors.mutedForeground }]}>N° {pupil.registrationNumber}</Text></View>{data.objectives.map((objective) => { const value = data.evaluations[pupil.id]?.[objective.id] ?? 'NotEvaluated'; return <Pressable key={objective.id} onPress={() => data.cycleEvaluation(pupil.id, objective.id)} style={styles.cell}><ValueMark value={value} size="small" /></Pressable>; })}</View>)}
            <View style={[styles.totalRow, { backgroundColor: colors.secondary }]}><View style={styles.nameCell}><Text style={[styles.headerText, { color: colors.foreground }]}>Total</Text></View>{data.statistics.map((stat) => <View key={stat.objectiveId} style={styles.cell}><Text style={[styles.totalText, { color: colors.primary }]}>{stat.acquiredPercent}%</Text></View>)}</View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mobileContent}>
          <View style={styles.pupilNavigator}><Pressable disabled={pupilIndex === 0} onPress={() => setPupilIndex((value) => Math.max(0, value - 1))} style={[styles.navButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pupilIndex === 0 ? 0.4 : 1 }]}><Feather name="chevron-left" size={18} color={colors.foreground} /><Text style={[styles.navText, { color: colors.foreground }]}>Précédent</Text></Pressable><View style={styles.pupilHeading}><Text style={[styles.pupilIndex, { color: colors.primary }]}>{String(pupilIndex + 1).padStart(2, '0')} / {data.pupils.length}</Text><Text style={[styles.mobilePupilName, { color: colors.foreground }]}>{currentPupil.firstName} {currentPupil.lastName}</Text></View><Pressable disabled={pupilIndex === data.pupils.length - 1} onPress={() => setPupilIndex((value) => Math.min(data.pupils.length - 1, value + 1))} style={[styles.navButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pupilIndex === data.pupils.length - 1 ? 0.4 : 1 }]}><Text style={[styles.navText, { color: colors.foreground }]}>Suivant</Text><Feather name="chevron-right" size={18} color={colors.foreground} /></Pressable></View>
          <View style={styles.mobileObjectives}>{data.objectives.map((objective) => { const value = currentValues[objective.id] ?? 'NotEvaluated'; return <Surface key={objective.id} style={styles.mobileObjective}><View style={styles.objectiveCopy}><Text style={[styles.mobileObjectiveNumber, { color: colors.primary }]}>OBJECTIF {String(objective.order).padStart(2, '0')}</Text><Text style={[styles.mobileObjectiveText, { color: colors.foreground }]}>{objective.description}</Text></View><View style={styles.valueButtons}>{(['Acquired', 'PartiallyAcquired', 'NotAcquired'] as EvaluationValue[]).map((choice) => <Pressable key={choice} onPress={() => data.setEvaluation(currentPupil.id, objective.id, choice)} style={[styles.choiceButton, { backgroundColor: value === choice ? colors.primary : colors.secondary, borderColor: value === choice ? colors.primary : colors.border }]}><Text style={[styles.choiceText, { color: value === choice ? colors.primaryForeground : colors.foreground }]}>{displayValue(choice)}</Text></Pressable>)}</View></Surface>; })}</View>
          <View style={styles.mobileFooter}><Button label="Enregistrer" icon="save" onPress={save} /><Button label={pupilIndex === data.pupils.length - 1 ? 'Terminer' : 'Enregistrer et suivant'} icon="arrow-right" secondary onPress={() => { save(); setPupilIndex((value) => Math.min(data.pupils.length - 1, value + 1)); }} /></View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  topActions: { flexDirection: 'row', gap: 8 },
  metaCard: { flexDirection: 'row', gap: 18, marginBottom: 14 },
  metaItem: { flex: 1, gap: 4 },
  metaLabel: { fontSize: 9, letterSpacing: 1, fontWeight: '800' },
  metaValue: { fontSize: 13, fontWeight: '700' },
  gridScroll: { paddingBottom: 24 },
  grid: { minWidth: 740, borderWidth: 1, borderColor: '#ded7cc', borderRadius: 14, overflow: 'hidden' },
  gridRow: { flexDirection: 'row', borderBottomWidth: 1, minHeight: 53, alignItems: 'stretch' },
  gridHeader: { minHeight: 65, borderBottomWidth: 1 },
  headerCell: { justifyContent: 'center' },
  nameCell: { width: 190, paddingHorizontal: 13, justifyContent: 'center' },
  headerText: { fontSize: 13, fontWeight: '800' },
  objectiveCell: { width: 83, alignItems: 'center', justifyContent: 'center', gap: 4 },
  objectiveNumber: { fontSize: 13, fontWeight: '800' },
  markAll: { fontSize: 9, fontWeight: '700' },
  pupilName: { fontSize: 12, fontWeight: '700' },
  pupilNumber: { fontSize: 10, marginTop: 3 },
  cell: { width: 83, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', minHeight: 50 },
  totalText: { fontSize: 11, fontWeight: '800' },
  mobileContent: { paddingBottom: 30 },
  pupilNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, gap: 8 },
  navButton: { minHeight: 40, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  navText: { fontSize: 11, fontWeight: '700' },
  pupilHeading: { alignItems: 'center', flex: 1, gap: 3 },
  pupilIndex: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  mobilePupilName: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  mobileObjectives: { gap: 10 },
  mobileObjective: { gap: 13 },
  objectiveCopy: { gap: 5 },
  mobileObjectiveNumber: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  mobileObjectiveText: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  valueButtons: { flexDirection: 'row', gap: 8 },
  choiceButton: { flex: 1, minHeight: 43, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontSize: 19, fontWeight: '800' },
  mobileFooter: { gap: 9, marginTop: 16 },
});