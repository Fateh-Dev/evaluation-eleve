import { and, asc, count, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  academicYears,
  assessments,
  assessmentObjectives,
  classes,
  db,
  evaluations,
  pupils,
  schools,
} from "@workspace/db";

const router: IRouter = Router();

const evaluationInput = z.object({
  pupilId: z.string().uuid(),
  objectiveId: z.string().uuid(),
  value: z.enum(["NotEvaluated", "Acquired", "PartiallyAcquired", "NotAcquired"]),
});

router.get("/dashboard", async (_req, res, next) => {
  try {
    const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.active, true)).limit(1);
    const [year] = await db.select({ label: academicYears.label }).from(academicYears).where(eq(academicYears.isActive, true)).limit(1);
    const classRows = await db
      .select({
        id: classes.id,
        name: classes.name,
        level: classes.level,
        academicYear: academicYears.label,
        pupilCount: count(pupils.id),
      })
      .from(classes)
      .leftJoin(academicYears, eq(classes.academicYearId, academicYears.id))
      .leftJoin(pupils, eq(classes.id, pupils.classId))
      .where(eq(classes.active, true))
      .groupBy(classes.id, academicYears.label);
    const recentAssessments = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        date: assessments.date,
        classId: assessments.classId,
        subject: assessments.subject,
        level: assessments.level,
        competency: assessments.competency,
        status: assessments.status,
      })
      .from(assessments)
      .orderBy(assessments.date)
      .limit(5);
    res.json({ schoolName: school?.name ?? "", academicYear: year?.label ?? "", classes: classRows.map((row) => ({ ...row, pupilCount: Number(row.pupilCount) })), recentAssessments });
  } catch (error) {
    next(error);
  }
});

router.get("/classes", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: classes.id,
        name: classes.name,
        level: classes.level,
        academicYear: academicYears.label,
        pupilCount: count(pupils.id),
      })
      .from(classes)
      .leftJoin(academicYears, eq(classes.academicYearId, academicYears.id))
      .leftJoin(pupils, eq(classes.id, pupils.classId))
      .where(eq(classes.active, true))
      .groupBy(classes.id, academicYears.label)
      .orderBy(asc(classes.name));
    res.json(rows.map((row) => ({ ...row, pupilCount: Number(row.pupilCount) })));
  } catch (error) {
    next(error);
  }
});

router.get("/classes/:classId/pupils", async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: pupils.id,
        registrationNumber: pupils.registrationNumber,
        firstName: pupils.firstName,
        lastName: pupils.lastName,
        classId: pupils.classId,
        active: pupils.active,
      })
      .from(pupils)
      .where(eq(pupils.classId, req.params.classId))
      .orderBy(asc(pupils.lastName), asc(pupils.firstName));
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/classes/:classId/assessments", async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        date: assessments.date,
        classId: assessments.classId,
        subject: assessments.subject,
        level: assessments.level,
        competency: assessments.competency,
        status: assessments.status,
      })
      .from(assessments)
      .where(eq(assessments.classId, req.params.classId))
      .orderBy(asc(assessments.date));
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/assessments/:assessmentId", async (req, res, next) => {
  try {
    const [assessment] = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        date: assessments.date,
        classId: assessments.classId,
        subject: assessments.subject,
        level: assessments.level,
        competency: assessments.competency,
        status: assessments.status,
        support: assessments.support,
        sessionObjectives: assessments.sessionObjectives,
      })
      .from(assessments)
      .where(eq(assessments.id, req.params.assessmentId))
      .limit(1);
    if (!assessment) {
      res.status(404).json({ message: "Assessment not found" });
      return;
    }
    const objectives = await db
      .select({ id: assessmentObjectives.id, order: assessmentObjectives.order, description: assessmentObjectives.description })
      .from(assessmentObjectives)
      .where(eq(assessmentObjectives.assessmentId, assessment.id))
      .orderBy(asc(assessmentObjectives.order));
    res.json({ ...assessment, objectives });
    return;
  } catch (error) {
    next(error);
  }
});

router.get("/assessments/:assessmentId/statistics", async (req, res, next) => {
  try {
    const objectiveRows = await db
      .select({ id: assessmentObjectives.id })
      .from(assessmentObjectives)
      .where(eq(assessmentObjectives.assessmentId, req.params.assessmentId));
    const classPupils = await db
      .select({ id: pupils.id })
      .from(pupils)
      .innerJoin(assessments, eq(assessments.classId, pupils.classId))
      .where(eq(assessments.id, req.params.assessmentId));
    const result = [];
    for (const objective of objectiveRows) {
      const values = await db
        .select({ value: evaluations.value })
        .from(evaluations)
        .where(and(eq(evaluations.assessmentId, req.params.assessmentId), eq(evaluations.objectiveId, objective.id)));
      const acquired = values.filter((item) => item.value === "Acquired").length;
      const partiallyAcquired = values.filter((item) => item.value === "PartiallyAcquired").length;
      const notAcquired = values.filter((item) => item.value === "NotAcquired").length;
      const evaluated = acquired + partiallyAcquired + notAcquired;
      result.push({
        objectiveId: objective.id,
        evaluated,
        notEvaluated: Math.max(classPupils.length - evaluated, 0),
        acquired,
        partiallyAcquired,
        notAcquired,
        acquiredPercent: evaluated ? Math.round((acquired / evaluated) * 100) : 0,
      });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/assessments/:assessmentId/evaluations/bulk", async (req, res, next) => {
  try {
    const entries = z.array(evaluationInput).max(5000).parse(req.body);
    const assessmentId = req.params.assessmentId;
    await db.transaction(async (transaction) => {
      for (const entry of entries) {
        await transaction
          .insert(evaluations)
          .values({ assessmentId, pupilId: entry.pupilId, objectiveId: entry.objectiveId, value: entry.value })
          .onConflictDoUpdate({
            target: [evaluations.assessmentId, evaluations.pupilId, evaluations.objectiveId],
            set: { value: entry.value, updatedAt: new Date() },
          });
      }
    });
    res.json({ saved: entries.length });
  } catch (error) {
    next(error);
  }
});

export default router;