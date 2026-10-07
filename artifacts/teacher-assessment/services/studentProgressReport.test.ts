import assert from 'node:assert/strict';
import { buildStudentProgressReport } from './studentProgressReport.ts';

const report = buildStudentProgressReport({
  school: { name: 'École', address: '', wilaya: '' },
  teacherName: 'Enseignante',
  classItem: { id: 'class-1', name: '1AS-A', level: '1AS', academicYear: '2026-2027' },
  period: { id: 'term-1', name: 'Trimestre 1', startDate: '2026-09-01', endDate: '2026-12-31' },
  pupils: [
    { id: 'pupil-1', registrationNumber: '01', firstName: 'Nadia', lastName: 'Test' },
    { id: 'pupil-2', registrationNumber: '02', firstName: 'Karim', lastName: 'Test' },
  ],
  assessments: [
    {
      id: 'assessment-1',
      title: 'Lecture',
      competency: 'Compréhension',
      date: '2026-10-01',
      objectives: [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }],
      evaluations: {
        'pupil-1': { o1: 'Acquired', o2: 'PartiallyAcquired', o3: 'NotAcquired' },
        'pupil-2': { o1: 'Acquired' },
      },
      absentPupilIds: ['pupil-2'],
    },
    {
      id: 'assessment-outside',
      title: 'Hors période',
      competency: 'Autre',
      date: '2027-01-01',
      objectives: [{ id: 'o4' }],
      evaluations: { 'pupil-1': { o4: 'Acquired' } },
      absentPupilIds: [],
    },
  ],
  continuousEvaluations: [{
    pupilId: 'pupil-1',
    classId: 'class-1',
    schoolYearId: '2026-2027',
    evaluationPeriodId: 'term-1',
    cahierScore: 4,
    participationScore: 5,
  }],
  attendanceRecords: [
    { classId: 'class-1', date: '2026-10-02', statuses: { 'pupil-1': 'present', 'pupil-2': 'absent' } },
    { classId: 'class-1', date: '2026-10-03', statuses: { 'pupil-1': 'absent', 'pupil-2': 'present' } },
    { classId: 'class-1', date: '2027-01-02', statuses: { 'pupil-1': 'absent' } },
  ],
  disciplineEvents: [{
    studentId: 'pupil-1',
    classId: 'class-1',
    schoolYearId: '2026-2027',
    date: '2026-11-01',
    penalty: 0.5,
  }],
  absencePenaltyPerAbsence: 0.5,
});

assert.equal(report.pupils[0].assessments.length, 1);
assert.equal(report.pupils[0].averageAssessmentPercent, 50);
assert.equal(report.pupils[0].absenceScore, 4.5);
assert.equal(report.pupils[0].disciplineScore, 4.5);
assert.equal(report.pupils[0].continuousTotal, 18);
assert.equal(report.pupils[0].presentSessions, 1);
assert.equal(report.pupils[0].absentSessions, 1);
assert.equal(report.pupils[1].assessments[0].absent, true);
assert.equal(report.pupils[1].averageAssessmentPercent, null);
assert.equal(report.pupils[1].continuousTotal, null);
console.log('Tests de bulletin trimestriel réussis.');
