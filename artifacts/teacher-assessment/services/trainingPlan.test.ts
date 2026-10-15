import {
  createDefaultTrainingPlan,
  DEFAULT_DEMO_CLASSES,
  DEFAULT_TRAINING_FILIERE_NAMES,
  getTrainingPlanSessions,
  isTrainingPlan,
  parseTrainingPlanJson,
  setTrainingSessionAssignmentExecuted,
  upsertTrainingSessionAssignment,
  validateTrainingPlan,
  validateTrainingSequence,
  type TrainingPlan,
  type TrainingPlanSession,
  type TrainingSequence,
} from './trainingPlan.ts';
import { createFirstYearScienceTrainingPlan } from './firstYearScienceTrainingPlan.ts';

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: attendu ${String(expected)}, obtenu ${String(actual)}.`);
  }
}

function assertThrows(action: () => unknown, expectedMessage: string, label: string) {
  try {
    action();
  } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessage)) return;
    throw new Error(`${label}: le message d’erreur était inattendu.`);
  }
  throw new Error(`${label}: une erreur était attendue.`);
}

function sessionsFor(
  writtenComprehensionCount: number,
): TrainingPlanSession[] {
  const sessions: TrainingPlanSession[] = [
    { id: 'setup', title: 'Mise en place', type: 'mise-en-place', order: 0 },
    { id: 'oral-in', title: 'Compréhension orale', type: 'comprehension-orale', order: 1 },
    { id: 'oral-out', title: 'Production orale', type: 'production-orale', order: 2 },
  ];
  for (let index = 0; index < writtenComprehensionCount; index += 1) {
    sessions.push({
      id: `written-in-${index}`,
      title: 'Compréhension écrite',
      type: 'comprehension-ecrite',
      order: sessions.length,
    });
  }
  for (let index = 0; index < 3; index += 1) {
    sessions.push({
      id: `written-out-${index}`,
      title: 'Production écrite',
      type: 'production-ecrite',
      order: sessions.length,
    });
  }
  return sessions;
}

function createFilierePlan(sessionsPerSequence: 9 | 10): TrainingPlan {
  const objectsPerProject = [1, 2, 2];
  const sequencesPerObject = [2, 1, 1, 1, 2];
  let objectIndex = 0;
  return {
    id: `filiere-${sessionsPerSequence}`,
    filiereId: `filiere-${sessionsPerSequence}`,
    schoolYearId: '2026-2027',
    filiereName: 'Filière X',
    projects: objectsPerProject.map((objectCount, projectIndex) => ({
      id: `project-${projectIndex}`,
      title: `Projet ${projectIndex + 1}`,
      order: projectIndex,
      launch: {
        id: `launch-${projectIndex}`,
        title: 'Lancement',
        type: 'lancement',
        order: 0,
      },
      studyObjects: Array.from({ length: objectCount }, (_, studyIndex) => {
        const currentObjectIndex = objectIndex;
        objectIndex += 1;
        return {
          id: `object-${currentObjectIndex}`,
          title: `Objet ${currentObjectIndex + 1}`,
          order: studyIndex,
          diagnostic: {
            id: `diagnostic-${currentObjectIndex}`,
            title: 'Diagnostic',
            type: 'diagnostic' as const,
            order: 0,
          },
          sequences: Array.from({ length: sequencesPerObject[currentObjectIndex] }, (_, sequenceIndex) => {
            const sequenceId = `sequence-${currentObjectIndex}-${sequenceIndex}`;
            return {
              id: sequenceId,
              title: `Séquence ${sequenceIndex + 1}`,
              order: sequenceIndex,
              sessions: sessionsFor(sessionsPerSequence === 9 ? 3 : 4).map((session) => ({
                ...session,
                id: `${sequenceId}-${session.id}`,
              })),
            };
          }),
        };
      }),
    })),
  };
}

function runTrainingPlanTests() {
  assertEqual(
    DEFAULT_DEMO_CLASSES.map((classDefinition) => classDefinition.name).join(', '),
    '2AS LPH1, 2AS LPH2, 1AS SC3, 1AS SC5',
    'Les classes de démonstration utilisent les noms fournis',
  );
  assertEqual(
    DEFAULT_DEMO_CLASSES[0].filiereName,
    DEFAULT_DEMO_CLASSES[1].filiereName,
    'Les deux classes LPH partagent une filière',
  );
  assertEqual(
    DEFAULT_DEMO_CLASSES[2].filiereName,
    DEFAULT_DEMO_CLASSES[3].filiereName,
    'Les deux classes SC partagent une filière',
  );
  const validSequence: TrainingSequence = {
    id: 'sequence-1',
    title: 'Séquence 1',
    order: 0,
    sessions: sessionsFor(3),
  };
  const tenSessionSequence: TrainingSequence = {
    ...validSequence,
    sessions: sessionsFor(4),
  };
  assertEqual(validateTrainingSequence(validSequence).length, 0, 'Une séquence valide de 9 séances est acceptée');
  assertEqual(validateTrainingSequence(tenSessionSequence).length, 0, 'Une séquence valide de 10 séances est acceptée');
  assertEqual(
    validateTrainingSequence({ ...validSequence, sessions: validSequence.sessions.slice(0, 8) })
      .some((error) => error.code === 'invalid-sequence-session-count'),
    true,
    'Une séquence de moins de 9 séances est signalée',
  );
  assertEqual(
    validateTrainingSequence({ ...validSequence, sessions: [...validSequence.sessions, ...sessionsFor(3)] })
      .some((error) => error.code === 'invalid-sequence-session-count'),
    true,
    'Une séquence de plus de 10 séances est signalée',
  );
  assertEqual(
    validateTrainingSequence({ ...validSequence, sessions: sessionsFor(2) })
      .some((error) => error.code === 'invalid-written-comprehension-count'),
    true,
    'Le nombre insuffisant de compréhensions écrites est signalé',
  );

  const plan: TrainingPlan = {
    id: 'plan',
    filiereId: 'filiere-1',
    schoolYearId: '2026-2027',
    filiereName: 'Filière X',
    projects: [{
      id: 'project-1',
      title: 'Projet A',
      order: 0,
      launch: { id: 'launch', title: 'Lancement', type: 'lancement', order: 0 },
      studyObjects: [{
        id: 'object-1',
        title: 'Objet 1',
        order: 0,
        diagnostic: { id: 'diagnostic', title: 'Diagnostic', type: 'diagnostic', order: 0 },
        sequences: [validSequence],
      }],
    }],
  };
  assertEqual(validateTrainingPlan(plan).length, 0, 'Un plan structuré valide est accepté');
  assertEqual(getTrainingPlanSessions(plan).length, 11, 'Le plan expose lancements, diagnostics et séances de séquence');
  assertEqual(
    validateTrainingPlan({
      ...plan,
      projects: [{
        ...plan.projects[0],
        launch: undefined,
        studyObjects: [{
          ...plan.projects[0].studyObjects[0],
          diagnostic: undefined,
          sequences: [],
        }],
      }],
    }).some((error) => error.code === 'missing-launch'),
    true,
    'Un projet sans lancement est signalé',
  );
  assertEqual(
    validateTrainingPlan({
      ...plan,
      projects: [{
        ...plan.projects[0],
        studyObjects: [{
          ...plan.projects[0].studyObjects[0],
          diagnostic: undefined,
        }],
      }],
    }).some((error) => error.code === 'missing-diagnostic'),
    true,
    'Un objet d’étude sans diagnostic est signalé',
  );
  const ninePerSequence = createFilierePlan(9);
  const tenPerSequence = createFilierePlan(10);
  assertEqual(ninePerSequence.projects.length, 3, 'Le scénario de formation contient 3 projets');
  assertEqual(
    ninePerSequence.projects.reduce((count, project) => count + project.studyObjects.length, 0),
    5,
    'Le scénario de formation contient 5 objets d’étude',
  );
  assertEqual(
    ninePerSequence.projects.flatMap((project) =>
      project.studyObjects.flatMap((studyObject) => studyObject.sequences),
    ).length,
    7,
    'Le scénario de formation contient 7 séquences',
  );
  assertEqual(getTrainingPlanSessions(ninePerSequence).length, 71, 'Le volume minimal totalise 71 séances, diagnostics et lancements inclus');
  assertEqual(getTrainingPlanSessions(tenPerSequence).length, 78, 'Le volume maximal totalise 78 séances, diagnostics et lancements inclus');
  assertEqual(validateTrainingPlan(ninePerSequence).length, 0, 'Le plan de 71 séances respecte les règles');
  assertEqual(validateTrainingPlan(tenPerSequence).length, 0, 'Le plan de 78 séances respecte les règles');

  let generatedId = 0;
  const createId = (prefix: string) => `${prefix}-${++generatedId}`;
  for (const filiereName of DEFAULT_TRAINING_FILIERE_NAMES) {
    const defaultPlan = createDefaultTrainingPlan(
      `filiere-${filiereName}`,
      filiereName,
      '2026-2027',
      createId,
    );
    const hasTheatreObject = defaultPlan.projects[1].studyObjects.some(
      (studyObject) => studyObject.title === 'Le discours théâtral',
    );
    assertEqual(defaultPlan.projects.length, 3, `${filiereName} a 3 projets par défaut`);
    assertEqual(
      defaultPlan.projects.flatMap((project) => project.studyObjects).length,
      hasTheatreObject ? 5 : 4,
      `${filiereName} a le nombre prévu d’objets d’étude`,
    );
    assertEqual(
      defaultPlan.projects.flatMap((project) =>
        project.studyObjects.flatMap((studyObject) => studyObject.sequences),
      ).length,
      hasTheatreObject ? 7 : 6,
      `${filiereName} a le nombre prévu de séquences`,
    );
    assertEqual(
      validateTrainingPlan(defaultPlan).length,
      0,
      `${filiereName} reçoit un plan initial valide`,
    );
    assertEqual(
      getTrainingPlanSessions(defaultPlan).length,
      hasTheatreObject ? 71 : 61,
      `${filiereName} reçoit les activités et volumes indiqués`,
    );
  }
  const firstYearPlan = createFirstYearScienceTrainingPlan(
    'filiere-tcs',
    '2026-2027',
    createId,
  );
  const firstYearStudyObjects = firstYearPlan.projects.flatMap(
    (project) => project.studyObjects,
  );
  const firstYearSequences = firstYearStudyObjects.flatMap(
    (studyObject) => studyObject.sequences,
  );
  assertEqual(isTrainingPlan(firstYearPlan), true, 'Le plan TCS est valide au format');
  assertEqual(firstYearPlan.projects.length, 3, 'Le plan TCS comprend 3 projets');
  assertEqual(
    firstYearPlan.sourceNote?.includes('26 semaines × 3 h'),
    true,
    'La source et le volume annuel sont conservés',
  );
  assertEqual(firstYearStudyObjects.length, 4, 'Le plan TCS comprend 4 objets d’étude');
  assertEqual(firstYearSequences.length, 5, 'Le plan TCS comprend 5 séquences');
  assertEqual(
    firstYearPlan.projects.reduce((total, project) => total + (project.durationHours ?? 0), 0),
    78,
    'Le plan TCS totalise 78 heures officielles',
  );
  assertEqual(
    firstYearSequences.every((sequence) => sequence.sessions.length === 9),
    true,
    'Chaque séquence TCS comprend les 9 séances prévues',
  );
  assertEqual(
    validateTrainingPlan(firstYearPlan).length,
    0,
    'Le plan TCS respecte les règles de structure de séquence',
  );
  assertEqual(
    firstYearSequences[0].durationNote?.includes('totalisent 15 h'),
    true,
    'Le décalage de durée de la première séquence est explicité',
  );
  assertEqual(
    firstYearSequences[0].sessions[3].objective?.startsWith('Lire un texte de vulgarisation'),
    true,
    'Les objectifs détaillés sont conservés dans les séances',
  );
  assertEqual(
    createDefaultTrainingPlan('filiere-custom', 'Autre filière', '2026-2027', createId).projects.length,
    0,
    'Une filière inconnue n’est pas préremplie avec un programme inventé',
  );
  const exportablePlan = createDefaultTrainingPlan(
    'filiere-json',
    'Filière JSON',
    '2026-2027',
    createId,
  );
  const planFile = JSON.stringify({
    format: 'evaluation-eleve-training-plan',
    version: 1,
    plan: exportablePlan,
  });
  assertEqual(
    parseTrainingPlanJson(planFile).filiereId,
    exportablePlan.filiereId,
    'Un fichier JSON exporté importe le plan de formation',
  );
  assertEqual(
    parseTrainingPlanJson(JSON.stringify(exportablePlan)).id,
    exportablePlan.id,
    'Un plan JSON brut reste importable',
  );
  assertEqual(isTrainingPlan({ ...exportablePlan, projects: [{}] }), false, 'Un plan JSON mal formé est rejeté');
  assertThrows(
    () => parseTrainingPlanJson('{"format":"other"}'),
    'export valide',
    'Un autre format JSON est rejeté',
  );

  const assignment = {
    classId: 'class-1',
    scheduleSessionId: 'schedule-1',
    occurrenceDate: '2026-10-08',
    trainingSessionId: 'written-in-0',
  };
  const assigned = upsertTrainingSessionAssignment([], assignment);
  assertEqual(assigned.length, 1, 'Une association par occurrence est créée');
  const executed = setTrainingSessionAssignmentExecuted(
    assigned,
    assigned[0].id,
    true,
    '2026-10-08T10:00:00.000Z',
  );
  assertEqual(executed[0].executedAt, '2026-10-08T10:00:00.000Z', 'La date d’exécution est conservée');
  const reassigned = upsertTrainingSessionAssignment(executed, {
    ...assignment,
    trainingSessionId: 'written-in-1',
  });
  assertEqual(reassigned.length, 1, 'Un créneau garde une seule séance associée');
  assertEqual(reassigned[0].executedAt, undefined, 'Changer la séance retire son ancien statut exécuté');
  assertEqual(
    upsertTrainingSessionAssignment(reassigned, {
      ...assignment,
      occurrenceDate: '2026-10-15',
    }).length,
    2,
    'Les associations de dates différentes restent indépendantes',
  );
}

runTrainingPlanTests();
console.log('Tests de plan de formation réussis.');
