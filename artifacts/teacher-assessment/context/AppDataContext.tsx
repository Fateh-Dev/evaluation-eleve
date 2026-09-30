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

  // Class Actions
  createClass: (input: { name: string; level: string; academicYear?: string; competencyIds?: string[] }) => string;
  setActiveClass: (classId: string) => void;
  deleteClass: (classId: string) => void;

  // Pupil Actions
  addPupils: (
    pupils: Array<Pick<Pupil, 'registrationNumber' | 'firstName' | 'lastName' | 'dateOfBirth'>>,
    targetClassId?: string,
  ) => { imported: number; skipped: number };
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

const STORAGE_KEY = '@teacher-assessment/app-state-v3';

// 34 Pupils from the official Algerian class reference (notation_names_11_objectifs.docx)
const seedPupilNames2AS = [
  ['Aberbed', 'Rami'],
  ['Idir', 'Maria'],
  ['Ait Oudia', 'Mohamed Salah Eddine Reda'],
  ['Bermila', 'Aya'],
  ['Belaifa', 'Ilhem'],
  ['Ben Ammar', 'Abdelkader Wassim'],
  ['Ben Nounas', 'Nedjib'],
  ['Boulezghar', 'Nourhane'],
  ['Boudjaddar', 'Achref Abdellah'],
  ['Tlidjane', 'Salima'],
  ['Touati', 'El Hadj Faiez'],
  ['Tounsi', 'Meriem'],
  ['Hadj Cherif', 'Abdelghani'],
  ['Haddad', 'Nour'],
  ['Khecheba', 'Yahia'],
  ['Khelif', 'Abdelnour'],
  ['Khoudja', 'Wessam'],
  ['Reghdoud', 'Aya Zohra'],
  ['Seri', 'Abdellaslam'],
  ['Slaimia', 'Yousra'],
  ['Tadjine', 'Ikram'],
  ['Tayeb El Rahman', 'Hana'],
  ['Abron', 'Tasnim'],
  ['Assous', 'Adhem'],
  ['Ghendouzi', 'Zineddine'],
  ['Kehli', 'Somia'],
  ['Keraz', 'Soheib'],
  ['Mahamdou', 'Ali Lotfi'],
  ['Messaoui', 'Omnia'],
  ['Messaoudane', 'Walid'],
  ['Helal', 'Aya'],
  ['Yallaoui Bembina', 'Nour El Houda'],
  ['Youkhesef', 'Imene'],
  ['Youssefi', 'Ala'],
];

const seedPupilNames1AS = [
  ['Amir', 'Mohamed Mehdi'],
  ['Amziane', 'Mokhtar'],
  ['Brahimi', 'Yasser Fadi'],
  ['Belarbi', 'Iyad Nasrallah'],
  ['Belkaid', 'Alaa'],
  ['Ben Amara', 'Bilal'],
  ['Ben Aïfa', 'Abdelilah Samir'],
  ['Ben Nâama', 'Hibet Errahmane'],
  ['Bouzabia', 'Zineb'],
  ['Bouflouh', 'Ibrahim El Khalil'],
  ['Toumi', 'Abdelbasset'],
  ['Harrach', 'Fatima Zahra Meriem'],
  ['Khemissat', 'Rehab'],
  ['Khouadji', 'Anis'],
  ['Drioueb', 'Tayeb El Amine'],
  ['Douieb', 'Mohamed Wassim'],
  ['Zebaïri', 'Adlane'],
  ['Sahli', 'Bachir'],
  ['Slatni', 'Imad'],
  ['Smaïli', 'Djamila'],
];

