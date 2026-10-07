import {
  calculateAbsenceScore,
  calculateContinuousTotal,
  calculateDisciplineScore,
  getContinuousEvaluationProgress,
  isValidManualScore,
} from './continuousEvaluation';

function assertEqual(actual: number | boolean, expected: number | boolean, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: attendu ${expected}, obtenu ${actual}.`);
  }
}

function runContinuousEvaluationTests() {
  assertEqual(isValidManualScore(0), true, 'Note minimale valide');
  assertEqual(isValidManualScore(2.5), true, 'Note décimale valide');
  assertEqual(isValidManualScore(5), true, 'Note maximale valide');
  assertEqual(isValidManualScore(5.5), false, 'Note supérieure à 5 refusée');
  assertEqual(isValidManualScore(-1), false, 'Note négative refusée');

  const attendance = { totalSessions: 20, presentCount: 18, absentCount: 2 };
  assertEqual(calculateAbsenceScore(attendance), 4, 'Note d’absence calculée');
  assertEqual(
    calculateAbsenceScore({ totalSessions: 0, presentCount: 0, absentCount: 0 }),
    5,
    'Absence de données de présence',
  );
  assertEqual(
    calculateAbsenceScore(
      { totalSessions: 20, presentCount: 0, absentCount: 20 },
      { penaltyPerAbsence: 0.5, maximumScore: 5 },
    ),
    0,
    'Note d’absence jamais négative',
  );

  assertEqual(calculateDisciplineScore([0.5]), 4.5, 'Première pénalité disciplinaire');
  assertEqual(calculateDisciplineScore([0.5, 0.5]), 4, 'Pénalités cumulées');
  assertEqual(calculateDisciplineScore([0.5], 0), 0, 'Discipline jamais négative');
  assertEqual(calculateDisciplineScore([]), 5, 'Annulation recalculée sans événement');

  assertEqual(
    calculateContinuousTotal({
      cahierScore: 4,
      participationScore: 3.5,
      absenceScore: 4,
      disciplineScore: 4.5,
    }),
    16,
    'Total sur 20',
  );

  const progress = getContinuousEvaluationProgress(
    ['pupil-1', 'pupil-2', 'pupil-3'],
    'class-1',
    '2026-2027',
    [
      {
        pupilId: 'pupil-1',
        classId: 'class-1',
        schoolYearId: '2026-2027',
        cahierScore: 4,
        participationScore: 3,
      },
      {
        pupilId: 'pupil-2',
        classId: 'class-1',
        schoolYearId: '2026-2027',
        cahierScore: 5,
      },
      {
        pupilId: 'pupil-3',
        classId: 'class-1',
        schoolYearId: '2026-2027',
        evaluationPeriodId: 'period-1',
        cahierScore: 5,
        participationScore: 5,
      },
      {
        pupilId: 'other-class-pupil',
        classId: 'class-2',
        schoolYearId: '2026-2027',
        cahierScore: 5,
        participationScore: 5,
      },
    ],
  );
  assertEqual(progress.completedCount, 1, 'Une fiche partielle reste à compléter');
  assertEqual(progress.incompleteCount, 2, 'Comptage des fiches incomplètes');
  assertEqual(progress.missingCahierCount, 1, 'Comptage des notes de cahier manquantes');
  assertEqual(progress.missingParticipationCount, 2, 'Comptage des notes de participation manquantes');
  assertEqual(progress.completionPercent, 33, 'Pourcentage d’évaluations complètes');
  assertEqual(progress.averageEnteredScore ?? -1, 4, 'Moyenne des notes saisies seulement');

  const emptyProgress = getContinuousEvaluationProgress([], 'class-1', '2026-2027', []);
  assertEqual(emptyProgress.completionPercent, 0, 'Aucun élève donne une progression nulle');
  assertEqual(emptyProgress.averageEnteredScore === null, true, 'Aucune note donne une moyenne vide');
}

runContinuousEvaluationTests();
console.log('Tests de l’évaluation continue réussis.');
