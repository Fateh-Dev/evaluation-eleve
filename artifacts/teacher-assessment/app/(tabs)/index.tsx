import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, ProgressBar, Screen, SectionTitle, Surface, SyncPill } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { useGetDashboard } from '@workspace/api-client-react';

export default function DashboardScreen() {
  const colors = useColors();
  const data = useAppData();
  const { data: serverDashboard } = useGetDashboard();
  const serverClass = serverDashboard?.classes?.[0];
  const className = serverClass?.name ?? data.className;
  const pupilCount = serverClass?.pupilCount ?? data.pupils.length;
  const focusObjective = data.statistics.reduce((lowest, current) => current.acquiredPercent < lowest.acquiredPercent ? current : lowest, data.statistics[0]);
  const focusIndex = data.objectives.findIndex((objective) => objective.id === focusObjective?.objectiveId);
  const completion = Math.round((data.statistics.reduce((sum, stat) => sum + stat.evaluated, 0) / (data.pupils.length * data.objectives.length)) * 100);

  return (
    <Screen>
      <AppHeader eyebrow="Espace enseignant" title="Bonjour, Mme X" />
      <SyncPill status={data.syncStatus} />
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroKicker, { color: colors.primary }]}>Évaluation en cours</Text>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>{data.assessment.title}</Text>
          <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>{className} · {data.assessment.date}</Text>
          <View style={styles.heroProgressRow}>
            <Text style={[styles.progressLabel, { color: colors.foreground }]}>{completion}% de la classe évaluée</Text>
            <Text style={[styles.progressCount, { color: colors.mutedForeground }]}>{pupilCount} élèves</Text>
          </View>
          <ProgressBar value={completion} />
          <Button label="Continuer l’évaluation" icon="arrow-right" onPress={() => router.push(`/assessments/${data.assessment.id}`)} />
        </View>
        <View style={[styles.heroBadge, { backgroundColor: colors.accent }]}>
          <Feather name="check-circle" color={colors.primary} size={31} />
          <Text style={[styles.heroBadgeText, { color: colors.foreground }]}>Données enregistrées localement</Text>
        </View>
      </View>

      <SectionTitle title="Mes classes" action="Voir tout" onAction={() => router.push('/classes')} />
      <Pressable onPress={() => router.push('/classes')} style={({ pressed }) => [styles.classRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
        <View style={[styles.classIcon, { backgroundColor: colors.secondary }]}><Feather name="users" size={19} color={colors.foreground} /></View>
        <View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{className}</Text><Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>{data.level} · {pupilCount} élèves · {serverDashboard?.academicYear ?? data.academicYear}</Text></View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <SectionTitle title="À surveiller" />
      <Surface style={styles.focusCard}>
        <View style={styles.focusTop}>
          <View style={[styles.focusIcon, { backgroundColor: '#fff0cf' }]}><Feather name="alert-circle" size={18} color="#9a7124" /></View>
          <View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>Objectif {String(focusIndex + 1).padStart(2, '0')}</Text><Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>{data.objectives[focusIndex]?.description}</Text></View>
          <Text style={[styles.focusPercent, { color: colors.primary }]}>{focusObjective?.acquiredPercent ?? 0}%</Text>
        </View>
        <ProgressBar value={focusObjective?.acquiredPercent ?? 0} />
        <Text style={[styles.focusFoot, { color: colors.mutedForeground }]}>Indicateur de suivi · décision pédagogique à confirmer</Text>
      </Surface>

      <SectionTitle title="Accès rapide" />
      <View style={styles.quickGrid}>
        <Pressable onPress={() => router.push('/assessments')} style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="plus-circle" size={22} color={colors.primary} /><Text style={[styles.quickTitle, { color: colors.foreground }]}>Nouvelle évaluation</Text><Text style={[styles.quickText, { color: colors.mutedForeground }]}>Créer depuis un modèle</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/pupils')} style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="user" size={22} color={colors.primary} /><Text style={[styles.quickTitle, { color: colors.foreground }]}>Mes élèves</Text><Text style={[styles.quickText, { color: colors.mutedForeground }]}>Historique individuel</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 18, borderRadius: 22, padding: 20, backgroundColor: '#183143', flexDirection: 'row', gap: 20, overflow: 'hidden' },
  heroCopy: { flex: 1, gap: 10 },
  heroKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { fontSize: 25, lineHeight: 30, fontWeight: '700' },
  heroMeta: { fontSize: 14 },
  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressLabel: { fontSize: 12, fontWeight: '700' },
  progressCount: { fontSize: 12 },
  heroBadge: { width: 130, height: 130, borderRadius: 65, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 9, alignSelf: 'center' },
  heroBadgeText: { textAlign: 'center', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  classRow: { minHeight: 76, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  classIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12, lineHeight: 17 },
  focusCard: { gap: 14 },
  focusTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  focusIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  focusPercent: { fontSize: 20, fontWeight: '800' },
  focusFoot: { fontSize: 11, lineHeight: 16 },
  quickGrid: { flexDirection: 'row', gap: 12, paddingBottom: 16 },
  quickCard: { flex: 1, minHeight: 118, borderWidth: 1, borderRadius: 16, padding: 15, gap: 7 },
  quickTitle: { fontSize: 14, fontWeight: '700', marginTop: 3 },
  quickText: { fontSize: 12, lineHeight: 16 },
});
