import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type EvaluationValue =
  | 'NotEvaluated'
  | 'Acquired'
  | 'PartiallyAcquired'
  | 'NotAcquired';

export type Pupil = {
  id: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  classId: string;
  dateOfBirth?: string;
};

export type Objective = {
  id: string;
  order: number;
  description: string;
};

export type Assessment = {
  id: string;
  title: string;
  date: string;
  classId: string;
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

type School = {
  name: string;
  address: string;
  wilaya: string;
};

type AppState = {
  school: School;
  academicYear: string;
  className: string;
  level: string;
  classId: string;
  pupils: Pupil[];
  assessment: Assessment;
  objectives: Objective[];
  evaluations: Record<string, Record<string, EvaluationValue>>;
  individualRemediation: string;
  classRemediation: string;
};

type AppDataContextValue = AppState & {
  hydrated: boolean;
  isDirty: boolean;
  syncStatus: 'synced' | 'pending';
  setEvaluation: (pupilId: string, objectiveId: string, value: EvaluationValue) => void;
  cycleEvaluation: (pupilId: string, objectiveId: string) => void;
  setAllForObjective: (objectiveId: string, value: EvaluationValue) => void;
  clearAssessment: () => void;
  saveDraft: () => void;
  markSynced: () => void;
  statistics: AssessmentStatistics[];
};

const STORAGE_KEY = '@teacher-assessment/app-state-v1';

const objectiveDescriptions = [
  "Repérer le thème principal d’un texte.",
  "Comprendre les idées essentielles du texte.",
  "Identifier les outils linguistiques utilisés.",
  "Identifier les procédés explicatifs utilisés dans un texte.",
  "Repérer l’utilisation de l’indicatif présent à valeur de vérité générale.",
  "Savoir en déduire la visée.",
];

const pupilNames = [
  ['Ahmed', 'Benali'], ['Mohamed', 'X'], ['Ali', 'Kaci'], ['Yasmine', 'Brahimi'],
  ['Sofiane', 'Mansouri'], ['Inès', 'Saïdi'], ['Lina', 'Cherif'], ['Walid', 'Boudiaf'],
  ['Nour', 'Hadjiri'], ['Meriem', 'Amrani'], ['Adam', 'Belkacem'], ['Rania', 'Ghezali'],
  ['Ilyes', 'Zerrouki'], ['Aya', 'Meziane'], ['Anis', 'Dahmani'], ['Sarah', 'Touati'],
  ['Rayane', 'Khelifa'], ['Malak', 'Ferhat'], ['Yacine', 'Bensaïd'], ['Imane', 'Rahmani'],
  ['Omar', 'Aït Ali'], ['Selma', 'Mebarki'], ['Hichem', 'Ziani'], ['أمين', 'بن عمر'],
];

function createSeedState(): AppState {
  const pupils = pupilNames.map(([firstName, lastName], index) => ({
    id: `44444444-4444-4444-8444-4444444444${String(index + 1).padStart(2, '0')}`,
    registrationNumber: `${String(index + 1).padStart(2, '0')}`,
    firstName,
    lastName,
    classId: '33333333-3333-4333-8333-333333333333',
  }));
  const objectives = objectiveDescriptions.map((description, index) => ({
    id: `66666666-6666-4666-8666-6666666666${String(index + 1).padStart(2, '0')}`,
    order: index + 1,
    description,
  }));
  const evaluations: AppState['evaluations'] = {};
  pupils.forEach((pupil, pupilIndex) => {
    evaluations[pupil.id] = {};
    objectives.forEach((objective, objectiveIndex) => {
      const pattern = (pupilIndex * 3 + objectiveIndex) % 9;
      evaluations[pupil.id][objective.id] =
        pattern < 5 ? 'Acquired' : pattern < 7 ? 'PartiallyAcquired' : pattern < 8 ? 'NotAcquired' : 'NotEvaluated';
    });
  });

  return {
    school: {
      name: 'Abdelhamid DOUROUAZ',
      address: 'Établissement scolaire',
      wilaya: 'Alger',
    },
    academicYear: '2026-2027',
    className: '2AS LPH2',
    level: '2AS',
    classId: '33333333-3333-4333-8333-333333333333',
    pupils,
    assessment: {
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Compréhension de l’écrit',
      date: '28/09/2026',
      classId: 'class-2as-lph2',
      subject: 'Français',
      level: '2AS',
      competency: 'Compréhension de l’écrit',
      support: 'Texte explicatif à visée informative',
      sessionObjectives: 'Comprendre et interpréter des textes écrits en vue de développer la compréhension.',
      status: 'InProgress',
    },
    objectives,
    evaluations,
    individualRemediation: 'Encourager les élèves à lire régulièrement des textes à la maison afin de développer leur capacité de compréhension et d’analyse.',
    classRemediation: 'Proposer un ou plusieurs courts extraits, portant sur des modèles discursifs différents.',
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
            setState(JSON.parse(stored) as AppState);
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

  const setEvaluation = (pupilId: string, objectiveId: string, value: EvaluationValue) => {
    setState((current) => ({
      ...current,
      evaluations: {
        ...current.evaluations,
        [pupilId]: {
          ...current.evaluations[pupilId],
          [objectiveId]: value,
        },
      },
    }));
    setIsDirty(true);
    setSyncStatus('pending');
  };

  const cycleEvaluation = (pupilId: string, objectiveId: string) => {
    const current = state.evaluations[pupilId]?.[objectiveId] ?? 'NotEvaluated';
    const next: EvaluationValue =
      current === 'NotEvaluated' ? 'Acquired' :
      current === 'Acquired' ? 'PartiallyAcquired' :
      current === 'PartiallyAcquired' ? 'NotAcquired' : 'NotEvaluated';
    setEvaluation(pupilId, objectiveId, next);
  };

  const setAllForObjective = (objectiveId: string, value: EvaluationValue) => {
    setState((current) => {
      const evaluations = { ...current.evaluations };
      current.pupils.forEach((pupil) => {
        evaluations[pupil.id] = { ...evaluations[pupil.id], [objectiveId]: value };
      });
      return { ...current, evaluations };
    });
    setIsDirty(true);
    setSyncStatus('pending');
  };

  const clearAssessment = () => {
    setState((current) => {
      const evaluations: AppState['evaluations'] = {};
      current.pupils.forEach((pupil) => {
        evaluations[pupil.id] = {};
        current.objectives.forEach((objective) => {
          evaluations[pupil.id][objective.id] = 'NotEvaluated';
        });
      });
      return { ...current, evaluations };
    });
    setIsDirty(true);
    setSyncStatus('pending');
  };

  const statistics = useMemo(() => state.objectives.map((objective) => {
    let evaluated = 0;
    let acquired = 0;
    let partiallyAcquired = 0;
    let notAcquired = 0;
    state.pupils.forEach((pupil) => {
      const value = state.evaluations[pupil.id]?.[objective.id] ?? 'NotEvaluated';
      if (value !== 'NotEvaluated') evaluated += 1;
      if (value === 'Acquired') acquired += 1;
      if (value === 'PartiallyAcquired') partiallyAcquired += 1;
      if (value === 'NotAcquired') notAcquired += 1;
    });
    return {
      objectiveId: objective.id,
      evaluated,
      notEvaluated: state.pupils.length - evaluated,
      acquired,
      partiallyAcquired,
      notAcquired,
      acquiredPercent: evaluated ? Math.round((acquired / evaluated) * 100) : 0,
    };
  }), [state]);

  const value = useMemo<AppDataContextValue>(() => ({
    ...state,
    hydrated,
    isDirty,
    syncStatus,
    setEvaluation,
    cycleEvaluation,
    setAllForObjective,
    clearAssessment,
    saveDraft: () => {
      setIsDirty(false);
      setSyncStatus('pending');
    },
    markSynced: () => setSyncStatus('synced'),
    statistics,
  }), [state, hydrated, isDirty, syncStatus, statistics]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used within AppDataProvider');
  return context;
}
