import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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

export default function NewAssessmentScreen() {
  const colors = useColors();
  const data = useAppData();
  const params = useLocalSearchParams<{ classId?: string }>();

  const [selectedClassId, setSelectedClassId] = useState<string>(
    params.classId || data.activeClassId || data.classes[0]?.id || '',
  );

  const selectedClass = data.classes.find((c) => c.id === selectedClassId) ?? data.activeClass;

  const [competencyType, setCompetencyType] = useState<string>(
    COMPETENCY_TEMPLATES[0].name,
  );
  const [title, setTitle] = useState(COMPETENCY_TEMPLATES[0].defaultTitle);
  const [subject, setSubject] = useState('Français');
  const [support, setSupport] = useState(COMPETENCY_TEMPLATES[0].defaultSupport);
  const [sessionObjectives, setSessionObjectives] = useState(
    COMPETENCY_TEMPLATES[0].defaultSessionObjectives,
  );
  const [date, setDate] = useState(new Date().toLocaleDateString('fr-FR'));

  // Objectives list
  const [objectives, setObjectives] = useState<string[]>([
    ...COMPETENCY_TEMPLATES[0].defaultObjectives,
  ]);
  const [newObjectiveText, setNewObjectiveText] = useState('');

  const handleSelectTemplate = (templateName: string) => {
    setCompetencyType(templateName);
    const tmpl = COMPETENCY_TEMPLATES.find((t) => t.name === templateName);
    if (tmpl) {
      setTitle(tmpl.defaultTitle);
      setSupport(tmpl.defaultSupport);
      setSessionObjectives(tmpl.defaultSessionObjectives);
      setObjectives([...tmpl.defaultObjectives]);
    } else {
      setTitle(templateName);
      setSupport('');
      setSessionObjectives('');
      setObjectives(['Objectif 1']);
    }
  };

  const handleAddObjective = () => {
    if (!newObjectiveText.trim()) return;
    setObjectives((prev) => [...prev, newObjectiveText.trim()]);
    setNewObjectiveText('');
  };

  const handleRemoveObjective = (indexToRemove: number) => {
    if (objectives.length <= 1) {
      Alert.alert('Attention', 'Une évaluation doit comporter au moins un objectif.');
      return;
    }
    setObjectives((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdateObjective = (index: number, newText: string) => {
    setObjectives((prev) => prev.map((item, idx) => (idx === index ? newText : item)));
  };

  const create = () => {
    if (!title.trim() || !competencyType.trim()) {
      Alert.alert('Informations manquantes', 'Le titre et la compétence sont obligatoires.');
      return;
    }
    if (objectives.length === 0) {
      Alert.alert('Objectifs requis', 'Veuillez ajouter au moins un objectif.');
      return;
    }

    const createdId = data.createAssessment({
      classId: selectedClassId,
      competency: competencyType,
      title: title.trim(),
      subject: subject.trim(),
      level: selectedClass.level,
      support: support.trim(),
      sessionObjectives: sessionObjectives.trim(),
      date: date.trim(),
      objectives,
    });

    router.replace(`/assessments/${createdId}`);
  };

  return (
    <Screen>
      <AppHeader
        eyebrow={`${selectedClass.name} · ${selectedClass.level}`}
        title="Nouvelle Compétence / Évaluation"
        onBack={() => router.back()}
      />

      {/* Class Selector */}
      <Surface style={styles.sectionCard}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>1. CHOISIR LA CLASSE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChips}>
          {data.classes.map((cls) => {
            const isSelected = cls.id === selectedClassId;
            return (
              <Pressable
                key={cls.id}
                onPress={() => setSelectedClassId(cls.id)}
                style={[
                  styles.classChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.secondary,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.classChipText,
                    { color: isSelected ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {cls.name} ({cls.level})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Surface>

      {/* Competency Template Selector */}
      <Surface style={styles.sectionCard}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          2. CHOISIR LA COMPÉTENCE (MODÈLE)
        </Text>
        <View style={styles.templatesGrid}>
          {COMPETENCY_TEMPLATES.map((tmpl) => {
            const isSelected = competencyType === tmpl.name;
            return (
              <Pressable
                key={tmpl.id}
                onPress={() => handleSelectTemplate(tmpl.name)}
                style={[
                  styles.templateCard,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.templateTitle,
                    { color: isSelected ? colors.primary : colors.foreground },
                  ]}
                >
                  {tmpl.name}
                </Text>
                <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
                  {tmpl.defaultObjectives.length} objectifs pré-configurés
                </Text>
              </Pressable>
            );
          })}

          {/* Custom option */}
          <Pressable
            onPress={() => handleSelectTemplate('Compétence personnalisée')}
            style={[
              styles.templateCard,
              {
                backgroundColor:
                  competencyType === 'Compétence personnalisée' ? colors.accent : colors.card,
                borderColor:
                  competencyType === 'Compétence personnalisée' ? colors.primary : colors.border,
                borderWidth: competencyType === 'Compétence personnalisée' ? 2 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.templateTitle,
                {
                  color:
                    competencyType === 'Compétence personnalisée' ? colors.primary : colors.foreground,
                },
              ]}
            >
              Autre / Personnalisée
            </Text>
            <Text style={[styles.templateCount, { color: colors.mutedForeground }]}>
              Définir des objectifs sur mesure
            </Text>
          </Pressable>
        </View>
      </Surface>

      {/* Details Form */}
      <Surface style={styles.sectionCard}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          3. DÉTAILS DE LA SÉANCE
        </Text>

        <View style={styles.field}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>TITRE DE L’ÉVALUATION</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ex. Compréhension de l’écrit — Le texte explicatif"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>SUPPORT PÉDAGOGIQUE</Text>
          <TextInput
            value={support}
            onChangeText={setSupport}
            placeholder="Ex. Des extraits écrits / Document sonore"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>OBJECTIF DE LA SÉANCE</Text>
          <TextInput
            value={sessionObjectives}
            onChangeText={setSessionObjectives}
            placeholder="Ex. Comprendre et interpréter des textes écrits en vue"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>DATE</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="JJ/MM/AAAA"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />
        </View>
      </Surface>

      {/* Objectives Configuration Section */}
      <Surface style={styles.sectionCard}>
        <View style={styles.objectivesHeader}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            4. OBJECTIFS DE CETTE COMPÉTENCE ({objectives.length})
          </Text>
        </View>

        <View style={styles.objectivesList}>
          {objectives.map((desc, idx) => (
            <View key={idx} style={[styles.objectiveRow, { borderColor: colors.border }]}>
              <View style={[styles.objectiveIndex, { backgroundColor: colors.accent }]}>
                <Text style={[styles.objectiveIndexText, { color: colors.primary }]}>
                  {String(idx + 1).padStart(2, '0')}
                </Text>
              </View>
              <TextInput
                value={desc}
                onChangeText={(val) => handleUpdateObjective(idx, val)}
                multiline
                style={[styles.objectiveInput, { color: colors.foreground }]}
              />
              <Pressable
                onPress={() => handleRemoveObjective(idx)}
                hitSlop={8}
                style={styles.deleteButton}
              >
                <Feather name="trash-2" size={17} color={colors.destructiveForeground || '#DC2626'} />
              </Pressable>
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
            style={[styles.addObjectiveInput, { color: colors.foreground, borderColor: colors.border }]}
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
        <Button label="Créer cette compétence & Commencer l’évaluation" icon="check" onPress={create} />
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
    paddingHorizontal: 12,
    paddingVertical: 7,
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
