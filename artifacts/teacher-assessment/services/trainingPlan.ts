export const SEQUENCE_ACTIVITY_TYPES = [
  'mise-en-place',
  'comprehension-orale',
  'production-orale',
  'comprehension-ecrite',
  'production-ecrite',
] as const;

export type SequenceActivityType = (typeof SEQUENCE_ACTIVITY_TYPES)[number];
export type TrainingSessionType =
  | 'lancement'
  | 'diagnostic'
  | SequenceActivityType;

export const DEFAULT_SESSION_DURATION_HOURS = 1;

export const SESSION_TYPE_LABELS: Record<TrainingSessionType, string> = {
  lancement: 'Lancement',
  diagnostic: 'Diagnostic',
  'mise-en-place': 'Mise en place',
  'comprehension-orale': 'Compréhension de l’oral',
  'production-orale': 'Production de l’oral',
  'comprehension-ecrite': 'Compréhension de l’écrit',
  'production-ecrite': 'Production de l’écrit',
};

export type TrainingPlanSession = {
  id: string;
  title: string;
  type: TrainingSessionType;
  order: number;
  /** Durée de la séance en heures. La durée par activité interne n’est pas définie. */
  durationHours?: number;
  competencyIds?: string[];
};

export type UnmappedSourceItem = {
  kind: 'project' | 'study-object';
  title: string;
  originNote: string;
};

export type TrainingPlanGaps = {
  /** Compétences du test de niveau : liste métier non fournie, sélection extensible. */
  levelTestCompetencyIds: string[];
  /** Forme du test de niveau (à compléter). */
  levelTestFormKind?: string;
  /** Mode de notation du test de niveau (à compléter). */
  levelTestScoringMode?: string;
  /** Fréquence de l’évaluation continue (à compléter). */
  continuousEvaluationFrequency?: string;
  /** Instruments de l’évaluation continue (à compléter). */
  continuousEvaluationInstruments: string[];
  /** Durées d’activités internes à une séance (à compléter, non figées). */
  activityDurationHoursByType: Partial<Record<SequenceActivityType, number>>;
  /** Élément présent dans des fiches mais absent de la carte de cette filière. */
  unmappedSourceItems: UnmappedSourceItem[];
};

export type TrainingSequence = {
  id: string;
  title: string;
  order: number;
  competencyIds?: string[];
  sessions: TrainingPlanSession[];
};

export type TrainingStudyObject = {
  id: string;
  title: string;
  order: number;
  prerequisites?: string[];
  diagnostic?: TrainingPlanSession;
  sequences: TrainingSequence[];
};

export type TrainingProject = {
  id: string;
  title: string;
  order: number;
  launch?: TrainingPlanSession;
  studyObjects: TrainingStudyObject[];
};

export type TrainingPlan = {
  id: string;
  filiereId: string;
  schoolYearId: string;
  filiereName: string;
  projects: TrainingProject[];
  gaps?: TrainingPlanGaps;
  /** Present only while reading state saved by the earlier class-scoped version. */
  classId?: string;
};

export function isTrainingPlan(value: unknown): value is TrainingPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<TrainingPlan>;
  return typeof plan.id === 'string' &&
    (typeof plan.filiereId === 'string' || typeof plan.classId === 'string') &&
    typeof plan.schoolYearId === 'string' &&
    typeof plan.filiereName === 'string' &&
    Array.isArray(plan.projects) && plan.projects.every((project) => {
      if (
        !project ||
        typeof project.id !== 'string' ||
        typeof project.title !== 'string' ||
        !Number.isInteger(project.order) ||
        !Array.isArray(project.studyObjects) ||
        (project.launch !== undefined &&
          (!project.launch ||
            typeof project.launch.id !== 'string' ||
            typeof project.launch.title !== 'string' ||
            (project.launch.durationHours !== undefined &&
              !(typeof project.launch.durationHours === 'number' &&
                Number.isFinite(project.launch.durationHours)))))
      ) return false;
      return project.studyObjects.every((studyObject) => {
        if (
          !studyObject ||
          typeof studyObject.id !== 'string' ||
          typeof studyObject.title !== 'string' ||
          !Number.isInteger(studyObject.order) ||
          (studyObject.prerequisites !== undefined &&
            (!Array.isArray(studyObject.prerequisites) ||
              !studyObject.prerequisites.every((item) => typeof item === 'string'))) ||
          !Array.isArray(studyObject.sequences) ||
          (studyObject.diagnostic !== undefined &&
            (!studyObject.diagnostic ||
              typeof studyObject.diagnostic.id !== 'string' ||
              typeof studyObject.diagnostic.title !== 'string'))
        ) return false;
        return studyObject.sequences.every((sequence) =>
          Boolean(sequence) &&
          typeof sequence.id === 'string' &&
          typeof sequence.title === 'string' &&
          Number.isInteger(sequence.order) &&
          (sequence.competencyIds === undefined ||
            (Array.isArray(sequence.competencyIds) &&
              sequence.competencyIds.every((id) => typeof id === 'string'))) &&
          Array.isArray(sequence.sessions) &&
          sequence.sessions.every((session) =>
            Boolean(session) &&
            typeof session.id === 'string' &&
            typeof session.title === 'string' &&
            (session.type === 'lancement' ||
              session.type === 'diagnostic' ||
              SEQUENCE_ACTIVITY_TYPES.some((type) => type === session.type)) &&
            Number.isInteger(session.order) &&
            (session.durationHours === undefined ||
              (typeof session.durationHours === 'number' && Number.isFinite(session.durationHours))),
          ),
        );
      });
    });
}

