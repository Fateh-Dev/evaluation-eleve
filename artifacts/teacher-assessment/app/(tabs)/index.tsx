import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, ProgressBar, Screen, SectionTitle, Surface, SyncPill } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function DashboardScreen() {
  const colors = useColors();
  const data = useAppData();

  const hasClasses = data.classes.length > 0;
  const hasAssessments = data.assessments.length > 0;
  const className = hasClasses ? data.className : 'Aucune classe';
  const pupilCount = data.pupils.length;

  const totalPossible = pupilCount * data.objectives.length;
  const evaluatedTotal = data.statistics.reduce((sum, stat) => sum + stat.evaluated, 0);
  const completion = totalPossible > 0 ? Math.round((evaluatedTotal / totalPossible) * 100) : 0;

  const focusObjective = data.statistics.length > 0
    ? data.statistics.reduce((lowest, current) => (current.acquiredPercent < lowest.acquiredPercent ? current : lowest), data.statistics[0])
    : null;
  const focusIndex = focusObjective
    ? data.objectives.findIndex((objective) => objective.id === focusObjective.objectiveId)
    : -1;

  const teacherGreeting = data.teacherName ? `Bonjour, ${data.teacherName}` : 'Bonjour, Enseignant';

  return (
    <Screen>
      <AppHeader eyebrow="Espace enseignant" title={teacherGreeting} />
      <SyncPill status={data.syncStatus} />

      {/* HERO SECTION */}
      {!hasClasses ? (
        <View style={[styles.hero, { backgroundColor: colors.hero }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroKicker, { color: colors.primary }]}>Démarrage</Text>
            <Text style={[styles.heroTitle, { color: colors.heroForeground }]}>
              Bienvenue dans votre espace
            </Text>
            <Text style={[styles.heroMeta, { color: colors.heroForeground }]}>
              Votre base de données est prête. Créez votre première classe pour commencer à évaluer vos compétences.
            </Text>
            <View style={{ marginTop: 6 }}>
              <Button
                label="Créer ma première classe"
                icon="plus"
                onPress={() => router.push('/classes')}
              />
            </View>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: colors.accent }]}>
            <Feather name="layers" color={colors.primary} size={31} />
            <Text style={[styles.heroBadgeText, { color: colors.foreground }]}>
              Prêt pour vos classes
            </Text>
          </View>
        </View>
      ) : !hasAssessments ? (
        <View style={[styles.hero, { backgroundColor: colors.hero }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroKicker, { color: colors.primary }]}>Classe active : {className}</Text>
            <Text style={[styles.heroTitle, { color: colors.heroForeground }]}>
              Aucune compétence créée
            </Text>
            <Text style={[styles.heroMeta, { color: colors.heroForeground }]}>
              Ajoutez une première compétence / évaluation pour évaluer vos élèves.
            </Text>
            <View style={{ marginTop: 6 }}>
              <Button
                label="Nouvelle évaluation"
                icon="plus"
                onPress={() => router.push('/assessments/new')}
              />
            </View>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: colors.accent }]}>
            <Feather name="award" color={colors.primary} size={31} />
            <Text style={[styles.heroBadgeText, { color: colors.foreground }]}>
              {pupilCount} élève{pupilCount > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.hero, { backgroundColor: colors.hero }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroKicker, { color: colors.primary }]}>Évaluation en cours</Text>
            <Text style={[styles.heroTitle, { color: colors.heroForeground }]}>{data.assessment.title}</Text>
            <Text style={[styles.heroMeta, { color: colors.heroForeground }]}>
              {className} · {data.assessment.date}
            </Text>
            <View style={styles.heroProgressRow}>
              <Text style={[styles.progressLabel, { color: colors.heroForeground }]}>
                {completion}% de la classe évaluée
              </Text>
              <Text style={[styles.progressCount, { color: colors.heroForeground }]}>
                {pupilCount} élève{pupilCount > 1 ? 's' : ''}
              </Text>
            </View>
            <ProgressBar value={completion} />
            <Button
              label="Continuer l’évaluation"
              icon="arrow-right"
              onPress={() => router.push(`/assessments/${data.assessment.id}`)}
            />
          </View>
          <View style={[styles.heroBadge, { backgroundColor: colors.accent }]}>
            <Feather name="check-circle" color={colors.primary} size={31} />
            <Text style={[styles.heroBadgeText, { color: colors.foreground }]}>
              Données locales prêtes
            </Text>
          </View>
        </View>
      )}

      {/* MES CLASSES */}
      <SectionTitle
        title="Mes classes"
        action={hasClasses ? 'Voir tout' : '+ Nouvelle classe'}
        onAction={() => router.push('/classes')}
      />
      {hasClasses ? (
        <Pressable
          onPress={() => router.push('/classes')}
          style={({ pressed }) => [
            styles.classRow,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.classIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="users" size={19} color={colors.foreground} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.foreground }]}>{className}</Text>
            <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
              {data.level} · {pupilCount} élève{pupilCount > 1 ? 's' : ''} · {data.academicYear}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      ) : (
        <Surface style={styles.emptyCard}>
          <Feather name="users" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyCardTitle, { color: colors.foreground }]}>
            Aucune classe enregistrée
          </Text>
          <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
            Créez une classe (ex: 2AS LPH, 1AS ST) pour commencer votre suivi.
          </Text>
          <Button label="Ajouter une classe" compact icon="plus" onPress={() => router.push('/classes')} />
        </Surface>
      )}

      {/* À SURVEILLER */}
      {focusObjective && focusIndex >= 0 && (
        <>
          <SectionTitle title="À surveiller" />
          <Surface style={styles.focusCard}>
            <View style={styles.focusTop}>
              <View style={[styles.focusIcon, { backgroundColor: colors.warningSurface }]}>
                <Feather name="alert-circle" size={18} color={colors.warningForeground} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                  Objectif {String(focusIndex + 1).padStart(2, '0')}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>
                  {data.objectives[focusIndex]?.description}
                </Text>
              </View>
              <Text style={[styles.focusPercent, { color: colors.primary }]}>
                {focusObjective.acquiredPercent}%
              </Text>
            </View>
            <ProgressBar value={focusObjective.acquiredPercent} />
            <Text style={[styles.focusFoot, { color: colors.mutedForeground }]}>
              Indicateur de suivi · décision pédagogique à confirmer
            </Text>
          </Surface>
        </>
      )}

      {/* ACCÈS RAPIDE */}
      <SectionTitle title="Accès rapide" />
      <View style={styles.quickGrid}>
        <Pressable
          onPress={() => router.push('/assessments')}
          style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="award" size={22} color={colors.primary} />
          <Text style={[styles.quickTitle, { color: colors.foreground }]}>Compétences</Text>
          <Text style={[styles.quickText, { color: colors.mutedForeground }]}>
            {data.assessments.length} évaluation{data.assessments.length > 1 ? 's' : ''}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/classes')}
          style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="users" size={22} color={colors.primary} />
          <Text style={[styles.quickTitle, { color: colors.foreground }]}>Classes & Élèves</Text>
          <Text style={[styles.quickText, { color: colors.mutedForeground }]}>
            {data.classes.length} classe{data.classes.length > 1 ? 's' : ''}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 18, borderRadius: 22, padding: 20, flexDirection: 'row', gap: 20, overflow: 'hidden' },
  heroCopy: { flex: 1, gap: 10 },
  heroKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { fontSize: 24, lineHeight: 29, fontWeight: '700' },
  heroMeta: { fontSize: 13, lineHeight: 18 },
  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressLabel: { fontSize: 12, fontWeight: '700' },
  progressCount: { fontSize: 12 },
  heroBadge: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', padding: 14, gap: 7, alignSelf: 'center' },
  heroBadgeText: { textAlign: 'center', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  classRow: { minHeight: 74, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  classIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12, lineHeight: 17 },
  focusCard: { gap: 14, padding: 16 },
  focusTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  focusIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  focusPercent: { fontSize: 20, fontWeight: '800' },
  focusFoot: { fontSize: 11, lineHeight: 16 },
  quickGrid: { flexDirection: 'row', gap: 12, paddingBottom: 16 },
  quickCard: { flex: 1, minHeight: 110, borderWidth: 1, borderRadius: 16, padding: 15, gap: 6 },
  quickTitle: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  quickText: { fontSize: 12, lineHeight: 16 },
  emptyCard: { padding: 20, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16 },
  emptyCardTitle: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyCardText: { fontSize: 13, textAlign: 'center', marginBottom: 6 },
});
