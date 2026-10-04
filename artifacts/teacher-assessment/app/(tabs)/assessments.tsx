import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function AssessmentsScreen() {
  const colors = useColors();
  const data = useAppData();
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [deleteArmedAssessmentId, setDeleteArmedAssessmentId] = useState<string | null>(null);

  const filteredAssessments = selectedClassId === 'all'
    ? data.assessments
    : data.assessments.filter((a) => a.classId === selectedClassId);

  const handleDeleteAssessment = (assessmentId: string, assessmentTitle: string) => {
    Alert.alert(
      'Supprimer la compétence',
      `Êtes-vous sûr de vouloir supprimer l’évaluation "${assessmentTitle}" ?\n\nToutes les notes et objectifs associés seront définitivement effacés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            data.deleteAssessment(assessmentId);
            Alert.alert('Compétence supprimée', 'L’évaluation a été supprimée.');
          },
        },
      ],
    );
  };

  return (
    <Screen onTouchStart={() => setDeleteArmedAssessmentId(null)}>
      <AppHeader eyebrow="Suivi pédagogique" title="Évaluations & Compétences" />

      {/* Class Filter Bar */}
      {data.classes.length > 0 && (
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>FILTRER PAR CLASSE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChips}>
            <Pressable
              onPress={() => setSelectedClassId('all')}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedClassId === 'all' ? colors.primary : colors.card,
                  borderColor: selectedClassId === 'all' ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selectedClassId === 'all' ? colors.primaryForeground : colors.foreground },
                ]}
              >
                Toutes ({data.assessments.length})
              </Text>
            </Pressable>

            {data.classes.map((cls) => {
              const count = data.getAssessmentsForClass(cls.id).length;
              const isSelected = selectedClassId === cls.id;
              return (
                <Pressable
                  key={cls.id}
                  onPress={() => setSelectedClassId(cls.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {cls.name} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {data.classes.length > 0 && (
        <Button
          label="Nouvelle compétence / évaluation"
          icon="plus"
          onPress={() => router.push('/assessments/new')}
        />
      )}

      <SectionTitle
        title={`Compétences (${filteredAssessments.length})`}
        action={data.classes.length > 0 ? '+ Ajouter' : undefined}
        onAction={() => router.push('/assessments/new')}
      />

      {/* List of Assessments / Competencies / Empty State */}
      {data.classes.length === 0 ? (
        <Surface style={styles.emptyContainer}>
          <Feather name="layers" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucune classe disponible
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Vous devez d’abord créer au moins une classe pour pouvoir y ajouter des compétences et évaluations.
          </Text>
          <Button
            label="Créer une classe"
            icon="plus"
            onPress={() => router.push('/classes')}
          />
        </Surface>
      ) : filteredAssessments.length === 0 ? (
        <Surface style={styles.emptyContainer}>
          <Feather name="award" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucune compétence enregistrée
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            {selectedClassId === 'all'
              ? 'Créez votre première compétence d’évaluation pour commencer à noter vos élèves.'
              : 'Aucune compétence pour cette classe. Cliquez sur "+ Ajouter" pour en créer une.'}
          </Text>
          <Button
            label="Créer une compétence"
            icon="plus"
            onPress={() => router.push(`/assessments/new${selectedClassId !== 'all' ? `?classId=${selectedClassId}` : ''}`)}
          />
        </Surface>
      ) : (
        <View style={styles.assessmentsList}>
          {filteredAssessments.map((item) => {
            const itemClass = data.classes.find((c) => c.id === item.classId);
            const objList = data.getObjectivesForAssessment(item.id);
            const classPupils = data.getPupilsForClass(item.classId);
            const stats = data.getStatisticsForAssessment(item.id);
            const evaluatedTotal = stats.reduce((sum, s) => sum + s.evaluated, 0);
            const totalPossible = Math.max(classPupils.length * objList.length, 1);
            const progressPercent = Math.round((evaluatedTotal / totalPossible) * 100);

            return (
              <Surface
                key={item.id}
                style={[
                  styles.assessmentCard,
                  deleteArmedAssessmentId === item.id && {
                    backgroundColor: colors.card,
                    borderColor: colors.destructive,
                    borderWidth: 2,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.classPill, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.classPillText, { color: colors.foreground }]}>
                        {itemClass?.name ?? item.level}
                      </Text>
                    </View>
                    <View style={[styles.compPill, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.compPillText, { color: colors.accentForeground }]}>
                        {item.competency}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.progressNumber, { color: colors.primary }]}>
                    {progressPercent}%
                  </Text>
                </View>

                <Pressable
                  accessibilityHint="Maintenez appuyé pour afficher l’action Supprimer."
                  onTouchStart={(event) => event.stopPropagation()}
                  onLongPress={() => setDeleteArmedAssessmentId(item.id)}
                  onPress={() => {
                    if (deleteArmedAssessmentId !== null) setDeleteArmedAssessmentId(item.id);
                  }}
                >
                  <Text style={[styles.assessmentTitle, { color: colors.foreground }]}>{item.title}</Text>
                </Pressable>

                <View style={styles.metaRow}>
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {objList.length} objectifs
                  </Text>
                  <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>•</Text>
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {classPupils.length} élèves
                  </Text>
                  <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>•</Text>
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {item.date}
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  <Button
                    label="Évaluer"
                    icon="check-square"
                    compact
                    onPress={() => {
                      data.setActiveAssessment(item.id);
                      router.push(`/assessments/${item.id}`);
                    }}
                  />
                  <Button
                    label="Exporter"
                    icon="file-text"
                    compact
                    secondary
                    onPress={() => {
                      data.setActiveAssessment(item.id);
                      router.push(`/assessments/${item.id}/document`);
                    }}
                  />
                  {deleteArmedAssessmentId === item.id ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Supprimer ${item.title}`}
                      onTouchStart={(event) => event.stopPropagation()}
                      onPress={() => {
                        setDeleteArmedAssessmentId(null);
                        handleDeleteAssessment(item.id, item.title);
                      }}
                      style={[styles.deleteBtn, { backgroundColor: colors.errorSurface }]}
                    >
                      <Feather name="trash-2" size={15} color={colors.errorForeground} />
                      <Text style={[styles.deleteActionText, { color: colors.errorForeground }]}>Supprimer</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Surface>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterSection: {
    gap: 6,
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  classChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  assessmentsList: {
    gap: 12,
    paddingBottom: 24,
  },
  assessmentCard: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  classPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  compPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  compPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressNumber: {
    fontSize: 17,
    fontWeight: '800',
  },
  assessmentTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
  },
  metaDot: {
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  deleteBtn: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionText: { fontSize: 11, fontWeight: '700' },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
});
