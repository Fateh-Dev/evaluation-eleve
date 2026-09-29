import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const assessmentStatusEnum = pgEnum("assessment_status", [
  "Draft",
  "InProgress",
  "Completed",
  "Archived",
]);

export const evaluationValueEnum = pgEnum("evaluation_value", [
  "NotEvaluated",
  "Acquired",
  "PartiallyAcquired",
  "NotAcquired",
]);

export const schools = pgTable("schools", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  wilaya: text("wilaya"),
  logo: text("logo"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const academicYears = pgTable("academic_years", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull().unique(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(false),
});

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    level: text("level").notNull(),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id),
    schoolId: uuid("school_id").notNull().references(() => schools.id),
    teacherId: uuid("teacher_id"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    schoolYearIndex: index("classes_school_year_idx").on(table.schoolId, table.academicYearId),
  }),
);

export const pupils = pgTable(
  "pupils",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    registrationNumber: text("registration_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth"),
    gender: text("gender"),
    classId: uuid("class_id").notNull().references(() => classes.id),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    classRegistrationUnique: uniqueIndex("pupils_class_registration_unique").on(
      table.classId,
      table.registrationNumber,
    ),
    lastNameIndex: index("pupils_last_name_idx").on(table.lastName),
    firstNameIndex: index("pupils_first_name_idx").on(table.firstName),
  }),
);

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    date: date("date").notNull(),
    classId: uuid("class_id").notNull().references(() => classes.id),
    teacherId: uuid("teacher_id"),
    subject: text("subject").notNull(),
    level: text("level").notNull(),
    competency: text("competency").notNull(),
    support: text("support"),
    sessionObjectives: text("session_objectives"),
    notes: text("notes"),
    status: assessmentStatusEnum("status").notNull().default("Draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    classDateIndex: index("assessments_class_date_idx").on(table.classId, table.date),
  }),
);

export const assessmentObjectives = pgTable(
  "assessment_objectives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assessmentId: uuid("assessment_id").notNull().references(() => assessments.id),
    order: integer("order").notNull(),
    description: text("description").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => ({
    assessmentOrderUnique: uniqueIndex("assessment_objectives_order_unique").on(
      table.assessmentId,
      table.order,
    ),
  }),
);

export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assessmentId: uuid("assessment_id").notNull().references(() => assessments.id),
    pupilId: uuid("pupil_id").notNull().references(() => pupils.id),
    objectiveId: uuid("objective_id").notNull().references(() => assessmentObjectives.id),
    value: evaluationValueEnum("value").notNull().default("NotEvaluated"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    evaluationUnique: uniqueIndex("evaluations_assessment_pupil_objective_unique").on(
      table.assessmentId,
      table.pupilId,
      table.objectiveId,
    ),
    assessmentIndex: index("evaluations_assessment_idx").on(table.assessmentId),
    pupilIndex: index("evaluations_pupil_idx").on(table.pupilId),
  }),
);

export const assessmentRemediations = pgTable("assessment_remediations", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id),
  scope: text("scope").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});