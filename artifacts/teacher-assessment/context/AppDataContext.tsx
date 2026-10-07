import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { COMPETENCY_TEMPLATES } from '@/constants/competencies';
import {
  cloneSchoolYearConfiguration,
  createConfigId,
  createDefaultSchoolYearConfiguration,
  getObjectivesForPair,
  migrateSchoolYearConfigurations,
  normalizeLabel,
  type ConfiguredObjective,
  type SchoolCompetency,
  type SchoolLevel,
  type SchoolYearConfiguration,
} from '@/services/pedagogicalConfiguration';
import {
  DEFAULT_ABSENCE_SCORING_CONFIGURATION,
  DEFAULT_DISCIPLINE_PENALTY,
  isValidManualScore,
  normalizeScore,
} from '@/services/continuousEvaluation';
import {
  findScheduleOccurrenceConflict,
  getScheduleOccurrencesForDate,
} from '@/services/schedule';

export type EvaluationValue =
  'NotEvaluated' | 'Acquired' | 'PartiallyAcquired' | 'NotAcquired';

export type ClassItem = {
  id: string;
  name: string;
  level: string;
  levelId?: string;
  academicYear: string;
  active?: boolean;
};

export type ScheduleSession = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classId: string;
  subject?: string;
  room?: string;
  notes?: string;
};

export type ScheduleOccurrenceOverride = {
  id: string;
  sourceSessionId?: string;
  originalDate: string;
  status: 'cancelled' | 'rescheduled' | 'extra';
  date?: string;
  classId: string;
  startTime: string;
  endTime: string;
  subject?: string;
  room?: string;
  notes?: string;
  cancellationReason?: string;
};

export type ScheduleOccurrenceSaveResult =
  | { success: true }
  | {
      success: false;
      reason: 'session-not-found' | 'invalid-original-date' | 'invalid-target-date' |
        'invalid-class' | 'invalid-time' | 'invalid-time-range' | 'overlap';
      conflictingOccurrence?: Pick<ScheduleSession, 'classId' | 'startTime' | 'endTime'>;
    };

export type AttendanceStatus = 'present' | 'absent';

export type AttendanceRecord = {
  id: string;
  classId: string;
  sessionId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  subject?: string;
  room?: string;
  statuses: Record<string, AttendanceStatus>;
};

export type ContinuousEvaluationRecord = {
  id: string;
  pupilId: string;
  classId: string;
  schoolYearId: string;
  evaluationPeriodId?: string;
  cahierScore?: number;
  participationScore?: number;
  createdAt: string;
  updatedAt: string;
};

export type ContinuousEvaluationPeriod = {
  id: string;
  schoolYearId: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type DisciplineEvent = {
  id: string;
  studentId: string;
  classId: string;
  schoolYearId: string;
  evaluationId: string;
  date: string;
  type: 'MINUS';
  penalty: number;
  comment?: string;
  createdAt: string;
};

export type ContinuousEvaluationSettings = {
  absencePenaltyPerAbsence: number;
  disciplinePenalty: number;
};

export type LevelTest = {
  id: string;
  classId: string;
  schoolYearId: string;
  createdAt: string;
};

export type Pupil = {
  id: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  classId: string;
  dateOfBirth?: string;
  gender?: string;
};

export type Objective = {
  id: string;
  assessmentId: string;
  order: number;
  description: string;
};

export type Assessment = {
  id: string;
  classId: string;
  levelTestId?: string;
  title: string;
  date: string;
  subject: string;
  level: string;
  competency: string;
  competencyId?: string;
  support: string;
  sessionObjectives: string;
  status: 'Draft' | 'InProgress' | 'Completed' | 'Archived';
};

export type AssessmentStatistics = {
  objectiveId: string;
  evaluated: number;
  notEvaluated: number;
  acquired: number;
  partiallyAcquired: number;
  notAcquired: number;
  acquiredPercent: number;
};

export type School = {
  name: string;
  address: string;
  wilaya: string;
};

export type AppState = {
  school: School;
  teacherName: string;
  interfaceMode: 'daily' | 'full';
  academicYear: string;
  archivedAcademicYears: string[];
  schoolYearConfigurations: SchoolYearConfiguration[];
  classes: ClassItem[];
  scheduleSessions: ScheduleSession[];
  scheduleOccurrenceOverrides: ScheduleOccurrenceOverride[];
  attendanceRecords: AttendanceRecord[];
  continuousEvaluations: ContinuousEvaluationRecord[];
  continuousEvaluationPeriods: ContinuousEvaluationPeriod[];
  activeContinuousEvaluationPeriodByYear: Record<string, string>;
  disciplineEvents: DisciplineEvent[];
  continuousEvaluationSettings: ContinuousEvaluationSettings;
  levelTests: LevelTest[];
  activeClassId: string;
  pupils: Pupil[];
  assessments: Assessment[];
  activeAssessmentId: string;
  objectives: Record<string, Objective[]>; // keyed by assessmentId
  evaluations: Record<string, Record<string, Record<string, EvaluationValue>>>; // [assessmentId][pupilId][objectiveId]
  absentPupilIds: Record<string, string[]>; // [assessmentId] => absent pupil IDs
  remediations: Record<string, { individual: string; classroom: string }>; // keyed by assessmentId
};

type DeleteYearResult = {
  ok: boolean;
  reason?: 'not-found' | 'last-year';
  classCount: number;
  defaultYear?: string;
};

type DeleteLevelResult = {
  ok: boolean;
  reason?: 'not-found' | 'in-use';
  classCount: number;
};

export type AppDataContextValue = {
  school: School;
  teacherName: string;
  interfaceMode: 'daily' | 'full';
  academicYear: string;
  archivedAcademicYears: string[];
  schoolYearConfigurations: SchoolYearConfiguration[];
  classes: ClassItem[];
  scheduleSessions: ScheduleSession[];
  scheduleOccurrenceOverrides: ScheduleOccurrenceOverride[];
  attendanceRecords: AttendanceRecord[];
  continuousEvaluations: ContinuousEvaluationRecord[];
  continuousEvaluationPeriods: ContinuousEvaluationPeriod[];
  activeContinuousEvaluationPeriodByYear: Record<string, string>;
  disciplineEvents: DisciplineEvent[];
  continuousEvaluationSettings: ContinuousEvaluationSettings;
  levelTests: LevelTest[];
  activeClassId: string;
  pupils: Pupil[];
  assessments: Assessment[];
  activeAssessmentId: string;
  absentPupilIds: Record<string, string[]>;
  allObjectives: Record<string, Objective[]>; // alias for objectives (all assessments)
  allEvaluations: Record<
    string,
    Record<string, Record<string, EvaluationValue>>
  >; // alias
  allRemediations: Record<string, { individual: string; classroom: string }>; // alias

  hydrated: boolean;
  lastBackupAt: string | null;

  // Active shortcuts (backward compatibility for existing screens)
  className: string;
  level: string;
  classId: string;
  activeClass: ClassItem;
  assessment: Assessment;
  objectives: Objective[];
  evaluations: Record<string, Record<string, EvaluationValue>>;
  individualRemediation: string;
  classRemediation: string;
  statistics: AssessmentStatistics[];

  // Profile / Settings Actions
  updateTeacherName: (name: string) => void;
  setInterfaceMode: (mode: 'daily' | 'full') => void;
  updateSchool: (school: Partial<School> & { academicYear?: string }) => void;
  setActiveAcademicYear: (year: string) => void;
  createAcademicYear: (year: string, copyFromYear?: string) => boolean;
  renameAcademicYear: (year: string, newName: string) => boolean;
  deleteAcademicYear: (year: string) => DeleteYearResult;
  setAcademicYearArchived: (year: string, archived: boolean) => boolean;
  archiveAndCreateAcademicYear: (
    sourceYear: string,
    targetYear: string,
    options: {
      copyPedagogicalConfiguration: boolean;
      carryClassesAndPupils: boolean;
      copySchedule: boolean;
    },
  ) => Promise<
    | { ok: true; classCount: number; pupilCount: number; sessionCount: number }
    | { ok: false; reason: 'source-not-found' | 'already-archived' | 'target-invalid' | 'target-exists' }
  >;
  addSchoolLevel: (year: string, name: string) => string | undefined;
  renameSchoolLevel: (
    year: string,
    levelId: string,
    newName: string,
  ) => boolean;
  deleteSchoolLevel: (year: string, levelId: string) => DeleteLevelResult;
  addOrAssociateCompetency: (
    year: string,
    levelId: string,
    name: string,
  ) => string | undefined;
  setCompetencyAssociation: (
    year: string,
    levelId: string,
    competencyId: string,
    associated: boolean,
  ) => void;
  setConfiguredObjectives: (
    year: string,
    levelId: string,
    competencyId: string,
    descriptions: string[],
  ) => void;
  getSchoolYearConfiguration: (
    year?: string,
  ) => SchoolYearConfiguration | undefined;
  getLevelIdForYear: (
    year: string,
    levelId?: string,
    levelName?: string,
  ) => string;
  getCompetenciesForLevel: (
    year: string,
    levelId?: string,
    levelName?: string,
  ) => SchoolCompetency[];
  getObjectivesForLevelCompetency: (
    year: string,
    levelId: string,
    competencyId: string,
  ) => ConfiguredObjective[];
  resetAllData: () => Promise<void>;
  generateTestData: () => Promise<{ classCount: number; pupilCount: number; weeklyHours: number }>;
  getBackupState: () => AppState;
  restoreBackupState: (backup: unknown) => Promise<void>;

  // Class Actions
  createClass: (input: {
    name: string;
    level: string;
    levelId?: string;
    academicYear?: string;
  }) => string;
  setActiveClass: (classId: string) => void;
  addScheduleSession: (input: Omit<ScheduleSession, 'id'>) => string | undefined;
  updateScheduleSession: (sessionId: string, input: Omit<ScheduleSession, 'id'>) => boolean;
  deleteScheduleSession: (sessionId: string) => void;
  saveScheduleOccurrenceOverride: (
    input: Omit<ScheduleOccurrenceOverride, 'id' | 'status'> & { status: 'cancelled' | 'rescheduled' },
  ) => ScheduleOccurrenceSaveResult;
  addExtraScheduleSession: (
    input: Omit<ScheduleOccurrenceOverride, 'id' | 'sourceSessionId' | 'status'>,
  ) => string | undefined;
  deleteScheduleOccurrenceOverride: (overrideId: string) => void;
  renameClass: (classId: string, name: string) => boolean;
  deleteClass: (classId: string) => void;

  // Pupil Actions
  addPupils: (
    pupils: Array<
      Pick<
        Pupil,
        'registrationNumber' | 'firstName' | 'lastName' | 'dateOfBirth'
      >
    >,
    targetClassId?: string,
  ) => { imported: number; skipped: number };
  deletePupil: (pupilId: string) => void;
  updatePupilName: (
    pupilId: string,
    firstName: string,
    lastName: string,
  ) => boolean;
  getPupilsForClass: (classId: string) => Pupil[];
  getAttendanceRecord: (
    classId: string,
    sessionId: string | undefined,
    date: string,
  ) => AttendanceRecord | undefined;
  getAttendanceRecordsForClass: (classId: string) => AttendanceRecord[];
  saveAttendanceRecord: (record: Omit<AttendanceRecord, 'id'>) => boolean;
  getContinuousEvaluation: (
    pupilId: string,
    classId: string,
    schoolYearId: string,
    evaluationPeriodId?: string,
  ) => ContinuousEvaluationRecord | undefined;
  getContinuousEvaluationPeriods: (schoolYearId: string) => ContinuousEvaluationPeriod[];
  getActiveContinuousEvaluationPeriod: (schoolYearId: string) => ContinuousEvaluationPeriod | undefined;
  setActiveContinuousEvaluationPeriod: (schoolYearId: string, periodId: string) => boolean;
  addContinuousEvaluationPeriod: (
    schoolYearId: string,
    name: string,
    startDate: string,
    endDate: string,
  ) => string | undefined;
  updateContinuousEvaluationPeriod: (
    periodId: string,
    name: string,
    startDate: string,
    endDate: string,
  ) => boolean;
  deleteContinuousEvaluationPeriod: (periodId: string) => boolean;
  setContinuousEvaluationScore: (
    pupilId: string,
    classId: string,
    schoolYearId: string,
    field: 'cahierScore' | 'participationScore',
    score: number,
    evaluationPeriodId?: string,
  ) => boolean;
  getDisciplineEventsForEvaluation: (evaluationId: string) => DisciplineEvent[];
  addDisciplinePenalty: (
    pupilId: string,
    classId: string,
    schoolYearId: string,
    comment?: string,
    evaluationPeriodId?: string,
  ) => string | undefined;
  deleteDisciplineEvent: (eventId: string) => boolean;
  updateContinuousEvaluationSettings: (
    settings: Partial<ContinuousEvaluationSettings>,
  ) => boolean;

  // Assessment / Competency Actions
  createAssessment: (input: {
    classId: string;
    competency: string;
    competencyId?: string;
    title: string;
    subject?: string;
    level?: string;
    support?: string;
    sessionObjectives?: string;
    date?: string;
    objectives?: string[];
  }) => string | undefined;
  setActiveAssessment: (assessmentId: string) => void;
  deleteAssessment: (assessmentId: string) => void;
  getAssessment: (assessmentId: string) => Assessment | undefined;
  getAssessmentsForClass: (classId: string) => Assessment[];
  getLevelTestForClassYear: (classId: string, schoolYearId: string) => LevelTest | undefined;

  // Objective Actions
  addObjective: (assessmentId: string, description: string) => string;
  removeObjective: (assessmentId: string, objectiveId: string) => void;
  updateObjective: (
    assessmentId: string,
    objectiveId: string,
    description: string,
  ) => void;
  getObjectivesForAssessment: (assessmentId: string) => Objective[];

  // Evaluation Actions
  setEvaluation: (
    pupilId: string,
    objectiveId: string,
    value: EvaluationValue,
    assessmentId?: string,
  ) => void;
  cycleEvaluation: (
    pupilId: string,
    objectiveId: string,
    assessmentId?: string,
  ) => void;
  setAllForObjective: (
    objectiveId: string,
    value: EvaluationValue,
    assessmentId?: string,
  ) => void;
  getEvaluationsForAssessment: (
    assessmentId: string,
  ) => Record<string, Record<string, EvaluationValue>>;
  setPupilAbsent: (pupilId: string, absent: boolean, assessmentId?: string) => void;
  getAbsentPupilIdsForAssessment: (assessmentId: string) => string[];
  getStatisticsForAssessment: (assessmentId: string) => AssessmentStatistics[];

  // Remediation Actions
  updateRemediation: (
    individual: string,
    classroom: string,
    assessmentId?: string,
  ) => void;
  getRemediationForAssessment: (assessmentId: string) => {
    individual: string;
    classroom: string;
  };

  // Utilities
  clearAssessment: (assessmentId?: string) => void;
  saveLocally: () => Promise<void>;
};

const STORAGE_KEY = '@teacher-assessment/app-state-v4';

function isScheduleSession(value: unknown): value is ScheduleSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<ScheduleSession>;
  return typeof session.id === 'string' &&
    Number.isInteger(session.dayOfWeek) &&
    session.dayOfWeek! >= 0 && session.dayOfWeek! <= 6 &&
    typeof session.classId === 'string' &&
    typeof session.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(session.startTime) &&
    typeof session.endTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(session.endTime) &&
    session.startTime < session.endTime;
}

