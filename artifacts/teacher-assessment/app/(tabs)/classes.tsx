import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AppHeader,
  Button,
  KeyboardAvoidingViewCompat,
  ListSelectionToolbar,
  SelectionCheckbox,
  Screen,
  SectionTitle,
  Surface,
} from '@/components/AppShell';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { useListSelection } from '@/hooks/useListSelection';

export default function ClassesScreen() {
  const colors = useColors();
  const data = useAppData();
  const selection = useListSelection();

  const [modalVisible, setModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassLevelId, setNewClassLevelId] = useState('');
  const [newClassYear, setNewClassYear] = useState(
    data.academicYear || '2026-2027',
  );
  const [visibleYear, setVisibleYear] = useState(data.academicYear);

  const selectedYearConfiguration =
    data.getSchoolYearConfiguration(newClassYear);
  const selectedLevel = selectedYearConfiguration?.levels.find(
    (level) => level.id === newClassLevelId,
  );
  const visibleClasses = data.classes.filter(
    (item) => item.academicYear === visibleYear,
  );

  useEffect(() => {
    setVisibleYear(data.academicYear);
  }, [data.academicYear]);

  const openCreateModal = () => {
    const year = data.academicYear;
    const config = data.getSchoolYearConfiguration(year);
    const level = config?.levels[0];
    setNewClassName('');
    setNewClassYear(year);
    setNewClassLevelId(level?.id ?? '');
    setModalVisible(true);
  };

  const resetModal = () => {
    setNewClassName('');
    setNewClassLevelId('');
    setModalVisible(false);
  };

  const selectClassYear = (year: string) => {
    const config = data.getSchoolYearConfiguration(year);
    const level = config?.levels[0];
    setNewClassYear(year);
    setNewClassLevelId(level?.id ?? '');
  };

  const selectClassLevel = (levelId: string) => {
    setNewClassLevelId(levelId);
  };

  const handleCreateClass = () => {
    if (!newClassName.trim() || !selectedLevel) {
      Alert.alert(
        'Informations requises',
        'Le nom et le niveau de la classe sont obligatoires.',
      );
      return;
    }
    const createdId = data.createClass({
      name: newClassName.trim(),
      level: selectedLevel.name,
      levelId: selectedLevel.id,
      academicYear: newClassYear.trim(),
    });
    setVisibleYear(newClassYear);
    resetModal();
    router.push(`/classes/${createdId}`);
  };

  const handleDeleteSelectedClasses = () => {
    const selectedClasses = data.classes.filter((item) => selection.selectedIds.includes(item.id));
    if (selectedClasses.length === 0) return;
    const names = selectedClasses.map((item) => item.name).join(', ');
    Alert.alert(
      'Supprimer les classes sélectionnées',
      `Supprimer ${selectedClasses.length} classe${selectedClasses.length > 1 ? 's' : ''} (${names}) ? Tous les élèves, évaluations et notes associés seront également supprimés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            selectedClasses.forEach((item) => data.deleteClass(item.id));
            selection.cancelSelection();
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
          <Text
            style={[styles.summaryLabel, { color: colors.mutedForeground }]}
          >
            ANNÉE AFFICHÉE
          </Text>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {visibleYear}
          </Text>
          <Text style={[styles.summaryNote, { color: colors.mutedForeground }]}>
            {visibleClasses.length} classe{visibleClasses.length > 1 ? 's' : ''}{' '}
            enregistrée{visibleClasses.length > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={[styles.summaryIcon, { backgroundColor: colors.accent }]}>
          <Feather name="users" size={22} color={colors.primary} />
        </View>
      </Surface>

      {data.schoolYearConfigurations.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.yearChoices}
        >
          {data.schoolYearConfigurations.map((configuration) => {
            const selected = configuration.year === visibleYear;
            return (
              <Pressable
                key={configuration.year}
                onPress={() => setVisibleYear(configuration.year)}
                style={[
                  styles.yearChip,
                  {
                    backgroundColor: selected
                      ? colors.primary
                      : colors.secondary,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.levelChipText,
                    {
                      color: selected
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {configuration.year}
                  {configuration.year === data.academicYear
                    ? ' · Par défaut'
                    : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Section Header with Add Button */}
      <SectionTitle
        title="Liste des classes"
        action="+ Nouvelle classe"
        onAction={openCreateModal}
      />
      <ListSelectionToolbar
        active={selection.isSelecting}
        selectedCount={selection.selectedIds.length}
        onStart={() => selection.startSelecting()}
        onCancel={selection.cancelSelection}
        onDelete={handleDeleteSelectedClasses}
      />

      {/* Classes List / Empty State */}
      {visibleClasses.length === 0 ? (
        <Surface style={styles.emptyContainer}>
          <Feather name="layers" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucune classe pour {visibleYear}
          </Text>
          <Text
            style={[styles.emptySubtitle, { color: colors.mutedForeground }]}
          >
            Créez une classe pour cette année scolaire afin de gérer ses élèves
            et compétences. Les autres années restent accessibles avec les
            filtres ci-dessus.
          </Text>
          <Button
            label="Créer ma première classe"
            icon="plus"
            onPress={openCreateModal}
          />
        </Surface>
      ) : (
        <View style={styles.classesList}>
          {visibleClasses.map((cls) => {
            const classPupils = data.getPupilsForClass(cls.id);
            const isActive = cls.id === data.activeClassId;

            return (
              <Pressable
                key={cls.id}
                onTouchStart={(event) => event.stopPropagation()}
                onPress={() => {
                  if (selection.isSelecting) {
                    selection.toggleSelection(cls.id);
                    return;
                  }
                  handleSelectClass(cls.id);
                }}
                style={({ pressed }) => [
                  styles.classCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: selection.selectedIds.includes(cls.id) ? colors.primary : isActive ? colors.primary : colors.border,
                    borderWidth: selection.selectedIds.includes(cls.id) || isActive ? 2 : 1,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.classIcon,
                    {
                      backgroundColor: isActive
                        ? colors.accent
                        : colors.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.classLevel,
                      { color: isActive ? colors.primary : colors.foreground },
                    ]}
                  >
                    {cls.level}
                  </Text>
                </View>

                <View style={styles.classCopy}>
                  <View style={styles.classNameRow}>
                    <Text
                      style={[styles.className, { color: colors.foreground }]}
                    >
                      {cls.name}
                    </Text>
                    {isActive && (
                      <View
                        style={[
                          styles.activePill,
                          { backgroundColor: colors.accent },
                        ]}
                      >
                        <Text
                          style={[
                            styles.activeText,
                            { color: colors.accentForeground },
                          ]}
                        >
                          Active
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.classMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {classPupils.length} élève
                    {classPupils.length > 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={styles.cardActionsRow}>
                  {selection.isSelecting ? (
                    <SelectionCheckbox checked={selection.selectedIds.includes(cls.id)} />
                  ) : <Feather name="chevron-right" size={20} color={colors.mutedForeground} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {visibleClasses.length > 0 && (
        <Button
          label="Créer une nouvelle classe"
          icon="plus"
          onPress={openCreateModal}
        />
      )}

      {/* Creation Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingViewCompat style={styles.modalOverlay}>
          <Surface
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <KeyboardAwareScrollViewCompat
              bottomOffset={100}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Nouvelle classe
                </Text>
                <Pressable onPress={resetModal} hitSlop={8}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Class Name */}
              <View style={[styles.formGroup, { marginTop: 14 }]}>
                <Text
                  style={[styles.fieldLabel, { color: colors.mutedForeground }]}
                >
                  NOM DE LA CLASSE
                </Text>
                <TextInput
                  value={newClassName}
                  onChangeText={setNewClassName}
                  placeholder="Ex. 2AS LPH3, 1AS ST2, 3AS SE"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                />
              </View>

              {/* Academic Year */}
              <View style={styles.formGroup}>
                <Text
                  style={[styles.fieldLabel, { color: colors.mutedForeground }]}
                >
                  ANNÉE SCOLAIRE
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.yearChoices}
                >
                  {data.schoolYearConfigurations.map((configuration) => {
                    const selected = configuration.year === newClassYear;
                    return (
                      <Pressable
                        key={configuration.year}
                        onPress={() => selectClassYear(configuration.year)}
                        style={[
                          styles.yearChip,
                          {
                            backgroundColor: selected
                              ? colors.primary
                              : colors.secondary,
                            borderColor: selected
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.levelChipText,
                            {
                              color: selected
                                ? colors.primaryForeground
                                : colors.foreground,
                            },
                          ]}
                        >
                          {configuration.year}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* School level */}
              <View style={styles.formGroup}>
                <Text
                  style={[styles.fieldLabel, { color: colors.mutedForeground }]}
                >
                  NIVEAU SCOLAIRE
                </Text>
                <View style={styles.levelButtons}>
                  {selectedYearConfiguration?.levels.map((level) => {
                    const selected = level.id === newClassLevelId;
                    return (
                      <Pressable
                        key={level.id}
                        onPress={() => selectClassLevel(level.id)}
                        style={[
                          styles.levelChip,
                          {
                            backgroundColor: selected
                              ? colors.primary
                              : colors.secondary,
                            borderColor: selected
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.levelChipText,
                            {
                              color: selected
                                ? colors.primaryForeground
                                : colors.foreground,
                            },
                          ]}
                        >
                          {level.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {!selectedYearConfiguration?.levels.length && (
                  <Text
                    style={[
                      styles.fieldHint,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Ajoutez d’abord un niveau dans Paramètres.
                  </Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text
                  style={[styles.fieldLabel, { color: colors.mutedForeground }]}
                >
                  TEST DE NIVEAU INITIAL
                </Text>
                <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                  Le test initial se cr?e s?par?ment depuis ? Plus ?, une seule
                  fois par classe et par ann?e scolaire.
                </Text>
              </View>

              <View style={[styles.modalActions, { marginTop: 8 }]}>
                <Button
                  label="Créer la classe"
                  icon="check"
                  onPress={handleCreateClass}
                />
                <Button label="Annuler" secondary onPress={resetModal} />
              </View>
            </KeyboardAwareScrollViewCompat>
          </Surface>
        </KeyboardAvoidingViewCompat>
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
    maxHeight: '90%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  modalContent: {
    gap: 16,
    paddingBottom: 4,
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
    gap: 8,
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
    flexWrap: 'wrap',
    gap: 8,
  },
  yearChoices: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  yearChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelChip: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
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
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
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