function createSeedState(): AppState {
  const class2ASId = 'class-2as-lph2';
  const class1ASId = 'class-1as-st1';

  const classes: ClassItem[] = [
    {
      id: class2ASId,
      name: '2AS LPH2',
      level: '2AS LPH',
      academicYear: '2026-2027',
      active: true,
    },
    {
      id: class1ASId,
      name: '1AS ST1',
      level: '1AS ST',
      academicYear: '2026-2027',
      active: false,
    },
  ];

  const pupils: Pupil[] = [
    ...seedPupilNames2AS.map(([lastName, firstName], index) => ({
      id: `pupil-2as-${String(index + 1).padStart(2, '0')}`,
      registrationNumber: String(index + 1).padStart(2, '0'),
      firstName,
      lastName,
      classId: class2ASId,
    })),
    ...seedPupilNames1AS.map(([lastName, firstName], index) => ({
      id: `pupil-1as-${String(index + 1).padStart(2, '0')}`,
      registrationNumber: String(index + 1).padStart(2, '0'),
      firstName,
      lastName,
      classId: class1ASId,
    })),
  ];

  // Assessments for 2AS LPH2
  const assessment2ASEcritId = '55555555-5555-4555-8555-555555555555';
  const assessment2ASOralId = 'assessment-2as-oral-1';
  const assessment2ASProdId = 'assessment-2as-prod-1';

  // Assessments for 1AS ST1
  const assessment1ASEcritId = 'assessment-1as-ecrit-1';

  const assessments: Assessment[] = [
    {
      id: assessment2ASEcritId,
      classId: class2ASId,
      title: 'Compréhension de l’écrit',
      date: '28/09/2026',
      subject: 'Français',
      level: '2AS LPH',
      competency: 'Compréhension de l’écrit',
      support: 'Des extraits écrits',
      sessionObjectives: 'Comprendre et interpréter des textes écrits en vue',
      status: 'InProgress',
    },
    {
      id: assessment2ASOralId,
      classId: class2ASId,
      title: 'Compréhension de l’oral — Le reportage',
      date: '05/10/2026',
      subject: 'Français',
      level: '2AS LPH',
      competency: 'Compréhension de l’oral',
      support: 'Document sonore / audiovisuel',
      sessionObjectives: 'Écouter et comprendre un document oral en vue de restituer les informations principales',
      status: 'Draft',
    },
    {
      id: assessment2ASProdId,
      classId: class2ASId,
      title: 'Production de l’écrit — Synthèse',
      date: '12/10/2026',
      subject: 'Français',
      level: '2AS LPH',
      competency: 'Production de l’écrit',
      support: 'Consigne d’écriture et grille critériée',
      sessionObjectives: 'Rédiger un texte explicatif structuré',
      status: 'Draft',
    },
    {
      id: assessment1ASEcritId,
      classId: class1ASId,
      title: 'Compréhension de l’écrit — Discours vulgarisé',
      date: '30/09/2026',
      subject: 'Français',
      level: '1AS ST',
      competency: 'Compréhension de l’écrit',
      support: 'Articles scientifiques vulgarisés',
      sessionObjectives: 'Dégager les caractéristiques du texte explicatif',
      status: 'InProgress',
    },
  ];

  // Objectives for each assessment
  const templateEcrit = COMPETENCY_TEMPLATES.find((t) => t.id === 'comprehension-ecrite')!;
  const templateOral = COMPETENCY_TEMPLATES.find((t) => t.id === 'comprehension-orale')!;
  const templateProd = COMPETENCY_TEMPLATES.find((t) => t.id === 'production-ecrite')!;

  const objectives: Record<string, Objective[]> = {
    [assessment2ASEcritId]: templateEcrit.defaultObjectives.map((desc, idx) => ({
      id: `obj-2as-ecrit-${idx + 1}`,
      assessmentId: assessment2ASEcritId,
      order: idx + 1,
      description: desc,
    })),
    [assessment2ASOralId]: templateOral.defaultObjectives.map((desc, idx) => ({
      id: `obj-2as-oral-${idx + 1}`,
      assessmentId: assessment2ASOralId,
      order: idx + 1,
      description: desc,
    })),
    [assessment2ASProdId]: templateProd.defaultObjectives.map((desc, idx) => ({
      id: `obj-2as-prod-${idx + 1}`,
      assessmentId: assessment2ASProdId,
      order: idx + 1,
      description: desc,
    })),
    [assessment1ASEcritId]: templateEcrit.defaultObjectives.slice(0, 6).map((desc, idx) => ({
      id: `obj-1as-ecrit-${idx + 1}`,
      assessmentId: assessment1ASEcritId,
      order: idx + 1,
      description: desc,
    })),
  };

  // Seed Evaluations for 2AS LPH2 Ecrit
  const evaluations: AppState['evaluations'] = {
    [assessment2ASEcritId]: {},
    [assessment2ASOralId]: {},
    [assessment2ASProdId]: {},
    [assessment1ASEcritId]: {},
  };

  const pupils2AS = pupils.filter((p) => p.classId === class2ASId);
  pupils2AS.forEach((pupil, pupilIndex) => {
    evaluations[assessment2ASEcritId][pupil.id] = {};
    objectives[assessment2ASEcritId].forEach((objective, objectiveIndex) => {
      const pattern = (pupilIndex * 3 + objectiveIndex) % 9;
      evaluations[assessment2ASEcritId][pupil.id][objective.id] =
        pattern < 5 ? 'Acquired' : pattern < 7 ? 'PartiallyAcquired' : pattern < 8 ? 'NotAcquired' : 'NotEvaluated';
    });
  });

  const remediations: AppState['remediations'] = {
    [assessment2ASEcritId]: {
      individual:
        '• Encourager les élèves à lire régulièrement des textes à la maison afin de développer leur capacité de compréhension et d’analyse.\n• Aider l’élève à reconnaître les indices d’un texte explicatif/argumentatif/narratif.\n• Proposer des activités de langue pour travailler les procédés explicatifs.',
      classroom:
        '• Proposer un ou plusieurs courts extraits, portant sur des modèles discursifs différents.\n• Proposer une fiche d’exploitation ou un questionnaire porté au tableau ciblant des objectifs d’évaluation présélectionnés.',
    },
    [assessment2ASOralId]: {
      individual: '• Proposer des exercices d’écoute sélective avec support audio court.',
      classroom: '• Travailler la prise de notes lors d’une première écoute collective.',
    },
  };

  return {
    school: {
      name: 'Abdelhamid DOUROUAZ',
      address: 'Établissement scolaire',
      wilaya: 'Alger',
    },
    academicYear: '2026-2027',
    classes,
    activeClassId: class2ASId,
    pupils,
    assessments,
    activeAssessmentId: assessment2ASEcritId,
    objectives,
    evaluations,
    remediations,
  };
}

