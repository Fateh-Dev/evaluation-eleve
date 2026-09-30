import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppHeader, Button, Screen, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function ClassDetailScreen() {
  const colors = useColors();
  const data = useAppData();
  const params = useLocalSearchParams<{ classId: string }>();

  const currentClassId = params.classId || data.activeClassId;
  const currentClass = useMemo(() => {
    return data.classes.find((c) => c.id === currentClassId) ?? data.activeClass;
  }, [data.classes, currentClassId, data.activeClass]);

  const classPupils = useMemo(() => {
    return data.getPupilsForClass(currentClass.id);
  }, [data.pupils, currentClass.id]);

  const classAssessments = useMemo(() => {
    return data.getAssessmentsForClass(currentClass.id);
  }, [data.assessments, currentClass.id]);

  const [activeTab, setActiveTab] = useState<'competencies' | 'pupils'>('competencies');

  // Add Pupil Modal State
  const [pupilModalVisible, setPupilModalVisible] = useState(false);
  const [newPupilLastName, setNewPupilLastName] = useState('');
  const [newPupilFirstName, setNewPupilFirstName] = useState('');
  const [newPupilRegNo, setNewPupilRegNo] = useState('');
  const [newPupilDob, setNewPupilDob] = useState('');

  const openAddPupilModal = () => {
    const nextNum = String(classPupils.length + 1).padStart(2, '0');
    setNewPupilRegNo(nextNum);
    setNewPupilLastName('');
    setNewPupilFirstName('');
    setNewPupilDob('');
    setPupilModalVisible(true);
  };

  const handleAddPupil = () => {
    if (!newPupilLastName.trim() || !newPupilFirstName.trim()) {
      Alert.alert('Champs obligatoires', 'Veuillez saisir le nom et le prénom de l’élève.');
      return;
    }
    const result = data.addPupils(
      [
        {
          lastName: newPupilLastName.trim(),
          firstName: newPupilFirstName.trim(),
          registrationNumber: newPupilRegNo.trim() || String(classPupils.length + 1).padStart(2, '0'),
          dateOfBirth: newPupilDob.trim() || undefined,
        },
      ],
      currentClass.id,
    );
    if (result.imported > 0) {
      setPupilModalVisible(false);
      Alert.alert('Élève ajouté', `${newPupilLastName.trim()} ${newPupilFirstName.trim()} a été ajouté(e) avec succès.`);
    } else {
      Alert.alert('Attention', 'Impossible d’ajouter cet élève.');
    }
  };

  const handleDeletePupil = (pupilId: string, pupilName: string) => {
    Alert.alert(
      'Supprimer l’élève',
      `Êtes-vous sûr de vouloir retirer ${pupilName} de la classe ${currentClass.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            data.deletePupil(pupilId);
          },
        },
      ],
    );
  };

  const handleDeleteClass = () => {
    Alert.alert(
      'Supprimer la classe',
      `Êtes-vous sûr de vouloir supprimer définitivement la classe "${currentClass.name}" ?\n\nTous les élèves, évaluations et notes de cette classe seront effacés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            data.deleteClass(currentClass.id);
            Alert.alert('Classe supprimée', `La classe ${currentClass.name} a été supprimée.`);
            router.replace('/classes');
          },
        },
      ],
    );
  };

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

  if (!currentClass || !currentClass.id) {
    return (
      <Screen>
        <AppHeader eyebrow="Classes" title="Classe introuvable" onBack={() => router.back()} />
        <Surface style={styles.emptyCard}>
          <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Cette classe n’existe pas</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Elle a peut-être été supprimée ou n’a pas encore été créée.
          </Text>
          <Button label="Retour aux classes" icon="arrow-left" onPress={() => router.replace('/classes')} />
        </Surface>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        eyebrow={`${currentClass.level} · ${currentClass.academicYear}`}
        title={currentClass.name}
        onBack={() => router.back()}
      />

      {/* Class Overview Card */}
      <Surface style={styles.classInfo}>
        <View style={styles.infoCol}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>NIVEAU</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{currentClass.level}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>ÉLÈVES</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{classPupils.length}</Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>COMPÉTENCES</Text>
          <Text style={[styles.infoValue, { color: colors.primary }]}>{classAssessments.length}</Text>
        </View>
      </Surface>

      {/* Tabs Switcher: Compétences vs Élèves */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab('competencies')}
          style={[
            styles.tabItem,
            {
              backgroundColor: activeTab === 'competencies' ? colors.primary : colors.card,
              borderColor: activeTab === 'competencies' ? colors.primary : colors.border,
            },
          ]}
        >
          <Feather
            name="award"
            size={16}
            color={activeTab === 'competencies' ? colors.primaryForeground : colors.foreground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'competencies' ? colors.primaryForeground : colors.foreground },
            ]}
          >
            Compétences ({classAssessments.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('pupils')}
          style={[
            styles.tabItem,
            {
              backgroundColor: activeTab === 'pupils' ? colors.primary : colors.card,
              borderColor: activeTab === 'pupils' ? colors.primary : colors.border,
            },
          ]}
        >
          <Feather
            name="users"
            size={16}
            color={activeTab === 'pupils' ? colors.primaryForeground : colors.foreground}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'pupils' ? colors.primaryForeground : colors.foreground },
            ]}
          >
            Élèves ({classPupils.length})
          </Text>
        </Pressable>
      </View>

      {/* TAB 1: COMPETENCIES / ASSESSMENTS */}
      {activeTab === 'competencies' && (
        <View style={styles.tabContent}>
          <SectionTitle
            title="Compétences de la classe"
            action="+ Ajouter"
            onAction={() => router.push(`/assessments/new?classId=${currentClass.id}`)}
          />

          {classAssessments.length === 0 ? (
            <Surface style={styles.emptyCard}>
              <Feather name="award" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Aucune compétence pour cette classe
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Ajoutez une première compétence pour commencer l’évaluation des élèves de {currentClass.name}.
              </Text>
              <Button
                label="Ajouter une compétence"
                icon="plus"
                onPress={() => router.push(`/assessments/new?classId=${currentClass.id}`)}
              />
            </Surface>
          ) : (
            <View style={styles.assessmentList}>
              {classAssessments.map((item) => {
                const objList = data.getObjectivesForAssessment(item.id);
                const stats = data.getStatisticsForAssessment(item.id);
                const evaluatedTotal = stats.reduce((sum, s) => sum + s.evaluated, 0);
                const totalPossible = Math.max(classPupils.length * objList.length, 1);
                const progressPercent = Math.round((evaluatedTotal / totalPossible) * 100);

                return (
                  <Surface key={item.id} style={styles.assessmentCard}>
                    <View style={styles.assessmentCardHeader}>
                      <View style={styles.headerLeft}>
                        <View style={[styles.competencyBadge, { backgroundColor: colors.accent }]}>
                          <Text style={[styles.competencyBadgeText, { color: colors.accentForeground }]}>
                            {item.competency}
                          </Text>
                        </View>
                        <Text style={[styles.assessmentTitle, { color: colors.foreground }]}>
                          {item.title}
                        </Text>
                      </View>
                      <Text style={[styles.progressNumber, { color: colors.primary }]}>
                        {progressPercent}%
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                        {objList.length} objectifs
                      </Text>
                      <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>•</Text>
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                        {item.support || 'Support standard'}
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
                      <Pressable
                        onPress={() => handleDeleteAssessment(item.id, item.title)}
                        hitSlop={8}
                        style={[styles.deleteAssessBtn, { backgroundColor: colors.errorSurface }]}
                      >
                        <Feather name="trash-2" size={15} color={colors.errorForeground} />
                      </Pressable>
                    </View>
                  </Surface>
                );
              })}
            </View>
          )}

          {classAssessments.length > 0 && (
            <Button
              label="Ajouter une compétence pour cette classe"
              icon="plus"
              secondary
              onPress={() => router.push(`/assessments/new?classId=${currentClass.id}`)}
            />
          )}
        </View>
      )}

      {/* TAB 2: PUPILS */}
      {activeTab === 'pupils' && (
        <View style={styles.tabContent}>
          <SectionTitle
            title="Élèves de la classe"
            action="+ Ajouter un élève"
            onAction={openAddPupilModal}
          />

          <View style={styles.pupilList}>
            {classPupils.length === 0 ? (
              <Surface style={styles.emptyPupils}>
                <Feather name="users" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Aucun élève dans cette classe</Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  Ajoutez un premier élève ou importez la liste complète de la classe.
                </Text>
              </Surface>
            ) : (
              classPupils.map((pupil, index) => (
                <Pressable
                  key={pupil.id}
                  onPress={() => router.push(`/pupils/${pupil.id}`)}
                  style={[styles.pupilRow, { borderBottomColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: index % 2 ? colors.accent : colors.secondary },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.foreground }]}>
                      {pupil.lastName.charAt(0)}
                      {pupil.firstName.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.pupilCopy}>
                    <Text style={[styles.pupilName, { color: colors.foreground }]}>
                      {pupil.lastName} {pupil.firstName}
                    </Text>
                    <Text style={[styles.pupilMeta, { color: colors.mutedForeground }]}>
                      N° {pupil.registrationNumber} {pupil.dateOfBirth ? `· Né(e) le ${pupil.dateOfBirth}` : ''}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeletePupil(pupil.id, `${pupil.lastName} ${pupil.firstName}`);
                      }}
                      style={styles.deletePupilBtn}
                      hitSlop={10}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </Pressable>
                    <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
                  </View>
                </Pressable>
              ))
            )}
          </View>

          <View style={styles.pupilActions}>
            <Button
              label="+ Ajouter un élève"
              icon="user-plus"
              onPress={openAddPupilModal}
            />
            <Button
              label="Importer des élèves (CSV/Texte)"
              icon="upload"
              secondary
              onPress={() => router.push(`/classes/${currentClass.id}/import`)}
            />
          </View>
        </View>
      )}

      {/* Delete Class Section */}
      <View style={styles.deleteClassSection}>
        <Button
          label="Supprimer cette classe"
          icon="trash-2"
          secondary
          onPress={handleDeleteClass}
        />
      </View>

      {/* Modal: Ajouter un élève */}
      <Modal
        visible={pupilModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPupilModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Surface style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Ajouter un élève
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                  Classe : {currentClass.name} ({currentClass.level})
                </Text>
              </View>
              <Pressable
                onPress={() => setPupilModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  NOM DE FAMILLE *
                </Text>
                <TextInput
                  placeholder="Ex. Benali"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPupilLastName}
                  onChangeText={setNewPupilLastName}
                  style={[
                    styles.textInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  PRÉNOM *
                </Text>
                <TextInput
                  placeholder="Ex. Amina"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPupilFirstName}
                  onChangeText={setNewPupilFirstName}
                  style={[
                    styles.textInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  N° D’ORDRE / IMMATRICULATION
                </Text>
                <TextInput
                  placeholder="Ex. 01"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPupilRegNo}
                  onChangeText={setNewPupilRegNo}
                  keyboardType="numeric"
                  style={[
                    styles.textInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  DATE DE NAISSANCE (FACULTATIF)
                </Text>
                <TextInput
                  placeholder="Ex. 15/04/2009"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPupilDob}
                  onChangeText={setNewPupilDob}
                  style={[
                    styles.textInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                />
              </View>

              <View style={styles.modalButtons}>
                <Button
                  label="Annuler"
                  secondary
                  onPress={() => setPupilModalVisible(false)}
                />
                <Button
                  label="Enregistrer l’élève"
                  icon="check"
                  onPress={handleAddPupil}
                />
              </View>
            </ScrollView>
          </Surface>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  classInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  infoCol: {
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabContent: {
    gap: 12,
    paddingBottom: 30,
  },
  assessmentList: {
    gap: 12,
  },
  assessmentCard: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  assessmentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  competencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  competencyBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  assessmentTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaText: {
    fontSize: 11.5,
  },
  metaDot: {
    fontSize: 11.5,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pupilList: {
    borderRadius: 14,
  },
  pupilRow: {
    minHeight: 56,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  pupilCopy: {
    flex: 1,
    gap: 2,
  },
  pupilName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  pupilMeta: {
    fontSize: 11.5,
  },
  pupilActions: {
    marginTop: 10,
    gap: 8,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deletePupilBtn: {
    padding: 6,
    borderRadius: 8,
  },
  emptyPupils: {
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalForm: {
    gap: 14,
    paddingBottom: 10,
  },
  fieldGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  deleteAssessBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteClassSection: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    marginBottom: 16,
  },
});