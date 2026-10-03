import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface, ValueMark } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function PupilDetailScreen() {
  const colors = useColors();
  const { pupilId } = useLocalSearchParams<{ pupilId: string }>();
  const data = useAppData();
  const pupil = data.pupils.find((item) => item.id === pupilId);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [decisionInput, setDecisionInput] = useState('');
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
  const individualDecision = pupilAssessment
    ? data.getRemediationForAssessment(pupilAssessment.id).individual
    : '';

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

  const openDecisionEditor = () => {
    if (!pupilAssessment) {
      Alert.alert(
        'Aucune évaluation',
        'Créez une évaluation pour cette classe avant d’ajouter une décision individuelle.',
      );
      return;
    }
    setDecisionInput(individualDecision);
    setDecisionModalVisible(true);
  };

  const saveIndividualDecision = () => {
    if (!pupilAssessment) {
      Alert.alert(
        'Aucune évaluation',
        'Créez une évaluation pour cette classe avant d’ajouter une décision individuelle.',
      );
      return;
    }
    const existing = data.getRemediationForAssessment(pupilAssessment.id);
    data.updateRemediation(
      decisionInput,
      existing.classroom,
      pupilAssessment.id,
    );
    setDecisionModalVisible(false);
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
      <Button
        label="Évaluer cet élève"
        icon="check-square"
        disabled={!pupilAssessment}
        onPress={() => {
          if (pupilAssessment) {
            router.push(`/assessments/${pupilAssessment.id}?pupilId=${pupil.id}`);
          }
        }}
      />
      <SectionTitle title="Historique d’évaluation" />
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
      <SectionTitle
        title="Décisions individuelles"
        action="Modifier"
        onAction={openDecisionEditor}
      />
      <Surface style={styles.note}>
        <Feather name="edit-3" size={16} color={colors.primary} />
        <Text style={[styles.noteText, { color: colors.foreground }]}>
          {individualDecision || 'Aucune décision individuelle renseignée.'}
        </Text>
      </Surface>
      <Modal
        visible={decisionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDecisionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Surface style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Décision individuelle
                </Text>
                <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>
                  {pupil.firstName} {pupil.lastName}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={() => setDecisionModalVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.secondary }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            <TextInput
              autoFocus
              multiline
              value={decisionInput}
              onChangeText={setDecisionInput}
              placeholder="Saisir la décision ou la remédiation individuelle…"
              placeholderTextColor={colors.mutedForeground}
              textAlignVertical="top"
              style={[
                styles.decisionInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Button label="Annuler" secondary onPress={() => setDecisionModalVisible(false)} />
              <Button label="Enregistrer" icon="check" onPress={saveIndividualDecision} />
            </View>
          </Surface>
        </View>
      </Modal>
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
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
        </View>
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
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 16, minHeight: 64 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 480, borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128, 128, 128, 0.25)' },
  modalHeaderCopy: { flex: 1, gap: 3 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 3 },
  closeButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  decisionInput: { minHeight: 140, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
