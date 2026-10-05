import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
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
  Screen,
  SectionTitle,
  Surface,
} from '@/components/AppShell';
import { COMPETENCY_TEMPLATES } from '@/constants/competencies';
import { useAppData } from '@/context/AppDataContext';
import { useColors } from '@/hooks/useColors';
import { normalizeLabel } from '@/services/pedagogicalConfiguration';

export default function NewAssessmentScreen() {
  const colors = useColors();
  const data = useAppData();
  const params = useLocalSearchParams<{ classId?: string }>();

  const [selectedClassId, setSelectedClassId] = useState<string>(
    params.classId || data.activeClassId || data.classes[0]?.id || '',
  );

  const selectedClass =
    data.classes.find((c) => c.id === selectedClassId) ?? data.activeClass;

  const competencies = useMemo(
    () =>
      data.getCompetenciesForLevel(
        selectedClass.academicYear,
        selectedClass.levelId,
        selectedClass.level,
      ),
    [
      data.schoolYearConfigurations,
      selectedClass.academicYear,
      selectedClass.levelId,
      selectedClass.level,
    ],
  );
  const classAssessments = useMemo(
    () => data.getAssessmentsForClass(selectedClassId),
    [data.assessments, selectedClassId],
  );
  const isCompetencyUsed = (competency: (typeof competencies)[number]) =>
    classAssessments.some((assessment) =>
      assessment.competencyId === competency.id ||
      normalizeLabel(assessment.competency) === normalizeLabel(competency.name),
    );
  const [selectedCompetencyId, setSelectedCompetencyId] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Français');
  const [support, setSupport] = useState('');
  const [sessionObjectives, setSessionObjectives] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('fr-FR'));

  // Objectives list
  const [objectives, setObjectives] = useState<string[]>([]);
  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [removeArmedObjectiveIndex, setRemoveArmedObjectiveIndex] = useState<number | null>(null);
  const selectedCompetency = competencies.find(
    (competency) => competency.id === selectedCompetencyId,
  );

  useEffect(() => {
    const nextCompetency =
      competencies.find((item) => item.id === selectedCompetencyId && !isCompetencyUsed(item)) ??
      competencies.find((item) => !isCompetencyUsed(item));
    setSelectedCompetencyId(nextCompetency?.id ?? '');
    if (!nextCompetency) {
      setTitle('');
      setSupport('');
      setSessionObjectives('');
      setObjectives([]);
      return;
    }
    const template = COMPETENCY_TEMPLATES.find(
      (item) =>
        item.id === nextCompetency.templateId ||
        normalizeLabel(item.name) === normalizeLabel(nextCompetency.name),
    );
    const levelId = data.getLevelIdForYear(
      selectedClass.academicYear,
      selectedClass.levelId,
      selectedClass.level,
    );
    const configuredObjectives = data
      .getObjectivesForLevelCompetency(
        selectedClass.academicYear,
        levelId,
        nextCompetency.id,
      )
      .map((item) => item.description);
    setTitle(template?.defaultTitle ?? nextCompetency.name);
    setSupport(template?.defaultSupport ?? '');
    setSessionObjectives(template?.defaultSessionObjectives ?? '');
    setObjectives(
      configuredObjectives.length
        ? configuredObjectives
        : (template?.defaultObjectives ?? ['Objectif 1']),
    );
  }, [selectedClassId, selectedCompetencyId, data.schoolYearConfigurations, data.assessments]);

  const handleSelectCompetency = (competencyId: string) => {
    const competency = competencies.find((item) => item.id === competencyId);
    if (competency && isCompetencyUsed(competency)) return;
    setSelectedCompetencyId(competencyId);
    setNewObjectiveText('');
  };

  const handleAddObjective = () => {
    if (!newObjectiveText.trim()) return;
    setObjectives((prev) => [...prev, newObjectiveText.trim()]);
    setNewObjectiveText('');
  };

  const handleRemoveObjective = (indexToRemove: number) => {
    if (objectives.length <= 1) {
      Alert.alert(
        'Attention',
        'Une évaluation doit comporter au moins un objectif.',
      );
      return;
    }
    setObjectives((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdateObjective = (index: number, newText: string) => {
    setObjectives((prev) =>
      prev.map((item, idx) => (idx === index ? newText : item)),
    );
  };

  const create = () => {
    if (!title.trim() || !selectedCompetency) {
      Alert.alert(
        'Informations manquantes',
        'Le titre et la compétence sont obligatoires.',
      );
      return;
    }
    if (objectives.length === 0) {
      Alert.alert('Objectifs requis', 'Veuillez ajouter au moins un objectif.');
      return;
    }
    if (isCompetencyUsed(selectedCompetency)) {
      Alert.alert(
        'Compétence déjà évaluée',
        `La compétence « ${selectedCompetency.name} » a déjà été ajoutée à ${selectedClass.name} pour l’année scolaire ${selectedClass.academicYear}.`,
      );
      return;
    }

    const createdId = data.createAssessment({
      classId: selectedClassId,
      competency: selectedCompetency.name,
      competencyId: selectedCompetency.id,
      title: title.trim(),
      subject: subject.trim(),
      level: selectedClass.level,
      support: support.trim(),
      sessionObjectives: sessionObjectives.trim(),
      date: date.trim(),
      objectives,
    });

    if (!createdId) {
      Alert.alert(
        'Compétence déjà évaluée',
        `Cette compétence est déjà associée à une évaluation de ${selectedClass.name} pour l’année scolaire ${selectedClass.academicYear}.`,
      );
      return;
    }
    router.replace(`/assessments/${createdId}`);
  };

  return (
    <Screen onTouchStart={() => setRemoveArmedObjectiveIndex(null)}>
      <AppHeader
        eyebrow="Nouvelle évaluation"
        title="Nouvelle Compétence / Évaluation"
        onBack={() => router.back()}
        compact
      />

      {/* Class Selector */}
      <Surface
        style={styles.sectionCard}
        guideTitle="Choisir la classe"
        guideDescription="Sélectionnez le groupe d’élèves et vérifiez le niveau associé avant de créer l’évaluation."
      >
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          1. CHOISIR LA CLASSE
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.classChips}
        >
          {data.classes.map((cls) => {
            const isSelected = cls.id === selectedClassId;
            return (
              <Pressable
                key={cls.id}
                onPress={() => setSelectedClassId(cls.id)}
                style={[
                  styles.classChip,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.secondary,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.classChipText,
                    {
                      color: isSelected
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {cls.name} ({cls.level})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Surface>

      {/* Competencies configured for this school year and level */}
      <Surface
        style={styles.sectionCard}
        guideTitle="Compétences associées"
        guideDescription="Choisissez une compétence disponible pour le niveau et l’année scolaire de la classe."
      >
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          2. COMPÉTENCES ASSOCIÉES À {selectedClass.level.toLocaleUpperCase()}
        </Text>
        <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
          Année scolaire : {selectedClass.academicYear}. Les objectifs sont
          copiés depuis la configuration de ce niveau.
        </Text>
        <View style={styles.templatesGrid}>
          {competencies.map((competency) => {
            const isSelected = selectedCompetencyId === competency.id;
            const isAlreadyUsed = isCompetencyUsed(competency);
            const levelId = data.getLevelIdForYear(
              selectedClass.academicYear,
              selectedClass.levelId,
              selectedClass.level,
            );
            const objectiveCount = data.getObjectivesForLevelCompetency(
              selectedClass.academicYear,
              levelId,
              competency.id,
            ).length;
            return (
              <Pressable
                key={competency.id}
                disabled={isAlreadyUsed}
                accessibilityState={{ disabled: isAlreadyUsed, selected: isSelected }}
                onPress={() => handleSelectCompetency(competency.id)}
                style={[
                  styles.templateCard,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.card,
                    borderColor: isAlreadyUsed ? colors.border : isSelected ? colors.primary : colors.border,
                    borderWidth: !isAlreadyUsed && isSelected ? 2 : 1,
                    opacity: isAlreadyUsed ? 0.55 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.templateTitle,
                    { color: isSelected ? colors.primary : colors.foreground },
                  ]}
                >
                  {competency.name}
                </Text>
                <Text
                  style={[
                    styles.templateCount,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {isAlreadyUsed
                    ? `Déjà évaluée pour ${selectedClass.name} cette année`
                    : `${objectiveCount} objectif${objectiveCount > 1 ? 's' : ''} configuré${objectiveCount > 1 ? 's' : ''}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {competencies.length === 0 && (
          <View style={styles.emptyCompetencies}>
            <Text
              style={[styles.templateCount, { color: colors.mutedForeground }]}
            >
              Aucune compétence n’est associée à ce niveau pour cette année.
              Ajoutez-la dans la configuration pédagogique.
            </Text>
            <Button
              label="Configurer les compétences"
              icon="settings"
              secondary
              onPress={() => router.push('/settings')}
            />
          </View>
        )}
      </Surface>

      {/* Details Form */}
      <Surface
        style={styles.sectionCard}
        guideTitle="Détails de la séance"
        guideDescription="Renseignez le titre, le support, l’objectif de séance et la date de l’évaluation."
      >
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          3. DÉTAILS DE LA SÉANCE
        </Text>
        <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
          Les objectifs sont copiés depuis la configuration du niveau. Les
          modifications ci-dessous s’appliquent uniquement à cette évaluation.
        </Text>

        <View style={styles.field}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
            TITRE DE L’ÉVALUATION
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex. Compréhension de l’écrit — Le texte explicatif"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              { color: colors.foreground, borderColor: colors.border },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
            SUPPORT PÉDAGOGIQUE
          </Text>
          <TextInput
            value={support}
            onChangeText={setSupport}
            placeholder="Ex. Des extraits écrits / Document sonore"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              { color: colors.foreground, borderColor: colors.border },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
            OBJECTIF DE LA SÉANCE
          </Text>
          <TextInput
            value={sessionObjectives}
            onChangeText={setSessionObjectives}
            placeholder="Ex. Comprendre et interpréter des textes écrits en vue"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              { color: colors.foreground, borderColor: colors.border },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
            DATE
          </Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="JJ/MM/AAAA"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              { color: colors.foreground, borderColor: colors.border },
            ]}
          />
        </View>
      </Surface>

      {/* Objectives Configuration Section */}
      <Surface
        style={styles.sectionCard}
        guideTitle="Objectifs de la compétence"
        guideDescription="Vérifiez ou adaptez les objectifs qui seront évalués pour cette séance."
      >
        <View style={styles.objectivesHeader}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            4. OBJECTIFS DE CETTE COMPÉTENCE ({objectives.length})
          </Text>
        </View>

        <View style={styles.objectivesList}>
          {objectives.map((desc, idx) => (
            <View
              key={idx}
              style={[
                styles.objectiveRow,
                removeArmedObjectiveIndex === idx
                  ? { backgroundColor: colors.card, borderColor: colors.destructive, borderWidth: 2 }
                  : { borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.objectiveIndex,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Pressable
                  accessibilityHint="Maintenez appuyé pour afficher le retrait de cet objectif."
                  onTouchStart={(event) => event.stopPropagation()}
                  onLongPress={() => setRemoveArmedObjectiveIndex(idx)}
                  onPress={() => {
                    if (removeArmedObjectiveIndex !== null) setRemoveArmedObjectiveIndex(idx);
                  }}
                >
                  <Text style={[styles.objectiveIndexText, { color: colors.primary }]}>
                    {String(idx + 1).padStart(2, '0')}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={desc}
                onChangeText={(val) => handleUpdateObjective(idx, val)}
                multiline
                style={[styles.objectiveInput, { color: colors.foreground }]}
              />
              {removeArmedObjectiveIndex === idx ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer l’objectif ${idx + 1}`}
                  onTouchStart={(event) => event.stopPropagation()}
                  onPress={() => {
                    setRemoveArmedObjectiveIndex(null);
                    handleRemoveObjective(idx);
                  }}
                  hitSlop={8}
                  style={styles.deleteButton}
                >
                  <Feather name="trash-2" size={17} color={colors.destructiveForeground || '#DC2626'} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {/* Add Objective Input */}
        <View style={styles.addObjectiveBox}>
          <TextInput
            value={newObjectiveText}
            onChangeText={setNewObjectiveText}
            placeholder="Ajouter un objectif personnalisé…"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.addObjectiveInput,
              { color: colors.foreground, borderColor: colors.border },
            ]}
          />
          <Button
            label="Ajouter"
            icon="plus"
            compact
            onPress={handleAddObjective}
            disabled={!newObjectiveText.trim()}
          />
        </View>
      </Surface>

      {/* Submit / Cancel Actions */}
      <View style={styles.actions}>
        <Button
          label="Créer cette compétence & Commencer l’évaluation"
          icon="check"
          onPress={create}
        />
        <Button label="Annuler" secondary onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    padding: 16,
    borderRadius: 14,
    gap: 12,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  classChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  classChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
  },
  classChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  templatesGrid: {
    gap: 8,
  },
  emptyCompetencies: {
    gap: 10,
  },
  templateCard: {
    padding: 12,
    borderRadius: 10,
    gap: 3,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  templateCount: {
    fontSize: 11,
  },
  field: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13.5,
  },
  objectivesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  objectivesList: {
    gap: 8,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  objectiveIndex: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  objectiveIndexText: {
    fontSize: 11,
    fontWeight: '800',
  },
  objectiveInput: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    padding: 0,
  },
  deleteButton: {
    padding: 4,
    marginTop: 2,
  },
  addObjectiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  addObjectiveInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  actions: {
    gap: 10,
    marginTop: 6,
    marginBottom: 30,
  },
});
