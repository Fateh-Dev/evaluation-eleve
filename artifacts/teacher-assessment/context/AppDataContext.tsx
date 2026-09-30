import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { COMPETENCY_TEMPLATES } from '@/constants/competencies';

export type EvaluationValue =
  | 'NotEvaluated'
  | 'Acquired'
  | 'PartiallyAcquired'
  | 'NotAcquired';

export type ClassItem = {
  id: string;
  name: string;
  level: string;
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
  classes: ClassItem[];
  activeClassId: string;
  pupils: Pupil[];
  assessments: Assessment[];
  activeAssessmentId: string;
  objectives: Record<string, Objective[]>; // keyed by assessmentId
  evaluations: Record<string, Record<string, Record<string, EvaluationValue>>>; // [assessmentId][pupilId][objectiveId]
  remediations: Record<string, { individual: string; classroom: string }>; // keyed by assessmentId
};

export type AppDataContextValue = {
  school: School;
  teacherName: string;
  academicYear: string;
  classes: ClassItem[];
  activeClassId: string;
  pupils: Pupil[];
  assessments: Assessment[];
  activeAssessmentId: string;
  allObjectives: Record<string, Objective[]>;  // alias for objectives (all assessments)
  allEvaluations: Record<string, Record<string, Record<string, EvaluationValue>>>;  // alias
  allRemediations: Record<string, { individual: string; classroom: string }>;  // alias

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
  resetAllData: () => void;

  // Class Actions
  createClass: (input: { name: string; level: string; academicYear?: string; competencyIds?: string[] }) => string;
  setActiveClass: (classId: string) => void;
  deleteClass: (classId: string) => void;

  // Pupil Actions
  addPupils: (
    pupils: Array<Pick<Pupil, 'registrationNumber' | 'firstName' | 'lastName' | 'dateOfBirth'>>,
    targetClassId?: string,
  ) => { imported: number; skipped: number };
  deletePupil: (pupilId: string) => void;
  getPupilsForClass: (classId: string) => Pupil[];

  // Assessment / Competency Actions
  createAssessment: (input: {
    classId: string;
    competency: string;
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
  updateObjective: (assessmentId: string, objectiveId: string, description: string) => void;
  getObjectivesForAssessment: (assessmentId: string) => Objective[];

  // Evaluation Actions
  setEvaluation: (
    pupilId: string,
    objectiveId: string,
    value: EvaluationValue,
    assessmentId?: string,
  ) => void;
  cycleEvaluation: (pupilId: string, objectiveId: string, assessmentId?: string) => void;
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
  updateRemediation: (individual: string, classroom: string, assessmentId?: string) => void;
  getRemediationForAssessment: (
    assessmentId: string,
  ) => { individual: string; classroom: string };

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
            setState((prev) => ({
              ...prev,
              ...parsed,
              school: parsed.school ?? prev.school,
              teacherName: parsed.teacherName ?? prev.teacherName,
              academicYear: parsed.academicYear ?? prev.academicYear,
              classes: Array.isArray(parsed.classes) ? parsed.classes : [],
              pupils: Array.isArray(parsed.pupils) ? parsed.pupils : [],
              assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
              objectives: parsed.objectives ?? {},
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
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
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
    const found = state.assessments.find((a) => a.id === state.activeAssessmentId);
    if (found) return found;
    // Fallback to first assessment of active class
    const classAssessments = state.assessments.filter((a) => a.classId === state.activeClassId);
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
  }, [state.assessments, state.activeAssessmentId, state.activeClassId, activeClass]);

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
    return state.remediations[activeAssessment.id] ?? { individual: '', classroom: '' };
  }, [state.remediations, activeAssessment.id]);

  // CLASS ACTIONS
  const createClass = (input: { name: string; level: string; academicYear?: string; competencyIds?: string[] }) => {
    const newId = `class-${Date.now()}`;
    const newClass: ClassItem = {
      id: newId,
      name: input.name.trim(),
      level: input.level.trim(),
      academicYear: (input.academicYear ?? state.academicYear).trim(),
      active: true,
    };

    // Determine which templates to create assessments for
    const selectedTemplates =
      input.competencyIds && input.competencyIds.length > 0
        ? COMPETENCY_TEMPLATES.filter((t) => input.competencyIds!.includes(t.id))
        : [COMPETENCY_TEMPLATES[0]];

    const newAssessments: Assessment[] = [];
    const newObjectivesMap: Record<string, Objective[]> = {};
    const newEvaluationsMap: Record<string, Record<string, Record<string, EvaluationValue>>> = {};
    const newRemediationsMap: Record<string, { individual: string; classroom: string }> = {};

    selectedTemplates.forEach((tmpl, tmplIdx) => {
      const newAssessmentId = `assessment-${Date.now()}-${tmplIdx}`;
      newAssessments.push({
        id: newAssessmentId,
        classId: newId,
        title: tmpl.defaultTitle,
        date: new Date().toLocaleDateString('fr-FR'),
        subject: 'Français',
        level: newClass.level,
        competency: tmpl.name,
        support: tmpl.defaultSupport,
        sessionObjectives: tmpl.defaultSessionObjectives,
        status: 'Draft',
      });
      newObjectivesMap[newAssessmentId] = tmpl.defaultObjectives.map((desc, idx) => ({
        id: `obj-${newAssessmentId}-${idx + 1}`,
        assessmentId: newAssessmentId,
        order: idx + 1,
        description: desc,
      }));
      newEvaluationsMap[newAssessmentId] = {};
      newRemediationsMap[newAssessmentId] = { individual: '', classroom: '' };
    });

    const firstAssessmentId = newAssessments[0]?.id ?? '';

    setState((prev) => ({
      ...prev,
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
    }));

    setIsDirty(true);
    setSyncStatus('pending');
    return newId;
  };

  const setActiveClass = (classId: string) => {
    const foundClass = state.classes.find((c) => c.id === classId);
    if (!foundClass) return;

    // Find first assessment of this class to set as active
    const classAssessments = state.assessments.filter((a) => a.classId === classId);
    const nextAssessmentId = classAssessments[0]?.id ?? state.activeAssessmentId;

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

  const updateSchool = (schoolData: Partial<School> & { academicYear?: string }) => {
    setState((prev) => ({
      ...prev,
      school: {
        ...prev.school,
        ...(schoolData.name !== undefined ? { name: schoolData.name.trim() } : {}),
        ...(schoolData.address !== undefined ? { address: schoolData.address.trim() } : {}),
        ...(schoolData.wilaya !== undefined ? { wilaya: schoolData.wilaya.trim() } : {}),
      },
      ...(schoolData.academicYear !== undefined ? { academicYear: schoolData.academicYear.trim() } : {}),
    }));
    setIsDirty(true);
    setSyncStatus('pending');
  };

  const resetAllData = () => {
    const empty = createEmptyState();
    setState(empty);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(empty)).catch(() => undefined);
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
      const remainingAssessments = prev.assessments.filter((a) => a.classId !== classId);

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
      if (deletedAssessmentIds.has(prev.activeAssessmentId) || !nextActiveAssessmentId) {
        const remainingForNextClass = remainingAssessments.filter(
          (a) => a.classId === nextActiveClassId,
        );
        nextActiveAssessmentId = remainingForNextClass[0]?.id ?? remainingAssessments[0]?.id ?? '';
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
    incoming: Array<Pick<Pupil, 'registrationNumber' | 'firstName' | 'lastName' | 'dateOfBirth'>>,
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
      let regNo = pupil.registrationNumber ? pupil.registrationNumber.trim() : '';
      if (!regNo || existing.has(regNo.toLowerCase())) {
        let candidate = existing.size + 1;
        while (existing.has(String(candidate).padStart(2, '0').toLowerCase()) || existing.has(String(candidate).toLowerCase())) {
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
    title: string;
    subject?: string;
    level?: string;
    support?: string;
    sessionObjectives?: string;
    date?: string;
    objectives?: string[];
  }) => {
    const newAssessmentId = `assessment-${Date.now()}`;
    const targetClass = state.classes.find((c) => c.id === input.classId) ?? activeClass;

    const newAssessment: Assessment = {
      id: newAssessmentId,
      classId: input.classId,
      title: input.title.trim(),
      date: input.date ?? new Date().toLocaleDateString('fr-FR'),
      subject: input.subject ?? 'Français',
      level: input.level ?? targetClass.level,
      competency: input.competency.trim(),
      support: input.support ?? '',
      sessionObjectives: input.sessionObjectives ?? '',
      status: 'Draft',
    };

    // Determine objectives
    let objectiveTexts = input.objectives;
    if (!objectiveTexts || objectiveTexts.length === 0) {
      // Find matching template
      const matched = COMPETENCY_TEMPLATES.find((t) => t.name.toLowerCase() === input.competency.toLowerCase());
      objectiveTexts = matched ? matched.defaultObjectives : ['Objectif 1'];
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
        const deletedAssessment = prev.assessments.find((a) => a.id === assessmentId);
        const sameClassAssessments = remaining.filter((a) => a.classId === deletedAssessment?.classId);
        nextActiveAssessmentId = sameClassAssessments[0]?.id ?? remaining[0]?.id ?? '';
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
      const cleanedAssessEval: Record<string, Record<string, EvaluationValue>> = {};
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

  const updateObjective = (assessmentId: string, objectiveId: string, description: string) => {
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

  const cycleEvaluation = (pupilId: string, objectiveId: string, assessmentId?: string) => {
    const targetAssessmentId = assessmentId ?? state.activeAssessmentId;
    const current = state.evaluations[targetAssessmentId]?.[pupilId]?.[objectiveId] ?? 'NotEvaluated';
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
    const targetAssessment = state.assessments.find((a) => a.id === targetAssessmentId);
    const targetClassId = targetAssessment?.classId ?? state.activeClassId;
    const classPupils = state.pupils.filter((p) => p.classId === targetClassId);

    setState((prev) => {
      const currentAssessEval = { ...(prev.evaluations[targetAssessmentId] ?? {}) };
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
        acquiredPercent: evaluated ? Math.round((acquired / evaluated) * 100) : 0,
      };
    });
  };

  // REMEDIATION ACTIONS
  const getRemediationForAssessment = (assessmentId: string) => {
    return state.remediations[assessmentId] ?? { individual: '', classroom: '' };
  };

  const updateRemediation = (individual: string, classroom: string, assessmentId?: string) => {
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
      resetAllData,

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
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used within AppDataProvider');
  return context;
}