export function parseTrainingPlanJson(json: string): TrainingPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Le fichier sélectionné ne contient pas un JSON valide.');
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    'format' in parsed
  ) {
    const envelope = parsed as { format?: unknown; version?: unknown; plan?: unknown };
    if (
      envelope.format !== 'evaluation-eleve-training-plan' ||
      envelope.version !== 1 ||
      !isTrainingPlan(envelope.plan)
    ) {
      throw new Error('Ce fichier n’est pas un export valide de plan de formation.');
    }
    return envelope.plan;
  }
  if (!isTrainingPlan(parsed)) {
    throw new Error('Le fichier ne contient pas un plan de formation valide.');
  }
  return parsed;
}

export type TrainingFiliere = {
  id: string;
  name: string;
  schoolYearId: string;
};

export type TrainingSessionAssignment = {
  id: string;
  classId: string;
  filiereId?: string;
  scheduleSessionId: string;
  occurrenceDate: string;
  trainingSessionId: string;
  executedAt?: string;
};

export type TrainingPlanValidationError = {
  code:
    | 'missing-filiere'
    | 'missing-project'
    | 'missing-launch'
    | 'missing-study-object'
    | 'missing-diagnostic'
    | 'invalid-sequence-session-count'
    | 'invalid-written-comprehension-count'
    | 'invalid-written-production-count'
    | 'invalid-oral-comprehension-count'
    | 'invalid-oral-production-count'
    | 'invalid-setup-count'
    | 'diagnostic-count-mismatch'
    | 'invalid-session-duration';
  message: string;
  projectId?: string;
  studyObjectId?: string;
  sequenceId?: string;
}

export const DEFAULT_TRAINING_FILIERE_NAMES = [
  'Lettres et philosophie',
  'Langues étrangères',
  'Sciences expérimentales',
  'Mathématiques',
  'Techniques mathématiques',
  'Gestion et économie',
] as const;

export const DEFAULT_DEMO_CLASSES = [
  { name: '2AS LPH1', level: '2AS', filiereName: 'Lettres et philosophie' },
  { name: '2AS LPH2', level: '2AS', filiereName: 'Lettres et philosophie' },
  { name: '1AS SC3', level: '1AS', filiereName: 'Sciences expérimentales' },
  { name: '1AS SC5', level: '1AS', filiereName: 'Sciences expérimentales' },
] as const;

const commonProjectTitles = [
  'Concevoir et réaliser un dossier documentaire sur les grandes réalisations scientifiques et techniques de notre époque',
  'Produire une petite pièce théâtrale pour la présenter au lycée',
  'Constituer un recueil de nouvelles pour représenter un monde futur',
];

type DefaultSequenceDefinition = {
  title: string;
};

type DefaultStudyObjectDefinition = {
  title: string;
  sequences: DefaultSequenceDefinition[];
};

type DefaultProjectDefinition = {
  title: string;
  studyObjects: DefaultStudyObjectDefinition[];
};

const THEATRE_STUDY_OBJECT_TITLE = 'Le discours théâtral';

export function createEmptyTrainingPlanGaps(): TrainingPlanGaps {
  return {
    levelTestCompetencyIds: [],
    continuousEvaluationInstruments: [],
    activityDurationHoursByType: {},
    unmappedSourceItems: [],
  };
}

export function getSessionDurationHours(session: TrainingPlanSession): number {
  return session.durationHours ?? DEFAULT_SESSION_DURATION_HOURS;
}

