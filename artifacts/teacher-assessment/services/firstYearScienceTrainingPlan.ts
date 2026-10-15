import {
  createEmptyTrainingPlanGaps,
  type SequenceActivityType,
  type TrainingPlan,
  type TrainingPlanSession,
  type TrainingProject,
  type TrainingSequence,
  type TrainingStudyObject,
  type TrainingSessionType,
} from './trainingPlan.ts';

type Lesson = {
  type: SequenceActivityType;
  title: string;
  objective: string;
  durationHours: number;
};

type SequenceInput = {
  title: string;
  durationHours: number;
  oralComprehension: string;
  oralProduction: string;
  writtenComprehension: [string, string, string];
  writtenProduction: [string, string, string];
  lessonDurations?: [number, number, number, number, number, number, number, number, number];
  durationNote?: string;
};

export function createFirstYearScienceTrainingPlan(
  filiereId: string,
  schoolYearId: string,
  createId: (prefix: string) => string,
): TrainingPlan {
  const makeSession = (
    type: TrainingSessionType,
    title: string,
    objective: string,
    durationHours: number,
    order: number,
  ): TrainingPlanSession => ({
    id: createId('training-session'),
    type,
    title,
    objective,
    durationHours,
    order,
  });

  const makeSequence = (input: SequenceInput): TrainingSequence => {
    const lessonDurations = input.lessonDurations ?? [
      5 / 3, 5 / 3, 5 / 3, 5 / 3, 5 / 3, 5 / 3, 5 / 3, 5 / 3, 5 / 3,
    ];
    const lessons: Lesson[] = [
      {
        type: 'mise-en-place',
        title: 'Mise en place de la séquence',
        objective: 'Présenter l’objectif de la séquence, expliquer les mots clés et lancer le sujet de la production écrite.',
        durationHours: lessonDurations[0],
      },
      {
        type: 'comprehension-orale',
        title: 'Compréhension de l’oral',
        objective: input.oralComprehension,
        durationHours: lessonDurations[1],
      },
      {
        type: 'production-orale',
        title: 'Production de l’oral',
        objective: input.oralProduction,
        durationHours: lessonDurations[2],
      },
      ...input.writtenComprehension.map((objective, index) => ({
        type: 'comprehension-ecrite' as const,
        title: `Compréhension de l’écrit n° ${index + 1}`,
        objective,
        durationHours: lessonDurations[index + 3],
      })),
      ...input.writtenProduction.map((objective, index) => ({
        type: 'production-ecrite' as const,
        title: `Production de l’écrit n° ${index + 1}`,
        objective,
        durationHours: lessonDurations[index + 6],
      })),
    ];
    return {
      id: createId('training-sequence'),
      title: input.title,
      order: 0,
      durationHours: input.durationHours,
      durationNote: input.durationNote,
      sessions: lessons.map((lesson, order) =>
        makeSession(
          lesson.type,
          lesson.title,
          lesson.objective,
          lesson.durationHours,
          order,
        ),
      ),
    };
  };

  const makeStudyObject = (
    title: string,
    diagnosticObjective: string,
    sequences: TrainingSequence[],
    order: number,
  ): TrainingStudyObject => ({
    id: createId('study-object'),
    title,
    order,
    diagnostic: makeSession(
      'diagnostic',
      'Évaluation diagnostique',
      diagnosticObjective,
      1,
      0,
    ),
    sequences: sequences.map((sequence, sequenceOrder) => ({
      ...sequence,
      order: sequenceOrder,
    })),
  });

  const makeProject = (
    title: string,
    durationHours: number,
    launchObjective: string,
    studyObjects: TrainingStudyObject[],
    order: number,
  ): TrainingProject => ({
    id: createId('training-project'),
    title,
    order,
    durationHours,
    launch: makeSession(
      'lancement',
      'Lancement du projet',
      launchObjective,
      1,
      0,
    ),
    studyObjects,
  });

  const project1Sequence1 = makeSequence({
    title: 'Produire un texte de vulgarisation scientifique à partir d’informations données ou recueillies',
    durationHours: 18,
    lessonDurations: [1, 1, 1, 2, 2, 2, 2, 2, 2],
    durationNote: 'Le volume officiel est de 18 h, mais les durées détaillées des séances dans la source totalisent 15 h.',
    oralComprehension: 'Écouter un discours oral pour en dégager l’essentiel, ses caractéristiques, et le restituer sous forme de plan ou de prise de notes.',
    oralProduction: 'Expliquer oralement un phénomène scientifique, à partir d’une prise de notes ou d’un plan.',
    writtenComprehension: [
      'Lire un texte de vulgarisation pour en dégager les informations principales sous forme de plan.',
      'Étudier les faits de langue (nominalisation, substitution lexicale, passivation, effacement du locuteur) en relation avec la visée explicative.',
      'Dégager les caractéristiques du genre (neutralité, présent de vérité générale, progression thématique). Cette séance prépare la grille d’évaluation.',
    ],
    writtenProduction: [
      'Analyser le sujet inducteur, élaborer collectivement la grille d’autoévaluation et le plan, puis rédiger le premier jet.',
      'Autoévaluer sa production avec la grille, puis la réécrire.',
      'Coévaluer une production d’élève, proposer des corrections et améliorer le texte. Mettre en place la technique du résumé.',
    ],
  });

  const project1Sequence2 = makeSequence({
    title: 'Produire un questionnaire pertinent en vue de s’informer sur un thème scientifique',
    durationHours: 15,
    oralComprehension: 'Écouter une interview pour retrouver la double situation d’énonciation et les caractéristiques du discours, puis en dégager l’information.',
    oralProduction: 'Produire des interviews sous forme de jeux de rôles à partir d’une situation d’intégration.',
    writtenComprehension: [
      'Repérer les niveaux d’organisation d’une interview (ouverture, développement, clôture) et la structure du questionnement.',
      'Extraire l’information d’une interview sous forme de plan.',
      'Étudier les faits de langue de l’oral (marqueurs de structure, injonction atténuée, marques personnelles « je/vous/on »).',
    ],
    writtenProduction: [
      'Analyser le sujet, élaborer collectivement la grille, rédiger le premier jet du questionnaire.',
      'Autoévaluer le questionnaire, puis le réécrire.',
      'Coévaluer le questionnaire, enseigner puis appliquer la technique de la prise de notes. Socialisation du projet.',
    ],
  });

  const project2Sequence1 = makeSequence({
    title: 'Produire un texte argumentatif pour défendre une opinion',
    durationHours: 15,
    oralComprehension: 'Écouter un discours argumentatif pour en dégager l’essentiel, réagir, ou le restituer sous forme de plan ou de résumé.',
    oralProduction: 'Produire des énoncés argumentatifs pour défendre son point de vue, devant un auditoire.',
    writtenComprehension: [
      'Lire un texte argumentatif pour en sélectionner les informations sous forme de plan.',
      'Étudier les articulateurs logiques de cause et de conséquence, et les connecteurs argumentatifs.',
      'Dégager les caractéristiques du discours argumentatif (thèse, arguments, solutions) et les restituer sous forme de résumé.',
    ],
    writtenProduction: [
      'Analyser le sujet, élaborer la grille et le plan de rédaction, puis rédiger le premier jet.',
      'Autoévaluer le texte argumentatif, puis le réécrire.',
      'Coévaluer une production, améliorer le texte et vérifier la cohérence de l’argumentation.',
    ],
  });

  const project2Sequence2 = makeSequence({
    title: 'Produire une lettre ouverte',
    durationHours: 15,
    oralComprehension: 'Écouter un discours argumentatif pour en dégager l’essentiel, puis le restituer sous forme de plan ou de résumé.',
    oralProduction: 'Produire des énoncés argumentatifs pour dénoncer une situation, des énoncés injonctifs en jeu de rôles, et prendre la parole devant un auditoire.',
    writtenComprehension: [
      'Lire une lettre ouverte pour en sélectionner les informations sous forme de plan.',
      'Étudier les faits de langue (verbes de demande, valeur du conditionnel présent, lexique mélioratif et péjoratif, statuts énonciateur et énonciataire).',
      'Dégager les caractéristiques de la lettre ouverte (paratexte, date, rédacteur, formule introductive, corps, formule conclusive, signature).',
    ],
    writtenProduction: [
      'Analyser le sujet, élaborer la grille et le plan, puis rédiger le premier jet de la lettre.',
      'Autoévaluer la lettre, puis la réécrire.',
      'Coévaluer la lettre, améliorer le texte. Bilan et réorientations du projet.',
    ],
  });

  const project3Sequence = makeSequence({
    title: 'Produire un récit vraisemblable',
    durationHours: 15,
    oralComprehension: 'Écouter un récit pour en dégager sa structure, réagir, ou en faire le résumé.',
    oralProduction: 'Raconter une anecdote, ou raconter à partir d’informations biographiques.',
    writtenComprehension: [
      'Lire une nouvelle réaliste pour en sélectionner les informations principales sous forme de schéma narratif ou actantiel.',
      'Étudier les temps du récit (passé simple au premier plan, imparfait et plus-que-parfait à l’arrière-plan) et l’ancrage du fictif dans le réel.',
      'Dégager les caractéristiques de la nouvelle réaliste (narration, portrait, relation entre portrait, paroles et actions du personnage principal) et restituer le contenu en résumé.',
    ],
    writtenProduction: [
      'Analyser le sujet, élaborer la grille et le plan, puis rédiger le premier jet de la biographie romancée.',
      'Autoévaluer la biographie, puis la réécrire.',
      'Coévaluer la biographie, améliorer le texte. Socialisation du projet.',
    ],
  });

  return {
    id: createId('training-plan'),
    filiereId,
    schoolYearId,
    filiereName: 'Tronc commun sciences et technologies',
    sourceNote: 'Progressions annuelles de français, 1ère AS (sciences et technologies) · 78 h · 26 semaines × 3 h.',
    projects: [
      makeProject(
        'Réaliser une campagne d’information sur un thème scientifique à l’intention des élèves du lycée',
        33,
        'Négocier les termes, les modalités et l’évaluation de la campagne. Reformuler l’intitulé en situation d’intégration.',
        [
          makeStudyObject(
            'Les textes de vulgarisation de l’information scientifique',
            'Évaluer les prérequis : identifier le texte explicatif, restituer l’information essentielle (nominalisation, substitution), formuler une explication, identifier les articulateurs de classement.',
            [project1Sequence1],
            0,
          ),
          makeStudyObject(
            'L’interview',
            'Évaluer les prérequis : identifier le modèle de l’interview, les interlocuteurs, les circonstances, les formules d’ouverture et de clôture.',
            [project1Sequence2],
            1,
          ),
        ],
        0,
      ),
      makeProject(
        'Rédiger une lettre ouverte à une autorité compétente pour la sensibiliser à un problème et lui proposer des solutions',
        30,
        'Négocier le problème à traiter, le destinataire visé et les modalités de l’évaluation. Reformuler l’intitulé en situation d’intégration.',
        [
          makeStudyObject(
            'Le discours argumentatif (la lettre ouverte)',
            'Évaluer les prérequis : modèle argumentatif (thèse, arguments, conclusion), identification des arguments et des exemples, articulateurs logiques, de classement et d’illustration, verbes d’opinion.',
            [project2Sequence1, project2Sequence2],
            0,
          ),
        ],
        1,
      ),
      makeProject(
        'Écrire une courte biographie romancée concernant une personnalité nationale ou locale à partir d’informations succinctes',
        15,
        'Négocier le choix de la personnalité, les modalités de la biographie et l’évaluation. Reformuler l’intitulé en situation d’intégration.',
        [
          makeStudyObject(
            'La nouvelle réaliste',
            'Évaluer les prérequis : constituants du récit (narrateur, personnages, cadre spatio-temporel), structure du récit, distinction récit et dialogue, description, discours rapporté, temps du récit (passé simple, imparfait, conditionnel présent), résumé du texte narratif.',
            [project3Sequence],
            0,
          ),
        ],
        2,
      ),
    ],
    gaps: createEmptyTrainingPlanGaps(),
  };
}
