export type CompetencyTemplate = {
  id: string;
  name: string; // e.g. "Compréhension de l'écrit"
  defaultTitle: string;
  defaultSupport: string;
  defaultSessionObjectives: string;
  defaultObjectives: string[];
};

export const COMPETENCY_TEMPLATES: CompetencyTemplate[] = [
  {
    id: 'comprehension-ecrite',
    name: 'Compréhension de l’écrit',
    defaultTitle: 'Compréhension de l’écrit',
    defaultSupport: 'Des extraits écrits',
    defaultSessionObjectives: 'Comprendre et interpréter des textes écrits en vue',
    defaultObjectives: [
      "Repérer le thème principal d’un texte explicatif et comprendre les idées essentielles.",
      "Dégager le temps verbal dominant et préciser sa valeur.",
      "Identifier les marques d’objectivité (phrases impersonnelles) et relever les procédés explicatifs.",
      "Dégager la visée communicative d’un texte explicatif.",
      "Identifier les personnages du récit.",
      "Dégager le schéma narratif du texte.",
      "Repérer les temps de narration.",
      "Identifier le thème d’un texte argumentatif.",
      "Dégager la thèse défendue et les arguments avancés.",
      "Repérer les marques de présence de l’auteur.",
      "Dégager la visée communicative d’un discours argumentatif."
    ],
  },
  {
    id: 'comprehension-orale',
    name: 'Compréhension de l’oral',
    defaultTitle: 'Compréhension de l’oral',
    defaultSupport: 'Document sonore / audiovisuel',
    defaultSessionObjectives: 'Écouter et comprendre un document oral en vue de restituer les informations principales',
    defaultObjectives: [
      "Identifier la situation de communication orale (qui parle, à qui, de quoi).",
      "Repérer le thème général et dégager les idées maîtresses du document sonore.",
      "Identifier les marques énonciatives et les indices de subjectivité à l’oral.",
      "Dégager la visée communicative du message oral (informer, convaincre, expliquer).",
      "Repérer les connecteurs et la progression des arguments énoncés.",
      "Reformuler et synthétiser les informations clés entendues."
    ],
  },
  {
    id: 'production-ecrite',
    name: 'Production de l’écrit',
    defaultTitle: 'Production de l’écrit',
    defaultSupport: 'Consigne d’écriture et grille critériée',
    defaultSessionObjectives: 'Produire un texte écrit cohérent et structuré selon le modèle discursif requis',
    defaultObjectives: [
      "Respecter la consigne et le type de discours visé (explicatif, argumentatif, narratif).",
      "Structurer le texte avec une organisation logique (introduction, développement, conclusion).",
      "Utiliser les connecteurs logiques et chronologiques adéquats.",
      "Mobiliser un vocabulaire précis, varié et approprié au sujet.",
      "Maîtriser la concordance des temps et les accords grammaticaux.",
      "Respecter les règles syntaxiques et la ponctuation.",
      "Soigner la présentation matérielle et la lisibilité de la copie."
    ],
  },
  {
    id: 'production-orale',
    name: 'Production de l’oral',
    defaultTitle: 'Production de l’oral',
    defaultSupport: 'Sujet d’exposé ou de débat thématique',
    defaultSessionObjectives: 'Prendre la parole en continu et interagir de manière efficace dans un échange',
    defaultObjectives: [
      "S’exprimer avec audibilité, articulation claire et débit adapté.",
      "Organiser et enchaîner son discours de façon claire et ordonnée.",
      "Employer un registre de langue adapté à la situation d’échange.",
      "Défendre un point de vue avec des arguments et exemples pertinents.",
      "Interagir avec ses pairs et écouter activement les interventions.",
      "Accompagner la parole d’une posture et d’un contact visuel appropriés."
    ],
  },
];
