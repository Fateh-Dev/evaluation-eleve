import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, KeyboardAvoidingViewCompat, Screen, SectionTitle, Surface, ValueMark } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import {
  calculateAbsenceScore,
  calculateContinuousTotal,
  calculateDisciplineScore,
  isValidManualScore,
} from '@/services/continuousEvaluation';

export default function PupilDetailScreen() {
  const colors = useColors();
  const { pupilId } = useLocalSearchParams<{ pupilId: string }>();
  const data = useAppData();
  const pupil = data.pupils.find((item) => item.id === pupilId);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const pupilClass = data.classes.find(
    (classItem) => classItem.id === pupil?.classId,
  );
  const pupilAssessments = data.assessments.filter(
    (assessment) => assessment.classId === pupil?.classId,
  );
  const pupilAssessment =
    pupilAssessments.find(
      (assessment) => assessment.id === data.assessment.id,
    ) ?? pupilAssessments[0];
  const pupilObjectives = pupilAssessment
    ? data.getObjectivesForAssessment(pupilAssessment.id)
    : [];
  const pupilEvaluations = pupilAssessment
    ? data.getEvaluationsForAssessment(pupilAssessment.id)[pupil?.id ?? ''] ?? {}
    : {};
  const continuousEvaluation = pupil && pupilClass
    ? data.getContinuousEvaluation(pupil.id, pupilClass.id, pupilClass.academicYear)
    : undefined;
  const disciplineEvents = continuousEvaluation
    ? data.getDisciplineEventsForEvaluation(continuousEvaluation.id)
    : [];
  const attendanceRecords = pupilClass
    ? data.getAttendanceRecordsForClass(pupilClass.id)
    : [];
  const absenceStatistics = attendanceRecords.reduce(
    (statistics, record) => {
      const status = pupil ? record.statuses[pupil.id] : undefined;
      if (status === 'present') {
        statistics.totalSessions += 1;
        statistics.presentCount += 1;
      } else if (status === 'absent') {
        statistics.totalSessions += 1;
        statistics.absentCount += 1;
      }
      return statistics;
    },
    { totalSessions: 0, presentCount: 0, absentCount: 0 },
  );
  const absenceScore = calculateAbsenceScore(absenceStatistics, {
    penaltyPerAbsence: data.continuousEvaluationSettings.absencePenaltyPerAbsence,
    maximumScore: 5,
  });
  const disciplineScore = calculateDisciplineScore(
    disciplineEvents.map((event) => event.penalty),
  );
  const totalScore = calculateContinuousTotal({
    cahierScore: continuousEvaluation?.cahierScore ?? 0,
    participationScore: continuousEvaluation?.participationScore ?? 0,
    absenceScore,
    disciplineScore,
  });
  const [cahierInput, setCahierInput] = useState('0');
  const [participationInput, setParticipationInput] = useState('0');
  const [disciplineComment, setDisciplineComment] = useState('');
  const [disciplinePenaltyInput, setDisciplinePenaltyInput] = useState(
    String(data.continuousEvaluationSettings.disciplinePenalty),
  );
  const [absencePenaltyInput, setAbsencePenaltyInput] = useState(
    String(data.continuousEvaluationSettings.absencePenaltyPerAbsence),
  );

  useEffect(() => {
    setCahierInput(String(continuousEvaluation?.cahierScore ?? 0));
    setParticipationInput(String(continuousEvaluation?.participationScore ?? 0));
  }, [continuousEvaluation?.id, continuousEvaluation?.cahierScore, continuousEvaluation?.participationScore]);

  useEffect(() => {
    setDisciplinePenaltyInput(String(data.continuousEvaluationSettings.disciplinePenalty));
    setAbsencePenaltyInput(String(data.continuousEvaluationSettings.absencePenaltyPerAbsence));
  }, [data.continuousEvaluationSettings.disciplinePenalty, data.continuousEvaluationSettings.absencePenaltyPerAbsence]);

  const saveContinuousScore = (field: 'cahierScore' | 'participationScore', value: string) => {
    if (!pupil || !pupilClass) return;
    const score = Number(value.replace(',', '.'));
    if (!value.trim() || !isValidManualScore(score)) {
      Alert.alert('Note invalide', 'La note doit être comprise entre 0 et 5.');
      setCahierInput(String(continuousEvaluation?.cahierScore ?? 0));
      setParticipationInput(String(continuousEvaluation?.participationScore ?? 0));
      return;
    }
    if (!data.setContinuousEvaluationScore(
      pupil.id,
      pupilClass.id,
      pupilClass.academicYear,
      field,
      score,
    )) {
      Alert.alert('Enregistrement impossible', 'La note n’a pas pu être sauvegardée.');
    }
  };

  const savePenaltySettings = (field: 'disciplinePenalty' | 'absencePenaltyPerAbsence', value: string) => {
    const penalty = Number(value.replace(',', '.'));
    const valid = Boolean(value.trim()) &&
      Number.isFinite(penalty) &&
      penalty >= (field === 'disciplinePenalty' ? 0.01 : 0) &&
      penalty <= 5;
    if (!valid || !data.updateContinuousEvaluationSettings({ [field]: penalty })) {
      Alert.alert('Valeur invalide', 'Saisissez une valeur comprise entre 0 et 5 (strictement supérieure à 0 pour la discipline).');
      setDisciplinePenaltyInput(String(data.continuousEvaluationSettings.disciplinePenalty));
      setAbsencePenaltyInput(String(data.continuousEvaluationSettings.absencePenaltyPerAbsence));
    }
  };

  const addDisciplineEvent = () => {
    if (!pupil || !pupilClass) return;
    if (!data.addDisciplinePenalty(
      pupil.id,
      pupilClass.id,
      pupilClass.academicYear,
      disciplineComment,
    )) {
      Alert.alert('Enregistrement impossible', 'La pénalité disciplinaire n’a pas pu être enregistrée.');
      return;
    }
    setDisciplineComment('');
  };

  const removeDisciplineEvent = (eventId: string) => {
    Alert.alert('Annuler cette pénalité ?', 'La note de discipline sera recalculée à partir de l’historique.', [
      { text: 'Garder', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          if (!data.deleteDisciplineEvent(eventId)) {
            Alert.alert('Suppression impossible', 'Cette pénalité n’a pas pu être supprimée.');
          }
        },
      },
    ]);
  };

  const openEditModal = () => {
    if (!pupil) return;
    setFirstNameInput(pupil.firstName);
    setLastNameInput(pupil.lastName);
    setEditModalVisible(true);
  };

  const savePupilName = () => {
    if (!pupil || !firstNameInput.trim() || !lastNameInput.trim()) {
      Alert.alert('Champs obligatoires', 'Veuillez saisir le nom et le prénom de l’élève.');
      return;
    }
    if (!data.updatePupilName(pupil.id, firstNameInput, lastNameInput)) {
      Alert.alert('Modification impossible', 'Le nom de l’élève n’a pas pu être modifié.');
      return;
    }
    setEditModalVisible(false);
  };

  if (!pupil) {
    return <Screen><AppHeader title="Élève introuvable" onBack={() => router.back()} /><Button label="Retour aux élèves" icon="arrow-left" onPress={() => router.back()} /></Screen>;
  }
  return (
    <Screen>
      <AppHeader eyebrow="Élève" title={`${pupil.firstName} ${pupil.lastName}`} onBack={() => router.back()} compact />
      <Surface style={[styles.profile, { borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.foreground }]}>
            {pupil.firstName.charAt(0)}{pupil.lastName.charAt(0)}
          </Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            {pupil.firstName} {pupil.lastName}
          </Text>
          <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>
            {pupilClass?.name ?? data.className} · {pupilClass?.academicYear ?? data.academicYear}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Modifier le nom de l’élève"
          onPress={openEditModal}
          style={[styles.editButton, { backgroundColor: colors.accent }]}
        >
          <Feather name="edit-2" size={16} color={colors.primary} />
        </Pressable>
      </Surface>
      <SectionTitle title="Évaluation continue" />
      <Surface style={[styles.continuousCard, { borderColor: colors.border }]}>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreLabel, { color: colors.foreground }]}>Cahier</Text>
          <TextInput
            accessibilityLabel="Note du cahier sur 5"
            value={cahierInput}
            onChangeText={setCahierInput}
            onEndEditing={(event) => saveContinuousScore('cahierScore', event.nativeEvent.text)}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={[styles.scoreInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          />
          <Text style={[styles.scoreDenominator, { color: colors.mutedForeground }]}>/ 5</Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreLabel, { color: colors.foreground }]}>Participation</Text>
          <TextInput
            accessibilityLabel="Note de participation sur 5"
            value={participationInput}
            onChangeText={setParticipationInput}
            onEndEditing={(event) => saveContinuousScore('participationScore', event.nativeEvent.text)}
            keyboardType="decimal-pad"
            selectTextOnFocus
            style={[styles.scoreInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          />
          <Text style={[styles.scoreDenominator, { color: colors.mutedForeground }]}>/ 5</Text>
        </View>
        <View style={[styles.scoreRow, styles.calculatedRow, { borderTopColor: colors.border }]}>
          <View style={styles.calculatedCopy}>
            <Text style={[styles.scoreLabel, { color: colors.foreground }]}>Absences</Text>
            <Text style={[styles.calculatedHint, { color: colors.mutedForeground }]}>
              Calcul automatique · {absenceStatistics.absentCount}/{absenceStatistics.totalSessions} absence(s)
            </Text>
          </View>
          <Text style={[styles.calculatedScore, { color: colors.foreground }]}>{absenceScore} / 5</Text>
        </View>
        <View style={[styles.scoreRow, styles.calculatedRow, { borderTopColor: colors.border }]}>
          <View style={styles.calculatedCopy}>
            <Text style={[styles.scoreLabel, { color: colors.foreground }]}>Discipline</Text>
            <Text style={[styles.calculatedHint, { color: colors.mutedForeground }]}>
              Pénalité : {data.continuousEvaluationSettings.disciplinePenalty} point(s)
            </Text>
          </View>
          <Text style={[styles.calculatedScore, { color: colors.foreground }]}>{disciplineScore} / 5</Text>
        </View>
        <TextInput
          accessibilityLabel="Commentaire facultatif sur la pénalité"
          value={disciplineComment}
          onChangeText={setDisciplineComment}
          placeholder="Commentaire facultatif"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.commentInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        />
        <Button label={`− Ajouter une pénalité (${data.continuousEvaluationSettings.disciplinePenalty})`} secondary onPress={addDisciplineEvent} />
        <Text style={[styles.settingsLabel, { color: colors.mutedForeground }]}>RÈGLES DE CALCUL</Text>
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsText, { color: colors.foreground }]}>Pénalité discipline</Text>
          <TextInput
            accessibilityLabel="Pénalité par événement disciplinaire"
            value={disciplinePenaltyInput}
            onChangeText={setDisciplinePenaltyInput}
            onEndEditing={(event) => savePenaltySettings('disciplinePenalty', event.nativeEvent.text)}
            keyboardType="decimal-pad"
            style={[styles.settingInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>
        <View style={styles.settingsRow}>
          <Text style={[styles.settingsText, { color: colors.foreground }]}>Par absence</Text>
          <TextInput
            accessibilityLabel="Points retirés par absence"
            value={absencePenaltyInput}
            onChangeText={setAbsencePenaltyInput}
            onEndEditing={(event) => savePenaltySettings('absencePenaltyPerAbsence', event.nativeEvent.text)}
            keyboardType="decimal-pad"
            style={[styles.settingInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>
        <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>
          Absences : 5 points moins {data.continuousEvaluationSettings.absencePenaltyPerAbsence} par absence, avec un minimum de 0.
        </Text>
        <SectionTitle title={`Historique disciplinaire (${disciplineEvents.length})`} compact />
        {disciplineEvents.length ? disciplineEvents.map((event) => (
          <View key={event.id} style={[styles.eventRow, { borderTopColor: colors.border }]}>
            <View style={styles.eventCopy}>
              <Text style={[styles.eventDate, { color: colors.foreground }]}>
                {new Date(`${event.date}T00:00:00`).toLocaleDateString('fr-FR')} · −{event.penalty}
              </Text>
              {event.comment ? (
                <Text style={[styles.calculatedHint, { color: colors.mutedForeground }]}>{event.comment}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler la pénalité"
              onPress={() => removeDisciplineEvent(event.id)}
              style={[styles.removeEventButton, { backgroundColor: colors.secondary }]}
            >
              <Feather name="trash-2" size={15} color={colors.foreground} />
            </Pressable>
          </View>
        )) : (
          <Text style={[styles.emptyHistory, { color: colors.mutedForeground }]}>
            Aucune pénalité enregistrée.
          </Text>
        )}
        <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.scoreLabel, { color: colors.foreground }]}>Total</Text>
          <Text style={[styles.totalScore, { color: colors.primary }]}>{totalScore} / 20</Text>
        </View>
      </Surface>
      <SectionTitle title="Historique du test de niveau" />
      <Surface style={styles.historyCard}>
        {pupilAssessment ? (
          <>
            <View style={styles.historyHeader}>
              <View style={styles.historyHeading}>
                <Text style={[styles.subject, { color: colors.primary }]}>
                  {pupilAssessment.competency}
                </Text>
                <Text style={[styles.historyTitle, { color: colors.foreground }]}>
                  {pupilAssessment.date}
                </Text>
              </View>
              <View style={[styles.status, { backgroundColor: colors.accent }]}>
                <Text style={[styles.statusText, { color: colors.accentForeground }]}>
                  En cours
                </Text>
              </View>
            </View>
            {pupilObjectives.map((objective) => (
              <View
                key={objective.id}
                style={[styles.objectiveRow, { borderTopColor: colors.border }]}
              >
                <Text
                  style={[styles.objectiveText, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  Obj. {String(objective.order).padStart(2, '0')} · {objective.description}
                </Text>
                <ValueMark
                  value={pupilEvaluations[objective.id] ?? 'NotEvaluated'}
                  size="small"
                />
              </View>
            ))}
          </>
        ) : (
          <Text style={[styles.emptyHistory, { color: colors.mutedForeground }]}>
            Aucune évaluation n’a encore été créée pour cette classe.
          </Text>
        )}
      </Surface>
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalOverlay}>
          <Surface style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Modifier l’élève
                </Text>
                <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>
                  Le matricule et les évaluations seront conservés.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={() => setEditModalVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.secondary }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                NOM DE FAMILLE *
              </Text>
              <TextInput
                autoFocus
                value={lastNameInput}
                onChangeText={setLastNameInput}
                placeholder="Nom de famille"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                PRÉNOM *
              </Text>
              <TextInput
                value={firstNameInput}
                onChangeText={setFirstNameInput}
                placeholder="Prénom"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={styles.modalActions}>
              <Button label="Annuler" secondary onPress={() => setEditModalVisible(false)} />
              <Button label="Enregistrer" icon="check" onPress={savePupilName} />
            </View>
          </Surface>
        </KeyboardAvoidingViewCompat>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 4 },
  profileCopy: { flex: 1, minWidth: 0 },
  editButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  profileMeta: { fontSize: 13 },
  continuousCard: { gap: 10, padding: 14, marginBottom: 4 },
  scoreRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
  scoreInput: { width: 70, height: 38, borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, textAlign: 'center', fontSize: 15 },
  scoreDenominator: { width: 25, fontSize: 13 },
  calculatedRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9 },
  calculatedCopy: { flex: 1, gap: 3 },
  calculatedHint: { fontSize: 11, lineHeight: 16 },
  calculatedScore: { fontSize: 15, fontWeight: '700' },
  commentInput: { minHeight: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, fontSize: 13 },
  settingsLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 3 },
  settingsRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  settingsText: { flex: 1, fontSize: 12 },
  settingInput: { width: 68, height: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, textAlign: 'center', fontSize: 13 },
  settingsHint: { fontSize: 11, lineHeight: 16 },
  eventRow: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  eventCopy: { flex: 1, gap: 2 },
  eventDate: { fontSize: 12, fontWeight: '600' },
  removeEventButton: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  totalRow: { borderTopWidth: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingTop: 8 },
  totalScore: { fontSize: 18, fontWeight: '800' },
  historyCard: { gap: 4, paddingHorizontal: 14, paddingVertical: 10 },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 7, paddingHorizontal: 2 },
  historyHeading: { gap: 3 },
  subject: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  historyTitle: { fontSize: 16, fontWeight: '700' },
  status: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  objectiveRow: { minHeight: 42, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2, paddingVertical: 4 },
  objectiveText: { flex: 1, fontSize: 12, lineHeight: 17 },
  emptyHistory: { fontSize: 13, lineHeight: 19, paddingVertical: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 480, borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128, 128, 128, 0.25)' },
  modalHeaderCopy: { flex: 1, gap: 3 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 3 },
  closeButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