export function moveOrderedItem<T extends { id: string; order: number }>(
  items: T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const sorted = [...items].sort((left, right) => left.order - right.order);
  const index = sorted.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) return items;
  const reordered = [...sorted];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(target, 0, moved);
  return reordered.map((item, order) => ({ ...item, order }));
}

function getDefaultProjectDefinitions(filiereName: string): DefaultProjectDefinition[] | undefined {
  const normalizedName = filiereName.trim().toLocaleLowerCase('fr');
  if (!DEFAULT_TRAINING_FILIERE_NAMES.some(
    (name) => name.toLocaleLowerCase('fr') === normalizedName,
  )) return undefined;

  const projectOne: DefaultProjectDefinition = {
    title: commonProjectTitles[0],
    studyObjects: [{
      title: 'Le discours objectivé',
      sequences: [
        { title: 'Produire un texte pour présenter un fait, une notion, un phénomène' },
        { title: 'Produire un texte pour démontrer, prouver un fait' },
      ],
    }],
  };
  const projectTwo: DefaultProjectDefinition = {
    title: commonProjectTitles[1],
    studyObjects: normalizedName === 'sciences expérimentales' ||
      normalizedName === 'mathématiques' ||
      normalizedName === 'techniques mathématiques' ||
      normalizedName === 'gestion et économie'
      ? [{
          title: 'Le plaidoyer et le réquisitoire',
          sequences: [
            { title: 'Produire un discours pour plaider en faveur d’une personne, d’une opinion ou d’une cause' },
            { title: 'Produire un texte pour dénoncer ou discréditer une personne, une opinion ou une cause' },
          ],
        }]
      : [
          {
            title: 'Le discours théâtral',
            sequences: [
              { title: 'Produire un court texte théâtral pour émouvoir et faire réfléchir' },
            ],
          },
          {
            title: 'Le plaidoyer et le réquisitoire',
            sequences: [
              { title: 'Produire un discours pour plaider en faveur d’une personne, d’une opinion ou d’une cause' },
              { title: 'Produire un texte pour dénoncer ou discréditer une personne, une opinion ou une cause' },
            ],
          },
        ],
  };
  const projectThree: DefaultProjectDefinition = {
    title: commonProjectTitles[2],
    studyObjects: [
      {
        title: 'La nouvelle d’anticipation',
        sequences: [{ title: 'Produire un récit d’anticipation' }],
      },
      {
        title: 'Le reportage touristique et le récit de voyage',
        sequences: [{
          title: 'Produire un reportage touristique pour faire connaître aux touristes une région d’Algérie',
        }],
      },
    ],
  };
  return [projectOne, projectTwo, projectThree];
}

function makeDefaultSession(
  createId: (prefix: string) => string,
  type: TrainingSessionType,
  title: string,
  order = 0,
): TrainingPlanSession {
  return {
    id: createId('training-session'),
    title,
    type,
    order,
    durationHours: DEFAULT_SESSION_DURATION_HOURS,
  };
}

export function createDefaultTrainingPlan(
  filiereId: string,
  filiereName: string,
  schoolYearId: string,
  createId: (prefix: string) => string,
): TrainingPlan {
  const definitions = getDefaultProjectDefinitions(filiereName) ?? [];
  const hasTheatreObject = definitions.some((project) =>
    project.studyObjects.some((studyObject) => studyObject.title === THEATRE_STUDY_OBJECT_TITLE),
  );
  const gaps = createEmptyTrainingPlanGaps();
  if (definitions.length > 0 && !hasTheatreObject) {
    gaps.unmappedSourceItems = [{
      kind: 'study-object',
      title: THEATRE_STUDY_OBJECT_TITLE,
      originNote:
        'Présent dans les plans Lettres/Langues ; absent de la carte de cette filière. Le plan d’origine doit être vérifié.',
    }];
  }
  return {
    id: createId('training-plan'),
    filiereId,
    filiereName,
    schoolYearId,
    gaps,
    projects: definitions.map((projectDefinition, projectIndex) => ({
      id: createId('training-project'),
      title: projectDefinition.title,
      order: projectIndex,
      launch: makeDefaultSession(createId, 'lancement', 'Lancement du projet'),
      studyObjects: projectDefinition.studyObjects.map((studyObjectDefinition, studyObjectIndex) => ({
        id: createId('study-object'),
        title: studyObjectDefinition.title,
        order: studyObjectIndex,
        diagnostic: makeDefaultSession(createId, 'diagnostic', 'Évaluation diagnostique'),
        sequences: studyObjectDefinition.sequences.map((sequenceDefinition, sequenceIndex) => {
          const sessionDefinitions: Array<{
            type: SequenceActivityType;
            title: string;
          }> = [
            { type: 'mise-en-place', title: 'Mise en place' },
            { type: 'comprehension-orale', title: 'Compréhension de l’oral' },
            { type: 'production-orale', title: 'Production de l’oral' },
            ...Array.from({ length: 3 }, (_, index) => ({
              type: 'comprehension-ecrite' as const,
              title: `Compréhension de l’écrit ${index + 1}`,
            })),
            ...Array.from({ length: 3 }, (_, index) => ({
              type: 'production-ecrite' as const,
              title: `Production de l’écrit ${index + 1}`,
            })),
          ];
          return {
            id: createId('training-sequence'),
            title: sequenceDefinition.title,
            order: sequenceIndex,
            sessions: sessionDefinitions.map((session, sessionIndex) =>
              makeDefaultSession(createId, session.type, session.title, sessionIndex),
            ),
          };
        }),
      })),
    })),
  };
}

