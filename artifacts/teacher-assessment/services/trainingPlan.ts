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

export type TrainingPlanSession = {
  id: string;
  title: string;
  type: TrainingSessionType;
  order: number;
  competencyIds?: string[];
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
  /** Present only while reading state saved by the earlier class-scoped version. */
  classId?: string;
};

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
    | 'invalid-setup-count';
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

export function createDefaultTrainingPlan(
  filiereId: string,
  filiereName: string,
  schoolYearId: string,
  createId: (prefix: string) => string,
): TrainingPlan {
  const definitions = getDefaultProjectDefinitions(filiereName) ?? [];
  return {
    id: createId('training-plan'),
    filiereId,
    filiereName,
    schoolYearId,
    projects: definitions.map((projectDefinition, projectIndex) => ({
      id: createId('training-project'),
      title: projectDefinition.title,
      order: projectIndex,
      launch: {
        id: createId('training-session'),
        title: 'Lancement du projet',
        type: 'lancement',
        order: 0,
      },
      studyObjects: projectDefinition.studyObjects.map((studyObjectDefinition, studyObjectIndex) => ({
        id: createId('study-object'),
        title: studyObjectDefinition.title,
        order: studyObjectIndex,
        diagnostic: {
          id: createId('training-session'),
          title: 'Évaluation diagnostique',
          type: 'diagnostic',
          order: 0,
        },
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
            sessions: sessionDefinitions.map((session, sessionIndex) => ({
              id: createId('training-session'),
              title: session.title,
              type: session.type,
              order: sessionIndex,
            })),
          };
        }),
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
  return errors;
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
