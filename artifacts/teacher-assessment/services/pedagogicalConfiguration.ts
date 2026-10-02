import { COMPETENCY_TEMPLATES } from '@/constants/competencies';

export type SchoolLevel = {
  id: string;
  name: string;
};

export type SchoolCompetency = {
  id: string;
  name: string;
  templateId?: string;
};

export type LevelCompetencyAssociation = {
  levelId: string;
  competencyId: string;
};

export type ConfiguredObjective = {
  id: string;
  levelId: string;
  competencyId: string;
  order: number;
  description: string;
};

export type SchoolYearConfiguration = {
  year: string;
  levels: SchoolLevel[];
  competencies: SchoolCompetency[];
  associations: LevelCompetencyAssociation[];
  objectives: ConfiguredObjective[];
};

export type LegacyClass = {
  id: string;
  level?: string;
  levelId?: string;
  academicYear?: string;
};

export type LegacyAssessment = {
  id: string;
  classId: string;
  competency: string;
  competencyId?: string;
};

export type LegacyObjective = {
  id: string;
  order?: number;
  description: string;
};

export const DEFAULT_SCHOOL_LEVELS = ['1AM', '2AM', '3AM', '4AM'];

export function normalizeLabel(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

export function createConfigId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = normalizeLabel(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function createDefaultObjectiveRows(
  levelId: string,
  competencyId: string,
  descriptions: string[],
): ConfiguredObjective[] {
  return descriptions
    .map((description) => description.trim())
    .filter(Boolean)
    .map((description, index) => ({
      id: createConfigId('objective'),
      levelId,
      competencyId,
      order: index + 1,
      description,
    }));
}

export function createDefaultSchoolYearConfiguration(
  year: string,
  additionalLevels: string[] = [],
): SchoolYearConfiguration {
  const levels: SchoolLevel[] = uniqueLabels([
    ...DEFAULT_SCHOOL_LEVELS,
    ...additionalLevels,
  ]).map((name) => ({
    id: createConfigId('level'),
    name,
  }));
  const competencies: SchoolCompetency[] = COMPETENCY_TEMPLATES.map(
    (template) => ({
      id: template.id,
      name: template.name,
      templateId: template.id,
    }),
  );
  const associations: LevelCompetencyAssociation[] = [];
  const objectives: ConfiguredObjective[] = [];

  levels.forEach((level) => {
    competencies.forEach((competency) => {
      associations.push({ levelId: level.id, competencyId: competency.id });
      const template = COMPETENCY_TEMPLATES.find(
        (item) => item.id === competency.templateId,
      );
      objectives.push(
        ...createDefaultObjectiveRows(
          level.id,
          competency.id,
          template?.defaultObjectives ?? ['Objectif 1'],
        ),
      );
    });
  });

  return { year: year.trim(), levels, competencies, associations, objectives };
}

function normalizeSavedConfiguration(
  value: unknown,
): SchoolYearConfiguration | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<SchoolYearConfiguration>;
  if (typeof raw.year !== 'string' || !raw.year.trim()) return undefined;

  const levels: SchoolLevel[] = Array.isArray(raw.levels)
    ? raw.levels.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const item = entry as Partial<SchoolLevel>;
        return typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          item.name.trim()
          ? [{ id: item.id, name: item.name.trim() }]
          : [];
      })
    : [];
  const competencies: SchoolCompetency[] = Array.isArray(raw.competencies)
    ? raw.competencies.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const item = entry as Partial<SchoolCompetency>;
        return typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          item.name.trim()
          ? [
              {
                id: item.id,
                name: item.name.trim(),
                ...(item.templateId ? { templateId: item.templateId } : {}),
              },
            ]
          : [];
      })
    : [];
  const levelIds = new Set(levels.map((item) => item.id));
  const competencyIds = new Set(competencies.map((item) => item.id));
  const associations: LevelCompetencyAssociation[] = Array.isArray(
    raw.associations,
  )
    ? raw.associations.filter(
        (item): item is LevelCompetencyAssociation =>
          Boolean(item) &&
          typeof item.levelId === 'string' &&
          levelIds.has(item.levelId) &&
          typeof item.competencyId === 'string' &&
          competencyIds.has(item.competencyId),
      )
    : [];
  const objectives: ConfiguredObjective[] = Array.isArray(raw.objectives)
    ? raw.objectives.flatMap((entry, index) => {
        if (!entry || typeof entry !== 'object') return [];
        const item = entry as Partial<ConfiguredObjective>;
        return typeof item.levelId === 'string' &&
          levelIds.has(item.levelId) &&
          typeof item.competencyId === 'string' &&
          competencyIds.has(item.competencyId) &&
          typeof item.description === 'string' &&
          item.description.trim()
          ? [
              {
                id:
                  typeof item.id === 'string'
                    ? item.id
                    : createConfigId('objective'),
                levelId: item.levelId,
                competencyId: item.competencyId,
                order: typeof item.order === 'number' ? item.order : index + 1,
                description: item.description.trim(),
              },
            ]
          : [];
      })
    : [];

  return {
    year: raw.year.trim(),
    levels,
    competencies,
    associations,
    objectives,
  };
}