export function normalizeTrainingPlan(plan: TrainingPlan): TrainingPlan {
  const gaps = {
    ...createEmptyTrainingPlanGaps(),
    ...(plan.gaps ?? {}),
    levelTestCompetencyIds: plan.gaps?.levelTestCompetencyIds ?? [],
    continuousEvaluationInstruments: plan.gaps?.continuousEvaluationInstruments ?? [],
    activityDurationHoursByType: plan.gaps?.activityDurationHoursByType ?? {},
    unmappedSourceItems: plan.gaps?.unmappedSourceItems ?? [],
  };
  const withDuration = (session?: TrainingPlanSession) =>
    session
      ? { ...session, durationHours: getSessionDurationHours(session) }
      : session;
  return {
    ...plan,
    gaps,
    projects: [...plan.projects]
      .sort((left, right) => left.order - right.order)
      .map((project) => ({
        ...project,
        launch: withDuration(project.launch),
        studyObjects: [...project.studyObjects]
          .sort((left, right) => left.order - right.order)
          .map((studyObject) => ({
            ...studyObject,
            diagnostic: withDuration(studyObject.diagnostic),
            sequences: [...studyObject.sequences]
              .sort((left, right) => left.order - right.order)
              .map((sequence) => ({
                ...sequence,
                sessions: [...sequence.sessions]
                  .sort((left, right) => left.order - right.order)
                  .map((session) => ({
                    ...session,
                    durationHours: getSessionDurationHours(session),
                  })),
              })),
          })),
      })),
  };
}

export function upsertTrainingSessionAssignment(
  assignments: TrainingSessionAssignment[],
  input: Omit<TrainingSessionAssignment, 'id' | 'executedAt'> & { executedAt?: string },
): TrainingSessionAssignment[] {
  const id = `${input.classId}:${input.scheduleSessionId}:${input.occurrenceDate}`;
  const existing = assignments.find((assignment) => assignment.id === id);
  return [
    ...assignments.filter((assignment) => assignment.id !== id),
    {
      ...input,
      id,
      executedAt: existing?.trainingSessionId === input.trainingSessionId
        ? existing.executedAt
        : input.executedAt,
    },
  ];
}

export function setTrainingSessionAssignmentExecuted(
  assignments: TrainingSessionAssignment[],
  assignmentId: string,
  executed: boolean,
  executedAt = new Date().toISOString(),
): TrainingSessionAssignment[] {
  return assignments.map((assignment) =>
    assignment.id === assignmentId
      ? { ...assignment, executedAt: executed ? executedAt : undefined }
      : assignment,
  );
}

export function getTrainingPlanSessions(
  plan: TrainingPlan,
): TrainingPlanSession[] {
  return plan.projects.flatMap((project) => [
    ...(project.launch ? [project.launch] : []),
    ...project.studyObjects.flatMap((studyObject) => [
      ...(studyObject.diagnostic ? [studyObject.diagnostic] : []),
      ...studyObject.sequences.flatMap((sequence) => sequence.sessions),
    ]),
  ]);
}

