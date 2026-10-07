export type AbsenceStatistics = {
  totalSessions: number;
  presentCount: number;
  absentCount: number;
};

export type AbsenceScoringConfiguration = {
  penaltyPerAbsence: number;
  maximumScore: number;
};

export type ContinuousEvaluationScores = {
  cahierScore: number;
  participationScore: number;
  disciplineScore: number;
  absenceScore: number;
};

export type ContinuousEvaluationEntry = {
  pupilId: string;
  classId: string;
  schoolYearId: string;
  evaluationPeriodId?: string;
  cahierScore?: number;
  participationScore?: number;
};

export type ContinuousEvaluationProgress = {
  completedCount: number;
  incompleteCount: number;
  missingCahierCount: number;
  missingParticipationCount: number;
  completionPercent: number;
  averageEnteredScore: number | null;
};

export const DEFAULT_ABSENCE_SCORING_CONFIGURATION: AbsenceScoringConfiguration = {
  penaltyPerAbsence: 0.5,
  maximumScore: 5,
};

export const DEFAULT_DISCIPLINE_PENALTY = 0.5;

export function isValidManualScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 5;
}

export function normalizeScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateAbsenceScore(
  statistics: AbsenceStatistics,
  configuration: AbsenceScoringConfiguration = DEFAULT_ABSENCE_SCORING_CONFIGURATION,
): number {
  if (
    !Number.isInteger(statistics.totalSessions) ||
    statistics.totalSessions < 0 ||
    !Number.isInteger(statistics.absentCount) ||
    statistics.absentCount < 0 ||
    !Number.isInteger(statistics.presentCount) ||
    statistics.presentCount < 0 ||
    statistics.presentCount + statistics.absentCount > statistics.totalSessions ||
    !Number.isFinite(configuration.penaltyPerAbsence) ||
    configuration.penaltyPerAbsence < 0 ||
    !isValidManualScore(configuration.maximumScore)
  ) {
    throw new Error('Statistiques ou configuration des absences invalides.');
  }
  if (statistics.totalSessions === 0) return configuration.maximumScore;
  return normalizeScore(
    Math.max(
      0,
      configuration.maximumScore -
        statistics.absentCount * configuration.penaltyPerAbsence,
    ),
  );
}

export function calculateDisciplineScore(
  penalties: number[],
  maximumScore = 5,
): number {
  if (
    !isValidManualScore(maximumScore) ||
    penalties.some((penalty) => !Number.isFinite(penalty) || penalty < 0)
  ) {
    throw new Error('Pénalités disciplinaires invalides.');
  }
  return normalizeScore(Math.max(0, maximumScore - penalties.reduce((sum, penalty) => sum + penalty, 0)));
}

export function calculateContinuousTotal(scores: ContinuousEvaluationScores): number {
  const values = [
    scores.cahierScore,
    scores.participationScore,
    scores.disciplineScore,
    scores.absenceScore,
  ];
  if (values.some((value) => !isValidManualScore(value))) {
    throw new Error('Les notes de l’évaluation continue doivent être comprises entre 0 et 5.');
  }
  return normalizeScore(values.reduce((sum, value) => sum + value, 0));
}

export function getContinuousEvaluationProgress(
  pupilIds: string[],
  classId: string,
  schoolYearId: string,
  evaluations: ContinuousEvaluationEntry[],
  evaluationPeriodId?: string,
): ContinuousEvaluationProgress {
  const pupilIdSet = new Set(pupilIds);
  const evaluationByPupil = new Map<string, ContinuousEvaluationEntry>();
  for (const evaluation of evaluations) {
    if (
      evaluation.classId === classId &&
      evaluation.schoolYearId === schoolYearId &&
      (evaluation.evaluationPeriodId ?? '') === (evaluationPeriodId ?? '') &&
      pupilIdSet.has(evaluation.pupilId)
    ) {
      evaluationByPupil.set(evaluation.pupilId, evaluation);
    }
  }

  let completedCount = 0;
  let missingCahierCount = 0;
  let missingParticipationCount = 0;
  let enteredScoreTotal = 0;
  let enteredScoreCount = 0;
  for (const pupilId of pupilIds) {
    const evaluation = evaluationByPupil.get(pupilId);
    const cahierScore = evaluation?.cahierScore;
    const participationScore = evaluation?.participationScore;
    const hasCahierScore = typeof cahierScore === 'number';
    const hasParticipationScore = typeof participationScore === 'number';
    if (hasCahierScore) {
      enteredScoreTotal += cahierScore;
      enteredScoreCount += 1;
    } else {
      missingCahierCount += 1;
    }
    if (hasParticipationScore) {
      enteredScoreTotal += participationScore;
      enteredScoreCount += 1;
    } else {
      missingParticipationCount += 1;
    }
    if (hasCahierScore && hasParticipationScore) completedCount += 1;
  }

  return {
    completedCount,
    incompleteCount: pupilIds.length - completedCount,
    missingCahierCount,
    missingParticipationCount,
    completionPercent: pupilIds.length
      ? Math.round((completedCount / pupilIds.length) * 100)
      : 0,
    averageEnteredScore: enteredScoreCount
      ? normalizeScore(enteredScoreTotal / enteredScoreCount)
      : null,
  };
}
