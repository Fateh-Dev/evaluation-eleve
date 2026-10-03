import AsyncStorage from '@react-native-async-storage/async-storage';
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
  academicYear: string;
  schoolYearConfigurations: SchoolYearConfiguration[];
  classes: ClassItem[];
  activeClassId: string;
  pupils: Pupil[];
  assessments: Assessment[];
  activeAssessmentId: string;
  objectives: Record<string, Objective[]>; // keyed by assessmentId
  evaluations: Record<string, Record<string, Record<string, EvaluationValue>>>; // [assessmentId][pupilId][objectiveId]
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
  academicYear: string;
  schoolYearConfigurations: SchoolYearConfiguration[];
  classes: ClassItem[];
  activeClassId: string;
  pupils: Pupil[];
  assessments: Assessment[];
  activeAssessmentId: string;
  allObjectives: Record<string, Objective[]>; // alias for objectives (all assessments)
  allEvaluations: Record<
    string,
    Record<string, Record<string, EvaluationValue>>
  >; // alias
  allRemediations: Record<string, { individual: string; classroom: string }>; // alias

  hydrated: boolean;
  isDirty: boolean;
  syncStatus: 'synced' | 'pending';

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
  updateSchool: (school: Partial<School> & { academicYear?: string }) => void;
  setActiveAcademicYear: (year: string) => void;
  createAcademicYear: (year: string, copyFromYear?: string) => boolean;
  renameAcademicYear: (year: string, newName: string) => boolean;
  deleteAcademicYear: (year: string) => DeleteYearResult;
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
  resetAllData: () => void;
  getBackupState: () => AppState;
  restoreBackupState: (backup: unknown) => Promise<void>;

  // Class Actions
  createClass: (input: {
    name: string;
    level: string;
    levelId?: string;
    academicYear?: string;
    competencyIds?: string[];
    competencySelections?: Array<{
      competencyId: string;
      objectives?: string[];
    }>;
  }) => string;
  setActiveClass: (classId: string) => void;
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
  getPupilsForClass: (classId: string) => Pupil[];

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
  }) => string;
  setActiveAssessment: (assessmentId: string) => void;
  deleteAssessment: (assessmentId: string) => void;
  getAssessment: (assessmentId: string) => Assessment | undefined;
  getAssessmentsForClass: (classId: string) => Assessment[];

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
  saveDraft: () => void;
  markSynced: () => void;
};

const STORAGE_KEY = '@teacher-assessment/app-state-v4';

export function createEmptyState(): AppState {
  return {
    school: {
      name: '',
      address: '',
      wilaya: '',
    },
    teacherName: '',
    academicYear: '2026-2027',
    schoolYearConfigurations: [
      createDefaultSchoolYearConfiguration('2026-2027'),
    ],
    classes: [],
    activeClassId: '',
    pupils: [],
    assessments: [],
    activeAssessmentId: '',
    objectives: {},
    evaluations: {},
    remediations: {},
  };
}