function isScheduleOccurrenceOverride(value: unknown): value is ScheduleOccurrenceOverride {
  if (!value || typeof value !== 'object') return false;
  const occurrence = value as Partial<ScheduleOccurrenceOverride>;
  const isValidDate = (date: unknown) =>
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    (() => {
      const [year, month, day] = date.split('-').map(Number);
      const parsedDate = new Date(year, month - 1, day);
      return parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === month - 1 &&
        parsedDate.getDate() === day;
    })();
  const isValidTime = (time: unknown) =>
    typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const startTime = typeof occurrence.startTime === 'string' ? occurrence.startTime : '';
  const endTime = typeof occurrence.endTime === 'string' ? occurrence.endTime : '';
  return typeof occurrence.id === 'string' &&
    (occurrence.cancellationReason === undefined || typeof occurrence.cancellationReason === 'string') &&
    (occurrence.sourceSessionId === undefined || typeof occurrence.sourceSessionId === 'string') &&
    isValidDate(occurrence.originalDate) &&
    (occurrence.status === 'cancelled' || occurrence.status === 'rescheduled' || occurrence.status === 'extra') &&
    (occurrence.date === undefined || isValidDate(occurrence.date)) &&
    typeof occurrence.classId === 'string' &&
    isValidTime(startTime) &&
    isValidTime(endTime) &&
    startTime < endTime &&
    (occurrence.status === 'extra'
      ? occurrence.sourceSessionId === undefined && occurrence.date === occurrence.originalDate
      : typeof occurrence.sourceSessionId === 'string' &&
        (occurrence.status === 'cancelled' || isValidDate(occurrence.date)));
}

function isAttendanceRecord(value: unknown): value is AttendanceRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<AttendanceRecord>;
  const [year, month, day] = (record.date ?? '').split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(record.date ?? '') &&
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day;
  return typeof record.id === 'string' &&
    typeof record.classId === 'string' &&
    hasValidDate &&
    (record.sessionId === undefined || typeof record.sessionId === 'string') &&
    Boolean(record.statuses) && typeof record.statuses === 'object' &&
    Object.values(record.statuses).every((status) => status === 'present' || status === 'absent');
}

function isContinuousEvaluationRecord(value: unknown): value is ContinuousEvaluationRecord {
  if (!value || typeof value !== 'object') return false;
  const evaluation = value as Partial<ContinuousEvaluationRecord>;
  return typeof evaluation.id === 'string' &&
    typeof evaluation.pupilId === 'string' &&
    typeof evaluation.classId === 'string' &&
    typeof evaluation.schoolYearId === 'string' &&
    (evaluation.evaluationPeriodId === undefined || typeof evaluation.evaluationPeriodId === 'string') &&
    (evaluation.cahierScore === undefined || isValidManualScore(evaluation.cahierScore)) &&
    (evaluation.participationScore === undefined || isValidManualScore(evaluation.participationScore)) &&
    typeof evaluation.createdAt === 'string' &&
    typeof evaluation.updatedAt === 'string';
}

function isValidDateString(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day;
}

function isContinuousEvaluationPeriod(value: unknown): value is ContinuousEvaluationPeriod {
  if (!value || typeof value !== 'object') return false;
  const period = value as Partial<ContinuousEvaluationPeriod>;
  return typeof period.id === 'string' &&
    typeof period.schoolYearId === 'string' &&
    typeof period.name === 'string' &&
    Boolean(period.name.trim()) &&
    typeof period.startDate === 'string' &&
    isValidDateString(period.startDate) &&
    typeof period.endDate === 'string' &&
    isValidDateString(period.endDate) &&
    period.startDate <= period.endDate;
}

function createDefaultContinuousEvaluationPeriods(
  schoolYearId: string,
): ContinuousEvaluationPeriod[] {
  const years = schoolYearId.match(/(\d{4})\D+(\d{4})/);
  const firstYear = Number(years?.[1] ?? schoolYearId.match(/\d{4}/)?.[0] ?? new Date().getFullYear());
  const secondYear = Number(years?.[2] ?? firstYear + 1);
  const yearKey = schoolYearId.replace(/[^a-zA-Z0-9-]/g, '-');
  const date = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return [
    {
      id: `continuous-period-${yearKey}-1`,
      schoolYearId,
      name: '1er trimestre',
      startDate: date(firstYear, 9, 1),
      endDate: date(firstYear, 12, 31),
    },
    {
      id: `continuous-period-${yearKey}-2`,
      schoolYearId,
      name: '2e trimestre',
      startDate: date(secondYear, 1, 1),
      endDate: date(secondYear, 3, 31),
    },
    {
      id: `continuous-period-${yearKey}-3`,
      schoolYearId,
      name: '3e trimestre',
      startDate: date(secondYear, 4, 1),
      endDate: date(secondYear, 7, 31),
    },
  ];
}

function initializeContinuousEvaluationPeriods(
  schoolYearIds: string[],
  storedPeriods: unknown,
): ContinuousEvaluationPeriod[] {
  const validPeriods = Array.isArray(storedPeriods)
    ? storedPeriods.filter(isContinuousEvaluationPeriod)
    : [];
  const periods = validPeriods.filter((period, index) =>
    validPeriods.findIndex((item) => item.id === period.id) === index &&
    schoolYearIds.includes(period.schoolYearId),
  );
  for (const schoolYearId of schoolYearIds) {
    if (!periods.some((period) => period.schoolYearId === schoolYearId)) {
      periods.push(...createDefaultContinuousEvaluationPeriods(schoolYearId));
    }
  }
  return periods;
}

function isDisciplineEvent(value: unknown): value is DisciplineEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<DisciplineEvent>;
  const dateValue = typeof event.date === 'string' ? event.date : '';
  const [year, month, day] = dateValue.split('-').map(Number);
  const eventDate = new Date(year, month - 1, day);
  return typeof event.id === 'string' &&
    typeof event.studentId === 'string' &&
    typeof event.classId === 'string' &&
    typeof event.schoolYearId === 'string' &&
    typeof event.evaluationId === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue) &&
    eventDate.getFullYear() === year &&
    eventDate.getMonth() === month - 1 &&
    eventDate.getDate() === day &&
    event.type === 'MINUS' &&
    typeof event.penalty === 'number' &&
    Number.isFinite(event.penalty) &&
    event.penalty > 0 &&
    (event.comment === undefined || typeof event.comment === 'string') &&
    typeof event.createdAt === 'string';
}

function isLevelTest(value: unknown): value is LevelTest {
  if (!value || typeof value !== 'object') return false;
  const test = value as Partial<LevelTest>;
  return typeof test.id === 'string' &&
    typeof test.classId === 'string' &&
    typeof test.schoolYearId === 'string' &&
    typeof test.createdAt === 'string';
}

function migrateLevelTests(
  classes: ClassItem[],
  assessments: Assessment[],
  storedTests: unknown,
): { levelTests: LevelTest[]; assessments: Assessment[] } {
  const validTests = Array.isArray(storedTests)
    ? storedTests.filter(isLevelTest).filter((test) =>
        classes.some((classItem) =>
          classItem.id === test.classId &&
          classItem.academicYear === test.schoolYearId,
        ),
      )
    : [];
  const byClassYear = new Map<string, LevelTest>();
  for (const test of validTests) {
    const key = `${test.classId}::${test.schoolYearId}`;
    if (!byClassYear.has(key)) byClassYear.set(key, test);
  }
  const now = new Date().toISOString();
  for (const assessment of assessments) {
    const classItem = classes.find((item) => item.id === assessment.classId);
    if (!classItem) continue;
    const key = `${classItem.id}::${classItem.academicYear}`;
    const existing = byClassYear.get(key);
    const levelTest = existing ?? {
      id: createConfigId('level-test'),
      classId: classItem.id,
      schoolYearId: classItem.academicYear,
      createdAt: now,
    };
    if (!existing) {
      byClassYear.set(key, levelTest);
    }
    assessment.levelTestId = levelTest.id;
  }
  return { levelTests: Array.from(byClassYear.values()), assessments };
}

export function createEmptyState(): AppState {
  return {
    school: {
      name: '',
      address: '',
      wilaya: '',
    },
    teacherName: '',
    interfaceMode: 'full',
    academicYear: '2026-2027',
    archivedAcademicYears: [],
    schoolYearConfigurations: [
      createDefaultSchoolYearConfiguration('2026-2027'),
    ],
    classes: [],
    scheduleSessions: [],
    scheduleOccurrenceOverrides: [],
    attendanceRecords: [],
    continuousEvaluations: [],
    continuousEvaluationPeriods: createDefaultContinuousEvaluationPeriods('2026-2027'),
    activeContinuousEvaluationPeriodByYear: {},
    disciplineEvents: [],
    continuousEvaluationSettings: {
      absencePenaltyPerAbsence: DEFAULT_ABSENCE_SCORING_CONFIGURATION.penaltyPerAbsence,
      disciplinePenalty: DEFAULT_DISCIPLINE_PENALTY,
    },
    levelTests: [],
    activeClassId: '',
    pupils: [],
    assessments: [],
    activeAssessmentId: '',
    objectives: {},
    evaluations: {},
    absentPupilIds: {},
    remediations: {},
  };
}