export function cloneSchoolYearConfiguration(
  source: SchoolYearConfiguration,
  targetYear: string,
): SchoolYearConfiguration {
  const levelIds = new Map(
    source.levels.map((level) => [level.id, createConfigId('level')]),
  );
  const competencyIds = new Map(
    source.competencies.map((competency) => [
      competency.id,
      createConfigId('competency'),
    ]),
  );

  return {
    year: targetYear.trim(),
    levels: source.levels.map((level) => ({
      ...level,
      id: levelIds.get(level.id)!,
    })),
    competencies: source.competencies.map((competency) => ({
      ...competency,
      id: competencyIds.get(competency.id)!,
    })),
    associations: source.associations.flatMap((association) => {
      const levelId = levelIds.get(association.levelId);
      const competencyId = competencyIds.get(association.competencyId);
      return levelId && competencyId ? [{ levelId, competencyId }] : [];
    }),
    objectives: source.objectives.flatMap((objective) => {
      const levelId = levelIds.get(objective.levelId);
      const competencyId = competencyIds.get(objective.competencyId);
      return levelId && competencyId
        ? [
            {
              ...objective,
              id: createConfigId('objective'),
              levelId,
              competencyId,
            },
          ]
        : [];
    }),
  };
}

export function migrateSchoolYearConfigurations(
  saved: unknown,
  activeYear: string,
  classes: LegacyClass[],
  assessments: LegacyAssessment[],
  objectivesByAssessment: Record<string, LegacyObjective[]>,
): SchoolYearConfiguration[] {
  const savedConfigurations = Array.isArray(saved)
    ? saved
        .map(normalizeSavedConfiguration)
        .filter((item): item is SchoolYearConfiguration => Boolean(item))
    : [];
  const years = uniqueLabels([
    activeYear,
    ...classes.map((item) => item.academicYear ?? ''),
    ...savedConfigurations.map((item) => item.year),
  ]);

  return years.map((year) => {
    const existing = savedConfigurations.find(
      (item) => normalizeLabel(item.year) === normalizeLabel(year),
    );
    if (existing) {
      return {
        ...existing,
        levels: [...existing.levels],
        competencies: [...existing.competencies],
        associations: [...existing.associations],
        objectives: [...existing.objectives],
      };
    }

    const configuration = createDefaultSchoolYearConfiguration(
      year,
      classes
        .filter(
          (item) =>
            normalizeLabel(item.academicYear ?? '') === normalizeLabel(year),
        )
        .map((item) => item.level ?? ''),
    );
    const yearClasses = classes.filter(
      (item) =>
        normalizeLabel(item.academicYear ?? activeYear) ===
        normalizeLabel(year),
    );
    const migratedPairs = new Set<string>();

    yearClasses.forEach((classItem) => {
      const levelName = classItem.level?.trim();
      if (!levelName) return;
      let level =
        (classItem.levelId &&
          configuration.levels.find((item) => item.id === classItem.levelId)) ||
        configuration.levels.find(
          (item) => normalizeLabel(item.name) === normalizeLabel(levelName),
        );
      if (!level) {
        level = { id: createConfigId('level'), name: levelName };
        configuration.levels.push(level);
      }

      assessments
        .filter((item) => item.classId === classItem.id)
        .forEach((assessment) => {
          const template = COMPETENCY_TEMPLATES.find(
            (item) =>
              normalizeLabel(item.name) ===
              normalizeLabel(assessment.competency),
          );
          let competency =
            (assessment.competencyId &&
              configuration.competencies.find(
                (item) => item.id === assessment.competencyId,
              )) ||
            configuration.competencies.find(
              (item) =>
                normalizeLabel(item.name) ===
                normalizeLabel(assessment.competency),
            );
          if (!competency) {
            competency = {
              id: assessment.competencyId || createConfigId('competency'),
              name: assessment.competency.trim(),
              ...(template ? { templateId: template.id } : {}),
            };
            configuration.competencies.push(competency);
          }

          const linked = configuration.associations.some(
            (item) =>
              item.levelId === level!.id &&
              item.competencyId === competency!.id,
          );
          if (!linked) {
            configuration.associations.push({
              levelId: level!.id,
              competencyId: competency!.id,
            });
          }

          const pairKey = `${level.id}:${competency.id}`;
          if (!migratedPairs.has(pairKey)) {
            migratedPairs.add(pairKey);
            const legacyDescriptions = (
              objectivesByAssessment[assessment.id] ?? []
            )
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((item) => item.description);
            if (legacyDescriptions.length) {
              configuration.objectives = configuration.objectives.filter(
                (item) =>
                  item.levelId !== level!.id ||
                  item.competencyId !== competency!.id,
              );
              configuration.objectives.push(
                ...createDefaultObjectiveRows(
                  level.id,
                  competency.id,
                  legacyDescriptions,
                ),
              );
            } else if (
              !configuration.objectives.some(
                (item) =>
                  item.levelId === level!.id &&
                  item.competencyId === competency!.id,
              )
            ) {
              const descriptions = template?.defaultObjectives ?? [
                'Objectif 1',
              ];
              configuration.objectives.push(
                ...createDefaultObjectiveRows(
                  level.id,
                  competency.id,
                  descriptions,
                ),
              );
            }
          }
        });
    });

    return configuration;
  });
}

export function getObjectivesForPair(
  configuration: SchoolYearConfiguration | undefined,
  levelId: string,
  competencyId: string,
): ConfiguredObjective[] {
  if (!configuration) return [];
  return configuration.objectives
    .filter(
      (item) => item.levelId === levelId && item.competencyId === competencyId,
    )
    .sort((a, b) => a.order - b.order);
}