const initialState = createEmptyState();

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending'>('synced');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as Partial<AppState>;
            const academicYear = parsed.academicYear ?? '2026-2027';
            const classes = Array.isArray(parsed.classes) ? parsed.classes : [];
            const assessments = Array.isArray(parsed.assessments)
              ? parsed.assessments
              : [];
            const objectives = parsed.objectives ?? {};
            setState((prev) => ({
              ...prev,
              ...parsed,
              school: parsed.school ?? prev.school,
              teacherName: parsed.teacherName ?? prev.teacherName,
              academicYear,
              schoolYearConfigurations: migrateSchoolYearConfigurations(
                parsed.schoolYearConfigurations,
                academicYear,
                classes,
                assessments,
                objectives,
              ),
              classes,
              pupils: Array.isArray(parsed.pupils) ? parsed.pupils : [],
              assessments,
              objectives,
              evaluations: parsed.evaluations ?? {},
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

  // Active class helper (safe fallback when classes are empty)
  const activeClass = useMemo(() => {
    return (
      state.classes.find((c) => c.id === state.activeClassId) ??
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
    competencyIds?: string[];
    competencySelections?: Array<{
      competencyId: string;
      objectives?: string[];
    }>;
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

    const requestedSelections: Array<{
      competencyId: string;
      objectives?: string[];
    }> =
      input.competencySelections ??
      (input.competencyIds ?? []).map((competencyId) => ({ competencyId }));
    const availableCompetencies = configuration.competencies.filter(
      (competency) =>
        configuration.associations.some(
          (association) =>
            association.levelId === level!.id &&
            association.competencyId === competency.id,
        ),
    );
    const selectionsForClass: Array<{
      competencyId: string;
      objectives?: string[];
    }> = requestedSelections.length
      ? requestedSelections
      : availableCompetencies
          .slice(0, 1)
          .map((competency) => ({ competencyId: competency.id }));
    const selectedCompetencies = selectionsForClass.flatMap((selection) => {
      const competency = configuration.competencies.find(
        (item) => item.id === selection.competencyId,
      );
      const linked = configuration.associations.some(
        (association) =>
          association.levelId === level!.id &&
          association.competencyId === selection.competencyId,
      );
      return competency && linked
        ? [{ competency, objectives: selection.objectives }]
        : [];
    });

    const newAssessments: Assessment[] = [];
    const newObjectivesMap: Record<string, Objective[]> = {};
    const newEvaluationsMap: Record<
      string,
      Record<string, Record<string, EvaluationValue>>
    > = {};
    const newRemediationsMap: Record<
      string,
      { individual: string; classroom: string }
    > = {};

    selectedCompetencies.forEach(({ competency, objectives }) => {
      const template = COMPETENCY_TEMPLATES.find(
        (item) =>
          item.id === competency.templateId ||
          normalizeLabel(item.name) === normalizeLabel(competency.name),
      );
      const configuredDescriptions = getObjectivesForPair(
        configuration,
        level!.id,
        competency.id,
      ).map((item) => item.description);
      const selectedDescriptions = (objectives ?? []).filter((item) =>
        item.trim(),
      );
      const objectiveDescriptions = selectedDescriptions.length
        ? selectedDescriptions
        : configuredDescriptions.length
          ? configuredDescriptions
          : (template?.defaultObjectives ?? ['Objectif 1']);
      const newAssessmentId = createConfigId('assessment');
      newAssessments.push({
        id: newAssessmentId,
        classId: newId,
        title: template?.defaultTitle ?? competency.name,
        date: new Date().toLocaleDateString('fr-FR'),
        subject: 'Français',
        level: newClass.level,
        competency: competency.name,
        competencyId: competency.id,
        support: template?.defaultSupport ?? '',
        sessionObjectives: template?.defaultSessionObjectives ?? '',
        status: 'Draft',
      });
      newObjectivesMap[newAssessmentId] = objectiveDescriptions.map(
        (desc, idx) => ({
          id: `obj-${newAssessmentId}-${idx + 1}`,
          assessmentId: newAssessmentId,
          order: idx + 1,
          description: desc,
        }),
      );
      newEvaluationsMap[newAssessmentId] = {};
      newRemediationsMap[newAssessmentId] = { individual: '', classroom: '' };
    });

    const firstAssessmentId = newAssessments[0]?.id ?? '';

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
        classes: [...prev.classes, newClass],
        activeClassId: newId,
        assessments: [...prev.assessments, ...newAssessments],
        activeAssessmentId: firstAssessmentId,
        objectives: {
          ...prev.objectives,
          ...newObjectivesMap,
        },
        evaluations: {
          ...prev.evaluations,
          ...newEvaluationsMap,
        },
        remediations: {
          ...prev.remediations,
          ...newRemediationsMap,
        },
      };
    });

    setIsDirty(true);
    setSyncStatus('pending');
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

  const updateTeacherName = (name: string) => {
    setState((prev) => ({
      ...prev,
      teacherName: name.trim(),
    }));
    setIsDirty(true);
    setSyncStatus('pending');
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
    setIsDirty(true);
    setSyncStatus('pending');
  };

  const setActiveAcademicYear = (year: string) => {
    const requestedYear = year.trim();
    if (!requestedYear) return;
    setState((prev) => {
      const existing = prev.schoolYearConfigurations.find(
        (item) => normalizeLabel(item.year) === normalizeLabel(requestedYear),
      );
      return {
        ...prev,
        academicYear: existing?.year ?? requestedYear,
        schoolYearConfigurations: existing
          ? prev.schoolYearConfigurations
          : [
              ...prev.schoolYearConfigurations,
              createDefaultSchoolYearConfiguration(requestedYear),
            ],
      };
    });
    setIsDirty(true);
    setSyncStatus('pending');
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
    }));
    setIsDirty(true);
    setSyncStatus('pending');
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
      academicYear:
        normalizeLabel(prev.academicYear) === normalizeLabel(configuration.year)
          ? cleanName
          : prev.academicYear,
    }));
    setIsDirty(true);
    setSyncStatus('pending');
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
        classes,
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
      };
    });
    setIsDirty(true);
    setSyncStatus('pending');
    return { ok: true, classCount, defaultYear };
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
    setIsDirty(true);
    setSyncStatus('pending');
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
    setIsDirty(true);
    setSyncStatus('pending');
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
    setIsDirty(true);
    setSyncStatus('pending');
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
    setIsDirty(true);
    setSyncStatus('pending');
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
    setIsDirty(true);
    setSyncStatus('pending');
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
    setIsDirty(true);
    setSyncStatus('pending');
  };

  const getBackupState = () => state;
  const restoreBackupState = async (backup: unknown) => {
    if (!backup || typeof backup !== 'object') throw new Error('Fichier de sauvegarde invalide.');
    const candidate = backup as Partial<AppState>;
    if (!candidate.school || !Array.isArray(candidate.classes) || !Array.isArray(candidate.pupils) || !Array.isArray(candidate.assessments)) {
      throw new Error('Cette sauvegarde ne correspond pas à une sauvegarde Évaluation Élève.');
    }
    const restored: AppState = {
      ...createEmptyState(),
      ...candidate,
      school: { ...createEmptyState().school, ...candidate.school },
      teacherName: typeof candidate.teacherName === 'string' ? candidate.teacherName : '',
      academicYear: typeof candidate.academicYear === 'string' ? candidate.academicYear : '2026-2027',
      schoolYearConfigurations: Array.isArray(candidate.schoolYearConfigurations)
        ? candidate.schoolYearConfigurations
        : createEmptyState().schoolYearConfigurations,
      classes: candidate.classes,
      pupils: candidate.pupils,
      assessments: candidate.assessments,
      objectives: candidate.objectives ?? {},
      evaluations: candidate.evaluations ?? {},
      remediations: candidate.remediations ?? {},
      activeClassId: typeof candidate.activeClassId === 'string' ? candidate.activeClassId : '',
      activeAssessmentId: typeof candidate.activeAssessmentId === 'string' ? candidate.activeAssessmentId : '',
    };
    setState(restored);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
    setIsDirty(true);
    setSyncStatus('pending');
  };
  const resetAllData = () => {
    const empty = createEmptyState();
    setState(empty);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(empty)).catch(
      () => undefined,
    );
    setIsDirty(false);
    setSyncStatus('synced');
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

      deletedAssessmentIds.forEach((id) => {
        delete nextObjectives[id];
        delete nextEvaluations[id];
        delete nextRemediations[id];
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
        activeClassId: nextActiveClassId,
        pupils: remainingPupils,
        assessments: remainingAssessments,
        activeAssessmentId: nextActiveAssessmentId,
        objectives: nextObjectives,
        evaluations: nextEvaluations,
        remediations: nextRemediations,
      };
    });
    setIsDirty(true);
    setSyncStatus('pending');
  };

  // PUPIL ACTIONS
  const getPupilsForClass = (classId: string) => {
    return state.pupils.filter((p) => p.classId === classId);
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
      if (!regNo || existing.has(regNo.toLowerCase())) {
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
      setIsDirty(true);
      setSyncStatus('pending');
    }
    return { imported, skipped };
  };

  const deletePupil = (pupilId: string) => {
    setState((prev) => ({
      ...prev,
      pupils: prev.pupils.filter((p) => p.id !== pupilId),
    }));
    setIsDirty(true);
    setSyncStatus('pending');
  };

  // ASSESSMENT / COMPETENCY ACTIONS
  const getAssessment = (assessmentId: string) => {
    return state.assessments.find((a) => a.id === assessmentId);
  };

  const getAssessmentsForClass = (classId: string) => {
    return state.assessments.filter((a) => a.classId === classId);
  };

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
    const newAssessmentId = createConfigId('assessment');
    const targetClass =
      state.classes.find((c) => c.id === input.classId) ?? activeClass;
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

    const newAssessment: Assessment = {
      id: newAssessmentId,
      classId: input.classId,
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

    setIsDirty(true);
    setSyncStatus('pending');
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

      delete nextObjectives[assessmentId];
      delete nextEvaluations[assessmentId];
      delete nextRemediations[assessmentId];

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
      };
    });
    setIsDirty(true);
    setSyncStatus('pending');
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
    setIsDirty(true);
    setSyncStatus('pending');
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
    setIsDirty(true);
    setSyncStatus('pending');
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
    setIsDirty(true);
    setSyncStatus('pending');
  };

  // EVALUATION ACTIONS
  const getEvaluationsForAssessment = (assessmentId: string) => {
    return state.evaluations[assessmentId] ?? {};
  };

  const setEvaluation = (
    pupilId: string,
    objectiveId: string,
    value: EvaluationValue,
    assessmentId?: string,
  ) => {
    const targetAssessmentId = assessmentId ?? state.activeAssessmentId;
    setState((prev) => {
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
    setIsDirty(true);
    setSyncStatus('pending');
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
    const classPupils = state.pupils.filter((p) => p.classId === targetClassId);

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
    setIsDirty(true);
    setSyncStatus('pending');
  };

  const getStatisticsForAssessment = (assessmentId: string) => {
    const assessment = state.assessments.find((a) => a.id === assessmentId);
    const classId = assessment?.classId ?? state.activeClassId;
    const classPupils = state.pupils.filter((p) => p.classId === classId);
    const objList = state.objectives[assessmentId] ?? [];
    const assessEvals = state.evaluations[assessmentId] ?? {};

    return objList.map((objective) => {
      let evaluated = 0;
      let acquired = 0;
      let partiallyAcquired = 0;
      let notAcquired = 0;

      classPupils.forEach((pupil) => {
        const val = assessEvals[pupil.id]?.[objective.id] ?? 'NotEvaluated';
        if (val !== 'NotEvaluated') evaluated += 1;
        if (val === 'Acquired') acquired += 1;
        if (val === 'PartiallyAcquired') partiallyAcquired += 1;
        if (val === 'NotAcquired') notAcquired += 1;
      });

      return {
        objectiveId: objective.id,
        evaluated,
        notEvaluated: classPupils.length - evaluated,
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
    setIsDirty(true);
    setSyncStatus('pending');
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
    }));
    setIsDirty(true);
    setSyncStatus('pending');
  };

  // Active statistics helper
  const statistics = useMemo(() => {
    return getStatisticsForAssessment(activeAssessment.id);
  }, [state.pupils, state.objectives, state.evaluations, activeAssessment.id]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      ...state,
      hydrated,
      isDirty,
      syncStatus,

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
      updateSchool,
      setActiveAcademicYear,
      createAcademicYear,
      renameAcademicYear,
      deleteAcademicYear,
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
      getBackupState,
      restoreBackupState,

      // Methods
      createClass,
      setActiveClass,
      deleteClass,
      addPupils,
      deletePupil,
      getPupilsForClass,
      createAssessment,
      setActiveAssessment,
      deleteAssessment,
      getAssessment,
      getAssessmentsForClass,
      addObjective,
      removeObjective,
      updateObjective,
      getObjectivesForAssessment,
      setEvaluation,
      cycleEvaluation,
      setAllForObjective,
      getEvaluationsForAssessment,
      getStatisticsForAssessment,
      updateRemediation,
      getRemediationForAssessment,
      clearAssessment,
      saveDraft: () => {
        setIsDirty(false);
        setSyncStatus('pending');
      },
      markSynced: () => setSyncStatus('synced'),
    }),
    [
      state,
      hydrated,
      isDirty,
      syncStatus,
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
