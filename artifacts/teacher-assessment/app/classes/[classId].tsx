import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppHeader, Button, KeyboardAvoidingViewCompat, ListSelectionToolbar, Screen, SectionTitle, SelectionCheckbox, Surface } from '@/components/AppShell';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { useListSelection } from '@/hooks/useListSelection';
import { exportClassAttendancePdf } from '@/services/exportService';

export default function ClassDetailScreen() {
  const colors = useColors();
  const data = useAppData();
  const params = useLocalSearchParams<{ classId: string; sessionId?: string; attendanceDate?: string }>();

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
  const attendanceRecords = useMemo(
    () => data.getAttendanceRecordsForClass(currentClass.id),
    [data.attendanceRecords, currentClass.id],
  );
  const pupilAttendanceStats = useMemo(
    () => new Map(classPupils.map((pupil) => {
      const stats = attendanceRecords.reduce((counts, record) => {
        const status = record.statuses[pupil.id];
        if (status === 'present' || status === 'absent') {
          counts.total += 1;
          if (status === 'present') counts.present += 1;
        }
        return counts;
      }, { present: 0, total: 0 });
      return [pupil.id, stats] as const;
    })),
    [attendanceRecords, classPupils],
  );
  const attendanceCounts = [...pupilAttendanceStats.values()].reduce(
    (counts, pupilStats) => ({
      present: counts.present + pupilStats.present,
      total: counts.total + pupilStats.total,
    }),
    { present: 0, total: 0 },
  );
  const classAttendanceRate = attendanceCounts.total
    ? Math.round((attendanceCounts.present / attendanceCounts.total) * 100)
    : null;

  const openAttendance = () => {
    const now = new Date();
    const attendanceDate = params.attendanceDate && /^\d{4}-\d{2}-\d{2}$/.test(params.attendanceDate)
      ? params.attendanceDate
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    router.push({
      pathname: '/classes/[classId]/attendance',
      params: {
        classId: currentClass.id,
        sessionId: params.sessionId ?? '',
        date: attendanceDate,
      },
    });
  };

  const exportAttendanceList = async () => {
    setIsExportingAttendance(true);
    try {
      await exportClassAttendancePdf({
        schoolName: data.school.name,
        teacherName: data.teacherName,
        className: currentClass.name,
        level: currentClass.level,
        academicYear: currentClass.academicYear,
        pupils: classPupils.map((pupil) => {
          const stats = pupilAttendanceStats.get(pupil.id) ?? { present: 0, total: 0 };
          return {
            registrationNumber: pupil.registrationNumber,
            firstName: pupil.firstName,
            lastName: pupil.lastName,
            present: stats.present,
            absent: stats.total - stats.present,
            total: stats.total,
          };
        }),
      });
    } catch (error) {
      Alert.alert('Export impossible', error instanceof Error ? error.message : 'Impossible de générer la liste de présence.');
    } finally {
      setIsExportingAttendance(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'competencies' | 'pupils'>('competencies');
  const assessmentSelection = useListSelection();
  const pupilSelection = useListSelection();
  const [classDeleteArmed, setClassDeleteArmed] = useState(false);
  const [isExportingAttendance, setIsExportingAttendance] = useState(false);

  const [classNameModalVisible, setClassNameModalVisible] = useState(false);
  const [classNameInput, setClassNameInput] = useState('');
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

  const openClassNameModal = () => {
    setClassNameInput(currentClass.name);
    setClassNameModalVisible(true);
  };

  const handleRenameClass = () => {
    if (!classNameInput.trim()) {
      Alert.alert('Nom obligatoire', 'Veuillez saisir un nom pour la classe.');
      return;
    }
    if (!data.renameClass(currentClass.id, classNameInput)) {
      Alert.alert('Modification impossible', 'La classe n’a pas pu être renommée.');
      return;
    }
    setClassNameModalVisible(false);
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

  const deleteSelectedPupils = () => {
    const selected = classPupils.filter((pupil) => pupilSelection.selectedIds.includes(pupil.id));
    if (selected.length === 0) return;
    Alert.alert('Supprimer les élèves sélectionnés ?', `Retirer ${selected.length} élève${selected.length > 1 ? 's' : ''} de ${currentClass.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { selected.forEach((pupil) => data.deletePupil(pupil.id)); pupilSelection.cancelSelection(); } },
    ]);
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

  const deleteSelectedAssessments = () => {
    const selected = classAssessments.filter((item) => assessmentSelection.selectedIds.includes(item.id));
    if (selected.length === 0) return;
    Alert.alert('Supprimer les compétences sélectionnées ?', `Supprimer ${selected.length} compétence${selected.length > 1 ? 's' : ''} de cette classe ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { selected.forEach((item) => data.deleteAssessment(item.id)); assessmentSelection.cancelSelection(); } },
    ]);
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
    <Screen onTouchStart={() => setClassDeleteArmed(false)}>
      <AppHeader
        eyebrow="Classe"
        title={currentClass.name}
        onBack={() => router.back()}
        onTitleLongPress={() => setClassDeleteArmed(true)}
        titleActionArmed={classDeleteArmed}
        compact
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Modifier le nom de la classe"
          onPress={openClassNameModal}
          style={[styles.editClassButton, { backgroundColor: colors.accent }]}
        >
          <Feather name="edit-2" size={16} color={colors.primary} />
        </Pressable>
      </Surface>
      <Surface style={[styles.attendanceSummary, { borderColor: colors.border }]}>
        <View style={styles.attendanceSummaryCopy}>
          <Text style={[styles.attendanceSummaryTitle, { color: colors.foreground }]}>Présence de la classe</Text>
          <Text style={[styles.attendanceSummaryMeta, { color: colors.mutedForeground }]}>
            {classAttendanceRate === null
              ? 'Aucun appel enregistré'
              : `${classAttendanceRate}% · ${attendanceRecords.length} appel${attendanceRecords.length > 1 ? 's' : ''} enregistré${attendanceRecords.length > 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={styles.attendanceActions}>
          <Button label="Faire l’appel" icon="check-square" compact onPress={openAttendance} />
          <Button
            label={isExportingAttendance ? 'Préparation…' : 'Exporter la liste'}
            icon="download"
            compact
            secondary
            disabled={isExportingAttendance}
            onPress={() => { void exportAttendanceList(); }}
          />
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
            compact
            onAction={() => router.push(`/assessments/new?classId=${currentClass.id}`)}
          />
          <ListSelectionToolbar
            style={{ marginBottom: 0 }}
            active={assessmentSelection.isSelecting}
            selectedCount={assessmentSelection.selectedIds.length}
            onStart={() => assessmentSelection.startSelecting()}
            onCancel={assessmentSelection.cancelSelection}
            onDelete={deleteSelectedAssessments}
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
                  <Pressable
                    key={item.id}
                    disabled={!assessmentSelection.isSelecting}
                    onTouchStart={(event) => {
                      if (assessmentSelection.isSelecting) event.stopPropagation();
                    }}
                    onPress={() => {
                      if (assessmentSelection.isSelecting) assessmentSelection.toggleSelection(item.id);
                    }}
                  >
                  <Surface
                    style={[
                      styles.assessmentCard,
                      assessmentSelection.selectedIds.includes(item.id) && {
                        backgroundColor: colors.card,
                        borderColor: colors.destructive,
                        borderWidth: 2,
                      },
                    ]}
                  >
                    <View style={{ gap: 10 }}>
                    <View style={styles.assessmentCardHeader}>
                      <View style={styles.headerLeft}>
                        <View style={[styles.competencyBadge, { backgroundColor: colors.accent }]}>
                          <Text style={[styles.competencyBadgeText, { color: colors.accentForeground }]}>
                            {item.competency}
                          </Text>
                        </View>
                        <Text style={[styles.assessmentTitle, { color: colors.foreground }]}>{item.title}</Text>
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
                    </View>

                    <View style={styles.cardActions}>
                      {assessmentSelection.isSelecting ? (
                        <SelectionCheckbox checked={assessmentSelection.selectedIds.includes(item.id)} />
                      ) : (
                        <>
                      <View style={styles.cardActionButton}>
                        <Button
                          label="Évaluer"
                          icon="check-square"
                          compact
                          onPress={() => {
                            data.setActiveAssessment(item.id);
                            router.push(`/assessments/${item.id}`);
                          }}
                        />
                      </View>
                      <View style={styles.cardActionButton}>
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
                      </View>
                        </>
                      )}
                    </View>
                  </Surface>
                  </Pressable>
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
            compact
            onAction={openAddPupilModal}
          />
          <ListSelectionToolbar
            style={{ marginBottom: 0 }}
            active={pupilSelection.isSelecting}
            selectedCount={pupilSelection.selectedIds.length}
            onStart={() => pupilSelection.startSelecting()}
            onCancel={pupilSelection.cancelSelection}
            onDelete={deleteSelectedPupils}
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
              classPupils.map((pupil, index) => {
                const pupilStats = pupilAttendanceStats.get(pupil.id) ?? { present: 0, total: 0 };
                const presenceLabel = pupilStats.total
                  ? `Présence : ${Math.round((pupilStats.present / pupilStats.total) * 100)}% (${pupilStats.present}/${pupilStats.total})`
                  : 'Présence : aucun appel';
                return <Pressable
                  key={pupil.id}
                  onTouchStart={(event) => event.stopPropagation()}
                  onPress={() => {
                    if (pupilSelection.isSelecting) pupilSelection.toggleSelection(pupil.id);
                    else router.push(`/pupils/${pupil.id}`);
                  }}
                  style={[
                    styles.pupilRow,
                    pupilSelection.selectedIds.includes(pupil.id)
                      ? { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2, borderRadius: 10, paddingHorizontal: 8 }
                      : { borderBottomColor: colors.border },
                  ]}
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
                    <Text style={[styles.pupilMeta, { color: colors.primary }]}>
                      {presenceLabel}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    {pupilSelection.isSelecting ? (
                      <SelectionCheckbox checked={pupilSelection.selectedIds.includes(pupil.id)} />
                    ) : <Feather name="chevron-right" size={17} color={colors.mutedForeground} />}
                  </View>
                </Pressable>;
              })
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
        {classDeleteArmed ? (
          <Button label="Supprimer cette classe" icon="trash-2" secondary onTouchStart={(event) => event.stopPropagation()} onPress={() => { setClassDeleteArmed(false); handleDeleteClass(); }} />
        ) : null}
      </View>

      <Modal
        visible={classNameModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setClassNameModalVisible(false)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalOverlay}>
          <Surface style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Modifier la classe
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                  Le nouveau nom sera utilisé partout dans l’application.
                </Text>
              </View>
              <Pressable
                onPress={() => setClassNameModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                NOM DE LA CLASSE
              </Text>
              <TextInput
                autoFocus
                value={classNameInput}
                onChangeText={setClassNameInput}
                placeholder="Nom de la classe"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.textInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
            </View>
            <View style={styles.modalButtons}>
              <Button label="Annuler" secondary onPress={() => setClassNameModalVisible(false)} />
              <Button label="Enregistrer" icon="check" onPress={handleRenameClass} />
            </View>
          </Surface>
        </KeyboardAvoidingViewCompat>
      </Modal>

      {/* Modal: Ajouter un élève */}
      <Modal
        visible={pupilModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPupilModalVisible(false)}
      >
        <KeyboardAvoidingViewCompat style={styles.modalOverlay}>
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

            <KeyboardAwareScrollViewCompat bottomOffset={100} contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
            </KeyboardAwareScrollViewCompat>
          </Surface>
        </KeyboardAvoidingViewCompat>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  classInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  attendanceSummary: { flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 10, borderWidth: 1, borderRadius: 14, marginBottom: 10 },
  attendanceSummaryCopy: { flex: 1, gap: 3 },
  attendanceSummaryTitle: { fontSize: 14, fontWeight: '700' },
  attendanceSummaryMeta: { fontSize: 12 },
  attendanceActions: { flexDirection: 'row', gap: 10 },
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
  editClassButton: {
    width: 36,
    height: 36,
    alignSelf: 'center',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  tabItem: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
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
    gap: 12,
    marginTop: 8,
  },
  cardActionButton: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 12,
    gap: 12,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deletePupilBtn: {
    minHeight: 34,
    paddingHorizontal: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    gap: 12,
    marginTop: 10,
    justifyContent: 'flex-end',
  },
  deleteAssessBtn: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionText: { fontSize: 11, fontWeight: '700' },
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