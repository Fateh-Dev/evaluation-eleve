import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { AppHeader, Button, Screen, SectionTitle, Surface, SyncPill, ValueMark } from '@/components/AppShell';
import { EvaluationValue, useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { useSaveBulkEvaluations } from '@workspace/api-client-react';

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

  const currentStatistics = useMemo(() => {
    return data.getStatisticsForAssessment(currentAssessment.id);
  }, [data.pupils, data.objectives, data.evaluations, currentAssessment.id]);

  const [pupilIndex, setPupilIndex] = useState(() => {
    const index = currentPupils.findIndex((pupil) => pupil.id === pupilId);
    return index >= 0 ? index : 0;
  });
  const [objectivesModalVisible, setObjectivesModalVisible] = useState(false);
  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
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

  const saveMutation = useSaveBulkEvaluations();
  const evaluatedTotal = currentStatistics.reduce((sum, stat) => sum + stat.evaluated, 0);
  const total = Math.max(currentPupils.length * currentObjectives.length, 1);
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

  const save = (message = 'Évaluation enregistrée') => {
    data.saveDraft();
    const entries = currentPupils.flatMap((pupil) =>
      currentObjectives.map((objective) => ({
        pupilId: pupil.id,
        objectiveId: objective.id,
        value: currentEvaluations[pupil.id]?.[objective.id] ?? 'NotEvaluated',
      })),
    );
    saveMutation.mutate(
      { assessmentId: currentAssessment.id, data: entries },
      {
        onSuccess: () => data.markSynced(),
        onError: () => {
          if (Platform.OS !== 'web') {
            Alert.alert('Enregistrement local', 'Le serveur est indisponible. Votre brouillon reste disponible hors connexion.');
          }
        },
      },
    );
    setSavedMessage(message);
  };

  const saveAndNext = () => {
    const isLastPupil = pupilIndex >= currentPupils.length - 1;
    save(isLastPupil ? 'Dernière évaluation enregistrée' : 'Enregistré — passage à l’élève suivant');
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
          <Button label="Retour aux évaluations" icon="arrow-left" onPress={() => router.replace('/assessments')} />
        </Surface>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppHeader
        eyebrow={`${currentClass.name || 'Classe'} · ${currentAssessment.competency}`}
        title={currentAssessment.title}
        onBack={() => router.back()}
      />

      <View style={styles.topLine}>
        <SyncPill status={data.isDirty || saveMutation.isPending ? 'pending' : data.syncStatus} />
        <View style={styles.topActions}>
          <Button
            label={saveMutation.isPending ? 'Envoi…' : 'Enregistrer'}
            icon="save"
            compact
            onPress={save}
          />
          <Button
            label="Objectifs"
            icon="list"
            compact
            secondary
            onPress={() => setObjectivesModalVisible(true)}
          />
          <Button
            label="Analyse"
            icon="bar-chart-2"
            compact
            secondary
            onPress={() => router.push(`/assessments/${currentAssessment.id}/analysis`)}
          />
          <Button
            label="Export"
            icon="file-text"
            compact
            secondary
            onPress={() => router.push(`/assessments/${currentAssessment.id}/document`)}
          />
          <Pressable
            onPress={handleDeleteAssessment}
            hitSlop={8}
            style={[styles.deleteTopBtn, { backgroundColor: colors.errorSurface }]}
          >
            <Feather name="trash-2" size={16} color={colors.errorForeground} />
          </Pressable>
        </View>
      </View>
      {savedMessage ? (
        <View style={[styles.savedBanner, { backgroundColor: colors.successSurface, borderColor: colors.successForeground }]} accessibilityLiveRegion="polite">
          <Feather name="check-circle" size={16} color={colors.successForeground} />
          <Text style={[styles.savedBannerText, { color: colors.successForeground }]}>{savedMessage}</Text>
        </View>
      ) : null}

      <Surface style={styles.metaCard}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>CLASSE</Text>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{currentClass.name}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>COMPÉTENCE</Text>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{currentAssessment.competency}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>OBJECTIFS</Text>
          <Text style={[styles.metaValue, { color: colors.foreground }]}>{currentObjectives.length}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>PROGRESSION</Text>
          <Text style={[styles.metaValue, { color: colors.primary }]}>
            {Math.round((evaluatedTotal / total) * 100)}%
          </Text>
        </View>
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
                <View key={objective.id} style={styles.objectiveCell}>
                  <View style={styles.objCellHeader}>
                    <Text style={[styles.objectiveNumber, { color: colors.foreground }]}>
                      {String(objective.order).padStart(2, '0')}
                    </Text>
                    <Pressable
                      onPress={() => handleDeleteObjective(objective.id, objective.order, objective.description)}
                      hitSlop={6}
                    >
                      <Feather name="trash-2" size={12} color={colors.destructive} />
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
                  <Text style={[styles.pupilNumber, { color: colors.mutedForeground }]}>
                    N° {pupil.registrationNumber}
                  </Text>
                </View>

                {currentObjectives.map((objective) => {
                  const value = currentEvaluations[pupil.id]?.[objective.id] ?? 'NotEvaluated';
                  return (
                    <Pressable
                      key={objective.id}
                      onPress={() => data.cycleEvaluation(pupil.id, objective.id, currentAssessment.id)}
                      style={styles.cell}
                    >
                      <ValueMark value={value} size="small" />
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
        <ScrollView ref={mobileScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.mobileContent}>
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

          <View style={styles.mobileObjectives}>
            {currentObjectives.map((objective) => {
              const value = currentValues[objective.id] ?? 'NotEvaluated';
              return (
                <Surface key={objective.id} style={styles.mobileObjective}>
                  <View style={styles.objectiveCopy}>
                    <View style={styles.objectiveHeaderRow}>
                      <Text style={[styles.mobileObjectiveNumber, { color: colors.primary }]}>
                        OBJECTIF {String(objective.order).padStart(2, '0')}
                      </Text>
                      <Pressable
                        onPress={() => handleDeleteObjective(objective.id, objective.order, objective.description)}
                        hitSlop={8}
                        style={styles.trashObjBtn}
                      >
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
                        onPress={() =>
                          data.setEvaluation(currentPupil.id, objective.id, choice, currentAssessment.id)
                        }
                        style={[
                          styles.choiceButton,
                          {
                            backgroundColor: value === choice ? colors.primary : colors.secondary,
                            borderColor: value === choice ? colors.primary : colors.border,
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
            <Button label="Enregistrer" icon="save" onPress={save} />
            <Button label={pupilIndex === currentPupils.length - 1 ? 'Terminer' : 'Enregistrer et suivant'} icon="arrow-right" secondary onPress={saveAndNext} />
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
        <View style={styles.modalOverlay}>
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
                  <Pressable
                    onPress={() => handleDeleteObjective(obj.id, obj.order, obj.description)}
                    hitSlop={8}
                    style={styles.trashObjBtn}
                  >
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
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  savedBannerText: { fontSize: 12, fontWeight: '700' },
  topActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, flexShrink: 1 },
  deleteTopBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCard: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, padding: 12, marginBottom: 12 },
  metaItem: { gap: 3, minWidth: 70, flex: 1 },
  metaLabel: { fontSize: 9, letterSpacing: 1, fontWeight: '800' },
  metaValue: { fontSize: 13, fontWeight: '700' },
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
  cell: { width: 83, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', minHeight: 50 },
  totalText: { fontSize: 11, fontWeight: '800' },
  mobileContent: { paddingBottom: 30 },
  pupilNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, gap: 8 },
  navButton: { minHeight: 40, maxWidth: '34%', borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  navText: { fontSize: 11, fontWeight: '700' },
  pupilHeading: { alignItems: 'center', flex: 1, gap: 3 },
  pupilIndex: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  mobilePupilName: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
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
