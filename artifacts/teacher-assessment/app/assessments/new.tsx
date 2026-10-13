import { Alert } from '@/components/AppDialog';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Platform,
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
  const params = useLocalSearchParams<{
    classId?: string;
    evaluationType?: string;
    trainingSessionId?: string;
    diagnosticTitle?: string;
    studyObjectTitle?: string;
  }>();

  const [selectedClassId, setSelectedClassId] = useState<string>(
    params.classId || data.activeClassId || data.classes[0]?.id || '',
  );

  const selectedClass =
    data.classes.find((c) => c.id === selectedClassId) ?? data.activeClass;
  const existingLevelTest = data.getLevelTestForClassYear(
    selectedClassId,
    selectedClass.academicYear,
  );
  const existingCompetencyCount = existingLevelTest
    ? data.assessments.filter(
        (assessment) => assessment.levelTestId === existingLevelTest.id,
      ).filter((assessment) => (assessment.evaluationType ?? 'competency') === 'competency').length
    : 0;

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
  const [evaluationType, setEvaluationType] = useState<
    'competency' | 'prerequisites'
  >(params.evaluationType === 'prerequisites' ? 'prerequisites' : 'competency');
  const classAssessments = useMemo(
    () => data.getAssessmentsForClass(selectedClassId),
    [data.assessments, selectedClassId],
  );
  const isCompetencyUsed = (
    competency: (typeof competencies)[number],
    type = evaluationType,
  ) =>
    classAssessments.some((assessment) =>
      (assessment.evaluationType ?? 'competency') === type &&
      (params.trainingSessionId
        ? assessment.trainingSessionId === params.trainingSessionId
        : !assessment.trainingSessionId) &&
      (assessment.competencyId === competency.id ||
        normalizeLabel(assessment.competency) === normalizeLabel(competency.name)),
    );
  const selectableCompetencies = useMemo(
    () => evaluationType === 'prerequisites'
      ? competencies.filter((competency) => {
          const levelId = data.getLevelIdForYear(
            selectedClass.academicYear,
            selectedClass.levelId,
            selectedClass.level,
          );
          return data.getPrerequisitesForLevelCompetency(
            selectedClass.academicYear,
            levelId,
            competency.id,
          ).length > 0;
        })
      : competencies,
    [
      competencies,
      data.schoolYearConfigurations,
      evaluationType,
      selectedClass.academicYear,
      selectedClass.levelId,
      selectedClass.level,
    ],
  );
  const [selectedCompetencyId, setSelectedCompetencyId] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Français');
  const [support, setSupport] = useState('');
  const [sessionObjectives, setSessionObjectives] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Objectives list
  const [objectives, setObjectives] = useState<string[]>([]);
  const [newObjectiveText, setNewObjectiveText] = useState('');
  const [removeArmedObjectiveIndex, setRemoveArmedObjectiveIndex] = useState<number | null>(null);
  const selectedCompetency = competencies.find(
    (competency) => competency.id === selectedCompetencyId,
  );

  useEffect(() => {
    const nextCompetency =
      selectableCompetencies.find((item) => item.id === selectedCompetencyId && !isCompetencyUsed(item)) ??
      selectableCompetencies.find((item) => !isCompetencyUsed(item));
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
    setTitle(
      evaluationType === 'prerequisites'
        ? `${params.diagnosticTitle ? `${params.diagnosticTitle} — ` : 'Évaluation des prérequis — '}${nextCompetency.name}`
        : template?.defaultTitle ?? nextCompetency.name,
    );
    setSupport(template?.defaultSupport ?? '');
    setSessionObjectives(
      evaluationType === 'prerequisites'
        ? `Évaluation diagnostique de la classe${params.studyObjectTitle ? ` pour l’objet d’étude « ${params.studyObjectTitle} »` : ''} : vérifier les prérequis de la compétence « ${nextCompetency.name} ».`
        : template?.defaultSessionObjectives ?? '',
    );
    const configuredCriteria =
      evaluationType === 'prerequisites'
        ? data
            .getPrerequisitesForLevelCompetency(
              selectedClass.academicYear,
              levelId,
              nextCompetency.id,
            )
            .map((item) => item.description)
        : configuredObjectives;
    setObjectives(
      configuredCriteria.length
        ? configuredCriteria
        : evaluationType === 'prerequisites'
          ? []
          : (template?.defaultObjectives ?? ['Objectif 1']),
    );
  }, [
    selectedClassId,
    selectableCompetencies,
    selectedCompetencyId,
    evaluationType,
    params.diagnosticTitle,
    params.studyObjectTitle,
    params.trainingSessionId,
    data.schoolYearConfigurations,
    data.assessments,
  ]);

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
    if (
      evaluationType === 'prerequisites' &&
      data.getPrerequisitesForLevelCompetency(
        selectedClass.academicYear,
        data.getLevelIdForYear(
          selectedClass.academicYear,
          selectedClass.levelId,
          selectedClass.level,
        ),
        selectedCompetency.id,
      ).length === 0
    ) {
      Alert.alert(
        'Prérequis non configurés',
        'Configurez au moins un prérequis pour cette compétence dans les paramètres pédagogiques avant de créer son test.',
      );
      return;
    }
    if (objectives.length === 0) {
      Alert.alert(
        evaluationType === 'prerequisites' ? 'Prérequis requis' : 'Objectifs requis',
        evaluationType === 'prerequisites'
          ? 'Configurez les prérequis de cette compétence dans la configuration pédagogique avant de créer le test.'
          : 'Veuillez ajouter au moins un objectif.',
      );
      return;
    }
    if (isCompetencyUsed(selectedCompetency, evaluationType)) {
      Alert.alert(
        evaluationType === 'prerequisites'
          ? 'Test des prérequis déjà créé'
          : 'Compétence déjà évaluée',
        `La compétence « ${selectedCompetency.name} » possède déjà ${evaluationType === 'prerequisites' ? 'un test des prérequis' : 'une évaluation habituelle'} pour ${selectedClass.name} pendant l’année scolaire ${selectedClass.academicYear}.`,
      );
      return;
    }

    const createdId = data.createAssessment({
      classId: selectedClassId,
      ...(params.trainingSessionId ? { trainingSessionId: params.trainingSessionId } : {}),
      competency: selectedCompetency.name,
      competencyId: selectedCompetency.id,
      evaluationType,
      title: title.trim(),
      subject: subject.trim(),
      level: selectedClass.level,
      support: support.trim(),
      sessionObjectives: sessionObjectives.trim(),
      date: new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR'),
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
        eyebrow={params.trainingSessionId
          ? 'Évaluation diagnostique de la classe'
          : evaluationType === 'prerequisites' ? 'Test des prérequis' : 'Test de niveau'}
        title={
          params.trainingSessionId
            ? 'Évaluer les prérequis'
            : existingLevelTest
            ? 'Ajouter une évaluation'
            : 'Créer le test initial'
        }
        onBack={() => router.back()}
        compact
      />
      <Surface style={styles.sectionCard}>
        <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
          {params.trainingSessionId
            ? `Évaluation liée au diagnostic « ${params.diagnosticTitle ?? 'Diagnostic'} »${params.studyObjectTitle ? ` — ${params.studyObjectTitle}` : ''}, pour les élèves de ${selectedClass.name}.`
            : existingLevelTest
            ? `Le test initial de ${selectedClass.name} pour ${selectedClass.academicYear} existe déjà. ${existingCompetencyCount} compétence${existingCompetencyCount > 1 ? 's' : ''} évaluée${existingCompetencyCount > 1 ? 's' : ''} actuellement.`
            : `Vous créez le test initial de ${selectedClass.name} pour ${selectedClass.academicYear}.`}
        </Text>
      </Surface>

      {/* Class Selector */}
      <Surface
        style={styles.sectionCard}
        guideTitle="Choisir la classe"
        guideDescription="Sélectionnez le groupe d’élèves et vérifiez le niveau associé avant de créer l’évaluation."
      >
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          1. CHOISIR LA CLASSE
        </Text>
        {params.trainingSessionId ? (
          <Text style={[styles.templateTitle, { color: colors.foreground }]}>
            {selectedClass.name} ({selectedClass.level})
          </Text>
        ) : (
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
        )}
      </Surface>

      <Surface style={styles.sectionCard}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          {params.trainingSessionId ? '2. DIAGNOSTIC DES PRÉREQUIS' : '2. TYPE D’ÉVALUATION'}
        </Text>
        {params.trainingSessionId ? (
          <Text style={[styles.typeChoiceDescription, { color: colors.mutedForeground }]}>
            Choisissez une compétence configurée et renseignez les résultats de toute la classe sur ses prérequis.
          </Text>
        ) : (
          <View style={styles.typeChoices}>
            {([
              ['competency', 'Évaluation habituelle'],
              ['prerequisites', 'Test des prérequis'],
            ] as const).map(([type, label]) => {
              const selected = evaluationType === type;
              return (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setEvaluationType(type)}
                  style={[
                    styles.typeChoice,
                    {
                      backgroundColor: selected ? colors.accent : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChoiceTitle,
                      { color: selected ? colors.primary : colors.foreground },
                    ]}
                  >
                    {label}
                  </Text>
                  <Text style={[styles.typeChoiceDescription, { color: colors.mutedForeground }]}>
                    {type === 'prerequisites'
                      ? 'Mesure les acquis déjà nécessaires pour cette compétence.'
                      : 'Évalue les objectifs habituels de la compétence.'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Surface>

      {/* Competencies configured for this school year and level */}
      <Surface
        style={styles.sectionCard}
        guideTitle="Compétences associées"
        guideDescription="Choisissez une compétence disponible pour le niveau et l’année scolaire de la classe."
      >
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          3. COMPÉTENCES ASSOCIÉES À {selectedClass.level.toLocaleUpperCase()}
        </Text>
        <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
          Année scolaire : {selectedClass.academicYear}. {evaluationType === 'prerequisites'
            ? 'Les prérequis enregistrés pour cette compétence seront copiés dans le test.'
            : 'Les objectifs enregistrés pour cette compétence seront copiés dans le test.'}
        </Text>
        <View style={styles.templatesGrid}>
          {selectableCompetencies.map((competency) => {
            const isSelected = selectedCompetencyId === competency.id;
            const isAlreadyUsed = isCompetencyUsed(competency);
            const levelId = data.getLevelIdForYear(
              selectedClass.academicYear,
              selectedClass.levelId,
              selectedClass.level,
            );
            const objectiveCount =
              evaluationType === 'prerequisites'
                ? data.getPrerequisitesForLevelCompetency(
                    selectedClass.academicYear,
                    levelId,
                    competency.id,
                  ).length
                : data.getObjectivesForLevelCompetency(
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
                    : `${objectiveCount} ${evaluationType === 'prerequisites' ? 'prérequis' : 'objectif'}${objectiveCount > 1 ? 's' : ''} configuré${objectiveCount > 1 ? 's' : ''}`}
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
        {evaluationType === 'prerequisites' && competencies.length > 0 && selectableCompetencies.length === 0 ? (
          <View style={styles.emptyCompetencies}>
            <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
              Aucun prérequis n’est configuré pour les compétences de ce niveau. Configurez-les dans les paramètres pédagogiques pour préparer ce diagnostic.
            </Text>
          </View>
        ) : null}
        {evaluationType === 'prerequisites' &&
          selectedCompetency &&
          data.getPrerequisitesForLevelCompetency(
            selectedClass.academicYear,
            data.getLevelIdForYear(
              selectedClass.academicYear,
              selectedClass.levelId,
              selectedClass.level,
            ),
            selectedCompetency.id,
          ).length === 0 && (
            <View style={styles.prerequisiteHint}>
              <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
                Aucun prérequis n’est encore configuré pour cette compétence.
              </Text>
              <Button
                label="Configurer les prérequis"
                icon="settings"
                secondary
                onPress={() => router.push('/settings/pedagogical')}
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
          4. DÉTAILS DE LA SÉANCE
        </Text>
        <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
          {evaluationType === 'prerequisites'
            ? 'Les prérequis sont copiés depuis la configuration pédagogique. Les modifications ci-dessous s’appliquent uniquement à ce test.'
            : 'Les objectifs sont copiés depuis la configuration du niveau. Les modifications ci-dessous s’appliquent uniquement à cette évaluation.'}
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
          {Platform.OS === 'web' ? (
            React.createElement('input', {
              type: 'date',
              'aria-label': 'Date de l’évaluation',
              value: date,
              onChange: (event: { currentTarget: { value: string } }) => setDate(event.currentTarget.value),
              style: { height: 44, padding: '0 12px', borderWidth: 1, borderStyle: 'solid', borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, color: colors.foreground, fontSize: 14 },
            })
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Date de l’évaluation : ${new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR')}`}
                onPress={() => setShowDatePicker((visible) => !visible)}
                style={[styles.datePickerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Feather name="calendar" size={16} color={colors.primary} />
                <Text style={[styles.datePickerText, { color: colors.foreground }]}>
                  {new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR')}
                </Text>
              </Pressable>
              {showDatePicker ? (
                <View style={[styles.datePickerContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <DateTimePicker
                    value={new Date(`${date}T00:00:00`)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={(_, selectedDate) => {
                      setDate(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`);
                      if (Platform.OS !== 'ios') setShowDatePicker(false);
                    }}
                    onDismiss={() => setShowDatePicker(false)}
                  />
                  {Platform.OS === 'ios' ? (
                    <Pressable accessibilityRole="button" onPress={() => setShowDatePicker(false)} style={styles.datePickerDone}>
                      <Text style={[styles.datePickerDoneText, { color: colors.primary }]}>Terminé</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </>
          )}
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
            5. {evaluationType === 'prerequisites' ? 'PRÉREQUIS' : 'OBJECTIFS DE CETTE COMPÉTENCE'} ({objectives.length})
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
            placeholder={evaluationType === 'prerequisites' ? 'Ajouter un prérequis personnalisé…' : 'Ajouter un objectif personnalisé…'}
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
          label={evaluationType === 'prerequisites'
            ? 'Créer le test des prérequis'
            : 'Créer cette compétence & Commencer l’évaluation'}
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
  typeChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChoice: {
    flex: 1,
    minWidth: 210,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  typeChoiceTitle: { fontSize: 13, fontWeight: '700' },
  typeChoiceDescription: { fontSize: 11, lineHeight: 16 },
  prerequisiteHint: { gap: 8 },
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
  datePickerButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  datePickerText: { fontSize: 14, fontWeight: '600' },
  datePickerContainer: { alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 8 },
  datePickerDone: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 7 },
  datePickerDoneText: { fontSize: 14, fontWeight: '700' },
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