const initialState = createEmptyState();

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as Partial<AppState>;
            const academicYear = parsed.academicYear ?? '2026-2027';
            const classes = Array.isArray(parsed.classes) ? parsed.classes : [];
            const rawAssessments = Array.isArray(parsed.assessments)
              ? parsed.assessments
              : [];
            const migratedLevelTests = migrateLevelTests(
              classes,
              rawAssessments.map((assessment) => ({ ...assessment })),
              parsed.levelTests,
            );
            const assessments = migratedLevelTests.assessments;
            const objectives = parsed.objectives ?? {};
            const pupils = Array.isArray(parsed.pupils) ? parsed.pupils : [];
            const continuousEvaluationPeriods = initializeContinuousEvaluationPeriods(
              [...new Set([academicYear, ...classes.map((item) => item.academicYear)])],
              parsed.continuousEvaluationPeriods,
            );
            const periodByYear = new Map<string, string>();
            for (const period of [...continuousEvaluationPeriods].sort(
              (left, right) => left.startDate.localeCompare(right.startDate),
            )) {
              if (!periodByYear.has(period.schoolYearId)) {
                periodByYear.set(period.schoolYearId, period.id);
              }
            }
            const validEvaluations = Array.isArray(parsed.continuousEvaluations)
              ? parsed.continuousEvaluations
                  .filter(isContinuousEvaluationRecord)
                  .filter((evaluation) =>
                    classes.some((classItem) =>
                      classItem.id === evaluation.classId &&
                      classItem.academicYear === evaluation.schoolYearId &&
                      pupils.some((pupil) =>
                        pupil.id === evaluation.pupilId &&
                        pupil.classId === evaluation.classId,
                      ),
                    ),
                  )
                  .map((evaluation) => ({
                    ...evaluation,
                    evaluationPeriodId:
                      (evaluation.evaluationPeriodId &&
                      continuousEvaluationPeriods.some(
                        (period) =>
                          period.id === evaluation.evaluationPeriodId &&
                          period.schoolYearId === evaluation.schoolYearId,
                      )
                        ? evaluation.evaluationPeriodId
                        : periodByYear.get(evaluation.schoolYearId)),
                  }))
              : [];
            const evaluationIds = new Set(validEvaluations.map((item) => item.id));
            const validPeriodIds = new Set(continuousEvaluationPeriods.map((item) => item.id));
            const activeContinuousEvaluationPeriodByYear = Object.fromEntries(
              Object.entries(parsed.activeContinuousEvaluationPeriodByYear ?? {}).filter(
                ([schoolYearId, periodId]) =>
                  typeof periodId === 'string' &&
                  validPeriodIds.has(periodId) &&
                  continuousEvaluationPeriods.some(
                    (period) => period.id === periodId && period.schoolYearId === schoolYearId,
                  ),
              ),
            );
            setState((prev) => ({
              ...prev,
              ...parsed,
              school: parsed.school ?? prev.school,
              teacherName: parsed.teacherName ?? prev.teacherName,
              interfaceMode: parsed.interfaceMode === 'daily' ? 'daily' : 'full',
              academicYear,
              archivedAcademicYears: Array.isArray(parsed.archivedAcademicYears)
                ? parsed.archivedAcademicYears.filter((year): year is string => typeof year === 'string')
                : [],
              schoolYearConfigurations: migrateSchoolYearConfigurations(
                parsed.schoolYearConfigurations,
                academicYear,
                classes,
                assessments,
                objectives,
              ),
              classes,
              scheduleSessions: Array.isArray(parsed.scheduleSessions)
                ? parsed.scheduleSessions.filter(isScheduleSession).filter((session) => classes.some((classItem) => classItem.id === session.classId))
                : [],
              scheduleOccurrenceOverrides: Array.isArray(parsed.scheduleOccurrenceOverrides)
                ? parsed.scheduleOccurrenceOverrides
                    .filter(isScheduleOccurrenceOverride)
                    .filter((occurrence) =>
                      classes.some((classItem) => classItem.id === occurrence.classId) &&
                      (occurrence.status === 'extra' ||
                        (Array.isArray(parsed.scheduleSessions) &&
                          parsed.scheduleSessions.some(
                            (session) =>
                              isScheduleSession(session) &&
                              session.id === occurrence.sourceSessionId,
                          ))),
                    )
                : [],
              attendanceRecords: Array.isArray(parsed.attendanceRecords)
                ? parsed.attendanceRecords.filter(isAttendanceRecord).filter((record) => classes.some((classItem) => classItem.id === record.classId))
                : [],
              continuousEvaluations: validEvaluations,
              continuousEvaluationPeriods,
              activeContinuousEvaluationPeriodByYear,
              disciplineEvents: Array.isArray(parsed.disciplineEvents)
                ? parsed.disciplineEvents
                    .filter(isDisciplineEvent)
                    .filter((event) => {
                      const evaluation = validEvaluations.find(
                        (item) => item.id === event.evaluationId,
                      );
                      return evaluationIds.has(event.evaluationId) &&
                        evaluation?.pupilId === event.studentId &&
                        evaluation.classId === event.classId &&
                        evaluation.schoolYearId === event.schoolYearId;
                    })
                : [],
              continuousEvaluationSettings: {
                absencePenaltyPerAbsence: isValidManualScore(
                  parsed.continuousEvaluationSettings?.absencePenaltyPerAbsence ?? Number.NaN,
                )
                  ? parsed.continuousEvaluationSettings!.absencePenaltyPerAbsence
                  : DEFAULT_ABSENCE_SCORING_CONFIGURATION.penaltyPerAbsence,
                disciplinePenalty: isValidManualScore(
                  parsed.continuousEvaluationSettings?.disciplinePenalty ?? Number.NaN,
                ) && parsed.continuousEvaluationSettings!.disciplinePenalty > 0
                  ? parsed.continuousEvaluationSettings!.disciplinePenalty
                  : DEFAULT_DISCIPLINE_PENALTY,
              },
              pupils,
              assessments,
              levelTests: migratedLevelTests.levelTests,
              objectives,
              evaluations: parsed.evaluations ?? {},
              absentPupilIds: parsed.absentPupilIds ?? {},
              remediations: parsed.remediations ?? {},
            }));
          } catch {
            setState(createEmptyState());
          }
        } else {
          setState(createEmptyState());
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(
        () => undefined,
      );
    }
  }, [hydrated, state]);

  const writeAutomaticBackup = async (snapshot: AppState) => {
    try {
      const timestamp = new Date().toISOString();
      const directory = `${FileSystem.documentDirectory}backups/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      await FileSystem.writeAsStringAsync(`${directory}evaluation-eleve-${timestamp.slice(0, 10)}.json`, JSON.stringify({ format: 'evaluation-eleve-auto-backup', version: 1, exportedAt: timestamp, state: snapshot }));
      await AsyncStorage.setItem('@teacher-assessment/last-backup-at', timestamp);
      setLastBackupAt(timestamp);
    } catch {
      // Automatic backups must never block normal local use.
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.getItem('@teacher-assessment/last-backup-at').then((stored) => {
      setLastBackupAt(stored);
      if (!stored || Date.now() - new Date(stored).getTime() >= 24 * 60 * 60 * 1000) void writeAutomaticBackup(state);
    });
  }, [hydrated]);

  // Active class helper (safe fallback when classes are empty)
  const activeClass = useMemo(() => {
    return (
      state.classes.find((c) => c.id === state.activeClassId) ??
      state.classes.find(
        (c) => normalizeLabel(c.academicYear) === normalizeLabel(state.academicYear),
      ) ??
      state.classes[0] ?? {
        id: '',
        name: 'Aucune classe',
        level: '—',
        academicYear: state.academicYear,
      }
    );
  }, [state.classes, state.activeClassId, state.academicYear]);

  // Active assessment helper (safe fallback when assessments are empty)
  const activeAssessment = useMemo(() => {
    const found = state.assessments.find(
      (a) => a.id === state.activeAssessmentId,
    );
    if (found) return found;
    // Fallback to first assessment of active class
    const classAssessments = state.assessments.filter(
      (a) => a.classId === state.activeClassId,
    );
    return (
      classAssessments[0] ??
      state.assessments[0] ?? {
        id: '',
        classId: activeClass.id,
        title: 'Aucune évaluation',
        date: new Date().toLocaleDateString('fr-FR'),
        subject: 'Français',
        level: activeClass.level,
        competency: '—',
        support: '',
        sessionObjectives: '',
        status: 'Draft',
      }
    );
  }, [
    state.assessments,
    state.activeAssessmentId,
    state.activeClassId,
    activeClass,
  ]);

  // Active objectives helper
  const activeObjectives = useMemo(() => {
    return state.objectives[activeAssessment.id] ?? [];
  }, [state.objectives, activeAssessment.id]);

  // Active pupils helper (pupils of active class)
  const activePupils = useMemo(() => {
    return state.pupils.filter((p) => p.classId === activeClass.id);
  }, [state.pupils, activeClass.id]);

  // Active evaluations helper
  const activeEvaluations = useMemo(() => {
    return state.evaluations[activeAssessment.id] ?? {};
  }, [state.evaluations, activeAssessment.id]);

  // Active remediations helper
  const activeRemediation = useMemo(() => {
    return (
      state.remediations[activeAssessment.id] ?? {
        individual: '',
        classroom: '',
      }
    );
  }, [state.remediations, activeAssessment.id]);

  const getSchoolYearConfiguration = (year = state.academicYear) =>
    state.schoolYearConfigurations.find(
      (item) => normalizeLabel(item.year) === normalizeLabel(year),
    );

  const getLevelIdForYear = (
    year: string,
    levelId?: string,
    levelName?: string,
  ) => {
    const configuration = getSchoolYearConfiguration(year);
    const level =
      (levelId
        ? configuration?.levels.find((item) => item.id === levelId)
        : undefined) ||
      (levelName
        ? configuration?.levels.find(
            (item) => normalizeLabel(item.name) === normalizeLabel(levelName),
          )
        : undefined);
    return level?.id ?? '';
  };

  const getCompetenciesForLevel = (
    year: string,
    levelId?: string,
    levelName?: string,
  ) => {
    const configuration = getSchoolYearConfiguration(year);
    const resolvedLevelId = getLevelIdForYear(year, levelId, levelName);
    if (!configuration || !resolvedLevelId) return [];
    const linkedIds = new Set(
      configuration.associations
        .filter((association) => association.levelId === resolvedLevelId)
        .map((association) => association.competencyId),
    );
    return configuration.competencies.filter((competency) =>
      linkedIds.has(competency.id),
    );
  };

  const getObjectivesForLevelCompetency = (
    year: string,
    levelId: string,
    competencyId: string,
  ) =>
    getObjectivesForPair(
      getSchoolYearConfiguration(year),
      levelId,
      competencyId,
    );

  // CLASS ACTIONS
  const createClass = (input: {
    name: string;
    level: string;
    levelId?: string;
    academicYear?: string;
  }) => {
    const newId = createConfigId('class');
    const academicYear = (input.academicYear ?? state.academicYear).trim();
    let configuration =
      getSchoolYearConfiguration(academicYear) ??
      createDefaultSchoolYearConfiguration(academicYear, [input.level]);
    let level =
      (input.levelId
        ? configuration.levels.find((item) => item.id === input.levelId)
        : undefined) ||
      configuration.levels.find(
        (item) => normalizeLabel(item.name) === normalizeLabel(input.level),
      );
    if (!level) {
      level = { id: createConfigId('level'), name: input.level.trim() };
      configuration = {
        ...configuration,
        levels: [...configuration.levels, level],
      };
    }
    const newClass: ClassItem = {
      id: newId,
      name: input.name.trim(),
      level: level.name,
      levelId: level.id,
      academicYear,
      active: true,
    };

    setState((prev) => {
      const hasConfiguration = prev.schoolYearConfigurations.some(
        (item) => normalizeLabel(item.year) === normalizeLabel(academicYear),
      );
      return {
        ...prev,
        schoolYearConfigurations: hasConfiguration
          ? prev.schoolYearConfigurations.map((item) =>
              normalizeLabel(item.year) === normalizeLabel(academicYear)
                ? configuration
                : item,
            )
          : [...prev.schoolYearConfigurations, configuration],
        continuousEvaluationPeriods: prev.continuousEvaluationPeriods.some(
          (period) => period.schoolYearId === academicYear,
        )
          ? prev.continuousEvaluationPeriods
          : [
              ...prev.continuousEvaluationPeriods,
              ...createDefaultContinuousEvaluationPeriods(academicYear),
            ],
        classes: [...prev.classes, newClass],
        activeClassId: newId,
      };
    });
    return newId;
  };

  const setActiveClass = (classId: string) => {
    const foundClass = state.classes.find((c) => c.id === classId);
    if (!foundClass) return;

    // Find first assessment of this class to set as active
    const classAssessments = state.assessments.filter(
      (a) => a.classId === classId,
    );
    const nextAssessmentId =
      classAssessments[0]?.id ?? state.activeAssessmentId;

    setState((prev) => ({
      ...prev,
      activeClassId: classId,
      activeAssessmentId: nextAssessmentId,
    }));
  };

  const addScheduleSession = (input: Omit<ScheduleSession, 'id'>) => {
    const start = input.startTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
    const end = input.endTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
    if (start >= end || !state.classes.some((item) => item.id === input.classId)) return undefined;
    const overlaps = state.scheduleSessions.some((session) => {
      if (session.dayOfWeek !== input.dayOfWeek) return false;
      const existingStart = session.startTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
      const existingEnd = session.endTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
      return start < existingEnd && existingStart < end;
    });
    if (overlaps) return undefined;
    const id = `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setState((prev) => ({ ...prev, scheduleSessions: [...prev.scheduleSessions, { ...input, id }] }));
    return id;
  };

  const saveScheduleOccurrenceOverride = (
    input: Omit<ScheduleOccurrenceOverride, 'id' | 'status'> & {
      status: 'cancelled' | 'rescheduled';
    },
  ) => {
    const source = state.scheduleSessions.find(
      (session) => session.id === input.sourceSessionId,
    );
    if (!source) return { success: false, reason: 'session-not-found' } as const;
    if (!isValidDateString(input.originalDate)) {
      return { success: false, reason: 'invalid-original-date' } as const;
    }
    const [originalYear, originalMonth, originalDay] = input.originalDate.split('-').map(Number);
    const originalDate = new Date(originalYear, originalMonth - 1, originalDay);
    if ((originalDate.getDay() + 6) % 7 !== source.dayOfWeek) {
      return { success: false, reason: 'invalid-original-date' } as const;
    }
    const targetDate = input.date ?? input.originalDate;
    if (!isValidDateString(targetDate)) {
      return { success: false, reason: 'invalid-target-date' } as const;
    }
    if (!state.classes.some((item) => item.id === input.classId)) {
      return { success: false, reason: 'invalid-class' } as const;
    }
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime)
    ) {
      return { success: false, reason: 'invalid-time' } as const;
    }
    const start = input.startTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
    const end = input.endTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
    if (start >= end) return { success: false, reason: 'invalid-time-range' } as const;

    if (input.status === 'rescheduled') {
      const occurrences = getScheduleOccurrencesForDate(
        state.scheduleSessions,
        state.scheduleOccurrenceOverrides,
        targetDate,
      );
      const conflict = findScheduleOccurrenceConflict(occurrences, {
        classId: input.classId,
        startTime: input.startTime,
        endTime: input.endTime,
        sourceSessionId: source.id,
      });
      if (conflict) {
        return {
          success: false,
          reason: 'overlap',
          conflictingOccurrence: {
            classId: conflict.classId,
            startTime: conflict.startTime,
            endTime: conflict.endTime,
          },
        } as const;
      }
    }

    const existing = state.scheduleOccurrenceOverrides.find(
      (occurrence) =>
        occurrence.status !== 'extra' &&
        occurrence.sourceSessionId === source.id &&
        occurrence.originalDate === input.originalDate,
    );
    const override: ScheduleOccurrenceOverride = {
      ...input,
      id: existing?.id ?? createConfigId('schedule-occurrence'),
      sourceSessionId: source.id,
      date: input.status === 'cancelled' ? undefined : targetDate,
      status: input.status,
      originalDate: input.originalDate,
      startTime: input.startTime,
      endTime: input.endTime,
      classId: input.classId,
    };
    setState((prev) => ({
      ...prev,
      scheduleOccurrenceOverrides: existing
        ? prev.scheduleOccurrenceOverrides.map((item) =>
            item.id === existing.id ? override : item,
          )
        : [...prev.scheduleOccurrenceOverrides, override],
    }));
    return { success: true } as const;
  };

  const addExtraScheduleSession = (
    input: Omit<ScheduleOccurrenceOverride, 'id' | 'sourceSessionId' | 'status'>,
  ) => {
    const start = input.startTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
    const end = input.endTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
    if (
      !isValidDateString(input.originalDate) ||
      input.date !== input.originalDate ||
      !state.classes.some((item) => item.id === input.classId) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime) ||
      start >= end
    ) return undefined;
    const overlaps = getScheduleOccurrencesForDate(
      state.scheduleSessions,
      state.scheduleOccurrenceOverrides,
      input.originalDate,
    ).some((occurrence) =>
      start < occurrence.endTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0) &&
      occurrence.startTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0) < end,
    );
    if (overlaps) return undefined;
    const id = createConfigId('extra-session');
    const extra: ScheduleOccurrenceOverride = {
      ...input,
      id,
      status: 'extra',
      date: input.originalDate,
    };
    setState((prev) => ({
      ...prev,
      scheduleOccurrenceOverrides: [...prev.scheduleOccurrenceOverrides, extra],
    }));
    return id;
  };

  const deleteScheduleOccurrenceOverride = (overrideId: string) => {
    setState((prev) => ({
      ...prev,
      scheduleOccurrenceOverrides: prev.scheduleOccurrenceOverrides.filter(
        (occurrence) => occurrence.id !== overrideId,
      ),
    }));
  };

  const updateScheduleSession = (sessionId: string, input: Omit<ScheduleSession, 'id'>) => {
    const start = input.startTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
    const end = input.endTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
    if (start >= end || !state.classes.some((item) => item.id === input.classId)) return false;
    const overlaps = state.scheduleSessions.some((session) => {
      if (session.id === sessionId || session.dayOfWeek !== input.dayOfWeek) return false;
      const existingStart = session.startTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
      const existingEnd = session.endTime.split(':').reduce((hours, part) => hours * 60 + Number(part), 0);
      return start < existingEnd && existingStart < end;
    });
    if (overlaps) return false;
    setState((prev) => ({
      ...prev,
      scheduleSessions: prev.scheduleSessions.map((session) => session.id === sessionId ? { ...input, id: sessionId } : session),
    }));
    return true;
  };

  const deleteScheduleSession = (sessionId: string) => {
    setState((prev) => ({
      ...prev,
      scheduleSessions: prev.scheduleSessions.filter((session) => session.id !== sessionId),
      scheduleOccurrenceOverrides: prev.scheduleOccurrenceOverrides.filter(
        (occurrence) => occurrence.sourceSessionId !== sessionId,
      ),
    }));
  };

  const renameClass = (classId: string, name: string) => {
    const cleanName = name.trim();
    if (!cleanName || !state.classes.some((item) => item.id === classId)) {
      return false;
    }
    setState((prev) => ({
      ...prev,
      classes: prev.classes.map((item) =>
        item.id === classId ? { ...item, name: cleanName } : item,
      ),
    }));
    return true;
  };

  const updateTeacherName = (name: string) => {
    setState((prev) => ({
      ...prev,
      teacherName: name.trim(),
    }));
  };

  const setInterfaceMode = (mode: 'daily' | 'full') => {
    setState((prev) => ({ ...prev, interfaceMode: mode }));
  };

  const updateSchool = (
    schoolData: Partial<School> & { academicYear?: string },
  ) => {
    setState((prev) => {
      const requestedYear = schoolData.academicYear?.trim();
      const existingYear = requestedYear
        ? prev.schoolYearConfigurations.find(
            (item) =>
              normalizeLabel(item.year) === normalizeLabel(requestedYear),
          )
        : undefined;
      const academicYear =
        existingYear?.year ?? requestedYear ?? prev.academicYear;
      const schoolYearConfigurations =
        requestedYear && !existingYear
          ? [
              ...prev.schoolYearConfigurations,
              createDefaultSchoolYearConfiguration(academicYear),
            ]
          : prev.schoolYearConfigurations;
      return {
        ...prev,
        school: {
          ...prev.school,
          ...(schoolData.name !== undefined
            ? { name: schoolData.name.trim() }
            : {}),
          ...(schoolData.address !== undefined
            ? { address: schoolData.address.trim() }
            : {}),
          ...(schoolData.wilaya !== undefined
            ? { wilaya: schoolData.wilaya.trim() }
            : {}),
        },
        academicYear,
        schoolYearConfigurations,
      };
    });
  };

  const setActiveAcademicYear = (year: string) => {
    const requestedYear = year.trim();
    if (!requestedYear) return;
    setState((prev) => {
      const existing = prev.schoolYearConfigurations.find(
        (item) => normalizeLabel(item.year) === normalizeLabel(requestedYear),
      );
      const academicYear = existing?.year ?? requestedYear;
      const activeYearClass = prev.classes.find(
        (item) => normalizeLabel(item.academicYear) === normalizeLabel(academicYear),
      );
      const archivedAcademicYears = prev.archivedAcademicYears.filter(
        (item) =>
          normalizeLabel(item) !== normalizeLabel(academicYear) &&
          normalizeLabel(item) !== normalizeLabel(prev.academicYear),
      );
      return {
        ...prev,
        academicYear,
        activeClassId: activeYearClass?.id ?? prev.activeClassId,
        archivedAcademicYears:
          normalizeLabel(prev.academicYear) === normalizeLabel(academicYear)
            ? archivedAcademicYears
            : [...archivedAcademicYears, prev.academicYear],
        schoolYearConfigurations: existing
          ? prev.schoolYearConfigurations
          : [
              ...prev.schoolYearConfigurations,
              createDefaultSchoolYearConfiguration(requestedYear),
            ],
      };
    });
  };

  const createAcademicYear = (year: string, copyFromYear?: string) => {
    const requestedYear = year.trim();
    if (
      !requestedYear ||
      state.schoolYearConfigurations.some(
        (item) => normalizeLabel(item.year) === normalizeLabel(requestedYear),
      )
    )
      return false;

    const source = copyFromYear
      ? getSchoolYearConfiguration(copyFromYear)
      : undefined;
    const configuration = source
      ? cloneSchoolYearConfiguration(source, requestedYear)
      : createDefaultSchoolYearConfiguration(requestedYear);
    setState((prev) => ({
      ...prev,
      schoolYearConfigurations: [
        ...prev.schoolYearConfigurations,
        configuration,
      ],
      continuousEvaluationPeriods: [
        ...prev.continuousEvaluationPeriods,
        ...createDefaultContinuousEvaluationPeriods(requestedYear),
      ],
    }));
    return true;
  };

  const renameAcademicYear = (year: string, newName: string) => {
    const configuration = getSchoolYearConfiguration(year);
    const cleanName = newName.trim();
    if (!configuration || !cleanName) return false;
    const duplicate = state.schoolYearConfigurations.some(
      (item) =>
        normalizeLabel(item.year) === normalizeLabel(cleanName) &&
        normalizeLabel(item.year) !== normalizeLabel(configuration.year),
    );
    if (duplicate) return false;
    if (configuration.year === cleanName) return true;

    setState((prev) => ({
      ...prev,
      schoolYearConfigurations: prev.schoolYearConfigurations.map((item) =>
        normalizeLabel(item.year) === normalizeLabel(configuration.year)
          ? { ...item, year: cleanName }
          : item,
      ),
      classes: prev.classes.map((item) =>
        normalizeLabel(item.academicYear) === normalizeLabel(configuration.year)
          ? { ...item, academicYear: cleanName }
          : item,
      ),
      continuousEvaluationPeriods: prev.continuousEvaluationPeriods.map((period) =>
        normalizeLabel(period.schoolYearId) === normalizeLabel(configuration.year)
          ? { ...period, schoolYearId: cleanName }
          : period,
      ),
      activeContinuousEvaluationPeriodByYear: Object.fromEntries(
        Object.entries(prev.activeContinuousEvaluationPeriodByYear).map(([yearId, periodId]) => [
          normalizeLabel(yearId) === normalizeLabel(configuration.year) ? cleanName : yearId,
          periodId,
        ]),
      ),
      levelTests: prev.levelTests.map((test) =>
        normalizeLabel(test.schoolYearId) === normalizeLabel(configuration.year)
          ? { ...test, schoolYearId: cleanName }
          : test,
      ),
      continuousEvaluations: prev.continuousEvaluations.map((evaluation) =>
        normalizeLabel(evaluation.schoolYearId) === normalizeLabel(configuration.year)
          ? { ...evaluation, schoolYearId: cleanName }
          : evaluation,
      ),
      disciplineEvents: prev.disciplineEvents.map((event) =>
        normalizeLabel(event.schoolYearId) === normalizeLabel(configuration.year)
          ? { ...event, schoolYearId: cleanName }
          : event,
      ),
      academicYear:
        normalizeLabel(prev.academicYear) === normalizeLabel(configuration.year)
          ? cleanName
          : prev.academicYear,
      archivedAcademicYears: prev.archivedAcademicYears.map((yearId) =>
        normalizeLabel(yearId) === normalizeLabel(configuration.year) ? cleanName : yearId,
      ),
    }));
    return true;
  };

  const deleteAcademicYear = (year: string): DeleteYearResult => {
    const configuration = getSchoolYearConfiguration(year);
    if (!configuration)
      return { ok: false, reason: 'not-found', classCount: 0 };
    if (state.schoolYearConfigurations.length <= 1) {
      return { ok: false, reason: 'last-year', classCount: 0 };
    }

    const yearKey = normalizeLabel(configuration.year);
    const classIds = new Set(
      state.classes
        .filter((item) => normalizeLabel(item.academicYear) === yearKey)
        .map((item) => item.id),
    );
    const classCount = classIds.size;
    const remainingConfigurations = state.schoolYearConfigurations.filter(
      (item) => normalizeLabel(item.year) !== yearKey,
    );
    const defaultYear =
      normalizeLabel(state.academicYear) === yearKey
        ? (remainingConfigurations[0]?.year ?? '')
        : state.academicYear;

    setState((prev) => {
      const schoolYearConfigurations = prev.schoolYearConfigurations.filter(
        (item) => normalizeLabel(item.year) !== yearKey,
      );
      const classes = prev.classes.filter((item) => !classIds.has(item.id));
      const deletedAssessmentIds = new Set(
        prev.assessments
          .filter((item) => classIds.has(item.classId))
          .map((item) => item.id),
      );
      const assessments = prev.assessments.filter(
        (item) => !deletedAssessmentIds.has(item.id),
      );
      const activeClassId = classes.some(
        (item) => item.id === prev.activeClassId,
      )
        ? prev.activeClassId
        : (classes[0]?.id ?? '');
      const activeAssessmentId = assessments.some(
        (item) => item.id === prev.activeAssessmentId,
      )
        ? prev.activeAssessmentId
        : (assessments.find((item) => item.classId === activeClassId)?.id ??
          assessments[0]?.id ??
          '');

      return {
        ...prev,
        schoolYearConfigurations,
        academicYear: defaultYear,
        archivedAcademicYears: prev.archivedAcademicYears.filter(
          (yearId) => normalizeLabel(yearId) !== yearKey,
        ),
        classes,
        continuousEvaluationPeriods: prev.continuousEvaluationPeriods.filter(
          (period) => normalizeLabel(period.schoolYearId) !== yearKey,
        ),
        activeContinuousEvaluationPeriodByYear: Object.fromEntries(
          Object.entries(prev.activeContinuousEvaluationPeriodByYear).filter(
            ([schoolYearId]) => normalizeLabel(schoolYearId) !== yearKey,
          ),
        ),
        levelTests: prev.levelTests.filter((test) => !classIds.has(test.classId)),
        activeClassId,
        pupils: prev.pupils.filter((item) => !classIds.has(item.classId)),
        assessments,
        activeAssessmentId,
        objectives: Object.fromEntries(
          Object.entries(prev.objectives).filter(
            ([assessmentId]) => !deletedAssessmentIds.has(assessmentId),
          ),
        ),
        evaluations: Object.fromEntries(
          Object.entries(prev.evaluations).filter(
            ([assessmentId]) => !deletedAssessmentIds.has(assessmentId),
          ),
        ),
        remediations: Object.fromEntries(
          Object.entries(prev.remediations).filter(
            ([assessmentId]) => !deletedAssessmentIds.has(assessmentId),
          ),
        ),
        continuousEvaluations: prev.continuousEvaluations.filter(
          (evaluation) => !classIds.has(evaluation.classId),
        ),
        disciplineEvents: prev.disciplineEvents.filter(
          (event) => !classIds.has(event.classId),
        ),
      };
    });
    return { ok: true, classCount, defaultYear };
  };

  const setAcademicYearArchived = (year: string, archived: boolean) => {
    const configuration = getSchoolYearConfiguration(year);
    if (!configuration) return false;
    if (archived && normalizeLabel(state.academicYear) === normalizeLabel(configuration.year)) {
      return false;
    }
    setState((prev) => {
      const archivedYears = prev.archivedAcademicYears.filter(
        (item) => normalizeLabel(item) !== normalizeLabel(configuration.year),
      );
      const previousActiveYear = normalizeLabel(prev.academicYear);
      const nextActiveYear = archived ? prev.academicYear : configuration.year;
      const nextArchivedYears = archived
        ? [...archivedYears, configuration.year]
        : [
            ...archivedYears.filter(
              (item) => normalizeLabel(item) !== normalizeLabel(prev.academicYear),
            ),
            ...(previousActiveYear !== normalizeLabel(configuration.year)
              ? [prev.academicYear]
              : []),
          ];
      const activeYearClass = archived
        ? undefined
        : prev.classes.find(
            (item) => normalizeLabel(item.academicYear) === normalizeLabel(configuration.year),
          );
      return {
        ...prev,
        academicYear: nextActiveYear,
        archivedAcademicYears: nextArchivedYears,
        ...(activeYearClass ? { activeClassId: activeYearClass.id } : {}),
      };
    });
    return true;
  };

  const archiveAndCreateAcademicYear = async (
    sourceYear: string,
    targetYear: string,
    options: {
      copyPedagogicalConfiguration: boolean;
      carryClassesAndPupils: boolean;
      copySchedule: boolean;
    },
  ) => {
    const sourceConfiguration = getSchoolYearConfiguration(sourceYear);
    if (!sourceConfiguration) return { ok: false as const, reason: 'source-not-found' as const };
    if (state.archivedAcademicYears.some(
      (item) => normalizeLabel(item) === normalizeLabel(sourceConfiguration.year),
    )) {
      return { ok: false as const, reason: 'already-archived' as const };
    }
    const cleanTargetYear = targetYear.trim();
    if (!cleanTargetYear || normalizeLabel(cleanTargetYear) === normalizeLabel(sourceConfiguration.year)) {
      return { ok: false as const, reason: 'target-invalid' as const };
    }
    if (state.schoolYearConfigurations.some(
      (item) => normalizeLabel(item.year) === normalizeLabel(cleanTargetYear),
    )) {
      return { ok: false as const, reason: 'target-exists' as const };
    }

    const targetConfiguration = options.copyPedagogicalConfiguration
      ? cloneSchoolYearConfiguration(sourceConfiguration, cleanTargetYear)
      : createDefaultSchoolYearConfiguration(cleanTargetYear);
    const sourceClasses = options.carryClassesAndPupils
      ? state.classes.filter(
          (item) => normalizeLabel(item.academicYear) === normalizeLabel(sourceConfiguration.year),
        )
      : [];
    const classIdMap = new Map<string, string>();
    const copiedClasses: ClassItem[] = sourceClasses.map((item) => {
      const id = createConfigId('class');
      classIdMap.set(item.id, id);
      const targetLevel = targetConfiguration.levels.find(
        (level) => normalizeLabel(level.name) === normalizeLabel(item.level),
      );
      return {
        ...item,
        id,
        academicYear: cleanTargetYear,
        active: true,
        levelId: targetLevel?.id,
      };
    });
    const copiedPupils: Pupil[] = options.carryClassesAndPupils
      ? state.pupils
          .filter((item) => classIdMap.has(item.classId))
          .map((item) => {
            const id = createConfigId('pupil');
            return { ...item, id, classId: classIdMap.get(item.classId)! };
          })
      : [];
    const copiedSessions: ScheduleSession[] = options.copySchedule
      ? state.scheduleSessions.flatMap((session) => {
          const classId = classIdMap.get(session.classId);
          return classId ? [{ ...session, id: createConfigId('schedule'), classId }] : [];
        })
      : [];
    const targetPeriods = createDefaultContinuousEvaluationPeriods(cleanTargetYear);
    const targetPeriodId = targetPeriods[0]?.id;

    await writeAutomaticBackup(state);
    setState((prev) => ({
      ...prev,
      academicYear: cleanTargetYear,
      archivedAcademicYears: Array.from(
        new Map(
          [
            ...prev.archivedAcademicYears,
            prev.academicYear,
            sourceConfiguration.year,
          ]
            .filter((item) => normalizeLabel(item) !== normalizeLabel(cleanTargetYear))
            .map((item) => [normalizeLabel(item), item]),
        ).values(),
      ),
      schoolYearConfigurations: [...prev.schoolYearConfigurations, targetConfiguration],
      continuousEvaluationPeriods: [...prev.continuousEvaluationPeriods, ...targetPeriods],
      activeContinuousEvaluationPeriodByYear: targetPeriodId
        ? { ...prev.activeContinuousEvaluationPeriodByYear, [cleanTargetYear]: targetPeriodId }
        : prev.activeContinuousEvaluationPeriodByYear,
      classes: [...prev.classes, ...copiedClasses],
      pupils: [...prev.pupils, ...copiedPupils],
      scheduleSessions: [...prev.scheduleSessions, ...copiedSessions],
      activeClassId: copiedClasses[0]?.id ??
        (sourceClasses.some((item) => item.id === prev.activeClassId) ? '' : prev.activeClassId),
      activeAssessmentId: sourceClasses.some((item) => item.id ===
        prev.assessments.find((assessment) => assessment.id === prev.activeAssessmentId)?.classId)
        ? ''
        : prev.activeAssessmentId,
    }));
    return {
      ok: true as const,
      classCount: copiedClasses.length,
      pupilCount: copiedPupils.length,
      sessionCount: copiedSessions.length,
    };
  };

  const addSchoolLevel = (year: string, name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return undefined;
    const existingConfiguration = getSchoolYearConfiguration(year);
    const configuration =
      existingConfiguration ??
      createDefaultSchoolYearConfiguration(year.trim());
    const existingLevel = configuration.levels.find(
      (item) => normalizeLabel(item.name) === normalizeLabel(cleanName),
    );
    if (existingLevel) return existingLevel.id;

    const level: SchoolLevel = { id: createConfigId('level'), name: cleanName };
    const updatedConfiguration = {
      ...configuration,
      levels: [...configuration.levels, level],
    };
    setState((prev) => {
      const alreadyExists = prev.schoolYearConfigurations.some(
        (item) => normalizeLabel(item.year) === normalizeLabel(year),
      );
      return {
        ...prev,
        schoolYearConfigurations: alreadyExists
          ? prev.schoolYearConfigurations.map((item) =>
              normalizeLabel(item.year) === normalizeLabel(year)
                ? updatedConfiguration
                : item,
            )
          : [...prev.schoolYearConfigurations, updatedConfiguration],
      };
    });
    return level.id;
  };

  const renameSchoolLevel = (
    year: string,
    levelId: string,
    newName: string,
  ) => {
    const configuration = getSchoolYearConfiguration(year);
    const level = configuration?.levels.find((item) => item.id === levelId);
    const cleanName = newName.trim();
    if (!configuration || !level || !cleanName) return false;
    const duplicate = configuration.levels.some(
      (item) =>
        item.id !== levelId &&
        normalizeLabel(item.name) === normalizeLabel(cleanName),
    );
    if (duplicate) return false;
    if (level.name === cleanName) return true;

    const classIds = new Set(
      state.classes
        .filter(
          (item) =>
            normalizeLabel(item.academicYear) ===
              normalizeLabel(configuration.year) &&
            (item.levelId === levelId ||
              normalizeLabel(item.level) === normalizeLabel(level.name)),
        )
        .map((item) => item.id),
    );
    setState((prev) => ({
      ...prev,
      schoolYearConfigurations: prev.schoolYearConfigurations.map((item) =>
        normalizeLabel(item.year) === normalizeLabel(configuration.year)
          ? {
              ...item,
              levels: item.levels.map((entry) =>
                entry.id === levelId ? { ...entry, name: cleanName } : entry,
              ),
            }
          : item,
      ),
      classes: prev.classes.map((item) =>
        classIds.has(item.id) ? { ...item, level: cleanName } : item,
      ),
      assessments: prev.assessments.map((item) =>
        classIds.has(item.classId) ? { ...item, level: cleanName } : item,
      ),
    }));
    return true;
  };

  const deleteSchoolLevel = (
    year: string,
    levelId: string,
  ): DeleteLevelResult => {
    const configuration = getSchoolYearConfiguration(year);
    const level = configuration?.levels.find((item) => item.id === levelId);
    if (!configuration || !level) {
      return { ok: false, reason: 'not-found', classCount: 0 };
    }
    const classCount = state.classes.filter(
      (item) =>
        normalizeLabel(item.academicYear) ===
          normalizeLabel(configuration.year) &&
        (item.levelId === levelId ||
          normalizeLabel(item.level) === normalizeLabel(level.name)),
    ).length;
    if (classCount) return { ok: false, reason: 'in-use', classCount };

    setState((prev) => ({
      ...prev,
      schoolYearConfigurations: prev.schoolYearConfigurations.map((item) =>
        normalizeLabel(item.year) === normalizeLabel(configuration.year)
          ? {
              ...item,
              levels: item.levels.filter((entry) => entry.id !== levelId),
              associations: item.associations.filter(
                (entry) => entry.levelId !== levelId,
              ),
              objectives: item.objectives.filter(
                (entry) => entry.levelId !== levelId,
              ),
            }
          : item,
      ),
    }));
    return { ok: true, classCount: 0 };
  };

  const addOrAssociateCompetency = (
    year: string,
    levelId: string,
    name: string,
  ) => {
    const cleanName = name.trim();
    if (!cleanName) return undefined;
    const existingConfiguration = getSchoolYearConfiguration(year);
    const configuration =
      existingConfiguration ??
      createDefaultSchoolYearConfiguration(year.trim());
    if (!configuration.levels.some((item) => item.id === levelId))
      return undefined;

    const template = COMPETENCY_TEMPLATES.find(
      (item) => normalizeLabel(item.name) === normalizeLabel(cleanName),
    );
    const existingCompetency = configuration.competencies.find(
      (item) => normalizeLabel(item.name) === normalizeLabel(cleanName),
    );
    const competency: SchoolCompetency = existingCompetency ?? {
      id: template?.id ?? createConfigId('competency'),
      name: cleanName,
      ...(template ? { templateId: template.id } : {}),
    };
    const linked = configuration.associations.some(
      (item) => item.levelId === levelId && item.competencyId === competency.id,
    );
    const hasObjectives = configuration.objectives.some(
      (item) => item.levelId === levelId && item.competencyId === competency.id,
    );
    const defaultObjectives = template?.defaultObjectives ?? ['Objectif 1'];
    const updatedConfiguration: SchoolYearConfiguration = {
      ...configuration,
      competencies: existingCompetency
        ? configuration.competencies
        : [...configuration.competencies, competency],
      associations: linked
        ? configuration.associations
        : [
            ...configuration.associations,
            { levelId, competencyId: competency.id },
          ],
      objectives: hasObjectives
        ? configuration.objectives
        : [
            ...configuration.objectives,
            ...defaultObjectives.map((description, index) => ({
              id: createConfigId('objective'),
              levelId,
              competencyId: competency.id,
              order: index + 1,
              description,
            })),
          ],
    };
    setState((prev) => {
      const alreadyExists = prev.schoolYearConfigurations.some(
        (item) => normalizeLabel(item.year) === normalizeLabel(year),
      );
      return {
        ...prev,
        schoolYearConfigurations: alreadyExists
          ? prev.schoolYearConfigurations.map((item) =>
              normalizeLabel(item.year) === normalizeLabel(year)
                ? updatedConfiguration
                : item,
            )
          : [...prev.schoolYearConfigurations, updatedConfiguration],
      };
    });
    return competency.id;
  };

  const setCompetencyAssociation = (
    year: string,
    levelId: string,
    competencyId: string,
    associated: boolean,
  ) => {
    const configuration = getSchoolYearConfiguration(year);
    if (
      !configuration ||
      !configuration.levels.some((item) => item.id === levelId) ||
      !configuration.competencies.some((item) => item.id === competencyId)
    )
      return;
    const linked = configuration.associations.some(
      (item) => item.levelId === levelId && item.competencyId === competencyId,
    );
    if (linked === associated) return;

    const competency = configuration.competencies.find(
      (item) => item.id === competencyId,
    )!;
    const template = COMPETENCY_TEMPLATES.find(
      (item) =>
        item.id === competency.templateId ||
        normalizeLabel(item.name) === normalizeLabel(competency.name),
    );
    const existingObjectives = configuration.objectives.some(
      (item) => item.levelId === levelId && item.competencyId === competencyId,
    );
    const defaultObjectives = template?.defaultObjectives ?? ['Objectif 1'];
    const updatedConfiguration: SchoolYearConfiguration = {
      ...configuration,
      associations: associated
        ? [...configuration.associations, { levelId, competencyId }]
        : configuration.associations.filter(
            (item) =>
              !(item.levelId === levelId && item.competencyId === competencyId),
          ),
      objectives:
        associated && !existingObjectives
          ? [
              ...configuration.objectives,
              ...defaultObjectives.map((description, index) => ({
                id: createConfigId('objective'),
                levelId,
                competencyId,
                order: index + 1,
                description,
              })),
            ]
          : configuration.objectives,
    };
    setState((prev) => ({
      ...prev,
      schoolYearConfigurations: prev.schoolYearConfigurations.map((item) =>
        normalizeLabel(item.year) === normalizeLabel(year)
          ? updatedConfiguration
          : item,
      ),
    }));
  };

  const setConfiguredObjectives = (
    year: string,
    levelId: string,
    competencyId: string,
    descriptions: string[],
  ) => {
    const configuration = getSchoolYearConfiguration(year);
    if (
      !configuration ||
      !configuration.associations.some(
        (item) =>
          item.levelId === levelId && item.competencyId === competencyId,
      )
    )
      return;
    const pairObjectives = descriptions
      .map((description) => description.trim())
      .filter(Boolean);
    const updatedConfiguration: SchoolYearConfiguration = {
      ...configuration,
      objectives: [
        ...configuration.objectives.filter(
          (item) =>
            !(item.levelId === levelId && item.competencyId === competencyId),
        ),
        ...pairObjectives.map((description, index) => ({
          id: createConfigId('objective'),
          levelId,
          competencyId,
          order: index + 1,
          description,
        })),
      ],
    };
    setState((prev) => ({
      ...prev,
      schoolYearConfigurations: prev.schoolYearConfigurations.map((item) =>
        normalizeLabel(item.year) === normalizeLabel(year)
          ? updatedConfiguration
          : item,
      ),
    }));
  };

  const getBackupState = () => state;
  const restoreBackupState = async (backup: unknown) => {
    if (!backup || typeof backup !== 'object') throw new Error('Fichier de sauvegarde invalide.');
    const candidate = backup as Partial<AppState>;
    if (!candidate.school || !Array.isArray(candidate.classes) || !Array.isArray(candidate.pupils) || !Array.isArray(candidate.assessments)) {
      throw new Error('Cette sauvegarde ne correspond pas à une sauvegarde Évaluation Élève.');
    }
    const restoredClasses = candidate.classes;
    const restoredPupils = candidate.pupils;
    const migratedLevelTests = migrateLevelTests(
      restoredClasses,
      candidate.assessments.map((assessment) => ({ ...assessment })),
      candidate.levelTests,
    );
    const restoredAcademicYear = typeof candidate.academicYear === 'string'
      ? candidate.academicYear
      : '2026-2027';
    const continuousEvaluationPeriods = initializeContinuousEvaluationPeriods(
      [...new Set([restoredAcademicYear, ...restoredClasses.map((item) => item.academicYear)])],
      candidate.continuousEvaluationPeriods,
    );
    const periodByYear = new Map<string, string>();
    for (const period of [...continuousEvaluationPeriods].sort(
      (left, right) => left.startDate.localeCompare(right.startDate),
    )) {
      if (!periodByYear.has(period.schoolYearId)) {
        periodByYear.set(period.schoolYearId, period.id);
      }
    }
    const continuousEvaluations = Array.isArray(candidate.continuousEvaluations)
      ? candidate.continuousEvaluations
          .filter(isContinuousEvaluationRecord)
          .filter((evaluation) =>
            restoredClasses.some((classItem) =>
              classItem.id === evaluation.classId &&
              classItem.academicYear === evaluation.schoolYearId &&
              restoredPupils.some((pupil) =>
                pupil.id === evaluation.pupilId &&
                pupil.classId === evaluation.classId,
              ),
            ),
          )
          .map((evaluation) => ({
            ...evaluation,
            evaluationPeriodId:
              (evaluation.evaluationPeriodId &&
              continuousEvaluationPeriods.some(
                (period) =>
                  period.id === evaluation.evaluationPeriodId &&
                  period.schoolYearId === evaluation.schoolYearId,
              )
                ? evaluation.evaluationPeriodId
                : periodByYear.get(evaluation.schoolYearId)),
          }))
      : [];
    const evaluationIds = new Set(continuousEvaluations.map((item) => item.id));
    const validPeriodIds = new Set(continuousEvaluationPeriods.map((item) => item.id));
    const activeContinuousEvaluationPeriodByYear = Object.fromEntries(
      Object.entries(candidate.activeContinuousEvaluationPeriodByYear ?? {}).filter(
        ([schoolYearId, periodId]) =>
          typeof periodId === 'string' &&
          validPeriodIds.has(periodId) &&
          continuousEvaluationPeriods.some(
            (period) => period.id === periodId && period.schoolYearId === schoolYearId,
          ),
      ),
    );
    const restored: AppState = {
      ...createEmptyState(),
      ...candidate,
      school: { ...createEmptyState().school, ...candidate.school },
      teacherName: typeof candidate.teacherName === 'string' ? candidate.teacherName : '',
      interfaceMode: candidate.interfaceMode === 'daily' ? 'daily' : 'full',
      academicYear: restoredAcademicYear,
      schoolYearConfigurations: Array.isArray(candidate.schoolYearConfigurations)
        ? candidate.schoolYearConfigurations
        : createEmptyState().schoolYearConfigurations,
      classes: candidate.classes,
      pupils: restoredPupils,
      assessments: migratedLevelTests.assessments,
      levelTests: migratedLevelTests.levelTests,
      objectives: candidate.objectives ?? {},
      evaluations: candidate.evaluations ?? {},
      absentPupilIds: candidate.absentPupilIds ?? {},
      remediations: candidate.remediations ?? {},
      activeClassId: typeof candidate.activeClassId === 'string' ? candidate.activeClassId : '',
      activeAssessmentId: typeof candidate.activeAssessmentId === 'string' ? candidate.activeAssessmentId : '',
      scheduleSessions: Array.isArray(candidate.scheduleSessions)
        ? candidate.scheduleSessions.filter(isScheduleSession).filter((session) => restoredClasses.some((classItem) => classItem.id === session.classId))
        : [],
      scheduleOccurrenceOverrides: Array.isArray(candidate.scheduleOccurrenceOverrides)
        ? candidate.scheduleOccurrenceOverrides
            .filter(isScheduleOccurrenceOverride)
            .filter((occurrence) =>
              restoredClasses.some((classItem) => classItem.id === occurrence.classId) &&
              (occurrence.status === 'extra' ||
                candidate.scheduleSessions?.some(
                  (session) =>
                    isScheduleSession(session) &&
                    session.id === occurrence.sourceSessionId,
                )),
            )
        : [],
      attendanceRecords: Array.isArray(candidate.attendanceRecords)
        ? candidate.attendanceRecords.filter(isAttendanceRecord).filter((record) => restoredClasses.some((classItem) => classItem.id === record.classId))
        : [],
      continuousEvaluations,
      continuousEvaluationPeriods,
      activeContinuousEvaluationPeriodByYear,
      disciplineEvents: Array.isArray(candidate.disciplineEvents)
        ? candidate.disciplineEvents
            .filter(isDisciplineEvent)
            .filter((event) => {
              const evaluation = continuousEvaluations.find(
                (item) => item.id === event.evaluationId,
              );
              return evaluationIds.has(event.evaluationId) &&
                evaluation?.pupilId === event.studentId &&
                evaluation.classId === event.classId &&
                evaluation.schoolYearId === event.schoolYearId;
            })
        : [],
      continuousEvaluationSettings: {
        absencePenaltyPerAbsence: isValidManualScore(
          candidate.continuousEvaluationSettings?.absencePenaltyPerAbsence ?? Number.NaN,
        )
          ? candidate.continuousEvaluationSettings!.absencePenaltyPerAbsence
          : DEFAULT_ABSENCE_SCORING_CONFIGURATION.penaltyPerAbsence,
        disciplinePenalty: isValidManualScore(
          candidate.continuousEvaluationSettings?.disciplinePenalty ?? Number.NaN,
        ) && candidate.continuousEvaluationSettings!.disciplinePenalty > 0
          ? candidate.continuousEvaluationSettings!.disciplinePenalty
          : DEFAULT_DISCIPLINE_PENALTY,
      },
    };
    setState(restored);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
  };
  const resetAllData = async () => {
    void writeAutomaticBackup(state);
    const empty = createEmptyState();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
    setState(empty);
  };
  const generateTestData = async () => {
    void writeAutomaticBackup(state);
    const academicYear = state.academicYear.trim() || '2026-2027';
    const currentConfiguration = state.schoolYearConfigurations.find(
      (item) => normalizeLabel(item.year) === normalizeLabel(academicYear),
    );
    const defaultConfiguration = createDefaultSchoolYearConfiguration(academicYear);
    const configuration = currentConfiguration ?? defaultConfiguration;
    const levels = configuration.levels.length
      ? configuration.levels
      : defaultConfiguration.levels;
    const savedConfiguration = configuration.levels.length
      ? configuration
      : { ...configuration, levels };
    const classLevels = [
      levels[0],
      levels[0],
      levels[Math.min(1, levels.length - 1)],
      levels[Math.min(1, levels.length - 1)],
      levels[Math.min(2, levels.length - 1)],
    ];
    const classDefinitions = [
      ...classLevels.map((level, index) => ({
        name: `Test ${level.name}-${String.fromCharCode(65 + index)}`,
        level,
      })),
    ];
    const classes: ClassItem[] = classDefinitions.map((definition) => ({
      id: createConfigId('demo-class'),
      name: definition.name,
      level: definition.level.name,
      levelId: definition.level.id,
      academicYear,
      active: true,
    }));
    const firstNames = [
      'Amine', 'Yasmine', 'Mohamed', 'Lina', 'Yacine', 'Ines', 'Rayan', 'Meriem',
      'Sofiane', 'Nour', 'Ilyes', 'Aya', 'Anis', 'Sarah', 'Mehdi', 'Lyna',
      'Khalil', 'Maya', 'Ismail', 'Nesrine',
    ];
    const lastNames = [
      'Bensaid', 'Mansouri', 'Bouzid', 'Khelifi', 'Saidi', 'Cherif', 'Hamidi',
      'Belkacem', 'Amrani', 'Brahimi', 'Mokrani', 'Zerrouki', 'Haddad', 'Ferhat',
      'Benali', 'Ait Ali', 'Kaci', 'Rahmani', 'Dahmani', 'Toumi',
    ];
    const pupilCounts = [32, 34, 36, 38, 40];
    const pupils: Pupil[] = classes.flatMap((classItem, classIndex) =>
      Array.from({ length: pupilCounts[classIndex] }, (_, index) => ({
        id: createConfigId('demo-pupil'),
        registrationNumber: String(index + 1).padStart(2, '0'),
        firstName: firstNames[(index + classIndex * 3) % firstNames.length],
        lastName: lastNames[(index * 7 + classIndex * 5) % lastNames.length],
        classId: classItem.id,
      })),
    );
    const lessons: Array<{ dayOfWeek: number; classIndex: number; startTime: string; endTime: string }> = [
      { dayOfWeek: 0, classIndex: 0, startTime: '08:00', endTime: '10:00' },
      { dayOfWeek: 0, classIndex: 1, startTime: '13:00', endTime: '14:00' },
      { dayOfWeek: 1, classIndex: 1, startTime: '09:00', endTime: '11:00' },
      { dayOfWeek: 1, classIndex: 2, startTime: '14:00', endTime: '15:00' },
      { dayOfWeek: 2, classIndex: 2, startTime: '08:00', endTime: '10:00' },
      { dayOfWeek: 2, classIndex: 3, startTime: '13:00', endTime: '14:00' },
      { dayOfWeek: 3, classIndex: 3, startTime: '09:00', endTime: '11:00' },
      { dayOfWeek: 3, classIndex: 4, startTime: '14:00', endTime: '15:00' },
      { dayOfWeek: 4, classIndex: 4, startTime: '09:00', endTime: '11:00' },
    ];
    const scheduleSessions: ScheduleSession[] = lessons.map((lesson) => ({
      id: createConfigId('demo-schedule'),
      dayOfWeek: lesson.dayOfWeek,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      classId: classes[lesson.classIndex].id,
      subject: 'Français',
      room: 'Salle de classe',
    }));
    const base = createEmptyState();
    const nextState: AppState = {
      ...base,
      school: state.school,
      teacherName: state.teacherName,
      interfaceMode: state.interfaceMode,
      academicYear,
      archivedAcademicYears: state.archivedAcademicYears,
      schoolYearConfigurations: currentConfiguration
        ? state.schoolYearConfigurations.map((item) =>
            normalizeLabel(item.year) === normalizeLabel(academicYear)
              ? savedConfiguration
              : item,
          )
        : [...state.schoolYearConfigurations, configuration],
      continuousEvaluationPeriods: [
        ...state.continuousEvaluationPeriods.filter(
          (period) => period.schoolYearId !== academicYear,
        ),
        ...(state.continuousEvaluationPeriods.some(
          (period) => period.schoolYearId === academicYear,
        )
          ? state.continuousEvaluationPeriods.filter(
              (period) => period.schoolYearId === academicYear,
            )
          : createDefaultContinuousEvaluationPeriods(academicYear)),
      ],
      activeContinuousEvaluationPeriodByYear: state.activeContinuousEvaluationPeriodByYear,
      continuousEvaluationSettings: state.continuousEvaluationSettings,
      classes,
      pupils,
      scheduleSessions,
      activeClassId: classes[0]?.id ?? '',
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    setState(nextState);
    return { classCount: classes.length, pupilCount: pupils.length, weeklyHours: 14 };
  };

  const deleteClass = (classId: string) => {
    setState((prev) => {
      const remainingClasses = prev.classes.filter((c) => c.id !== classId);
      const nextActiveClassId = remainingClasses[0]?.id ?? '';

      // Cascade delete pupils belonging to this class
      const remainingPupils = prev.pupils.filter((p) => p.classId !== classId);

      // Find assessments belonging to this class
      const deletedAssessmentIds = new Set(
        prev.assessments.filter((a) => a.classId === classId).map((a) => a.id),
      );
      const remainingAssessments = prev.assessments.filter(
        (a) => a.classId !== classId,
      );

      // Cascade delete objectives, evaluations, remediations for those assessments
      const nextObjectives = { ...prev.objectives };
      const nextEvaluations = { ...prev.evaluations };
      const nextRemediations = { ...prev.remediations };
      const nextAbsences = { ...prev.absentPupilIds };

      deletedAssessmentIds.forEach((id) => {
        delete nextObjectives[id];
        delete nextEvaluations[id];
        delete nextRemediations[id];
        delete nextAbsences[id];
      });

      // Determine next active assessment
      let nextActiveAssessmentId = prev.activeAssessmentId;
      if (
        deletedAssessmentIds.has(prev.activeAssessmentId) ||
        !nextActiveAssessmentId
      ) {
        const remainingForNextClass = remainingAssessments.filter(
          (a) => a.classId === nextActiveClassId,
        );
        nextActiveAssessmentId =
          remainingForNextClass[0]?.id ?? remainingAssessments[0]?.id ?? '';
      }

      return {
        ...prev,
        classes: remainingClasses,
        scheduleSessions: prev.scheduleSessions.filter((session) => session.classId !== classId),
        scheduleOccurrenceOverrides: prev.scheduleOccurrenceOverrides.filter(
          (occurrence) =>
            (!occurrence.sourceSessionId ||
              prev.scheduleSessions.some(
                (session) =>
                  session.id === occurrence.sourceSessionId &&
                  session.classId !== classId,
              )) &&
            occurrence.classId !== classId,
        ),
        activeClassId: nextActiveClassId,
        pupils: remainingPupils,
        assessments: remainingAssessments,
        activeAssessmentId: nextActiveAssessmentId,
        objectives: nextObjectives,
        evaluations: nextEvaluations,
        remediations: nextRemediations,
        absentPupilIds: nextAbsences,
        attendanceRecords: prev.attendanceRecords.filter((record) => record.classId !== classId),
        continuousEvaluations: prev.continuousEvaluations.filter((evaluation) => evaluation.classId !== classId),
        disciplineEvents: prev.disciplineEvents.filter((event) => event.classId !== classId),
        levelTests: prev.levelTests.filter((test) => test.classId !== classId),
      };
    });
  };

  // PUPIL ACTIONS
  const getPupilsForClass = (classId: string) => {
    return state.pupils.filter((p) => p.classId === classId);
  };

  const getAttendanceRecord = (
    classId: string,
    sessionId: string | undefined,
    date: string,
  ) => state.attendanceRecords.find((record) =>
    record.classId === classId &&
    (record.sessionId ?? '') === (sessionId ?? '') &&
    record.date === date,
  );

  const getAttendanceRecordsForClass = (classId: string) =>
    state.attendanceRecords.filter((record) => record.classId === classId);

  const saveAttendanceRecord = (record: Omit<AttendanceRecord, 'id'>) => {
    const classPupils = state.pupils.filter((pupil) => pupil.classId === record.classId);
    const [year, month, day] = record.date.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    const scheduledSession = record.sessionId
      ? getScheduleOccurrencesForDate(
          state.scheduleSessions,
          state.scheduleOccurrenceOverrides,
          record.date,
        ).find(
          (session) =>
            session.id === record.sessionId &&
            session.classId === record.classId,
        )
      : undefined;
    const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
      parsedDate.getFullYear() === year &&
      parsedDate.getMonth() === month - 1 &&
      parsedDate.getDate() === day;
    if (
      !state.classes.some((classItem) => classItem.id === record.classId) ||
      !hasValidDate ||
      !scheduledSession ||
      classPupils.length === 0 ||
      classPupils.some((pupil) => record.statuses[pupil.id] !== 'present' && record.statuses[pupil.id] !== 'absent')
    ) {
      return false;
    }
    const id = `${record.classId}::${record.sessionId ?? 'manual'}::${record.date}`;
    setState((prev) => ({
      ...prev,
      attendanceRecords: [
        ...prev.attendanceRecords.filter((item) =>
          !(item.classId === record.classId &&
            (item.sessionId ?? '') === (record.sessionId ?? '') &&
            item.date === record.date),
        ),
        { ...record, id },
      ],
    }));
    return true;
  };

  const getContinuousEvaluation = (
    pupilId: string,
    classId: string,
    schoolYearId: string,
    evaluationPeriodId?: string,
  ) => state.continuousEvaluations.find((evaluation) =>
    evaluation.pupilId === pupilId &&
    evaluation.classId === classId &&
    evaluation.schoolYearId === schoolYearId &&
    (evaluation.evaluationPeriodId ?? '') === (evaluationPeriodId ?? ''),
  );

  const getContinuousEvaluationPeriods = (schoolYearId: string) =>
    state.continuousEvaluationPeriods
      .filter((period) => period.schoolYearId === schoolYearId)
      .sort((left, right) => left.startDate.localeCompare(right.startDate));

  const getActiveContinuousEvaluationPeriod = (schoolYearId: string) => {
    const periods = getContinuousEvaluationPeriods(schoolYearId);
    const selectedId = state.activeContinuousEvaluationPeriodByYear[schoolYearId];
    return periods.find((period) => period.id === selectedId) ?? periods[0];
  };

  const setActiveContinuousEvaluationPeriod = (schoolYearId: string, periodId: string) => {
    if (!state.continuousEvaluationPeriods.some(
      (period) => period.id === periodId && period.schoolYearId === schoolYearId,
    )) return false;
    setState((prev) => ({
      ...prev,
      activeContinuousEvaluationPeriodByYear: {
        ...prev.activeContinuousEvaluationPeriodByYear,
        [schoolYearId]: periodId,
      },
    }));
    return true;
  };

  const addContinuousEvaluationPeriod = (
    schoolYearId: string,
    name: string,
    startDate: string,
    endDate: string,
  ) => {
    const cleanName = name.trim();
    if (
      !schoolYearId.trim() ||
      !cleanName ||
      !isValidDateString(startDate) ||
      !isValidDateString(endDate) ||
      startDate > endDate ||
      state.continuousEvaluationPeriods.some(
        (period) =>
          period.schoolYearId === schoolYearId &&
          startDate <= period.endDate &&
          period.startDate <= endDate,
      )
    ) return undefined;
    const period: ContinuousEvaluationPeriod = {
      id: createConfigId('continuous-period'),
      schoolYearId,
      name: cleanName,
      startDate,
      endDate,
    };
    setState((prev) => ({
      ...prev,
      continuousEvaluationPeriods: [...prev.continuousEvaluationPeriods, period],
      activeContinuousEvaluationPeriodByYear: prev.activeContinuousEvaluationPeriodByYear[schoolYearId]
        ? prev.activeContinuousEvaluationPeriodByYear
        : { ...prev.activeContinuousEvaluationPeriodByYear, [schoolYearId]: period.id },
    }));
    return period.id;
  };

  const updateContinuousEvaluationPeriod = (
    periodId: string,
    name: string,
    startDate: string,
    endDate: string,
  ) => {
    const existing = state.continuousEvaluationPeriods.find((period) => period.id === periodId);
    const cleanName = name.trim();
    if (
      !existing ||
      !cleanName ||
      !isValidDateString(startDate) ||
      !isValidDateString(endDate) ||
      startDate > endDate ||
      state.continuousEvaluationPeriods.some(
        (period) =>
          period.id !== periodId &&
          period.schoolYearId === existing.schoolYearId &&
          startDate <= period.endDate &&
          period.startDate <= endDate,
      )
    ) return false;
    setState((prev) => ({
      ...prev,
      continuousEvaluationPeriods: prev.continuousEvaluationPeriods.map((period) =>
        period.id === periodId
          ? { ...period, name: cleanName, startDate, endDate }
          : period,
      ),
    }));
    return true;
  };

  const deleteContinuousEvaluationPeriod = (periodId: string) => {
    const period = state.continuousEvaluationPeriods.find((item) => item.id === periodId);
    if (
      !period ||
      state.continuousEvaluations.some((evaluation) => evaluation.evaluationPeriodId === periodId)
    ) return false;
    setState((prev) => {
      const periods = prev.continuousEvaluationPeriods.filter((item) => item.id !== periodId);
      const activePeriods = { ...prev.activeContinuousEvaluationPeriodByYear };
      if (activePeriods[period.schoolYearId] === periodId) {
        const replacement = periods
          .filter((item) => item.schoolYearId === period.schoolYearId)
          .sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
        if (replacement) activePeriods[period.schoolYearId] = replacement.id;
        else delete activePeriods[period.schoolYearId];
      }
      return {
        ...prev,
        continuousEvaluationPeriods: periods,
        activeContinuousEvaluationPeriodByYear: activePeriods,
      };
    });
    return true;
  };

  const setContinuousEvaluationScore = (
    pupilId: string,
    classId: string,
    schoolYearId: string,
    field: 'cahierScore' | 'participationScore',
    score: number,
    evaluationPeriodId?: string,
  ) => {
    const classItem = state.classes.find((item) => item.id === classId);
    if (
      !isValidManualScore(score) ||
      !classItem ||
      classItem.academicYear !== schoolYearId ||
      !state.pupils.some((pupil) => pupil.id === pupilId && pupil.classId === classId)
    ) {
      return false;
    }
    const now = new Date().toISOString();
    const newId = createConfigId('continuous-evaluation');
    setState((prev) => {
      const existing = prev.continuousEvaluations.find((evaluation) =>
        evaluation.pupilId === pupilId &&
        evaluation.classId === classId &&
        evaluation.schoolYearId === schoolYearId &&
        (evaluation.evaluationPeriodId ?? '') === (evaluationPeriodId ?? ''),
      );
      const updated: ContinuousEvaluationRecord = existing
        ? { ...existing, [field]: normalizeScore(score), updatedAt: now }
        : {
            id: newId,
            pupilId,
            classId,
            schoolYearId,
            evaluationPeriodId,
            cahierScore: field === 'cahierScore' ? normalizeScore(score) : undefined,
            participationScore: field === 'participationScore' ? normalizeScore(score) : undefined,
            createdAt: now,
            updatedAt: now,
          };
      return {
        ...prev,
        continuousEvaluations: existing
          ? prev.continuousEvaluations.map((evaluation) =>
              evaluation.id === existing.id ? updated : evaluation,
            )
          : [...prev.continuousEvaluations, updated],
      };
    });
    return true;
  };

  const getDisciplineEventsForEvaluation = (evaluationId: string) =>
    state.disciplineEvents
      .filter((event) => event.evaluationId === evaluationId)
      .sort((left, right) => right.date.localeCompare(left.date));

  const addDisciplinePenalty = (
    pupilId: string,
    classId: string,
    schoolYearId: string,
    comment?: string,
    evaluationPeriodId?: string,
  ) => {
    const classItem = state.classes.find((item) => item.id === classId);
    const pupilExists = state.pupils.some(
      (pupil) => pupil.id === pupilId && pupil.classId === classId,
    );
    const penalty = state.continuousEvaluationSettings.disciplinePenalty;
    if (
      !classItem ||
      classItem.academicYear !== schoolYearId ||
      !pupilExists ||
      !Number.isFinite(penalty) ||
      penalty <= 0 ||
      penalty > 5
    ) {
      return undefined;
    }
    const eventDate = new Date();
    const now = eventDate.toISOString();
    const evaluationId = getContinuousEvaluation(
      pupilId,
      classId,
      schoolYearId,
      evaluationPeriodId,
    )?.id ?? createConfigId('continuous-evaluation');
    const event: DisciplineEvent = {
      id: createConfigId('discipline-event'),
      studentId: pupilId,
      classId,
      schoolYearId,
      evaluationId,
      date: `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`,
      type: 'MINUS',
      penalty: normalizeScore(penalty),
      comment: comment?.trim() || undefined,
      createdAt: now,
    };
    setState((prev) => {
      const existing = prev.continuousEvaluations.find((evaluation) =>
        evaluation.pupilId === pupilId &&
        evaluation.classId === classId &&
        evaluation.schoolYearId === schoolYearId &&
        (evaluation.evaluationPeriodId ?? '') === (evaluationPeriodId ?? ''),
      );
      const evaluation: ContinuousEvaluationRecord = existing ?? {
        id: evaluationId,
        pupilId,
        classId,
        schoolYearId,
        evaluationPeriodId,
        cahierScore: undefined,
        participationScore: undefined,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...prev,
        continuousEvaluations: existing
          ? prev.continuousEvaluations.map((item) =>
              item.id === existing.id ? { ...item, updatedAt: now } : item,
            )
          : [...prev.continuousEvaluations, evaluation],
        disciplineEvents: [
          ...prev.disciplineEvents,
          { ...event, evaluationId: evaluation.id },
        ],
      };
    });
    return event.id;
  };

  const deleteDisciplineEvent = (eventId: string) => {
    if (!state.disciplineEvents.some((event) => event.id === eventId)) return false;
    setState((prev) => ({
      ...prev,
      disciplineEvents: prev.disciplineEvents.filter((event) => event.id !== eventId),
    }));
    return true;
  };

  const updateContinuousEvaluationSettings = (
    settings: Partial<ContinuousEvaluationSettings>,
  ) => {
    const next = {
      ...state.continuousEvaluationSettings,
      ...settings,
    };
    if (
      !Number.isFinite(next.absencePenaltyPerAbsence) ||
      next.absencePenaltyPerAbsence < 0 ||
      next.absencePenaltyPerAbsence > 5 ||
      !Number.isFinite(next.disciplinePenalty) ||
      next.disciplinePenalty <= 0 ||
      next.disciplinePenalty > 5
    ) {
      return false;
    }
    setState((prev) => ({
      ...prev,
      continuousEvaluationSettings: next,
    }));
    return true;
  };

  const addPupils = (
    incoming: Array<
      Pick<
        Pupil,
        'registrationNumber' | 'firstName' | 'lastName' | 'dateOfBirth'
      >
    >,
    targetClassId?: string,
  ) => {
    const classId = targetClassId ?? state.activeClassId;
    let imported = 0;
    let skipped = 0;
    const existing = new Set(
      state.pupils
        .filter((p) => p.classId === classId)
        .map((p) => p.registrationNumber.trim().toLowerCase()),
    );
    const additions: Pupil[] = [];

    incoming.forEach((pupil, index) => {
      let regNo = pupil.registrationNumber
        ? pupil.registrationNumber.trim()
        : '';
      if (!pupil.firstName.trim() || !pupil.lastName.trim()) {
        skipped += 1;
        return;
      }
      if (regNo && existing.has(regNo.toLowerCase())) {
        skipped += 1;
        return;
      }
      if (!regNo) {
        let candidate = existing.size + 1;
        while (
          existing.has(String(candidate).padStart(2, '0').toLowerCase()) ||
          existing.has(String(candidate).toLowerCase())
        ) {
          candidate++;
        }
        regNo = String(candidate).padStart(2, '0');
      }
      existing.add(regNo.toLowerCase());
      additions.push({
        ...pupil,
        id: `pupil-${Date.now()}-${index}`,
        registrationNumber: regNo,
        firstName: pupil.firstName.trim(),
        lastName: pupil.lastName.trim(),
        classId,
      });
      imported += 1;
    });

    if (additions.length) {
      setState((prev) => ({ ...prev, pupils: [...prev.pupils, ...additions] }));
    }
    return { imported, skipped };
  };

  const deletePupil = (pupilId: string) => {
    setState((prev) => ({
      ...prev,
      pupils: prev.pupils.filter((p) => p.id !== pupilId),
      continuousEvaluations: prev.continuousEvaluations.filter(
        (evaluation) => evaluation.pupilId !== pupilId,
      ),
      disciplineEvents: prev.disciplineEvents.filter(
        (event) => event.studentId !== pupilId,
      ),
    }));
  };

  const updatePupilName = (
    pupilId: string,
    firstName: string,
    lastName: string,
  ) => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    if (
      !cleanFirstName ||
      !cleanLastName ||
      !state.pupils.some((pupil) => pupil.id === pupilId)
    ) {
      return false;
    }
    setState((prev) => ({
      ...prev,
      pupils: prev.pupils.map((pupil) =>
        pupil.id === pupilId
          ? { ...pupil, firstName: cleanFirstName, lastName: cleanLastName }
          : pupil,
      ),
    }));
    return true;
  };

  // ASSESSMENT / COMPETENCY ACTIONS
  const getAssessment = (assessmentId: string) => {
    return state.assessments.find((a) => a.id === assessmentId);
  };

  const getAssessmentsForClass = (classId: string) => {
    return state.assessments.filter((a) => a.classId === classId);
  };

  const getLevelTestForClassYear = (classId: string, schoolYearId: string) =>
    state.levelTests.find(
      (test) =>
        test.classId === classId &&
        test.schoolYearId === schoolYearId,
    );

  const createAssessment = (input: {
    classId: string;
    competency: string;
    competencyId?: string;
    title: string;
    subject?: string;
    level?: string;
    support?: string;
    sessionObjectives?: string;
    date?: string;
    objectives?: string[];
  }) => {
    const targetClass =
      state.classes.find((c) => c.id === input.classId);
    if (!targetClass) return undefined;
    const configuration = getSchoolYearConfiguration(targetClass.academicYear);
    const levelId = getLevelIdForYear(
      targetClass.academicYear,
      targetClass.levelId,
      targetClass.level,
    );
    const competency =
      (input.competencyId &&
        configuration?.competencies.find(
          (item) => item.id === input.competencyId,
        )) ||
      configuration?.competencies.find(
        (item) =>
          normalizeLabel(item.name) === normalizeLabel(input.competency),
      );
    const competencyId = input.competencyId ?? competency?.id;
    const duplicateExists = state.assessments.some((assessment) =>
      assessment.classId === input.classId &&
      ((competencyId && assessment.competencyId === competencyId) ||
        normalizeLabel(assessment.competency) === normalizeLabel(input.competency)),
    );
    if (duplicateExists) return undefined;

    const newAssessmentId = createConfigId('assessment');
    const existingLevelTest = getLevelTestForClassYear(
      targetClass.id,
      targetClass.academicYear,
    );
    const levelTestId = existingLevelTest?.id ?? createConfigId('level-test');

    const newAssessment: Assessment = {
      id: newAssessmentId,
      classId: input.classId,
      levelTestId,
      title: input.title.trim(),
      date: input.date ?? new Date().toLocaleDateString('fr-FR'),
      subject: input.subject ?? 'Français',
      level: input.level ?? targetClass.level,
      competency: input.competency.trim(),
      ...(competencyId ? { competencyId } : {}),
      support: input.support ?? '',
      sessionObjectives: input.sessionObjectives ?? '',
      status: 'Draft',
    };

    // Determine objectives
    let objectiveTexts = input.objectives;
    if (!objectiveTexts || objectiveTexts.length === 0) {
      const configured =
        competencyId && levelId
          ? getObjectivesForPair(configuration, levelId, competencyId).map(
              (item) => item.description,
            )
          : [];
      const matched = COMPETENCY_TEMPLATES.find(
        (item) =>
          item.id === competency?.templateId ||
          normalizeLabel(item.name) === normalizeLabel(input.competency),
      );
      objectiveTexts = configured.length
        ? configured
        : (matched?.defaultObjectives ?? ['Objectif 1']);
    }

    const createdObjectives: Objective[] = objectiveTexts.map((desc, idx) => ({
      id: `obj-${newAssessmentId}-${idx + 1}`,
      assessmentId: newAssessmentId,
      order: idx + 1,
      description: desc,
    }));

    setState((prev) => ({
      ...prev,
      levelTests: existingLevelTest
        ? prev.levelTests
        : [
            ...prev.levelTests,
            {
              id: levelTestId,
              classId: targetClass.id,
              schoolYearId: targetClass.academicYear,
              createdAt: new Date().toISOString(),
            },
          ],
      assessments: [...prev.assessments, newAssessment],
      activeAssessmentId: newAssessmentId,
      objectives: {
        ...prev.objectives,
        [newAssessmentId]: createdObjectives,
      },
      evaluations: {
        ...prev.evaluations,
        [newAssessmentId]: {},
      },
      remediations: {
        ...prev.remediations,
        [newAssessmentId]: { individual: '', classroom: '' },
      },
    }));
    return newAssessmentId;
  };

  const setActiveAssessment = (assessmentId: string) => {
    const assessment = state.assessments.find((a) => a.id === assessmentId);
    if (!assessment) return;
    setState((prev) => ({
      ...prev,
      activeAssessmentId: assessmentId,
      activeClassId: assessment.classId,
    }));
  };

  const deleteAssessment = (assessmentId: string) => {
    setState((prev) => {
      const remaining = prev.assessments.filter((a) => a.id !== assessmentId);
      const nextObjectives = { ...prev.objectives };
      const nextEvaluations = { ...prev.evaluations };
      const nextRemediations = { ...prev.remediations };
      const nextAbsences = { ...prev.absentPupilIds };

      delete nextObjectives[assessmentId];
      delete nextEvaluations[assessmentId];
      delete nextRemediations[assessmentId];
      delete nextAbsences[assessmentId];

      let nextActiveAssessmentId = prev.activeAssessmentId;
      if (prev.activeAssessmentId === assessmentId) {
        const deletedAssessment = prev.assessments.find(
          (a) => a.id === assessmentId,
        );
        const sameClassAssessments = remaining.filter(
          (a) => a.classId === deletedAssessment?.classId,
        );
        nextActiveAssessmentId =
          sameClassAssessments[0]?.id ?? remaining[0]?.id ?? '';
      }

      return {
        ...prev,
        assessments: remaining,
        activeAssessmentId: nextActiveAssessmentId,
        objectives: nextObjectives,
        evaluations: nextEvaluations,
        remediations: nextRemediations,
        absentPupilIds: nextAbsences,
      };
    });
  };

  // OBJECTIVE ACTIONS
  const getObjectivesForAssessment = (assessmentId: string) => {
    return state.objectives[assessmentId] ?? [];
  };

  const addObjective = (assessmentId: string, description: string) => {
    const newId = `obj-${assessmentId}-${Date.now()}`;
    setState((prev) => {
      const currentList = prev.objectives[assessmentId] ?? [];
      const newObj: Objective = {
        id: newId,
        assessmentId,
        order: currentList.length + 1,
        description: description.trim(),
      };
      return {
        ...prev,
        objectives: {
          ...prev.objectives,
          [assessmentId]: [...currentList, newObj],
        },
      };
    });
    return newId;
  };

  const removeObjective = (assessmentId: string, objectiveId: string) => {
    setState((prev) => {
      const currentList = prev.objectives[assessmentId] ?? [];
      const filtered = currentList
        .filter((o) => o.id !== objectiveId)
        .map((o, idx) => ({ ...o, order: idx + 1 }));

      // Clean up evaluations for this specific objective across all pupils
      const currentAssessEval = prev.evaluations[assessmentId] ?? {};
      const cleanedAssessEval: Record<
        string,
        Record<string, EvaluationValue>
      > = {};
      for (const [pupilId, objMap] of Object.entries(currentAssessEval)) {
        const { [objectiveId]: _, ...rest } = objMap;
        cleanedAssessEval[pupilId] = rest;
      }

      return {
        ...prev,
        objectives: {
          ...prev.objectives,
          [assessmentId]: filtered,
        },
        evaluations: {
          ...prev.evaluations,
          [assessmentId]: cleanedAssessEval,
        },
      };
    });
  };

  const updateObjective = (
    assessmentId: string,
    objectiveId: string,
    description: string,
  ) => {
    setState((prev) => {
      const currentList = prev.objectives[assessmentId] ?? [];
      const updated = currentList.map((o) =>
        o.id === objectiveId ? { ...o, description: description.trim() } : o,
      );
      return {
        ...prev,
        objectives: {
          ...prev.objectives,
          [assessmentId]: updated,
        },
      };
    });
  };

  // EVALUATION ACTIONS
  const getEvaluationsForAssessment = (assessmentId: string) => {
    return state.evaluations[assessmentId] ?? {};
  };

  const getAbsentPupilIdsForAssessment = (assessmentId: string) => {
    return state.absentPupilIds[assessmentId] ?? [];
  };

  const setPupilAbsent = (pupilId: string, absent: boolean, assessmentId?: string) => {
    const targetAssessmentId = assessmentId ?? state.activeAssessmentId;
    setState((prev) => {
      const current = prev.absentPupilIds[targetAssessmentId] ?? [];
      const next = absent
        ? current.includes(pupilId) ? current : [...current, pupilId]
        : current.filter((id) => id !== pupilId);
      return {
        ...prev,
        absentPupilIds: {
          ...prev.absentPupilIds,
          [targetAssessmentId]: next,
        },
      };
    });
  };

  const setEvaluation = (
    pupilId: string,
    objectiveId: string,
    value: EvaluationValue,
    assessmentId?: string,
  ) => {
    const targetAssessmentId = assessmentId ?? state.activeAssessmentId;
    setState((prev) => {
      if ((prev.absentPupilIds[targetAssessmentId] ?? []).includes(pupilId)) {
        return prev;
      }
      const currentAssessEval = prev.evaluations[targetAssessmentId] ?? {};
      const currentPupilEval = currentAssessEval[pupilId] ?? {};
      return {
        ...prev,
        evaluations: {
          ...prev.evaluations,
          [targetAssessmentId]: {
            ...currentAssessEval,
            [pupilId]: {
              ...currentPupilEval,
              [objectiveId]: value,
            },
          },
        },
      };
    });
  };

  const cycleEvaluation = (
    pupilId: string,
    objectiveId: string,
    assessmentId?: string,
  ) => {
    const targetAssessmentId = assessmentId ?? state.activeAssessmentId;
    const current =
      state.evaluations[targetAssessmentId]?.[pupilId]?.[objectiveId] ??
      'NotEvaluated';
    const next: EvaluationValue =
      current === 'NotEvaluated'
        ? 'Acquired'
        : current === 'Acquired'
          ? 'PartiallyAcquired'
          : current === 'PartiallyAcquired'
            ? 'NotAcquired'
            : 'NotEvaluated';
    setEvaluation(pupilId, objectiveId, next, targetAssessmentId);
  };

  const setAllForObjective = (
    objectiveId: string,
    value: EvaluationValue,
    assessmentId?: string,
  ) => {
    const targetAssessmentId = assessmentId ?? state.activeAssessmentId;
    const targetAssessment = state.assessments.find(
      (a) => a.id === targetAssessmentId,
    );
    const targetClassId = targetAssessment?.classId ?? state.activeClassId;
    const absentPupilIds = new Set(state.absentPupilIds[targetAssessmentId] ?? []);
    const classPupils = state.pupils.filter(
      (p) => p.classId === targetClassId && !absentPupilIds.has(p.id),
    );

    setState((prev) => {
      const currentAssessEval = {
        ...(prev.evaluations[targetAssessmentId] ?? {}),
      };
      classPupils.forEach((pupil) => {
        currentAssessEval[pupil.id] = {
          ...(currentAssessEval[pupil.id] ?? {}),
          [objectiveId]: value,
        };
      });
      return {
        ...prev,
        evaluations: {
          ...prev.evaluations,
          [targetAssessmentId]: currentAssessEval,
        },
      };
    });
  };

  const getStatisticsForAssessment = (assessmentId: string) => {
    const assessment = state.assessments.find((a) => a.id === assessmentId);
    const classId = assessment?.classId ?? state.activeClassId;
    const classPupils = state.pupils.filter((p) => p.classId === classId);
    const objList = state.objectives[assessmentId] ?? [];
    const assessEvals = state.evaluations[assessmentId] ?? {};
    const absentPupilIds = new Set(state.absentPupilIds[assessmentId] ?? []);
    const attendingPupils = classPupils.filter((pupil) => !absentPupilIds.has(pupil.id));

    return objList.map((objective) => {
      let evaluated = 0;
      let acquired = 0;
      let partiallyAcquired = 0;
      let notAcquired = 0;

      attendingPupils.forEach((pupil) => {
        const val = assessEvals[pupil.id]?.[objective.id] ?? 'NotEvaluated';
        if (val !== 'NotEvaluated') evaluated += 1;
        if (val === 'Acquired') acquired += 1;
        if (val === 'PartiallyAcquired') partiallyAcquired += 1;
        if (val === 'NotAcquired') notAcquired += 1;
      });

      return {
        objectiveId: objective.id,
        evaluated,
        notEvaluated: attendingPupils.length - evaluated,
        acquired,
        partiallyAcquired,
        notAcquired,
        acquiredPercent: evaluated
          ? Math.round((acquired / evaluated) * 100)
          : 0,
      };
    });
  };

  // REMEDIATION ACTIONS
  const getRemediationForAssessment = (assessmentId: string) => {
    return (
      state.remediations[assessmentId] ?? { individual: '', classroom: '' }
    );
  };

  const updateRemediation = (
    individual: string,
    classroom: string,
    assessmentId?: string,
  ) => {
    const targetAssessmentId = assessmentId ?? state.activeAssessmentId;
    setState((prev) => ({
      ...prev,
      remediations: {
        ...prev.remediations,
        [targetAssessmentId]: {
          individual: individual.trim(),
          classroom: classroom.trim(),
        },
      },
    }));
  };

  // CLEAR ASSESSMENT
  const clearAssessment = (assessmentId?: string) => {
    const targetAssessmentId = assessmentId ?? state.activeAssessmentId;
    setState((prev) => ({
      ...prev,
      evaluations: {
        ...prev.evaluations,
        [targetAssessmentId]: {},
      },
      absentPupilIds: {
        ...prev.absentPupilIds,
        [targetAssessmentId]: [],
      },
    }));
  };

  // Active statistics helper
  const statistics = useMemo(() => {
    return getStatisticsForAssessment(activeAssessment.id);
  }, [state.pupils, state.objectives, state.evaluations, state.absentPupilIds, activeAssessment.id]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      ...state,
      hydrated,
      lastBackupAt,

      // Aliases for full maps (all assessments)
      allObjectives: state.objectives,
      allEvaluations: state.evaluations,
      allRemediations: state.remediations,

      // Active shortcuts (override state spread for the active assessment)
      className: activeClass.name,
      level: activeClass.level,
      classId: activeClass.id,
      activeClass,
      pupils: activePupils,
      assessment: activeAssessment,
      objectives: activeObjectives,
      evaluations: activeEvaluations,
      individualRemediation: activeRemediation.individual,
      classRemediation: activeRemediation.classroom,
      statistics,

      // Profile / Settings
      updateTeacherName,
      setInterfaceMode,
      updateSchool,
      setActiveAcademicYear,
      createAcademicYear,
      renameAcademicYear,
      deleteAcademicYear,
      setAcademicYearArchived,
      archiveAndCreateAcademicYear,
      addSchoolLevel,
      renameSchoolLevel,
      deleteSchoolLevel,
      addOrAssociateCompetency,
      setCompetencyAssociation,
      setConfiguredObjectives,
      getSchoolYearConfiguration,
      getLevelIdForYear,
      getCompetenciesForLevel,
      getObjectivesForLevelCompetency,
      resetAllData,
      generateTestData,
      getBackupState,
      restoreBackupState,

      // Methods
      createClass,
      setActiveClass,
      addScheduleSession,
      updateScheduleSession,
      deleteScheduleSession,
      saveScheduleOccurrenceOverride,
      addExtraScheduleSession,
      deleteScheduleOccurrenceOverride,
      renameClass,
      deleteClass,
      addPupils,
      deletePupil,
      updatePupilName,
      getPupilsForClass,
      getAttendanceRecord,
      getAttendanceRecordsForClass,
      saveAttendanceRecord,
      getContinuousEvaluation,
      getContinuousEvaluationPeriods,
      getActiveContinuousEvaluationPeriod,
      setActiveContinuousEvaluationPeriod,
      addContinuousEvaluationPeriod,
      updateContinuousEvaluationPeriod,
      deleteContinuousEvaluationPeriod,
      setContinuousEvaluationScore,
      getDisciplineEventsForEvaluation,
      addDisciplinePenalty,
      deleteDisciplineEvent,
      updateContinuousEvaluationSettings,
      createAssessment,
      setActiveAssessment,
      deleteAssessment,
      getAssessment,
      getAssessmentsForClass,
      getLevelTestForClassYear,
      addObjective,
      removeObjective,
      updateObjective,
      getObjectivesForAssessment,
      setEvaluation,
      cycleEvaluation,
      setAllForObjective,
      getEvaluationsForAssessment,
      setPupilAbsent,
      getAbsentPupilIdsForAssessment,
      getStatisticsForAssessment,
      updateRemediation,
      getRemediationForAssessment,
      clearAssessment,
      saveLocally: () => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)),
    }),
    [
      state,
      hydrated,
      activeClass,
      activePupils,
      activeAssessment,
      activeObjectives,
      activeEvaluations,
      activeRemediation,
      statistics,
      getBackupState,
      restoreBackupState,
    ],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context)
    throw new Error('useAppData must be used within AppDataProvider');
  return context;
}
