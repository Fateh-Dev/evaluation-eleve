import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppHeader, Button, GuideAnchor, KeyboardAvoidingViewCompat, Screen, SectionTitle, Surface, ValueMark } from '@/components/AppShell';
import { EvaluationValue, useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

function displayValue(value: EvaluationValue) {
  return value === 'Acquired' ? '+' : value === 'PartiallyAcquired' ? '±' : value === 'NotAcquired' ? '-' : '·';
}

export default function AssessmentEvaluationScreen() {
  const colors = useColors();
  const data = useAppData();
  const { assessmentId, pupilId } = useLocalSearchParams<{ assessmentId: string; pupilId?: string }>();

  const currentAssessment = useMemo(() => {
    return (assessmentId ? data.getAssessment(assessmentId) : null) ?? data.assessment;
  }, [assessmentId, data.assessments, data.assessment]);

  const currentClass = useMemo(() => {
    return data.classes.find((c) => c.id === currentAssessment.classId) ?? data.activeClass;
  }, [data.classes, currentAssessment.classId, data.activeClass]);

  const currentPupils = useMemo(() => {
    return data.getPupilsForClass(currentAssessment.classId);
  }, [data.pupils, currentAssessment.classId]);

  const currentObjectives = useMemo(() => {
    return data.getObjectivesForAssessment(currentAssessment.id);
  }, [data.objectives, currentAssessment.id]);

  const currentEvaluations = useMemo(() => {
    return data.getEvaluationsForAssessment(currentAssessment.id);
  }, [data.evaluations, currentAssessment.id]);

  const absentPupilIds = useMemo(
    () => new Set(
      data.getAbsentPupilIdsForAssessment(currentAssessment.id)
        .filter((id) => currentPupils.some((pupil) => pupil.id === id)),
    ),
    [data.absentPupilIds, currentAssessment.id, currentPupils],
  );
  const presentPupilCount = currentPupils.length - absentPupilIds.size;

  const currentStatistics = useMemo(() => {
    return data.getStatisticsForAssessment(currentAssessment.id);
  }, [data.pupils, data.objectives, data.evaluations, data.absentPupilIds, currentAssessment.id]);

  const [pupilIndex, setPupilIndex] = useState(() => {
    const index = currentPupils.findIndex((pupil) => pupil.id === pupilId);
    return index >= 0 ? index : 0;
  });
  const [objectivesModalVisible, setObjectivesModalVisible] = useState(false);
  const [assessmentDeleteArmed, setAssessmentDeleteArmed] = useState(false);
  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const mobileScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!savedMessage) return;
    const timer = setTimeout(() => setSavedMessage(null), 2200);
    return () => clearTimeout(timer);
  }, [savedMessage]);

  const isDesktop = Platform.OS === 'web' && Dimensions.get('window').width >= 850;

  const currentPupil = currentPupils[pupilIndex] ?? currentPupils[0] ?? {
    id: 'unknown',
    registrationNumber: '01',
    firstName: 'Élève',
    lastName: '',
    classId: currentClass.id,
  };

  const evaluatedTotal = currentStatistics.reduce((sum, stat) => sum + stat.evaluated, 0);
  const total = presentPupilCount * currentObjectives.length;
  const progressPercentage =
    total > 0 ? Math.round((evaluatedTotal / total) * 100) : 0;
  const currentValues = useMemo(
    () => currentEvaluations[currentPupil.id] ?? {},
    [currentEvaluations, currentPupil.id],
  );

  const confirmMarkAll = (objectiveId: string) => {
    Alert.alert('Marquer tous les élèves', 'Cette action remplacera les valeurs de la colonne sélectionnée.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Marquer +',
        onPress: () => data.setAllForObjective(objectiveId, 'Acquired', currentAssessment.id),
      },
    ]);
  };

  const handleDeleteAssessment = () => {
    Alert.alert(
      'Supprimer l’évaluation',
      `Êtes-vous sûr de vouloir supprimer cette évaluation ("${currentAssessment.title}") ?\n\nToutes les notes et objectifs seront définitivement effacés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            data.deleteAssessment(currentAssessment.id);
            Alert.alert('Évaluation supprimée', 'L’évaluation a été supprimée.');
            router.replace('/assessments');
          },
        },
      ],
    );
  };

  const handleDeleteObjective = (objectiveId: string, order: number, description: string) => {
    Alert.alert(
      'Supprimer l’objectif',
      `Voulez-vous supprimer l'objectif ${order} : "${description}" ?\n\nLes évaluations associées à cet objectif seront effacées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            data.removeObjective(currentAssessment.id, objectiveId);
          },
        },
      ],
    );
  };

  const handleAddObjective = () => {
    if (!newObjectiveText.trim()) return;
    data.addObjective(currentAssessment.id, newObjectiveText.trim());
    setNewObjectiveText('');
  };

  const save = async (
    message = 'Évaluation enregistrée sur cet appareil',
  ): Promise<boolean> => {
    try {
      await data.saveLocally();
    } catch {
      Alert.alert(
        'Enregistrement impossible',
        'Les données n’ont pas pu être enregistrées sur cet appareil. Vérifiez l’espace de stockage disponible.',
      );
      return false;
    }
    setSavedMessage(message);
    return true;
  };

  const saveAndNext = async () => {
    const isLastPupil = pupilIndex >= currentPupils.length - 1;
    const saved = await save(
      isLastPupil
        ? 'Dernière évaluation enregistrée sur cet appareil'
        : 'Enregistré — passage à l’élève suivant',
    );
    if (!saved) return;
    if (!isLastPupil) {
      setPupilIndex((value) => Math.min(currentPupils.length - 1, value + 1));
      requestAnimationFrame(() => mobileScrollRef.current?.scrollTo({ y: 0, animated: true }));
    }
  };

  if (!currentAssessment || !currentAssessment.id) {
    return (
      <Screen>
        <AppHeader eyebrow="Évaluation" title="Évaluation introuvable" onBack={() => router.back()} />
        <Surface style={styles.emptyCard}>
          <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyCardTitle, { color: colors.foreground }]}>
            Cette évaluation n’existe pas
          </Text>
          <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
            Elle a peut-être été supprimée ou n’a pas encore été créée.
          </Text>
          <Button label="Retour aux tests de niveau" icon="arrow-left" onPress={() => router.replace('/assessments')} />
        </Surface>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} bottomPadding={20} onTouchStart={() => setAssessmentDeleteArmed(false)}>
      <AppHeader
        eyebrow="Évaluation"
        title={currentAssessment.title}
        onBack={() => router.back()}
        onTitleLongPress={() => setAssessmentDeleteArmed(true)}
        titleActionArmed={assessmentDeleteArmed}
        compact
      />

      <GuideAnchor
        id="evaluation-actions"
        title="Actions de l’évaluation"
        description="Enregistrez les résultats, gérez les objectifs, ouvrez l’analyse ou exportez la grille."
        style={styles.topLine}
      >
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enregistrer"
            onPress={() => { void save(); }}
            style={({ pressed }) => [
              styles.topIconBtn,
              { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="save" size={20} color={colors.primaryForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Objectifs"
            onPress={() => setObjectivesModalVisible(true)}
            style={[styles.topIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="list" size={20} color={colors.foreground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Analyse"
            onPress={() => router.push(`/assessments/${currentAssessment.id}/analysis`)}
            style={[styles.topIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="bar-chart-2" size={20} color={colors.foreground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exporter"
            onPress={() => router.push(`/assessments/${currentAssessment.id}/document`)}
            style={[styles.topIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="file-text" size={20} color={colors.foreground} />
          </Pressable>
        </View>
        {assessmentDeleteArmed ? (
          <Pressable
            onPress={() => {
              setAssessmentDeleteArmed(false);
              handleDeleteAssessment();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Supprimer l’évaluation"
            onTouchStart={(event) => event.stopPropagation()}
            style={[styles.deleteTopBtn, { backgroundColor: colors.errorSurface, borderColor: colors.errorForeground }]}
          >
            <Feather name="trash-2" size={20} color={colors.errorForeground} />
          </Pressable>
        ) : null}
      </GuideAnchor>
        {savedMessage ? (
        <View style={[styles.savedBanner, { backgroundColor: colors.successSurface, borderColor: colors.successForeground }]} accessibilityLiveRegion="polite">
          <Feather name="check-circle" size={16} color={colors.successForeground} />
          <Text style={[styles.savedBannerText, { color: colors.successForeground }]}>{savedMessage}</Text>
        </View>
      ) : null}

      <Surface
        style={styles.metaCard}
        guideTitle="Résumé de l’évaluation"
        guideDescription="Affiche les informations de la classe, de la compétence et de la séance."
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            summaryExpanded
              ? 'Réduire le résumé de l’évaluation'
              : 'Afficher le résumé de l’évaluation'
          }
          accessibilityState={{ expanded: summaryExpanded }}
          onPress={() => setSummaryExpanded((expanded) => !expanded)}
          style={styles.metaHeader}
        >
          <View style={styles.metaHeaderCopy}>
            <View style={[styles.metaIcon, { backgroundColor: colors.accent }]}>
              <Feather name="activity" size={16} color={colors.primary} />
            </View>
            <View style={styles.metaHeaderText}>
              <Text style={[styles.metaHeading, { color: colors.foreground }]}>
                Résumé de l’évaluation
              </Text>
              {!summaryExpanded && (
                <Text style={[styles.metaCollapsedText, { color: colors.mutedForeground }]}>
                  {currentClass.name} · {currentAssessment.competency}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.metaHeaderTrailing}>
            <Text style={[styles.metaProgressBadge, { color: colors.primary }]}>
              {progressPercentage}%
            </Text>
            <Feather
              name={summaryExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.mutedForeground}
            />
          </View>
        </Pressable>
        {summaryExpanded && (
          <View style={styles.metaDetails}>
            <View style={styles.metaInfoRow}>
              <View style={[styles.metaInfoItem, { backgroundColor: colors.background }]}>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>CLASSE</Text>
                <Text style={[styles.metaValue, { color: colors.foreground }]} numberOfLines={2}>
                  {currentClass.name}
                </Text>
              </View>
              <View style={[styles.metaInfoItem, { backgroundColor: colors.background }]}>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>COMPÉTENCE</Text>
                <Text style={[styles.metaValue, { color: colors.foreground }]} numberOfLines={2}>
                  {currentAssessment.competency}
                </Text>
              </View>
            </View>
            <View style={styles.metaProgress}>
              <View style={styles.metaProgressTop}>
                <View>
                  <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>
                    PROGRESSION
                  </Text>
                  <Text style={[styles.metaProgressCount, { color: colors.foreground }]}>
                    {evaluatedTotal} / {total} évaluations complétées
                  </Text>
                  <Text style={[styles.attendanceSummary, { color: colors.mutedForeground }]}>
                    {presentPupilCount} présents · {absentPupilIds.size} absents
                  </Text>
                </View>
                <View style={[styles.metaObjectivesBadge, { backgroundColor: colors.secondary }]}>
                  <Feather name="list" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.metaObjectivesText, { color: colors.foreground }]}>
                    {currentObjectives.length} objectif{currentObjectives.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <View style={[styles.metaProgressTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.metaProgressFill,
                    {
                      width: `${Math.max(0, Math.min(100, progressPercentage))}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}
      </Surface>

      {/* Empty pupils banner */}
      {currentPupils.length === 0 ? (
        <Surface style={styles.emptyCard}>
          <Feather name="users" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyCardTitle, { color: colors.foreground }]}>
            Aucun élève dans cette classe
          </Text>
          <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
            Ajoutez des élèves dans la classe {currentClass.name} pour commencer à les évaluer.
          </Text>
          <Button
            label="Gérer les élèves de la classe"
            icon="user-plus"
            onPress={() => router.push(`/classes/${currentClass.id}`)}
          />
        </Surface>
      ) : currentObjectives.length === 0 ? (
        <Surface style={styles.emptyCard}>
          <Feather name="list" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyCardTitle, { color: colors.foreground }]}>
            Aucun objectif d'évaluation
          </Text>
          <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
            Ajoutez au moins un objectif pour pouvoir évaluer les compétences.
          </Text>
          <Button
            label="Ajouter un objectif"
            icon="plus"
            onPress={() => setObjectivesModalVisible(true)}
          />
        </Surface>
      ) : isDesktop ? (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.gridScroll}>
          <View style={styles.grid}>
            <View style={[styles.gridRow, styles.gridHeader, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={[styles.nameCell, styles.headerCell]}>
                <Text style={[styles.headerText, { color: colors.foreground }]}>Élève</Text>
              </View>
              {currentObjectives.map((objective) => (
                <View
                  key={objective.id}
                  style={styles.objectiveCell}
                >
                  <View style={styles.objCellHeader}>
                    <Text style={[styles.objectiveNumber, { color: colors.foreground }]}>
                      {String(objective.order).padStart(2, '0')}
                    </Text>
                    <Pressable onTouchStart={(event) => event.stopPropagation()} onPress={() => handleDeleteObjective(objective.id, objective.order, objective.description)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Supprimer l’objectif ${objective.order}`}>
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                    </Pressable>
                  </View>
                  <Pressable onPress={() => confirmMarkAll(objective.id)}>
                    <Text style={[styles.markAll, { color: colors.primary }]}>marquer +</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {currentPupils.map((pupil, rowIndex) => (
              <View
                key={pupil.id}
                style={[
                  styles.gridRow,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: rowIndex % 2 ? colors.card : colors.background,
                  },
                ]}
              >
                <View style={styles.nameCell}>
                  <Text style={[styles.pupilName, { color: colors.foreground }]}>
                    {pupil.lastName} {pupil.firstName}
                  </Text>
                  <View style={styles.desktopPupilMeta}>
                    <Text style={[styles.pupilNumber, { color: colors.mutedForeground }]}>
                      N° {pupil.registrationNumber}
                    </Text>
                    <Pressable
                      onPress={() => data.setPupilAbsent(pupil.id, !absentPupilIds.has(pupil.id), currentAssessment.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${absentPupilIds.has(pupil.id) ? 'Marquer présent' : 'Marquer absent'} : ${pupil.lastName} ${pupil.firstName}`}
                      style={[
                        styles.attendanceToggle,
                        { backgroundColor: absentPupilIds.has(pupil.id) ? colors.errorSurface : colors.successSurface },
                      ]}
                    >
                      <Text style={[
                        styles.attendanceToggleText,
                        { color: absentPupilIds.has(pupil.id) ? colors.errorForeground : colors.successForeground },
                      ]}>
                        {absentPupilIds.has(pupil.id) ? 'Absent' : 'Présent'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {currentObjectives.map((objective) => {
                  const value = currentEvaluations[pupil.id]?.[objective.id] ?? 'NotEvaluated';
                  return (
                    <Pressable
                      key={objective.id}
                      onPress={() => data.cycleEvaluation(pupil.id, objective.id, currentAssessment.id)}
                      disabled={absentPupilIds.has(pupil.id)}
                      style={[styles.cell, absentPupilIds.has(pupil.id) && styles.absentCell]}
                    >
                      {absentPupilIds.has(pupil.id)
                        ? <Text style={[styles.absentCellText, { color: colors.errorForeground }]}>ABS</Text>
                        : <ValueMark value={value} size="small" />}
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <View style={[styles.totalRow, { backgroundColor: colors.secondary }]}>
              <View style={styles.nameCell}>
                <Text style={[styles.headerText, { color: colors.foreground }]}>Total</Text>
              </View>
              {currentStatistics.map((stat) => (
                <View key={stat.objectiveId} style={styles.cell}>
                  <Text style={[styles.totalText, { color: colors.primary }]}>
                    {stat.acquiredPercent}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
          <ScrollView
            ref={mobileScrollRef}
            style={styles.mobileScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={styles.mobileContent}
          >
          <View style={styles.pupilNavigator}>
            <Pressable
              disabled={pupilIndex === 0}
              onPress={() => setPupilIndex((value) => Math.max(0, value - 1))}
              style={[
                styles.navButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pupilIndex === 0 ? 0.4 : 1,
                },
              ]}
            >
              <Feather name="chevron-left" size={18} color={colors.foreground} />
              <Text style={[styles.navText, { color: colors.foreground }]}>Précédent</Text>
            </Pressable>

            <View style={styles.pupilHeading}>
              <Text style={[styles.pupilIndex, { color: colors.primary }]}>
                {String(pupilIndex + 1).padStart(2, '0')} / {currentPupils.length}
              </Text>
              <Text style={[styles.mobilePupilName, { color: colors.foreground }]}>
                {currentPupil.lastName} {currentPupil.firstName}
              </Text>
              <Pressable
                onPress={() => data.setPupilAbsent(currentPupil.id, !absentPupilIds.has(currentPupil.id), currentAssessment.id)}
                accessibilityRole="button"
                accessibilityLabel={`${absentPupilIds.has(currentPupil.id) ? 'Marquer présent' : 'Marquer absent'} : ${currentPupil.lastName} ${currentPupil.firstName}`}
                style={[
                  styles.attendanceToggle,
                  { backgroundColor: absentPupilIds.has(currentPupil.id) ? colors.errorSurface : colors.successSurface },
                ]}
              >
                <Text style={[
                  styles.attendanceToggleText,
                  { color: absentPupilIds.has(currentPupil.id) ? colors.errorForeground : colors.successForeground },
                ]}>
                  {absentPupilIds.has(currentPupil.id) ? 'Absent · toucher pour marquer présent' : 'Marquer absent'}
                </Text>
              </Pressable>
            </View>

            <Pressable
              disabled={pupilIndex === currentPupils.length - 1}
              onPress={() => setPupilIndex((value) => Math.min(currentPupils.length - 1, value + 1))}
              style={[
                styles.navButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pupilIndex === currentPupils.length - 1 ? 0.4 : 1,
                },
              ]}
            >
              <Text style={[styles.navText, { color: colors.foreground }]}>Suivant</Text>
              <Feather name="chevron-right" size={18} color={colors.foreground} />
            </Pressable>
          </View>

          {absentPupilIds.has(currentPupil.id) ? (
            <Surface style={[styles.absentNotice, { backgroundColor: colors.errorSurface }]}>
              <Feather name="user-x" size={18} color={colors.errorForeground} />
              <Text style={[styles.absentNoticeText, { color: colors.errorForeground }]}>
                Élève absent à cette évaluation. Ses résultats sont exclus des statistiques.
              </Text>
            </Surface>
          ) : null}
          <View style={styles.mobileObjectives}>
            {currentObjectives.map((objective) => {
              const value = currentValues[objective.id] ?? 'NotEvaluated';
              return (
                <Surface
                  key={objective.id}
                  style={styles.mobileObjective}
                >
                  <View style={styles.objectiveCopy}>
                    <View style={styles.objectiveHeaderRow}>
                      <Text style={[styles.mobileObjectiveNumber, { color: colors.primary }]}>
                        OBJECTIF {String(objective.order).padStart(2, '0')}
                      </Text>
                      <Pressable onTouchStart={(event) => event.stopPropagation()} onPress={() => handleDeleteObjective(objective.id, objective.order, objective.description)} hitSlop={8} style={styles.trashObjBtn} accessibilityRole="button" accessibilityLabel={`Supprimer l’objectif ${objective.order}`}>
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                      </Pressable>
                    </View>
                    <Text style={[styles.mobileObjectiveText, { color: colors.foreground }]}>
                      {objective.description}
                    </Text>
                  </View>

                  <View style={styles.valueButtons}>
                    {(['Acquired', 'PartiallyAcquired', 'NotAcquired'] as EvaluationValue[]).map((choice) => (
                      <Pressable
                        key={choice}
                        disabled={absentPupilIds.has(currentPupil.id)}
                        onPress={() =>
                          data.setEvaluation(currentPupil.id, objective.id, choice, currentAssessment.id)
                        }
                        style={[
                          styles.choiceButton,
                          {
                            backgroundColor: value === choice ? colors.primary : colors.secondary,
                            borderColor: value === choice ? colors.primary : colors.border,
                            opacity: absentPupilIds.has(currentPupil.id) ? 0.45 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            { color: value === choice ? colors.primaryForeground : colors.foreground },
                          ]}
                        >
                          {displayValue(choice)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Surface>
              );
            })}
          </View>

          <View style={styles.mobileFooter}>
            <Button
              label={pupilIndex === currentPupils.length - 1 ? 'Terminer' : 'Enregistrer et suivant'}
              icon={pupilIndex === currentPupils.length - 1 ? 'check' : 'arrow-right'}
              onPress={() => { void saveAndNext(); }}
            />
          </View>
        </ScrollView>
      )}

      {/* MODAL: MANAGE OBJECTIVES */}
      <Modal
        visible={objectivesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setObjectivesModalVisible(false)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalOverlay}>
          <Surface style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Objectifs d'évaluation
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                  {currentAssessment.competency} ({currentObjectives.length} objectifs)
                </Text>
              </View>
              <Pressable
                onPress={() => setObjectivesModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Add New Objective Input */}
            <View style={styles.addObjBox}>
              <TextInput
                placeholder="Nouvel objectif d’évaluation…"
                placeholderTextColor={colors.mutedForeground}
                value={newObjectiveText}
                onChangeText={setNewObjectiveText}
                style={[
                  styles.addObjInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
              <Button label="Ajouter" icon="plus" compact onPress={handleAddObjective} />
            </View>

            {/* List of Existing Objectives */}
            <ScrollView style={styles.objScrollList} showsVerticalScrollIndicator={false}>
              {currentObjectives.map((obj) => (
                <View
                  key={obj.id}
                  style={[styles.objListItem, { borderBottomColor: colors.border }]}
                >
                  <View style={[styles.objOrderBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.objOrderText, { color: colors.foreground }]}>
                      {String(obj.order).padStart(2, '0')}
                    </Text>
                  </View>
                  <Text style={[styles.objListDesc, { color: colors.foreground }]}>
                    {obj.description}
                  </Text>
                  <Pressable onTouchStart={(event) => event.stopPropagation()} onPress={() => handleDeleteObjective(obj.id, obj.order, obj.description)} hitSlop={8} style={styles.trashObjBtn} accessibilityRole="button" accessibilityLabel={`Supprimer l’objectif ${obj.order}`}>
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <Button
              label="Fermer"
              secondary
              onPress={() => setObjectivesModalVisible(false)}
            />
          </Surface>
        </KeyboardAvoidingViewCompat>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topLine: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 12 },
  savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  savedBannerText: { fontSize: 12, fontWeight: '700' },
  topActions: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  topIconBtn: { width: 48, height: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deleteTopBtn: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  metaCard: { gap: 14, padding: 14, marginBottom: 12 },
  metaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 36 },
  metaHeaderCopy: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  metaIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metaHeaderText: { flex: 1, minWidth: 0, gap: 2 },
  metaHeading: { fontSize: 13, fontWeight: '800' },
  metaCollapsedText: { fontSize: 10, lineHeight: 14 },
  metaHeaderTrailing: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaProgressBadge: { fontSize: 13, fontWeight: '800' },
  metaDetails: { gap: 12 },
  metaInfoRow: { flexDirection: 'row', gap: 8 },
  metaInfoItem: { flex: 1, minWidth: 0, gap: 4, borderRadius: 11, padding: 10 },
  metaLabel: { fontSize: 9, letterSpacing: 1, fontWeight: '800' },
  metaValue: { fontSize: 13, fontWeight: '700' },
  metaProgress: { gap: 9, paddingHorizontal: 2 },
  metaProgressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metaProgressCount: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  attendanceSummary: { fontSize: 10, marginTop: 3, fontWeight: '600' },
  metaObjectivesBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  metaObjectivesText: { fontSize: 10, fontWeight: '700' },
  metaProgressTrack: { height: 7, borderRadius: 5, overflow: 'hidden' },
  metaProgressFill: { height: '100%', borderRadius: 5 },
  gridScroll: { paddingBottom: 24 },
  grid: { minWidth: 740, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  gridRow: { flexDirection: 'row', borderBottomWidth: 1, minHeight: 53, alignItems: 'stretch' },
  gridHeader: { minHeight: 65, borderBottomWidth: 1 },
  headerCell: { justifyContent: 'center' },
  nameCell: { width: 190, paddingHorizontal: 13, justifyContent: 'center' },
  headerText: { fontSize: 13, fontWeight: '800' },
  objectiveCell: { width: 83, alignItems: 'center', justifyContent: 'center', gap: 4 },
  objCellHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  objectiveNumber: { fontSize: 13, fontWeight: '800' },
  markAll: { fontSize: 9, fontWeight: '700' },
  pupilName: { fontSize: 12, fontWeight: '700' },
  pupilNumber: { fontSize: 10, marginTop: 3 },
  desktopPupilMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  attendanceToggle: { alignSelf: 'center', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  attendanceToggleText: { fontSize: 10, fontWeight: '800' },
  absentCell: { backgroundColor: '#FDE8E7' },
  absentCellText: { fontSize: 9, fontWeight: '800' },
  cell: { width: 83, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', minHeight: 50 },
  totalText: { fontSize: 11, fontWeight: '800' },
  mobileScroll: { flex: 1 },
  mobileContent: { flexGrow: 1, paddingBottom: 30 },
  pupilNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, gap: 8 },
  navButton: { minHeight: 40, maxWidth: '34%', borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  navText: { fontSize: 11, fontWeight: '700' },
  pupilHeading: { alignItems: 'center', flex: 1, gap: 3 },
  pupilIndex: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  mobilePupilName: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  absentNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 12, marginBottom: 10 },
  absentNoticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  mobileObjectives: { gap: 10 },
  mobileObjective: { gap: 13, padding: 14 },
  objectiveCopy: { gap: 5 },
  objectiveHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trashObjBtn: { padding: 4 },
  mobileObjectiveNumber: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  mobileObjectiveText: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  valueButtons: { flexDirection: 'row', gap: 8 },
  choiceButton: { flex: 1, minHeight: 43, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontSize: 19, fontWeight: '800' },
  mobileFooter: { gap: 9, marginTop: 16 },
  emptyCard: { padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, marginTop: 20 },
  emptyCardTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptyCardText: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addObjBox: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addObjInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  objScrollList: { maxHeight: 300 },
  objListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  objOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  objOrderText: { fontSize: 12, fontWeight: '800' },
  objListDesc: { flex: 1, fontSize: 13, lineHeight: 17 },
});
