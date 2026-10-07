export type StudentProgressReportInput = {
  school: { name: string; address: string; wilaya: string };
  teacherName: string;
  classItem: { id: string; name: string; level: string; academicYear: string };
  period: { id: string; name: string; startDate: string; endDate: string };
  pupils: Array<{
    id: string;
    registrationNumber: string;
    firstName: string;
    lastName: string;
  }>;
  assessments: Array<{
    id: string;
    title: string;
    competency: string;
    date: string;
    objectives: Array<{ id: string }>;
    evaluations: Record<string, Record<string, string>>;
    absentPupilIds: string[];
  }>;
  continuousEvaluations: Array<{
    pupilId: string;
    classId: string;
    schoolYearId: string;
    evaluationPeriodId?: string;
    cahierScore?: number;
    participationScore?: number;
  }>;
  attendanceRecords: Array<{
    classId: string;
    date: string;
    statuses: Record<string, 'present' | 'absent'>;
  }>;
  disciplineEvents: Array<{
    studentId: string;
    classId: string;
    schoolYearId: string;
    date: string;
    penalty: number;
  }>;
  absencePenaltyPerAbsence: number;
};

export type StudentProgressReport = {
  school: StudentProgressReportInput['school'];
  teacherName: string;
  classItem: StudentProgressReportInput['classItem'];
  period: StudentProgressReportInput['period'];
  pupils: Array<{
    id: string;
    registrationNumber: string;
    firstName: string;
    lastName: string;
    assessments: Array<{
      title: string;
      competency: string;
      date: string;
      acquired: number;
      partial: number;
      notAcquired: number;
      evaluated: number;
      total: number;
      percent: number | null;
      absent: boolean;
    }>;
    cahierScore?: number;
    participationScore?: number;
    absenceScore: number;
    disciplineScore: number;
    continuousTotal: number | null;
    presentSessions: number;
    absentSessions: number;
    averageAssessmentPercent: number | null;
  }>;
};

export function buildStudentProgressReport(
  input: StudentProgressReportInput,
): StudentProgressReport {
  const assessments = input.assessments
    .filter((assessment) => assessment.date >= input.period.startDate && assessment.date <= input.period.endDate)
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));
  const attendanceRecords = input.attendanceRecords.filter(
    (record) =>
      record.classId === input.classItem.id &&
      record.date >= input.period.startDate &&
      record.date <= input.period.endDate,
  );

  const pupils = input.pupils.map((pupil) => {
    const pupilAssessments = assessments.map((assessment) => {
      const absent = assessment.absentPupilIds.includes(pupil.id);
      let acquired = 0;
      let partial = 0;
      let notAcquired = 0;
      if (!absent) {
        for (const objective of assessment.objectives) {
          const value = assessment.evaluations[pupil.id]?.[objective.id];
          if (value === 'Acquired') acquired += 1;
          else if (value === 'PartiallyAcquired') partial += 1;
          else if (value === 'NotAcquired') notAcquired += 1;
        }
      }
      const evaluated = acquired + partial + notAcquired;
      return {
        title: assessment.title,
        competency: assessment.competency,
        date: assessment.date,
        acquired,
        partial,
        notAcquired,
        evaluated,
        total: assessment.objectives.length,
        percent: evaluated
          ? Math.round(((acquired + partial * 0.5) / evaluated) * 100)
          : null,
        absent,
      };
    });
    const continuous = input.continuousEvaluations.find(
      (record) =>
        record.pupilId === pupil.id &&
        record.classId === input.classItem.id &&
        record.schoolYearId === input.classItem.academicYear &&
        record.evaluationPeriodId === input.period.id,
    );
    const presentSessions = attendanceRecords.filter(
      (record) => record.statuses[pupil.id] === 'present',
    ).length;
    const absentSessions = attendanceRecords.filter(
      (record) => record.statuses[pupil.id] === 'absent',
    ).length;
    const disciplinePenalty = input.disciplineEvents
      .filter(
        (event) =>
          event.studentId === pupil.id &&
          event.classId === input.classItem.id &&
          event.schoolYearId === input.classItem.academicYear &&
          event.date >= input.period.startDate &&
          event.date <= input.period.endDate,
      )
      .reduce((sum, event) => sum + event.penalty, 0);
    const absenceScore = Math.max(
      0,
      5 - absentSessions * input.absencePenaltyPerAbsence,
    );
    const disciplineScore = Math.max(0, 5 - disciplinePenalty);
    const completedAssessmentPercentages = pupilAssessments.flatMap(
      (assessment) => assessment.percent === null ? [] : [assessment.percent],
    );
    return {
      ...pupil,
      assessments: pupilAssessments,
      cahierScore: continuous?.cahierScore,
      participationScore: continuous?.participationScore,
      absenceScore,
      disciplineScore,
      continuousTotal:
        typeof continuous?.cahierScore === 'number' &&
        typeof continuous.participationScore === 'number'
          ? Math.round(
              (continuous.cahierScore +
                continuous.participationScore +
                absenceScore +
                disciplineScore) *
                100,
            ) / 100
          : null,
      presentSessions,
      absentSessions,
      averageAssessmentPercent: completedAssessmentPercentages.length
        ? Math.round(
            completedAssessmentPercentages.reduce((sum, percent) => sum + percent, 0) /
              completedAssessmentPercentages.length,
          )
        : null,
    };
  });

  return {
    school: input.school,
    teacherName: input.teacherName,
    classItem: input.classItem,
    period: input.period,
    pupils,
  };
}
