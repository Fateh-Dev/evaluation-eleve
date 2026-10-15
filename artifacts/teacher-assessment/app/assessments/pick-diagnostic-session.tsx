import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppHeader, Screen, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

/** Une séance diagnostique extraite du plan de formation. */
type DiagnosticSessionItem = {
  sessionId: string;
  sessionTitle: string;
  studyObjectId: string;
  studyObjectTitle: string;
  projectTitle: string;
  /** True si une évaluation diagnostique a déjà été créée pour cette séance. */
  alreadyEvaluated: boolean;
};

function getParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PickDiagnosticSessionScreen() {
  const colors = useColors();
  const data = useAppData();

  const { classId: classIdParam } = useLocalSearchParams<{
    classId?: string | string[];
  }>();
  const classId = getParam(classIdParam);

  const classItem = useMemo(
    () => data.classes.find((c) => c.id === classId),
    [data.classes, classId],
  );

  const plan = useMemo(
    () => (classId ? data.getTrainingPlanForClass(classId) : undefined),
    [data, classId],
  );

  /** Toutes les séances diagnostiques du plan de formation de la classe */
  const diagnosticSessions: DiagnosticSessionItem[] = useMemo(() => {
    if (!plan || !classId) return [];
    const assessmentsForClass = data.getAssessmentsForClass(classId);
    const items: DiagnosticSessionItem[] = [];
    for (const project of plan.projects) {
      for (const studyObject of project.studyObjects) {
        if (studyObject.diagnostic) {
          const session = studyObject.diagnostic;
          const alreadyEvaluated = assessmentsForClass.some(
            (a) =>
              a.trainingSessionId === session.id &&
              a.trainingStudyObjectId === studyObject.id &&
              a.evaluationType === 'prerequisites',
          );
          items.push({
            sessionId: session.id,
            sessionTitle: session.title,
            studyObjectId: studyObject.id,
            studyObjectTitle: studyObject.title,
            projectTitle: project.title,
            alreadyEvaluated,
          });
        }
      }
    }
    return items;
  }, [plan, classId, data]);

  const handleSelect = (item: DiagnosticSessionItem) => {
    if (!classId) return;
    router.push({
      pathname: '/assessments/diagnostic-prerequisites',
      params: {
        classId,
        trainingSessionId: item.sessionId,
        trainingStudyObjectId: item.studyObjectId,
      },
    });
  };

  return (
    <Screen>
      <AppHeader
        eyebrow="Évaluation diagnostique"
        title="Choisir la séance"
        onBack={() => router.back()}
        compact
      />

      {classItem && (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sélectionnez la séance diagnostique de{' '}
          <Text style={{ fontWeight: '700', color: colors.foreground }}>
            {classItem.name}
          </Text>{' '}
          à évaluer. Les séances déjà évaluées sont indiquées.
        </Text>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {diagnosticSessions.length === 0 ? (
          <Surface style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
              <Feather name="inbox" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Aucune séance diagnostique
            </Text>
            <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>
              {plan
                ? "Le plan de formation de cette classe ne contient pas encore de séance diagnostique."
                : "Cette classe n'a pas encore de plan de formation configuré."}
            </Text>
          </Surface>
        ) : (
          diagnosticSessions.map((item) => (
            <Pressable
              key={`${item.sessionId}-${item.studyObjectId}`}
              accessibilityRole="button"
              onPress={() => handleSelect(item)}
              style={({ pressed }) => [
                styles.sessionRow,
                {
                  backgroundColor: colors.card,
                  borderColor: item.alreadyEvaluated
                    ? colors.primary
                    : colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              {/* Icône */}
              <View
                style={[
                  styles.sessionIcon,
                  {
                    backgroundColor: item.alreadyEvaluated
                      ? colors.accent
                      : colors.secondary,
                  },
                ]}
              >
                <Feather
                  name={item.alreadyEvaluated ? 'check-circle' : 'target'}
                  size={20}
                  color={colors.primary}
                />
              </View>

              {/* Texte */}
              <View style={styles.sessionCopy}>
                <Text style={[styles.sessionTitle, { color: colors.foreground }]}>
                  {item.studyObjectTitle}
                </Text>
                <Text style={[styles.sessionSub, { color: colors.mutedForeground }]}>
                  {item.projectTitle} · {item.sessionTitle}
                </Text>
                {item.alreadyEvaluated && (
                  <View style={styles.badgeRow}>
                    <View
                      style={[styles.badge, { backgroundColor: colors.accent }]}
                    >
                      <Text
                        style={[styles.badgeText, { color: colors.primary }]}
                      >
                        Déjà évaluée
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <Feather
                name="chevron-right"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 12,
  },
  list: {
    gap: 10,
    paddingBottom: 32,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    minHeight: 74,
  },
  sessionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionCopy: { flex: 1, gap: 3 },
  sessionTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  sessionSub: { fontSize: 12, lineHeight: 17 },
  badgeRow: { marginTop: 4 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
    gap: 10,
    marginTop: 16,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyDetail: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
});
