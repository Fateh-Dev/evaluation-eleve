import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppHeader, Screen, SectionTitle, Surface, ValueMark } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function PupilDetailScreen() {
  const colors = useColors();
  const { pupilId } = useLocalSearchParams<{ pupilId: string }>();
  const data = useAppData();
  const pupil = data.pupils.find((item) => item.id === pupilId) ?? data.pupils[0];
  return (
    <Screen>
      <AppHeader eyebrow={`Élève · N° ${pupil.registrationNumber}`} title={`${pupil.firstName} ${pupil.lastName}`} onBack={() => router.back()} />
      <Surface style={styles.profile}><View style={[styles.avatar, { backgroundColor: colors.accent }]}><Text style={[styles.avatarText, { color: colors.foreground }]}>{pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}</Text></View><View><Text style={[styles.profileName, { color: colors.foreground }]}>{pupil.firstName} {pupil.lastName}</Text><Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>{data.className} · {data.academicYear}</Text></View></Surface>
      <SectionTitle title="Historique d’évaluation" />
      <Surface style={styles.historyCard}>
        <View style={styles.historyHeader}><View style={styles.historyHeading}><Text style={[styles.subject, { color: colors.primary }]}>{data.assessment.competency}</Text><Text style={[styles.historyTitle, { color: colors.foreground }]}>{data.assessment.date}</Text></View><View style={[styles.status, { backgroundColor: colors.accent }]}><Text style={[styles.statusText, { color: colors.accentForeground }]}>En cours</Text></View></View>
        {data.objectives.map((objective) => <View key={objective.id} style={styles.objectiveRow}><Text style={[styles.objectiveText, { color: colors.foreground }]} numberOfLines={1}>Obj. {String(objective.order).padStart(2, '0')} · {objective.description}</Text><ValueMark value={data.evaluations[pupil.id]?.[objective.id] ?? 'NotEvaluated'} size="small" /></View>)}
      </Surface>
      <SectionTitle title="Décisions individuelles" />
      <Surface style={styles.note}><Feather name="edit-3" size={16} color={colors.primary} /><Text style={[styles.noteText, { color: colors.foreground }]}>{data.individualRemediation}</Text></Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  profileMeta: { fontSize: 13 },
  historyCard: { gap: 2 },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 9 },
  historyHeading: { gap: 3 },
  subject: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  historyTitle: { fontSize: 16, fontWeight: '700' },
  status: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  objectiveRow: { minHeight: 40, borderTopWidth: 1, borderTopColor: '#eee9e1', flexDirection: 'row', alignItems: 'center', gap: 8 },
  objectiveText: { flex: 1, fontSize: 12 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
});