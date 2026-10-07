import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { getContinuousEvaluationProgress } from '@/services/continuousEvaluation';

export default function ContinuousEvaluationScreen() {
  const colors = useColors();
  const data = useAppData();

  return (
    <Screen>
      <AppHeader eyebrow="Suivi de l’année scolaire" title="Évaluation continue" />
      <SectionTitle title="Choisir une classe" />
      {data.classes.length ? (
        <View style={styles.classList}>
          {data.classes.map((classItem) => {
            const pupils = data.getPupilsForClass(classItem.id);
            const progress = getContinuousEvaluationProgress(
              pupils.map((pupil) => pupil.id),
              classItem.id,
              classItem.academicYear,
              data.continuousEvaluations,
            );

            return (
              <Pressable
                key={classItem.id}
                accessibilityRole="button"
                onPress={() => {
                  data.setActiveClass(classItem.id);
                  router.push(`/classes/${classItem.id}`);
                }}
              >
                <Surface style={[styles.classCard, { borderColor: colors.border }]}>
                  <View style={[styles.classIcon, { backgroundColor: colors.accent }]}>
                    <Feather name="users" size={19} color={colors.primary} />
                  </View>
                  <View style={styles.classCopy}>
                    <Text style={[styles.className, { color: colors.foreground }]}>
                      {classItem.name}
                    </Text>
                    <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>
                      {classItem.level} · {classItem.academicYear} · {pupils.length} élève{pupils.length > 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.progressLabel, { color: colors.primary }]}>
                      {progress.completedCount}/{pupils.length} évaluation(s) complète(s)
                      {progress.incompleteCount
                        ? ` · ${progress.incompleteCount} à compléter`
                        : ''}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
                </Surface>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Surface style={[styles.emptyCard, { borderColor: colors.border }]}>
          <Feather name="users" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucune classe pour le moment
          </Text>
          <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>
            Créez une classe pour commencer les évaluations continues de l’année.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/classes')}
            style={[styles.createButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.createButtonText, { color: colors.primaryForeground }]}>
              Créer une classe
            </Text>
          </Pressable>
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  classList: { gap: 10 },
  classCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  classIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  classCopy: { flex: 1, minWidth: 0, gap: 4 },
  className: { fontSize: 15, fontWeight: '700' },
  classMeta: { fontSize: 12, lineHeight: 17 },
  progressLabel: { fontSize: 11, fontWeight: '700' },
  emptyCard: { alignItems: 'center', gap: 10, padding: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  createButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10 },
  createButtonText: { fontSize: 13, fontWeight: '700' },
});
