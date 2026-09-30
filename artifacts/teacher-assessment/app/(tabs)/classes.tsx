import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
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
import { COMPETENCY_TEMPLATES } from '@/constants/competencies';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function ClassesScreen() {
  const colors = useColors();
  const data = useAppData();

  const [modalVisible, setModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevel, setNewClassLevel] = useState('2AS');
  const [newClassYear, setNewClassYear] = useState(data.academicYear || '2026-2027');
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<string[]>([
    COMPETENCY_TEMPLATES[0].id,
  ]);

  const toggleCompetency = (id: string) => {
    setSelectedCompetencyIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const resetModal = () => {
    setNewClassName('');
    setNewClassLevel('2AS');
    setSelectedCompetencyIds([COMPETENCY_TEMPLATES[0].id]);
    setModalVisible(false);
  };

  const handleCreateClass = () => {
    if (!newClassName.trim() || !newClassLevel.trim()) {
      Alert.alert('Informations requises', 'Le nom et le niveau de la classe sont obligatoires.');
      return;
    }
    if (selectedCompetencyIds.length === 0) {
      Alert.alert('Compétence requise', 'Veuillez sélectionner au moins une compétence.');
      return;
    }
    const createdId = data.createClass({
      name: newClassName.trim(),
      level: newClassLevel.trim(),
      academicYear: newClassYear.trim(),
      competencyIds: selectedCompetencyIds,
    });
    resetModal();
    router.push(`/classes/${createdId}`);
  };

  const handleDeleteClass = (classId: string, className: string) => {
    Alert.alert(
      'Supprimer la classe',
      `Êtes-vous sûr de vouloir supprimer la classe "${className}" ?\n\nAttention : Tous les élèves, évaluations et notes de cette classe seront définitivement supprimés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            data.deleteClass(classId);
            Alert.alert('Classe supprimée', `La classe ${className} a été supprimée.`);
          },
        },
      ],
    );
  };

  const handleSelectClass = (classId: string) => {
    data.setActiveClass(classId);
    router.push(`/classes/${classId}`);
  };

  return (
    <Screen>
      <AppHeader eyebrow="Organisation pédagogique" title="Mes Classes" />

      {/* Academic Year Banner */}
      <Surface style={styles.summary}>
        <View>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>ANNÉE EN COURS</Text>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>{data.academicYear}</Text>
          <Text style={[styles.summaryNote, { color: colors.mutedForeground }]}>
            {data.classes.length} classe{data.classes.length > 1 ? 's' : ''} enregistrée{data.classes.length > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={[styles.summaryIcon, { backgroundColor: colors.accent }]}>
          <Feather name="users" size={22} color={colors.primary} />
        </View>
      </Surface>

      {/* Section Header with Add Button */}
      <SectionTitle
        title="Liste des classes"
        action="+ Nouvelle classe"
        onAction={() => setModalVisible(true)}
      />

      {/* Classes List / Empty State */}
      {data.classes.length === 0 ? (
        <Surface style={styles.emptyContainer}>
          <Feather name="layers" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucune classe enregistrée
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Créez votre première classe (ex: 2AS LPH, 1AS ST) pour commencer à gérer vos élèves et leurs compétences.
          </Text>
          <Button
            label="Créer ma première classe"
            icon="plus"
            onPress={() => setModalVisible(true)}
          />
        </Surface>
      ) : (
        <View style={styles.classesList}>
          {data.classes.map((cls) => {
            const classPupils = data.getPupilsForClass(cls.id);
            const classAssessments = data.getAssessmentsForClass(cls.id);
            const isActive = cls.id === data.activeClassId;

            return (
              <Pressable
                key={cls.id}
                onPress={() => handleSelectClass(cls.id)}
                style={({ pressed }) => [
                  styles.classCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isActive ? colors.primary : colors.border,
                    borderWidth: isActive ? 2 : 1,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.classIcon,
                    { backgroundColor: isActive ? colors.accent : colors.secondary },
                  ]}
                >
                  <Text style={[styles.classLevel, { color: isActive ? colors.primary : colors.foreground }]}>
                    {cls.level}
                  </Text>
                </View>

                <View style={styles.classCopy}>
                  <View style={styles.classNameRow}>
                    <Text style={[styles.className, { color: colors.foreground }]}>{cls.name}</Text>
                    {isActive && (
                      <View style={[styles.activePill, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.activeText, { color: colors.accentForeground }]}>Active</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.classMeta, { color: colors.mutedForeground }]}>
                    {classPupils.length} élève{classPupils.length > 1 ? 's' : ''} · {classAssessments.length} compétence{classAssessments.length > 1 ? 's' : ''}
                  </Text>

                  <View style={styles.competenciesPreview}>
                    {classAssessments.slice(0, 3).map((a) => (
                      <View
                        key={a.id}
                        style={[styles.competencyTag, { backgroundColor: colors.secondary }]}
                      >
                        <Text style={[styles.competencyTagText, { color: colors.foreground }]} numberOfLines={1}>
                          {a.competency}
                        </Text>
                      </View>
                    ))}
                    {classAssessments.length > 3 && (
                      <Text style={[styles.moreCount, { color: colors.mutedForeground }]}>
                        +{classAssessments.length - 3}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.cardActionsRow}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteClass(cls.id, cls.name);
                    }}
                    hitSlop={8}
                    style={[styles.deleteButton, { backgroundColor: colors.errorSurface }]}
                  >
                    <Feather name="trash-2" size={16} color={colors.errorForeground} />
                  </Pressable>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {data.classes.length > 0 && (
        <Button
          label="Créer une nouvelle classe"
          icon="plus"
          onPress={() => setModalVisible(true)}
        />
      )}

      {/* Creation Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Surface style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Nouvelle classe</Text>
                <Pressable onPress={resetModal} hitSlop={8}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Class Name */}
              <View style={[styles.formGroup, { marginTop: 14 }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>NOM DE LA CLASSE</Text>
                <TextInput
                  value={newClassName}
                  onChangeText={setNewClassName}
                  placeholder="Ex. 2AS LPH3, 1AS ST2, 3AS SE"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                />
              </View>

              {/* Level */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>NIVEAU SCOLAIRE</Text>
                <View style={styles.levelButtons}>
                  {['1AS', '2AS', '3AS', 'Autre'].map((lvl) => (
                    <Pressable
                      key={lvl}
                      onPress={() => setNewClassLevel(lvl === 'Autre' ? '' : lvl)}
                      style={[
                        styles.levelChip,
                        {
                          backgroundColor:
                            newClassLevel.startsWith(lvl) && lvl !== 'Autre'
                              ? colors.primary
                              : colors.secondary,
                          borderColor:
                            newClassLevel.startsWith(lvl) && lvl !== 'Autre'
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.levelChipText,
                          {
                            color:
                              newClassLevel.startsWith(lvl) && lvl !== 'Autre'
                                ? colors.primaryForeground
                                : colors.foreground,
                          },
                        ]}
                      >
                        {lvl}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={newClassLevel}
                  onChangeText={setNewClassLevel}
                  placeholder="Niveau précis (ex. 2AS LPH ou 1AS ST)"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      marginTop: 6,
                    },
                  ]}
                />
              </View>

              {/* Academic Year */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ANNÉE SCOLAIRE</Text>
                <TextInput
                  value={newClassYear}
                  onChangeText={setNewClassYear}
                  placeholder="2026-2027"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                />
              </View>

              {/* Competencies */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  COMPÉTENCES À ÉVALUER ({selectedCompetencyIds.length} sélectionnée{selectedCompetencyIds.length > 1 ? 's' : ''})
                </Text>
                <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                  Sélectionnez une ou plusieurs compétences. Des objectifs par défaut seront créés automatiquement.
                </Text>
                <View style={styles.competencyGrid}>
                  {COMPETENCY_TEMPLATES.map((tmpl) => {
                    const isSelected = selectedCompetencyIds.includes(tmpl.id);
                    const icons: Record<string, string> = {
                      'comprehension-ecrite': 'book-open',
                      'comprehension-orale': 'headphones',
                      'production-ecrite': 'edit-3',
                      'production-orale': 'mic',
                    };
                    const iconName = (icons[tmpl.id] || 'award') as any;
                    return (
                      <Pressable
                        key={tmpl.id}
                        onPress={() => toggleCompetency(tmpl.id)}
                        style={[
                          styles.competencyChip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.secondary,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Feather
                          name={iconName}
                          size={15}
                          color={isSelected ? colors.primaryForeground : colors.foreground}
                        />
                        <Text
                          style={[
                            styles.competencyChipText,
                            { color: isSelected ? colors.primaryForeground : colors.foreground },
                          ]}
                          numberOfLines={2}
                        >
                          {tmpl.name}
                        </Text>
                        {isSelected && (
                          <Feather name="check" size={13} color={colors.primaryForeground} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Objectives preview for selected competencies */}
                {selectedCompetencyIds.length > 0 && (
                  <View style={[styles.objectivesSummary, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.objectivesSummaryTitle, { color: colors.foreground }]}>
                      Objectifs inclus :
                    </Text>
                    {COMPETENCY_TEMPLATES.filter((t) => selectedCompetencyIds.includes(t.id)).map((tmpl) => (
                      <View key={tmpl.id} style={styles.objectiveGroup}>
                        <Text style={[styles.objectiveGroupName, { color: colors.primary }]}>
                          {tmpl.name} ({tmpl.defaultObjectives.length} objectifs)
                        </Text>
                        {tmpl.defaultObjectives.slice(0, 3).map((obj, idx) => (
                          <Text
                            key={idx}
                            style={[styles.objectivePreview, { color: colors.mutedForeground }]}
                            numberOfLines={1}
                          >
                            {String(idx + 1).padStart(2, '0')}. {obj}
                          </Text>
                        ))}
                        {tmpl.defaultObjectives.length > 3 && (
                          <Text style={[styles.objectivePreview, { color: colors.mutedForeground }]}>
                            … +{tmpl.defaultObjectives.length - 3} objectifs
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={[styles.modalActions, { marginTop: 8 }]}>
                <Button label="Créer la classe" icon="check" onPress={handleCreateClass} />
                <Button label="Annuler" secondary onPress={resetModal} />
              </View>
            </ScrollView>
          </Surface>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 9.5,
    letterSpacing: 1.2,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryNote: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classesList: {
    gap: 12,
    marginBottom: 16,
  },
  classCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  classIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classLevel: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  classCopy: {
    flex: 1,
    gap: 4,
  },
  classNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  className: {
    fontSize: 17,
    fontWeight: '700',
  },
  activePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  classMeta: {
    fontSize: 12.5,
  },
  competenciesPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  competencyTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 160,
  },
  competencyTagText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  moreCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '88%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13.5,
  },
  levelButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  levelChip: {
    flex: 1,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    gap: 8,
    marginTop: 6,
  },
  fieldHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 2,
  },
  competencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  competencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: '45%',
    flex: 1,
  },
  competencyChipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  objectivesSummary: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  objectivesSummaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  objectiveGroup: {
    gap: 3,
    marginTop: 4,
  },
  objectiveGroupName: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  objectivePreview: {
    fontSize: 10.5,
    lineHeight: 15,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    marginBottom: 16,
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
