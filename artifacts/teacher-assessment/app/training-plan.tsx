import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppHeader, Button, Screen, Surface } from "@/components/AppShell";
import { useAppData } from "@/context/AppDataContext";
import { useColors } from "@/hooks/useColors";
import {
  getTrainingPlanSessions,
  SEQUENCE_ACTIVITY_TYPES,
  type SequenceActivityType,
  type TrainingPlan,
  type TrainingPlanSession,
  type TrainingProject,
  type TrainingSequence,
  type TrainingStudyObject,
  validateTrainingPlan,
} from "@/services/trainingPlan";
import { createConfigId } from "@/services/pedagogicalConfiguration";

const ACTIVITY_LABELS: Record<SequenceActivityType, string> = {
  "mise-en-place": "Mise en place",
  "comprehension-orale": "Compréhension de l’oral",
  "production-orale": "Production de l’oral",
  "comprehension-ecrite": "Compréhension de l’écrit",
  "production-ecrite": "Production de l’écrit",
};

function AddLine({
  placeholder,
  buttonLabel,
  onAdd,
}: {
  placeholder: string;
  buttonLabel: string;
  onAdd: (value: string) => void;
}) {
  const colors = useColors();
  const [value, setValue] = useState("");
  return (
    <View style={styles.addLine}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          { color: colors.foreground, borderColor: colors.border },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const title = value.trim();
          if (!title) return;
          onAdd(title);
          setValue("");
        }}
        style={[styles.addButton, { backgroundColor: colors.primary }]}
      >
        <Feather name="plus" size={16} color={colors.primaryForeground} />
        <Text
          style={[styles.addButtonText, { color: colors.primaryForeground }]}
        >
          {buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function ActivityAdder({
  onAdd,
}: {
  onAdd: (type: SequenceActivityType, title: string) => void;
}) {
  const colors = useColors();
  const [type, setType] = useState<SequenceActivityType>(
    SEQUENCE_ACTIVITY_TYPES[0],
  );
  const [title, setTitle] = useState("");
  return (
    <View style={styles.activityAdder}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeChoices}
      >
        {SEQUENCE_ACTIVITY_TYPES.map((activityType) => {
          const selected = type === activityType;
          return (
            <Pressable
              key={activityType}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setType(activityType)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.typeChipText,
                  {
                    color: selected
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {ACTIVITY_LABELS[activityType]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.addLine}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Intitulé de la séance"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { color: colors.foreground, borderColor: colors.border },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const sessionTitle = title.trim();
            if (!sessionTitle) return;
            onAdd(type, sessionTitle);
            setTitle("");
          }}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text
            style={[styles.addButtonText, { color: colors.primaryForeground }]}
          >
            Ajouter
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeSession(
  type: TrainingPlanSession["type"],
  title: string,
  order = 0,
): TrainingPlanSession {
  return { id: createConfigId("training-session"), type, title, order };
}

function nextOrder(items: { order: number }[]) {
  return items.reduce((highest, item) => Math.max(highest, item.order), -1) + 1;
}

function updateProject(
  plan: TrainingPlan,
  projectId: string,
  update: (project: TrainingProject) => TrainingProject,
) {
  return {
    ...plan,
    projects: plan.projects.map((project) =>
      project.id === projectId ? update(project) : project,
    ),
  };
}

function updateStudyObject(
  plan: TrainingPlan,
  studyObjectId: string,
  update: (studyObject: TrainingStudyObject) => TrainingStudyObject,
) {
  return {
    ...plan,
    projects: plan.projects.map((project) => ({
      ...project,
      studyObjects: project.studyObjects.map((studyObject) =>
        studyObject.id === studyObjectId ? update(studyObject) : studyObject,
      ),
    })),
  };
}

function updateSequence(
  plan: TrainingPlan,
  sequenceId: string,
  update: (sequence: TrainingSequence) => TrainingSequence,
) {
  return {
    ...plan,
    projects: plan.projects.map((project) => ({
      ...project,
      studyObjects: project.studyObjects.map((studyObject) => ({
        ...studyObject,
        sequences: studyObject.sequences.map((sequence) =>
          sequence.id === sequenceId ? update(sequence) : sequence,
        ),
      })),
    })),
  };
}

export default function TrainingPlanScreen() {
  const colors = useColors();
  const data = useAppData();
  const params = useLocalSearchParams<{ classId?: string }>();
  const filieres = data.trainingFilieres.filter(
    (item) => item.schoolYearId === data.academicYear,
  );
  const classes = data.classes.filter(
    (item) => item.academicYear === data.academicYear,
  );
  const selectedClass = classes.find((item) => item.id === params.classId);
  const [selectedFiliereId, setSelectedFiliereId] = useState(
    filieres.some((item) => item.id === selectedClass?.filiereId)
      ? selectedClass!.filiereId!
      : (filieres[0]?.id ?? ""),
  );
  const [planError, setPlanError] = useState("");
  useEffect(() => {
    if (filieres.some((item) => item.id === selectedFiliereId)) return;
    const preferredFiliereId =
      classes.find((item) => item.id === params.classId)?.filiereId ??
      classes.find((item) => item.id === data.activeClassId)?.filiereId ??
      filieres[0]?.id;
    if (preferredFiliereId) setSelectedFiliereId(preferredFiliereId);
  }, [
    filieres,
    classes,
    data.activeClassId,
    params.classId,
    selectedFiliereId,
  ]);
  const selectedFiliere = filieres.find(
    (item) => item.id === selectedFiliereId,
  );
  const plan = data.getTrainingPlanForFiliere(selectedFiliereId);
  const filiereCompetencies = selectedFiliere
    ? classes
        .filter((item) => item.filiereId === selectedFiliere.id)
        .flatMap((classItem) =>
          data.getCompetenciesForLevel(
            classItem.academicYear,
            classItem.levelId,
            classItem.level,
          ),
        )
        .filter(
          (competency, index, all) =>
            all.findIndex((item) => item.id === competency.id) === index,
        )
    : [];
  const validationErrors = plan ? validateTrainingPlan(plan) : [];
  const planSessionCount = plan ? getTrainingPlanSessions(plan).length : 0;
  const studyObjectIds =
    plan?.projects.flatMap((project) =>
      project.studyObjects.map((studyObject) => studyObject.id),
    ) ?? [];
  const sequenceIds =
    plan?.projects.flatMap((project) =>
      project.studyObjects.flatMap((studyObject) =>
        studyObject.sequences.map((sequence) => sequence.id),
      ),
    ) ?? [];
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(
    () => new Set(plan?.projects[0] ? [plan.projects[0].id] : []),
  );
  const [expandedStudyObjectIds, setExpandedStudyObjectIds] = useState<
    Set<string>
  >(
    () =>
      new Set(
        plan?.projects[0]?.studyObjects[0]
          ? [plan.projects[0].studyObjects[0].id]
          : [],
      ),
  );
  const [expandedSequenceIds, setExpandedSequenceIds] = useState<Set<string>>(
    () =>
      new Set(
        plan?.projects[0]?.studyObjects[0]?.sequences[0]
          ? [plan.projects[0].studyObjects[0].sequences[0].id]
          : [],
      ),
  );
  const allPlanSectionsExpanded = Boolean(
    plan &&
    plan.projects.length > 0 &&
    plan.projects.every((project) => expandedProjectIds.has(project.id)) &&
    studyObjectIds.every((id) => expandedStudyObjectIds.has(id)) &&
    sequenceIds.every((id) => expandedSequenceIds.has(id)),
  );

  useEffect(() => {
    const nextPlan = data.getTrainingPlanForFiliere(selectedFiliereId);
    const firstProject = nextPlan?.projects[0];
    const firstStudyObject = firstProject?.studyObjects[0];
    const firstSequence = firstStudyObject?.sequences[0];
    setExpandedProjectIds(new Set(firstProject ? [firstProject.id] : []));
    setExpandedStudyObjectIds(
      new Set(firstStudyObject ? [firstStudyObject.id] : []),
    );
    setExpandedSequenceIds(new Set(firstSequence ? [firstSequence.id] : []));
  }, [selectedFiliereId]);

  const toggleExpanded = (
    setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const savePlan = (next: TrainingPlan) => {
    data.saveTrainingPlan(next);
    setPlanError("");
  };

  const createFiliere = (name: string) => {
    const filiereId = data.createTrainingFiliere(data.academicYear, name);
    if (!filiereId) {
      setPlanError("Le nom de la filière est obligatoire.");
      return;
    }
    setSelectedFiliereId(filiereId);
    setPlanError("");
  };

  const removeSession = (
    projectId: string,
    studyObjectId: string,
    sessionId: string,
  ) => {
    if (!plan) return;
    const next = updateStudyObject(plan, studyObjectId, (studyObject) => ({
      ...studyObject,
      diagnostic:
        studyObject.diagnostic?.id === sessionId
          ? undefined
          : studyObject.diagnostic,
      sequences: studyObject.sequences.map((sequence) => ({
        ...sequence,
        sessions: sequence.sessions.filter(
          (session) => session.id !== sessionId,
        ),
      })),
    }));
    const project = next.projects.find((item) => item.id === projectId);
    if (project?.launch?.id === sessionId) {
      savePlan(
        updateProject(next, projectId, (item) => ({
          ...item,
          launch: undefined,
        })),
      );
    } else {
      savePlan(next);
    }
  };

  const renderSession = (
    session: TrainingPlanSession,
    projectId: string,
    studyObjectId = "",
  ) => {
    const label =
      session.type === "lancement"
        ? "Lancement"
        : session.type === "diagnostic"
          ? "Diagnostic"
          : ACTIVITY_LABELS[session.type];
    const assignments = data.trainingSessionAssignments.filter(
      (assignment) => assignment.trainingSessionId === session.id,
    );
    return (
      <View
        key={session.id}
        style={[styles.sessionRow, { borderColor: colors.border }]}
      >
        <View
          style={[styles.sessionDot, { backgroundColor: colors.primary }]}
        />
        <View style={styles.itemCopy}>
          <Text style={[styles.itemTitle, { color: colors.foreground }]}>
            {session.title}
          </Text>
          <Text style={[styles.itemDetail, { color: colors.mutedForeground }]}>
            {label}
            {assignments.length
              ? ` · ${assignments.filter((item) => item.executedAt).length}/${assignments.length} exécutée(s)`
              : ""}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Supprimer ${session.title}`}
          onPress={() => removeSession(projectId, studyObjectId, session.id)}
          hitSlop={8}
        >
          <Feather name="trash-2" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
    );
  };

  return (
    <Screen>
      <AppHeader eyebrow="Organisation" title="Plan de formation" />
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>
        Chaque filière possède son plan de formation, partagé par toutes les
        classes qui lui sont rattachées.
      </Text>
      <Surface style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Filières · {data.academicYear}
        </Text>
        {filieres.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.classChoices}
          >
            {filieres.map((filiere) => {
              const selected = filiere.id === selectedFiliereId;
              const classCount = classes.filter(
                (item) => item.filiereId === filiere.id,
              ).length;
              return (
                <Pressable
                  key={filiere.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedFiliereId(filiere.id)}
                  style={[
                    styles.classChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.classChipText,
                      {
                        color: selected
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {filiere.name} · {classCount} classe
                    {classCount === 1 ? "" : "s"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Créez une filière pour commencer son plan de formation.
          </Text>
        )}
        <AddLine
          placeholder="Nom d’une nouvelle filière"
          buttonLabel="Créer"
          onAdd={createFiliere}
        />
        {planError ? (
          <Text style={[styles.errorText, { color: colors.errorForeground }]}>
            {planError}
          </Text>
        ) : null}
        {selectedFiliere ? (
          <View style={styles.classAssignments}>
            <Text
              style={[styles.itemDetail, { color: colors.mutedForeground }]}
            >
              Classes de l’année à rattacher à « {selectedFiliere.name} »
            </Text>
            {classes.map((classItem) => {
              const assigned = classItem.filiereId === selectedFiliere.id;
              const otherFiliere = filieres.find(
                (item) => item.id === classItem.filiereId,
              );
              return (
                <View
                  key={classItem.id}
                  style={[styles.assignmentRow, { borderColor: colors.border }]}
                >
                  <View style={styles.itemCopy}>
                    <Text
                      style={[styles.itemTitle, { color: colors.foreground }]}
                    >
                      {classItem.name}
                    </Text>
                    <Text
                      style={[
                        styles.itemDetail,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {otherFiliere
                        ? `Filière actuelle : ${otherFiliere.name}`
                        : "Aucune filière affectée"}
                    </Text>
                  </View>
                  <Button
                    label={assigned ? "Affectée" : "Affecter"}
                    secondary={assigned}
                    compact
                    disabled={assigned}
                    onPress={() =>
                      data.assignClassToFiliere(
                        classItem.id,
                        selectedFiliere.id,
                      )
                    }
                  />
                </View>
              );
            })}
            {!classes.length ? (
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                Aucune classe enregistrée pour cette année.
              </Text>
            ) : null}
          </View>
        ) : null}
      </Surface>

      {plan ? (
        <>
          <Surface style={styles.sectionCard}>
            <View style={styles.planHeading}>
              <View style={styles.itemCopy}>
                <Text style={[styles.planTitle, { color: colors.foreground }]}>
                  {plan.filiereName}
                </Text>
                <Text
                  style={[styles.itemDetail, { color: colors.mutedForeground }]}
                >
                  {plan.projects.length} projet
                  {plan.projects.length === 1 ? "" : "s"} ·{" "}
                  {studyObjectIds.length} objet
                  {studyObjectIds.length === 1 ? "" : "s"} d’étude ·{" "}
                  {sequenceIds.length} séquence
                  {sequenceIds.length === 1 ? "" : "s"} · {planSessionCount}{" "}
                  séances
                </Text>
                <Text
                  style={[styles.itemDetail, { color: colors.mutedForeground }]}
                >
                  Plan partagé par les classes rattachées · {plan.schoolYearId}
                </Text>
              </View>
              {plan.projects.length ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (allPlanSectionsExpanded) {
                      setExpandedProjectIds(new Set());
                      setExpandedStudyObjectIds(new Set());
                      setExpandedSequenceIds(new Set());
                    } else {
                      setExpandedProjectIds(
                        new Set(plan.projects.map((project) => project.id)),
                      );
                      setExpandedStudyObjectIds(new Set(studyObjectIds));
                      setExpandedSequenceIds(new Set(sequenceIds));
                    }
                  }}
                  style={[
                    styles.expandAllButton,
                    { borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[styles.expandAllText, { color: colors.primary }]}
                  >
                    {allPlanSectionsExpanded ? "Tout réduire" : "Tout ouvrir"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <AddLine
              placeholder="Nom du projet"
              buttonLabel="Ajouter"
              onAdd={(title) =>
                savePlan({
                  ...plan,
                  projects: [
                    ...plan.projects,
                    {
                      id: createConfigId("training-project"),
                      title,
                      order: nextOrder(plan.projects),
                      studyObjects: [],
                    },
                  ],
                })
              }
            />
            {plan.projects.map((project) => (
              <View
                key={project.id}
                style={[styles.projectCard, { borderColor: colors.border }]}
              >
                <View style={styles.headingRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{
                      expanded: expandedProjectIds.has(project.id),
                    }}
                    onPress={() =>
                      toggleExpanded(setExpandedProjectIds, project.id)
                    }
                    style={styles.expandHeading}
                  >
                    <View style={styles.itemCopy}>
                      <Text
                        style={[
                          styles.projectTitle,
                          { color: colors.foreground },
                        ]}
                      >
                        {project.title}
                      </Text>
                      <Text
                        style={[
                          styles.itemDetail,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {project.studyObjects.length} objet
                        {project.studyObjects.length === 1 ? "" : "s"} d’étude
                      </Text>
                    </View>
                    <Feather
                      name={
                        expandedProjectIds.has(project.id)
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={19}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Supprimer le projet ${project.title}`}
                    onPress={() =>
                      savePlan({
                        ...plan,
                        projects: plan.projects.filter(
                          (item) => item.id !== project.id,
                        ),
                      })
                    }
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>
                {expandedProjectIds.has(project.id) ? (
                  <>
                    {project.launch ? (
                      renderSession(project.launch, project.id)
                    ) : (
                      <AddLine
                        placeholder="Intitulé du lancement"
                        buttonLabel="Ajouter le lancement"
                        onAdd={(title) =>
                          savePlan(
                            updateProject(plan, project.id, (item) => ({
                              ...item,
                              launch: makeSession("lancement", title),
                            })),
                          )
                        }
                      />
                    )}
                    <Text
                      style={[
                        styles.subheading,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Objets d’étude
                    </Text>
                    <AddLine
                      placeholder="Nom de l’objet d’étude"
                      buttonLabel="Ajouter"
                      onAdd={(title) =>
                        savePlan(
                          updateProject(plan, project.id, (item) => ({
                            ...item,
                            studyObjects: [
                              ...item.studyObjects,
                              {
                                id: createConfigId("study-object"),
                                title,
                                order: nextOrder(item.studyObjects),
                                sequences: [],
                              },
                            ],
                          })),
                        )
                      }
                    />
                    {project.studyObjects.map((studyObject) => (
                      <View
                        key={studyObject.id}
                        style={[
                          styles.studyCard,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.headingRow}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{
                              expanded: expandedStudyObjectIds.has(
                                studyObject.id,
                              ),
                            }}
                            onPress={() =>
                              toggleExpanded(
                                setExpandedStudyObjectIds,
                                studyObject.id,
                              )
                            }
                            style={styles.expandHeading}
                          >
                            <View style={styles.itemCopy}>
                              <Text
                                style={[
                                  styles.studyTitle,
                                  { color: colors.foreground },
                                ]}
                              >
                                {studyObject.title}
                              </Text>
                              <Text
                                style={[
                                  styles.itemDetail,
                                  { color: colors.mutedForeground },
                                ]}
                              >
                                {studyObject.sequences.length} séquence
                                {studyObject.sequences.length === 1 ? "" : "s"}
                              </Text>
                            </View>
                            <Feather
                              name={
                                expandedStudyObjectIds.has(studyObject.id)
                                  ? "chevron-up"
                                  : "chevron-down"
                              }
                              size={18}
                              color={colors.mutedForeground}
                            />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Supprimer l’objet d’étude ${studyObject.title}`}
                            onPress={() =>
                              savePlan(
                                updateProject(plan, project.id, (item) => ({
                                  ...item,
                                  studyObjects: item.studyObjects.filter(
                                    (candidate) =>
                                      candidate.id !== studyObject.id,
                                  ),
                                })),
                              )
                            }
                          >
                            <Feather
                              name="trash-2"
                              size={16}
                              color={colors.mutedForeground}
                            />
                          </Pressable>
                        </View>
                        {expandedStudyObjectIds.has(studyObject.id) ? (
                          <>
                            {studyObject.diagnostic ? (
                              renderSession(
                                studyObject.diagnostic,
                                project.id,
                                studyObject.id,
                              )
                            ) : (
                              <AddLine
                                placeholder="Intitulé du diagnostic"
                                buttonLabel="Ajouter le diagnostic"
                                onAdd={(title) =>
                                  savePlan(
                                    updateStudyObject(
                                      plan,
                                      studyObject.id,
                                      (item) => ({
                                        ...item,
                                        diagnostic: makeSession(
                                          "diagnostic",
                                          title,
                                        ),
                                      }),
                                    ),
                                  )
                                }
                              />
                            )}
                            {studyObject.diagnostic ? (
                              <Text
                                style={[
                                  styles.itemDetail,
                                  { color: colors.mutedForeground },
                                ]}
                              >
                                Ce diagnostic appartient à cet objet d’étude. Il
                                évalue les prérequis configurés pour la classe
                                et les compétences des séquences ci-dessous.
                              </Text>
                            ) : null}
                            <Text
                              style={[
                                styles.subheading,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              Prérequis de l’objet d’étude
                            </Text>
                            <Text
                              style={[
                                styles.itemDetail,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              Ces critères seront évalués pour la classe pendant
                              le diagnostic de cet objet.
                            </Text>
                            {(studyObject.prerequisites ?? []).map(
                              (prerequisite, index) => (
                                <View
                                  key={`${studyObject.id}-prerequisite-${index}`}
                                  style={[
                                    styles.sessionRow,
                                    { borderColor: colors.border },
                                  ]}
                                >
                                  <View
                                    style={[
                                      styles.sessionDot,
                                      { backgroundColor: colors.primary },
                                    ]}
                                  />
                                  <Text
                                    style={[
                                      styles.itemTitle,
                                      styles.prerequisiteText,
                                      { color: colors.foreground },
                                    ]}
                                  >
                                    {prerequisite}
                                  </Text>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Supprimer le prérequis ${prerequisite}`}
                                    onPress={() =>
                                      savePlan(
                                        updateStudyObject(
                                          plan,
                                          studyObject.id,
                                          (item) => ({
                                            ...item,
                                            prerequisites: (
                                              item.prerequisites ?? []
                                            ).filter(
                                              (_, itemIndex) =>
                                                itemIndex !== index,
                                            ),
                                          }),
                                        ),
                                      )
                                    }
                                    hitSlop={8}
                                  >
                                    <Feather
                                      name="trash-2"
                                      size={16}
                                      color={colors.mutedForeground}
                                    />
                                  </Pressable>
                                </View>
                              ),
                            )}
                            <AddLine
                              placeholder="Décrire un prérequis"
                              buttonLabel="Ajouter"
                              onAdd={(description) =>
                                savePlan(
                                  updateStudyObject(
                                    plan,
                                    studyObject.id,
                                    (item) => ({
                                      ...item,
                                      prerequisites: [
                                        ...(item.prerequisites ?? []),
                                        description,
                                      ],
                                    }),
                                  ),
                                )
                              }
                            />
                            <Text
                              style={[
                                styles.subheading,
                                { color: colors.mutedForeground },
                              ]}
                            >
                              Séquences
                            </Text>
                            <AddLine
                              placeholder="Nom de la séquence"
                              buttonLabel="Ajouter"
                              onAdd={(title) =>
                                savePlan(
                                  updateStudyObject(
                                    plan,
                                    studyObject.id,
                                    (item) => ({
                                      ...item,
                                      sequences: [
                                        ...item.sequences,
                                        {
                                          id: createConfigId(
                                            "training-sequence",
                                          ),
                                          title,
                                          order: nextOrder(item.sequences),
                                          sessions: [],
                                        },
                                      ],
                                    }),
                                  ),
                                )
                              }
                            />
                            {studyObject.sequences.map((sequence) => (
                              <View
                                key={sequence.id}
                                style={[
                                  styles.sequenceCard,
                                  { borderColor: colors.border },
                                ]}
                              >
                                <View style={styles.headingRow}>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{
                                      expanded: expandedSequenceIds.has(
                                        sequence.id,
                                      ),
                                    }}
                                    onPress={() =>
                                      toggleExpanded(
                                        setExpandedSequenceIds,
                                        sequence.id,
                                      )
                                    }
                                    style={styles.expandHeading}
                                  >
                                    <View style={styles.itemCopy}>
                                      <Text
                                        style={[
                                          styles.sequenceTitle,
                                          { color: colors.foreground },
                                        ]}
                                      >
                                        {sequence.title}
                                      </Text>
                                      <Text
                                        style={[
                                          styles.itemDetail,
                                          { color: colors.mutedForeground },
                                        ]}
                                      >
                                        {sequence.sessions.length} séance(s)
                                      </Text>
                                    </View>
                                    <Feather
                                      name={
                                        expandedSequenceIds.has(sequence.id)
                                          ? "chevron-up"
                                          : "chevron-down"
                                      }
                                      size={18}
                                      color={colors.mutedForeground}
                                    />
                                  </Pressable>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Supprimer la séquence ${sequence.title}`}
                                    onPress={() =>
                                      savePlan(
                                        updateStudyObject(
                                          plan,
                                          studyObject.id,
                                          (item) => ({
                                            ...item,
                                            sequences: item.sequences.filter(
                                              (candidate) =>
                                                candidate.id !== sequence.id,
                                            ),
                                          }),
                                        ),
                                      )
                                    }
                                  >
                                    <Feather
                                      name="trash-2"
                                      size={16}
                                      color={colors.mutedForeground}
                                    />
                                  </Pressable>
                                </View>
                                {expandedSequenceIds.has(sequence.id) ? (
                                  <>
                                    {sequence.sessions.map((session) =>
                                      renderSession(
                                        session,
                                        project.id,
                                        studyObject.id,
                                      ),
                                    )}
                                    {selectedFiliere ? (
                                      <View style={styles.competencyChoices}>
                                        <Text
                                          style={[
                                            styles.itemDetail,
                                            { color: colors.mutedForeground },
                                          ]}
                                        >
                                          Compétences concernées (facultatif)
                                        </Text>
                                        <ScrollView
                                          horizontal
                                          showsHorizontalScrollIndicator={false}
                                          contentContainerStyle={
                                            styles.typeChoices
                                          }
                                        >
                                          {filiereCompetencies.map(
                                            (competency) => {
                                              const selected =
                                                sequence.competencyIds?.includes(
                                                  competency.id,
                                                ) ?? false;
                                              return (
                                                <Pressable
                                                  key={competency.id}
                                                  accessibilityRole="button"
                                                  accessibilityState={{
                                                    selected,
                                                  }}
                                                  onPress={() =>
                                                    savePlan(
                                                      updateSequence(
                                                        plan,
                                                        sequence.id,
                                                        (item) => ({
                                                          ...item,
                                                          competencyIds:
                                                            selected
                                                              ? (
                                                                  item.competencyIds ??
                                                                  []
                                                                ).filter(
                                                                  (id) =>
                                                                    id !==
                                                                    competency.id,
                                                                )
                                                              : [
                                                                  ...(item.competencyIds ??
                                                                    []),
                                                                  competency.id,
                                                                ],
                                                        }),
                                                      ),
                                                    )
                                                  }
                                                  style={[
                                                    styles.typeChip,
                                                    {
                                                      backgroundColor: selected
                                                        ? colors.primary
                                                        : colors.card,
                                                      borderColor: selected
                                                        ? colors.primary
                                                        : colors.border,
                                                    },
                                                  ]}
                                                >
                                                  <Text
                                                    style={[
                                                      styles.typeChipText,
                                                      {
                                                        color: selected
                                                          ? colors.primaryForeground
                                                          : colors.foreground,
                                                      },
                                                    ]}
                                                  >
                                                    {competency.name}
                                                  </Text>
                                                </Pressable>
                                              );
                                            },
                                          )}
                                        </ScrollView>
                                      </View>
                                    ) : null}
                                    <ActivityAdder
                                      onAdd={(type, title) =>
                                        savePlan(
                                          updateSequence(
                                            plan,
                                            sequence.id,
                                            (item) => ({
                                              ...item,
                                              sessions: [
                                                ...item.sessions,
                                                makeSession(
                                                  type,
                                                  title,
                                                  nextOrder(item.sessions),
                                                ),
                                              ],
                                            }),
                                          ),
                                        )
                                      }
                                    />
                                    {validateTrainingPlan({
                                      ...plan,
                                      projects: [project],
                                    })
                                      .filter(
                                        (error) =>
                                          error.sequenceId === sequence.id,
                                      )
                                      .map((error) => (
                                        <Text
                                          key={error.code}
                                          style={[
                                            styles.errorText,
                                            { color: colors.warningForeground },
                                          ]}
                                        >
                                          {error.message}
                                        </Text>
                                      ))}
                                  </>
                                ) : null}
                              </View>
                            ))}
                          </>
                        ) : null}
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            ))}
          </Surface>
          <Surface style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Vérification du plan
            </Text>
            {validationErrors.length ? (
              validationErrors.map((error) => (
                <Text
                  key={`${error.code}-${error.projectId}-${error.sequenceId}`}
                  style={[
                    styles.errorText,
                    { color: colors.warningForeground },
                  ]}
                >
                  {error.message}
                </Text>
              ))
            ) : (
              <Text
                style={[styles.validText, { color: colors.successForeground }]}
              >
                La structure respecte les règles de lancement, diagnostic et
                séances par séquence.
              </Text>
            )}
          </Surface>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 4 },
  classChoices: { gap: 8, paddingVertical: 4 },
  classChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  classChipText: { fontSize: 13, fontWeight: "700" },
  sectionCard: { gap: 12, marginTop: 12 },
  classAssignments: { gap: 7 },
  assignmentRow: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  planTitle: { fontSize: 20, fontWeight: "800" },
  planHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  expandAllButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  expandAllText: { fontSize: 11, fontWeight: "700" },
  addLine: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 11,
    fontSize: 14,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 42,
    paddingHorizontal: 10,
    borderRadius: 9,
  },
  addButtonText: { fontSize: 12, fontWeight: "700" },
  projectCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginTop: 5,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  expandHeading: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  projectTitle: { flex: 1, fontSize: 16, fontWeight: "800" },
  subheading: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 3,
  },
  studyCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  studyTitle: { flex: 1, fontSize: 15, fontWeight: "700" },
  sequenceCard: { borderWidth: 1, borderRadius: 9, padding: 12, gap: 10 },
  sequenceTitle: { fontSize: 14, fontWeight: "700" },
  sessionRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  sessionDot: { width: 7, height: 7, borderRadius: 4 },
  itemCopy: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 13, fontWeight: "600" },
  prerequisiteText: { flex: 1, lineHeight: 18 },
  itemDetail: { fontSize: 12 },
  activityAdder: { gap: 8 },
  competencyChoices: { gap: 6 },
  typeChoices: { gap: 6 },
  typeChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  typeChipText: { fontSize: 11, fontWeight: "600" },
  errorText: { fontSize: 12, lineHeight: 17 },
  validText: { fontSize: 13 },
  emptyText: { fontSize: 14, lineHeight: 20 },
});
