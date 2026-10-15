import assert from "node:assert/strict";
import {
  cloneSchoolYearConfiguration,
  createDefaultSchoolYearConfiguration,
  getObjectivesForPair,
  getPrerequisitesForPair,
  migrateSchoolYearConfigurations,
} from "./pedagogicalConfiguration.ts";
import { parseObjectiveListFile } from "./objectiveListImport.ts";

const configuration = createDefaultSchoolYearConfiguration("2026-2027");
assert.deepEqual(
  parseObjectiveListFile('\uFEFF- Identifier le thème\n2) Repérer les idées principales\n\nConclure'),
  ['Identifier le thème', 'Repérer les idées principales', 'Conclure'],
  "Un fichier TXT avec listes numérotées ou à puces importe une ligne par objectif",
);
assert.deepEqual(
  parseObjectiveListFile('Prérequis;Ordre\n"Identifier le thème; général";1\nRepérer les connecteurs;2', 'csv'),
  ['Identifier le thème; général', 'Repérer les connecteurs'],
  "Un fichier CSV importe la colonne identifiée en préservant les délimiteurs cités",
);
assert.deepEqual(
  parseObjectiveListFile('1;Distinguer les idées\n2;Repérer les connecteurs', 'csv'),
  ['Distinguer les idées', 'Repérer les connecteurs'],
  "Un fichier CSV numéroté sans en-tête importe la colonne de texte",
);
assert.deepEqual(
  parseObjectiveListFile(' \n  ', 'txt'),
  [],
  "Un fichier vide ne produit aucun objectif",
);
assert.equal(
  configuration.competencies.some(
    (item) => item.name === "Évaluation diagnostique",
  ),
  false,
  "L’évaluation diagnostique n’est pas modélisée comme une compétence",
);
const level = configuration.levels.find((item) => item.name === "2AS");
const competency = configuration.competencies.find(
  (item) => item.id === "comprehension-ecrite",
);

assert.ok(level);
assert.ok(competency);
const prerequisites = getPrerequisitesForPair(
  configuration,
  level.id,
  competency.id,
);
assert.equal(prerequisites.length, 7);
assert.match(prerequisites[0].description, /thème/i);
assert.equal(
  getObjectivesForPair(configuration, level.id, competency.id).length,
  11,
);

const cloned = cloneSchoolYearConfiguration(configuration, "2027-2028");
const clonedLevel = cloned.levels.find((item) => item.name === level.name);
const clonedCompetency = cloned.competencies.find(
  (item) => item.name === competency.name,
);
assert.ok(clonedLevel);
assert.ok(clonedCompetency);
assert.equal(
  getPrerequisitesForPair(cloned, clonedLevel.id, clonedCompetency.id).length,
  7,
);
assert.notEqual(
  getPrerequisitesForPair(cloned, clonedLevel.id, clonedCompetency.id)[0].id,
  prerequisites[0].id,
);

const { prerequisiteObjectives: _oldPrerequisites, ...legacyConfiguration } =
  configuration;
void _oldPrerequisites;
const migrated = migrateSchoolYearConfigurations(
  [legacyConfiguration],
  "2026-2027",
  [],
  [],
  {},
);
const migratedLevel = migrated[0].levels.find((item) => item.name === "2AS");
const migratedCompetency = migrated[0].competencies.find(
  (item) => item.id === "comprehension-ecrite",
);
assert.ok(migratedLevel);
assert.ok(migratedCompetency);
assert.equal(
  getPrerequisitesForPair(migrated[0], migratedLevel.id, migratedCompetency.id)
    .length,
  7,
);
assert.equal(
  migrated[0].competencies.some(
    (item) => item.name === "Évaluation diagnostique",
  ),
  false,
  "La migration ne crée pas de compétence diagnostique",
);

console.log("Tests de configuration des prérequis réussis.");