export function validateTrainingPlan(
  plan: TrainingPlan,
): TrainingPlanValidationError[] {
  const errors: TrainingPlanValidationError[] = [];
  if (!plan.filiereName.trim()) {
    errors.push({
      code: 'missing-filiere',
      message: 'Renseignez le nom de la filière.',
    });
  }
  if (plan.projects.length === 0) {
    errors.push({
      code: 'missing-project',
      message: 'Ajoutez au moins un projet à la filière.',
    });
  }

  for (const project of plan.projects) {
    if (!project.launch?.title.trim()) {
      errors.push({
        code: 'missing-launch',
        message: `Le projet « ${project.title} » doit commencer par un lancement.`,
        projectId: project.id,
      });
    }
    if (project.studyObjects.length === 0) {
      errors.push({
        code: 'missing-study-object',
        message: `Ajoutez au moins un objet d’étude au projet « ${project.title} ».`,
        projectId: project.id,
      });
    }
    const diagnosticCount = project.studyObjects.filter(
      (studyObject) => studyObject.diagnostic?.title.trim(),
    ).length;
    if (project.studyObjects.length > 0 && diagnosticCount !== project.studyObjects.length) {
      errors.push({
        code: 'diagnostic-count-mismatch',
        message: `Le projet « ${project.title} » doit compter autant de diagnostics que d’objets d’étude (${diagnosticCount} diagnostic(s) pour ${project.studyObjects.length} objet(s)).`,
        projectId: project.id,
      });
    }
    for (const studyObject of project.studyObjects) {
      if (!studyObject.diagnostic?.title.trim()) {
        errors.push({
          code: 'missing-diagnostic',
          message: `L’objet d’étude « ${studyObject.title} » doit commencer par un diagnostic.`,
          projectId: project.id,
          studyObjectId: studyObject.id,
        });
      }
      for (const sequence of studyObject.sequences) {
        errors.push(
          ...validateTrainingSequence(sequence).map((error) => ({
            ...error,
            message: `${project.title} · ${studyObject.title} · ${sequence.title} : ${error.message}`,
            projectId: project.id,
            studyObjectId: studyObject.id,
            sequenceId: sequence.id,
          })),
        );
      }
    }
  }
  for (const session of getTrainingPlanSessions(plan)) {
    const duration = getSessionDurationHours(session);
    if (!Number.isFinite(duration) || duration <= 0) {
      errors.push({
        code: 'invalid-session-duration',
        message: `La séance « ${session.title} » doit avoir une durée positive (en heures).`,
      });
    }
  }
  return errors;
}

export function formatTrainingPlanValidationMessages(
  errors: TrainingPlanValidationError[],
): string {
  return errors.map((error) => error.message).join('\n');
}

export function assertTrainingPlanIsValid(plan: TrainingPlan): void {
  const errors = validateTrainingPlan(plan);
  if (errors.length === 0) return;
  throw new Error(formatTrainingPlanValidationMessages(errors));
}

export function validateTrainingSequence(
  sequence: TrainingSequence,
): TrainingPlanValidationError[] {
  const errors: TrainingPlanValidationError[] = [];
  const count = (type: SequenceActivityType) =>
    sequence.sessions.filter((session) => session.type === type).length;

  if (sequence.sessions.length < 9 || sequence.sessions.length > 10) {
    errors.push({
      code: 'invalid-sequence-session-count',
      message: `La séquence doit contenir 9 ou 10 séances (actuellement ${sequence.sessions.length}).`,
      sequenceId: sequence.id,
    });
  }
  if (count('comprehension-ecrite') < 3 || count('comprehension-ecrite') > 4) {
    errors.push({
      code: 'invalid-written-comprehension-count',
      message: 'Prévoyez 3 ou 4 séances de compréhension de l’écrit.',
      sequenceId: sequence.id,
    });
  }
  if (count('production-ecrite') !== 3) {
    errors.push({
      code: 'invalid-written-production-count',
      message: 'Prévoyez exactement 3 séances de production de l’écrit.',
      sequenceId: sequence.id,
    });
  }
  if (count('comprehension-orale') !== 1) {
    errors.push({
      code: 'invalid-oral-comprehension-count',
      message: 'Prévoyez exactement 1 séance de compréhension de l’oral.',
      sequenceId: sequence.id,
    });
  }
  if (count('production-orale') !== 1) {
    errors.push({
      code: 'invalid-oral-production-count',
      message: 'Prévoyez exactement 1 séance de production de l’oral.',
      sequenceId: sequence.id,
    });
  }
  if (count('mise-en-place') !== 1) {
    errors.push({
      code: 'invalid-setup-count',
      message: 'Prévoyez exactement 1 séance de mise en place.',
      sequenceId: sequence.id,
    });
  }
  return errors;
}
