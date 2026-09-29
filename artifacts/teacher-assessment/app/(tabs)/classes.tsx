import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { useListClasses } from '@workspace/api-client-react';

export default function ClassesScreen() {
  const colors = useColors();
  const data = useAppData();
  const { data: serverClasses } = useListClasses();
  const serverClass = Array.isArray(serverClasses) ? serverClasses[0] : undefined;
  return (
    <Screen>
      <AppHeader eyebrow="Organisation" title="Classes" />
      <Surface style={styles.summary}>
        <View><Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>ANNÉE ACTIVE</Text><Text style={[styles.summaryTitle, { color: colors.foreground }]}>{data.academicYear}</Text></View>
        <View style={[styles.summaryIcon, { backgroundColor: colors.accent }]}><Feather name="users" size={20} color={colors.primary} /></View>
      </Surface>
      <SectionTitle title="Mes classes" action="+ Ajouter" onAction={() => undefined} />
      <Pressable onPress={() => router.push(`/classes/${data.classId}`)} style={({ pressed }) => [styles.classCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}>
        <View style={[styles.classIcon, { backgroundColor: colors.secondary }]}><Text style={[styles.classLevel, { color: colors.foreground }]}>{data.level}</Text></View>
        <View style={styles.classCopy}><Text style={[styles.className, { color: colors.foreground }]}>{serverClass?.name ?? data.className}</Text><Text style={[styles.classMeta, { color: colors.mutedForeground }]}>{serverClass?.pupilCount ?? data.pupils.length} élèves · Mme X</Text><View style={styles.tags}><View style={[styles.tag, { backgroundColor: colors.accent }]}><Text style={[styles.tagText, { color: colors.accentForeground }]}>Active</Text></View><Text style={[styles.tagText, { color: colors.mutedForeground }]}>{data.assessment.title}</Text></View></View><Feather name="chevron-right" size={20} color={colors.mutedForeground} />
      </Pressable>
      <Button label="Ouvrir la classe" icon="arrow-right" onPress={() => router.push(`/classes/${data.classId}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 10, letterSpacing: 1.3, fontWeight: '800', marginBottom: 6 },
  summaryTitle: { fontSize: 22, fontWeight: '700' },
  summaryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  classCard: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 14 },
  classIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  classLevel: { fontSize: 15, fontWeight: '800' },
  classCopy: { flex: 1, gap: 4 },
  className: { fontSize: 17, fontWeight: '700' },
  classMeta: { fontSize: 13 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '700' },
});