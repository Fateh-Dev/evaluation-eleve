import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Alert } from "@/components/AppDialog";
import { AppHeader, Button, Screen, Surface } from "@/components/AppShell";
import { useAppData } from "@/context/AppDataContext";
import { useColors } from "@/hooks/useColors";
import { parseObjectiveListFile } from "@/services/objectiveListImport";

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function DiagnosticPrerequisitesScreen() {
  const colors = useColors();
  const data = useAppData();
  const {
    classId: classIdParam,
    trainingSessionId: sessionIdParam,
    trainingStudyObjectId: studyObjectIdParam,
  } = useLocalSearchParams<{
    classId?: string | string[];
    trainingSessionId?: string | string[];
    trainingStudyObjectId?: string | string[];
  }>();
  const classId = getParam(classIdParam);
  const trainingSessionId = getParam(sessionIdParam);
  const trainingStudyObjectId = getParam(studyObjectIdParam);
  const classItem = data.classes.find((item) => item.id === classId);
  const plan = classId ? data.getTrainingPlanForClass(classId) : undefined;
  const studyObject = useMemo(
    () =>
      plan?.projects
        .flatMap((project) => project.studyObjects)
        .find(
          (item) =>
            item.id === trainingStudyObjectId &&
            item.diagnostic?.id === trainingSessionId,
        ),
    [plan, trainingSessionId, trainingStudyObjectId],
  );
  const diagnostic = studyObject?.diagnostic;
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft((studyObject?.prerequisites ?? []).join("\n"));
  }, [studyObject?.id]);

  const startEvaluation = () => {
    if (!classItem || !diagnostic || !studyObject) {
      Alert.alert(
        "Informations introuvables",
        "La classe, la séance ou l’objet d’étude n’est plus disponible. Revenez au tableau de bord et réessayez.",
      );
      return;
    }
    const prerequisites = parseObjectiveListFile(draft);
    if (!prerequisites.length) {
      Alert.alert(
        "Ajoutez au moins un prérequis",
        "Saisissez un critère par ligne pour préparer cette évaluation diagnostique.",
      );
      return;
    }

    setSaving(true);
    const existingAssessment = data
      .getAssessmentsForClass(classItem.id)
      .find(
        (assessment) =>
          assessment.trainingSessionId === diagnostic.id &&
          assessment.trainingStudyObjectId === studyObject.id &&
          assessment.evaluationType === "prerequisites",
      );
    if (existingAssessment) {
      router.replace(`/assessments/${existingAssessment.id}`);
      return;
    }

    const assessmentId = data.createAssessment({
      classId: classItem.id,
      trainingSessionId: diagnostic.id,
      trainingStudyObjectId: studyObject.id,
      diagnosticPrerequisites: prerequisites,
      competency: studyObject.title,
      evaluationType: "prerequisites",
      title: `${diagnostic.title} — ${studyObject.title}`,
      sessionObjectives: `Évaluation diagnostique des prérequis de l’objet d’étude « ${studyObject.title} ».`,
      objectives: prerequisites,
    });
    if (assessmentId) {
      router.replace(`/assessments/${assessmentId}`);
      return;
    }

    const existing = data
      .getAssessmentsForClass(classItem.id)
      .find(
        (assessment) =>
          assessment.trainingSessionId === diagnostic.id &&
          assessment.trainingStudyObjectId === studyObject.id &&
          assessment.evaluationType === "prerequisites",
      );
    if (existing) {
      router.replace(`/assessments/${existing.id}`);
      return;
    }
    setSaving(false);
    Alert.alert(
      "Évaluation impossible",
      "Les prérequis n’ont pas pu être enregistrés ou l’évaluation n’a pas pu être créée. Vérifiez les informations et réessayez.",
    );
  };

  return (
    <Screen>
      <AppHeader
        eyebrow="Évaluation diagnostique"
        title="Préparer les prérequis"
        onBack={() => router.back()}
      />
      {classItem && studyObject && diagnostic ? (
        <>
          <Surface style={styles.contextCard}>
            <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
              <Feather name="target" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.contextTitle, { color: colors.foreground }]}>
              {studyObject.title}
            </Text>
            <Text style={[styles.contextText, { color: colors.mutedForeground }]}>
              {classItem.name} · {diagnostic.title}
            </Text>
          </Surface>
          <Text style={[styles.instructions, { color: colors.mutedForeground }]}>
            Saisissez les prérequis à évaluer, un par ligne. Ils seront enregistrés
            pour cet objet d’étude, puis l’évaluation s’ouvrira directement.
          </Text>
          <TextInput
            accessibilityLabel="Prérequis de l’objet d’étude"
            value={draft}
            onChangeText={setDraft}
            placeholder={"Ex. Identifier le sujet d’un texte\nEx. Repérer les informations principales"}
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            editable={!saving}
            style={[
              styles.input,
              {
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          />
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {parseObjectiveListFile(draft).length} prérequis
          </Text>
          <Button
            label="Enregistrer et commencer l’évaluation"
            icon="arrow-right"
            disabled={saving}
            onPress={startEvaluation}
            style={styles.startButton}
          />
        </>
      ) : (
        <Surface style={styles.missingCard}>
          <Text style={[styles.contextTitle, { color: colors.foreground }]}>
            Séance introuvable
          </Text>
          <Text style={[styles.instructions, { color: colors.mutedForeground }]}>
            Revenez au tableau de bord et sélectionnez de nouveau la séance diagnostique.
          </Text>
          <Button label="Retour" secondary onPress={() => router.back()} />
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contextCard: {
    alignItems: "center",
    marginTop: 18,
    padding: 20,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 24,
    height: 44,
    justifyContent: "center",
    marginBottom: 12,
    width: 44,
  },
  contextTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  contextText: {
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
  instructions: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
    marginTop: 18,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 190,
    padding: 14,
  },
  count: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },
  startButton: {
    marginTop: 18,
    width: "100%",
  },
  missingCard: {
    marginTop: 24,
    padding: 18,
  },
});
