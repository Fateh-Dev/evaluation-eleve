import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function ClassDetailScreen() {
  const colors = useColors();
  const data = useAppData();
  useLocalSearchParams();
  return (
    <Screen>
      <AppHeader eyebrow={data.academicYear} title={data.className} onBack={() => router.back()} />
      <View style={styles.actions}><Button label="Évaluer la classe" icon="check-square" onPress={() => router.push(`/assessments/${data.assessment.id}`)} /><Button label="Importer" icon="upload" secondary onPress={() => router.push(`/classes/${data.classId}/import`)} /></View>
      <Surface style={styles.classInfo}><View><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>NIVEAU</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{data.level}</Text></View><View><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>ÉLÈVES</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>{data.pupils.length}</Text></View><View><Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>ÉVALUATIONS</Text><Text style={[styles.infoValue, { color: colors.foreground }]}>1</Text></View></Surface>
      <SectionTitle title="Élèves" action="Voir tout" onAction={() => router.push('/pupils')} />
      {data.pupils.slice(0, 8).map((pupil, index) => <Pressable key={pupil.id} onPress={() => router.push(`/pupils/${pupil.id}`)} style={[styles.pupilRow, { borderBottomColor: colors.border }]}><View style={[styles.avatar, { backgroundColor: index % 2 ? colors.accent : colors.secondary }]}><Text style={[styles.avatarText, { color: colors.foreground }]}>{pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}</Text></View><View style={styles.pupilCopy}><Text style={[styles.pupilName, { color: colors.foreground }]}>{pupil.firstName} {pupil.lastName}</Text><Text style={[styles.pupilMeta, { color: colors.mutedForeground }]}>N° {pupil.registrationNumber}</Text></View><Feather name="chevron-right" size={17} color={colors.mutedForeground} /></Pressable>)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  classInfo: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 5 },
  infoValue: { fontSize: 18, fontWeight: '700' },
  pupilRow: { minHeight: 64, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '800' },
  pupilCopy: { flex: 1, gap: 3 },
  pupilName: { fontSize: 14, fontWeight: '700' },
  pupilMeta: { fontSize: 12 },
});