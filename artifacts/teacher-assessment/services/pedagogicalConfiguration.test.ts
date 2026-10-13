import assert from 'node:assert/strict';
import {
  cloneSchoolYearConfiguration,
  createDefaultSchoolYearConfiguration,
  getObjectivesForPair,
  getPrerequisitesForPair,
  migrateSchoolYearConfigurations,
} from './pedagogicalConfiguration.ts';

const configuration = createDefaultSchoolYearConfiguration('2026-2027');
const level = configuration.levels.find((item) => item.name === '2AS');
const competency = configuration.competencies.find(
  (item) => item.id === 'comprehension-ecrite',
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

const cloned = cloneSchoolYearConfiguration(configuration, '2027-2028');
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
  '2026-2027',
  [],
  [],
  {},
);
const migratedLevel = migrated[0].levels.find((item) => item.name === '2AS');
const migratedCompetency = migrated[0].competencies.find(
  (item) => item.id === 'comprehension-ecrite',
);
assert.ok(migratedLevel);
assert.ok(migratedCompetency);
assert.equal(
  getPrerequisitesForPair(
    migrated[0],
    migratedLevel.id,
    migratedCompetency.id,
  ).length,
  7,
);

console.log('Tests de configuration des prérequis réussis.');
