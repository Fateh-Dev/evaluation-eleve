import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, SectionTitle, Surface } from '@/components/AppShell';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';

export default function PedagogicalConfigurationManager() {
  const colors = useColors();
  const data = useAppData();
  const [selectedYear, setSelectedYear] = useState(data.academicYear);
  const [newYearName, setNewYearName] = useState('');
  const [newLevelName, setNewLevelName] = useState('');
  const [newCompetencyName, setNewCompetencyName] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedCompetencyId, setSelectedCompetencyId] = useState('');
  const [objectiveDraft, setObjectiveDraft] = useState<string[]>([]);

  const configuration = data.getSchoolYearConfiguration(selectedYear);
  const selectedLevel = configuration?.levels.find(
    (level) => level.id === selectedLevelId,
  );
  const linkedCompetencies = data.getCompetenciesForLevel(
    selectedYear,
    selectedLevelId,
  );
  const allCompetencies = configuration?.competencies ?? [];
  const selectedCompetency = allCompetencies.find(
    (competency) => competency.id === selectedCompetencyId,
  );

  useEffect(() => {
    if (
      !data.schoolYearConfigurations.some((item) => item.year === selectedYear)
    ) {
      setSelectedYear(data.academicYear);
      setSelectedLevelId('');
      setSelectedCompetencyId('');
      return;
    }
    if (
      configuration &&
      !configuration.levels.some((level) => level.id === selectedLevelId)
    ) {
      const nextLevel = configuration.levels[0];
      const nextCompetency = nextLevel
        ? data.getCompetenciesForLevel(selectedYear, nextLevel.id)[0]
        : undefined;
      setSelectedLevelId(nextLevel?.id ?? '');
      setSelectedCompetencyId(nextCompetency?.id ?? '');
    }
  }, [
    data.schoolYearConfigurations,
    data.academicYear,
    configuration,
    selectedYear,
    selectedLevelId,
  ]);

  useEffect(() => {
    if (!selectedLevelId || !selectedCompetencyId) {
      setObjectiveDraft([]);
      return;
    }
    setObjectiveDraft(
      data
        .getObjectivesForLevelCompetency(
          selectedYear,
          selectedLevelId,
          selectedCompetencyId,
        )
        .map((objective) => objective.description),
    );
  }, [selectedYear, selectedLevelId, selectedCompetencyId]);

  const selectYear = (year: string) => {
    const nextConfiguration = data.getSchoolYearConfiguration(year);
    const nextLevel = nextConfiguration?.levels[0];
    const nextCompetency = nextLevel
      ? data.getCompetenciesForLevel(year, nextLevel.id)[0]
      : undefined;
    setSelectedYear(year);
    setSelectedLevelId(nextLevel?.id ?? '');
    setSelectedCompetencyId(nextCompetency?.id ?? '');
  };

  const selectLevel = (levelId: string) => {
    const nextCompetency = data.getCompetenciesForLevel(
      selectedYear,
      levelId,
    )[0];
    setSelectedLevelId(levelId);
    setSelectedCompetencyId(nextCompetency?.id ?? '');
  };

  const createYear = (copyConfiguration: boolean) => {
    const name = newYearName.trim();
    if (!name) {
      Alert.alert(
        'Année requise',
        'Saisissez le libellé de la nouvelle année scolaire.',
      );
      return;
    }
    const created = data.createAcademicYear(
      name,
      copyConfiguration ? selectedYear : undefined,
    );
    if (!created) {
      Alert.alert(
        'Année déjà présente',
        'Cette année scolaire existe déjà dans les configurations.',
      );
      return;
    }
    setSelectedYear(name);
    setSelectedLevelId('');
    setSelectedCompetencyId('');
    setObjectiveDraft([]);
    setNewYearName('');
  };

  const addLevel = () => {
    const levelId = data.addSchoolLevel(selectedYear, newLevelName);
    if (!levelId) return;
    setSelectedLevelId(levelId);
    setSelectedCompetencyId('');
    setObjectiveDraft([]);
    setNewLevelName('');
  };

  const addCompetency = () => {
    if (!selectedLevelId) {
      Alert.alert(
        'Niveau requis',
        'Ajoutez ou sélectionnez un niveau avant d’associer une compétence.',
      );
      return;
    }
    const competencyId = data.addOrAssociateCompetency(
      selectedYear,
      selectedLevelId,
      newCompetencyName,
    );
    if (!competencyId) return;
    setSelectedCompetencyId(competencyId);
    setNewCompetencyName('');
  };

  const toggleAssociation = (competencyId: string) => {
    const currentlyLinked =
      configuration?.associations.some(
        (association) =>
          association.levelId === selectedLevelId &&
          association.competencyId === competencyId,
      ) ?? false;
    data.setCompetencyAssociation(
      selectedYear,
      selectedLevelId,
      competencyId,
      !currentlyLinked,
    );
    if (currentlyLinked && selectedCompetencyId === competencyId) {
      const nextCompetency = linkedCompetencies.find(
        (item) => item.id !== competencyId,
      );
      setSelectedCompetencyId(nextCompetency?.id ?? '');
    } else if (!currentlyLinked) {
      setSelectedCompetencyId(competencyId);
    }
  };

  const saveObjectives = () => {
    if (!selectedLevelId || !selectedCompetencyId) return;
    const cleaned = objectiveDraft.map((item) => item.trim()).filter(Boolean);
    data.setConfiguredObjectives(
      selectedYear,
      selectedLevelId,
      selectedCompetencyId,
      cleaned,
    );
    setObjectiveDraft(cleaned);
    Alert.alert(
      'Configuration enregistrée',
      'La liste d’objectifs est enregistrée pour cette année, ce niveau et cette compétence.',
    );
  };

  return (
    <>
      <SectionTitle title="Configuration pédagogique par année" />
      <Surface style={[styles.card, { borderColor: colors.border }]}>
        <Text style={[styles.help, { color: colors.mutedForeground }]}>
          Chaque année possède ses niveaux, ses compétences et ses objectifs par
          couple niveau–compétence. Une copie crée un nouveau jeu indépendant
          sans modifier l’année source.
        </Text>

        <View style={styles.block}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            ANNÉES CONFIGURÉES
          </Text>
          <View style={styles.chips}>
            {data.schoolYearConfigurations.map((item) => {
              const selected = item.year === selectedYear;
              const active = item.year === data.academicYear;
              return (
                <Pressable
                  key={item.year}
                  accessibilityRole="button"
                  onPress={() => selectYear(item.year)}
                  style={[
                    styles.chip,
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
                      styles.chipText,
                      {
                        color: selected
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {item.year}
                  </Text>
                  {active && (
                    <Text
                      style={[
                        styles.activeMark,
                        {
                          color: selected
                            ? colors.primaryForeground
                            : colors.primary,
                        },
                      ]}
                    >
                      Active
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
          {selectedYear !== data.academicYear && (
            <Button
              label={`Définir ${selectedYear} comme année active`}
              icon="check"
              compact
              secondary
              onPress={() => data.setActiveAcademicYear(selectedYear)}
            />
          )}
        </View>

        <View
          style={[
            styles.block,
            styles.divider,
            { borderTopColor: colors.border },
          ]}
        >
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            NOUVELLE ANNÉE SCOLAIRE
          </Text>
          <TextInput
            value={newYearName}
            onChangeText={setNewYearName}
            placeholder="Ex. 2026/2027"
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
          <View style={styles.buttonStack}>
            <Button
              label={`Créer en copiant ${selectedYear || 'l’année sélectionnée'}`}
              icon="copy"
              onPress={() => createYear(true)}
            />
            <Button
              label="Créer avec la configuration par défaut"
              icon="plus"
              secondary
              onPress={() => createYear(false)}
            />
          </View>
        </View>

        <View
          style={[
            styles.block,
            styles.divider,
            { borderTopColor: colors.border },
          ]}
        >
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            NIVEAUX · {selectedYear}
          </Text>
          <View style={styles.chips}>
            {(configuration?.levels ?? []).map((level) => {
              const selected = level.id === selectedLevelId;
              return (
                <Pressable
                  key={level.id}
                  accessibilityRole="button"
                  onPress={() => selectLevel(level.id)}
                  style={[
                    styles.chip,
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
                      styles.chipText,
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
          <View style={styles.inlineRow}>
            <TextInput
              value={newLevelName}
              onChangeText={setNewLevelName}
              placeholder="Ajouter un niveau (ex. 1AM)"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                styles.flexInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter le niveau"
              onPress={addLevel}
              style={[styles.addButton, { backgroundColor: colors.accent }]}
            >
              <Feather name="plus" size={17} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.block,
            styles.divider,
            { borderTopColor: colors.border },
          ]}
        >
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            COMPÉTENCES DISPONIBLES ·{' '}
            {selectedLevel?.name ?? 'choisissez un niveau'}
          </Text>
          {allCompetencies.map((competency) => {
            const linked =
              configuration?.associations.some(
                (association) =>
                  association.levelId === selectedLevelId &&
                  association.competencyId === competency.id,
              ) ?? false;
            const selectedForEditing = selectedCompetencyId === competency.id;
            return (
              <View
                key={competency.id}
                style={[
                  styles.competencyRow,
                  {
                    borderColor: colors.border,
                    backgroundColor: selectedForEditing
                      ? colors.accent
                      : colors.background,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: linked }}
                  onPress={() => toggleAssociation(competency.id)}
                  style={styles.competencyToggle}
                >
                  <Feather
                    name={linked ? 'check-square' : 'square'}
                    size={19}
                    color={linked ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.competencyName,
                      { color: colors.foreground },
                    ]}
                  >
                    {competency.name}
                  </Text>
                </Pressable>
                {linked && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Configurer les objectifs de ${competency.name}`}
                    onPress={() => setSelectedCompetencyId(competency.id)}
                    style={[
                      styles.objectivesButton,
                      {
                        borderColor: selectedForEditing
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.objectivesButtonText,
                        { color: colors.primary },
                      ]}
                    >
                      Objectifs
                    </Text>
                    <Feather
                      name="chevron-right"
                      size={15}
                      color={colors.primary}
                    />
                  </Pressable>
                )}
              </View>
            );
          })}
          <View style={styles.inlineRow}>
            <TextInput
              value={newCompetencyName}
              onChangeText={setNewCompetencyName}
              placeholder="Créer ou réutiliser une compétence"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                styles.flexInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Créer ou associer la compétence"
              onPress={addCompetency}
              style={[styles.addButton, { backgroundColor: colors.accent }]}
            >
              <Feather name="plus" size={17} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>
            Une compétence au même nom est réutilisée dans cette année et peut
            être associée à plusieurs niveaux. Chaque association conserve sa
            propre liste d’objectifs.
          </Text>
        </View>

        {selectedLevel && selectedCompetency && (
          <View
            style={[
              styles.objectiveEditor,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <View style={styles.editorHeader}>
              <View style={styles.editorCopy}>
                <Text
                  style={[styles.editorTitle, { color: colors.foreground }]}
                >
                  {selectedCompetency.name}
                </Text>
                <Text style={[styles.help, { color: colors.mutedForeground }]}>
                  {selectedYear} · {selectedLevel.name}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ajouter un objectif vide"
                onPress={() =>
                  setObjectiveDraft((previous) => [...previous, ''])
                }
                style={[styles.addButton, { backgroundColor: colors.accent }]}
              >
                <Feather name="plus" size={17} color={colors.primary} />
              </Pressable>
            </View>
            {objectiveDraft.map((objective, index) => (
              <View
                key={`${selectedCompetency.id}-${index}`}
                style={styles.inlineRow}
              >
                <Text style={[styles.order, { color: colors.mutedForeground }]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <TextInput
                  value={objective}
                  onChangeText={(value) =>
                    setObjectiveDraft((previous) =>
                      previous.map((item, itemIndex) =>
                        itemIndex === index ? value : item,
                      ),
                    )
                  }
                  placeholder={`Objectif ${index + 1}`}
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.input,
                    styles.flexInput,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer l’objectif ${index + 1}`}
                  onPress={() =>
                    setObjectiveDraft((previous) =>
                      previous.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  style={[
                    styles.removeButton,
                    { backgroundColor: colors.errorSurface },
                  ]}
                >
                  <Feather name="x" size={16} color={colors.errorForeground} />
                </Pressable>
              </View>
            ))}
            {objectiveDraft.length === 0 && (
              <Text style={[styles.help, { color: colors.mutedForeground }]}>
                Aucun objectif pour cette association. Ajoutez-en avant de créer
                une évaluation.
              </Text>
            )}
            <Button
              label="Enregistrer les objectifs"
              icon="save"
              onPress={saveObjectives}
            />
          </View>
        )}
      </Surface>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 16, marginBottom: 14 },
  block: { gap: 10 },
  divider: { borderTopWidth: 1, paddingTop: 14 },
  fieldLabel: { fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  help: { fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  activeMark: { fontSize: 9, fontWeight: '800' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  buttonStack: { gap: 8 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flexInput: { flex: 1, minWidth: 0 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  competencyRow: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 11,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  competencyToggle: {
    minHeight: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 7,
  },
  competencyName: { flex: 1, fontSize: 13, fontWeight: '700' },
  objectivesButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  objectivesButtonText: { fontSize: 11, fontWeight: '700' },
  objectiveEditor: { borderWidth: 1, borderRadius: 13, padding: 12, gap: 9 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editorCopy: { flex: 1, gap: 3 },
  editorTitle: { fontSize: 14, fontWeight: '800' },
  order: { width: 22, textAlign: 'center', fontSize: 10, fontWeight: '800' },
  removeButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