const initialState = createSeedState();

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
            if (parsed.classes && Array.isArray(parsed.classes) && parsed.classes.length > 0) {
              setState((prev) => ({
                ...prev,
                ...parsed,
              }));
            } else {
              setState(initialState);
            }
          } catch {
            setState(initialState);
          }
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
    }
  }, [hydrated, state]);

  // Active class helper
  const activeClass = useMemo(() => {
    return state.classes.find((c) => c.id === state.activeClassId) ?? state.classes[0] ?? {
      id: 'default-class',
      name: 'Classe',
      level: 'Niveau',
      academicYear: state.academicYear,
    };
  }, [state.classes, state.activeClassId, state.academicYear]);

  // Active assessment helper
  const activeAssessment = useMemo(() => {
    const found = state.assessments.find((a) => a.id === state.activeAssessmentId);
    if (found) return found;
    // Fallback to first assessment of active class
    const classAssessments = state.assessments.filter((a) => a.classId === state.activeClassId);
    return classAssessments[0] ?? state.assessments[0] ?? {
      id: 'default-assessment',
      classId: state.activeClassId,
      title: 'Nouvelle évaluation',
      date: new Date().toLocaleDateString('fr-FR'),
      subject: 'Français',
      level: activeClass.level,
      competency: 'Compréhension de l’écrit',
      support: '',
      sessionObjectives: '',
      status: 'Draft',
    };
  }, [state.assessments, state.activeAssessmentId, state.activeClassId, activeClass.level]);

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

  const deleteClass = (classId: string) => {
    setState((prev) => {
      const remainingClasses = prev.classes.filter((c) => c.id !== classId);
      if (remainingClasses.length === 0) return prev;
      const nextActiveId = remainingClasses[0].id;
      return {
        ...prev,
        classes: remainingClasses,
        activeClassId: prev.activeClassId === classId ? nextActiveId : prev.activeClassId,
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
      const regNo = pupil.registrationNumber.trim();
      const key = regNo.toLowerCase();
      if (!regNo || existing.has(key)) {
        skipped += 1;
        return;
      }
      existing.add(key);
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
      if (remaining.length === 0) return prev;
      return {
        ...prev,
        assessments: remaining,
        activeAssessmentId:
          prev.activeAssessmentId === assessmentId ? remaining[0].id : prev.activeAssessmentId,
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
      return {
        ...prev,
        objectives: {
          ...prev.objectives,
          [assessmentId]: filtered,
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

      // Methods
      createClass,
      setActiveClass,
      deleteClass,
      addPupils,
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
