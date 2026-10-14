import {
  generateDiagnosticPupilSheetHtml,
  generateTeacherSessionSheetHtml,
} from './trainingSheets.ts';
import type { TrainingPlanSession, TrainingProject } from './trainingPlan.ts';

function assertContains(haystack: string, needle: string, label: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label}: « ${needle} » introuvable.`);
  }
}

const project: TrainingProject = {
  id: 'project-1',
  title: 'Projet A',
  order: 0,
  studyObjects: [{
    id: 'object-1',
    title: 'Objet 1',
    order: 0,
    prerequisites: ['Identifier le thème du texte.'],
    sequences: [],
  }],
};
const session: TrainingPlanSession = {
  id: 'session-1',
  title: 'Compréhension de l’écrit 1',
  type: 'comprehension-ecrite',
  order: 3,
  durationHours: 1,
};
const diagnostic: TrainingPlanSession = {
  id: 'diagnostic-1',
  title: 'Évaluation diagnostique',
  type: 'diagnostic',
  order: 0,
  durationHours: 1,
};
const context = {
  filiereName: 'Filière X',
  className: '2AS LPH1',
  teacherName: 'Mme Test',
};

const teacherHtml = generateTeacherSessionSheetHtml(
  session,
  { project, sequenceTitle: 'Séquence 1' },
  context,
);
assertContains(teacherHtml, 'Fiche enseignant', 'La fiche séance cible l’enseignant');
assertContains(teacherHtml, 'Durée de la séance : 1 h', 'La durée de séance est affichée');
assertContains(teacherHtml, 'Projet A', 'Le projet figure sur la fiche');

const pupilHtml = generateDiagnosticPupilSheetHtml(
  diagnostic,
  { project, studyObject: project.studyObjects[0] },
  context,
  [{ firstName: 'Nadia', lastName: 'Khelifi', registrationNumber: '25' }],
);
assertContains(pupilHtml, 'Fiche élève · diagnostic', 'Le diagnostic produit une fiche élève');
assertContains(pupilHtml, 'Khelifi Nadia', 'Le nom de l’élève figure sur la fiche');
assertContains(pupilHtml, 'Identifier le thème du texte.', 'Les prérequis de l’objet d’étude sont listés');
assertContains(pupilHtml, 'Remédiations notées par l’enseignant', 'La fiche prévoit la notation des remédiations');

console.log('Tests de fiches PDF réussis.');
