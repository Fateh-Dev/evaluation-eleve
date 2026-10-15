import {
  getSessionDurationHours,
  SESSION_TYPE_LABELS,
  type TrainingPlan,
  type TrainingPlanSession,
  type TrainingProject,
  type TrainingStudyObject,
} from './trainingPlan.ts';

export type TrainingSheetContext = {
  schoolName?: string;
  teacherName?: string;
  academicYear?: string;
  filiereName: string;
  className?: string;
  classLevel?: string;
};

export type TrainingSessionLocation = {
  project: TrainingProject;
  studyObject?: TrainingStudyObject;
  sequenceTitle?: string;
};

export type DiagnosticPupil = {
  id?: string;
  registrationNumber?: string;
  firstName: string;
  lastName: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function findTrainingSessionLocation(
  plan: TrainingPlan,
  sessionId: string,
): TrainingSessionLocation | undefined {
  for (const project of plan.projects) {
    if (project.launch?.id === sessionId) {
      return { project };
    }
    for (const studyObject of project.studyObjects) {
      if (studyObject.diagnostic?.id === sessionId) {
        return { project, studyObject };
      }
      for (const sequence of studyObject.sequences) {
        if (sequence.sessions.some((session) => session.id === sessionId)) {
          return { project, studyObject, sequenceTitle: sequence.title };
        }
      }
    }
  }
  return undefined;
}

function sheetChrome(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family: "Times New Roman", Times, serif; color: #1f2a33; font-size: 11pt; }
  h1 { font-size: 16pt; margin: 0 0 6px; color: #1f4e78; }
  h2 { font-size: 12pt; margin: 16px 0 8px; color: #1f4e78; }
  .meta { color: #52616b; font-size: 10pt; margin: 2px 0; }
  .badge { display: inline-block; border: 1px solid #1f4e78; color: #1f4e78; padding: 2px 8px; border-radius: 10px; font-size: 9pt; font-weight: 700; }
  .box { border: 1px solid #7f7f7f; padding: 10px 12px; margin-top: 8px; min-height: 64px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #7f7f7f; padding: 6px 8px; font-size: 10pt; }
  th { background: #d9e1f2; text-align: left; }
  .mark { width: 18%; text-align: center; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .footer { margin-top: 18px; font-size: 9pt; color: #657174; }
</style></head><body>${body}</body></html>`;
}

function contextLines(context: TrainingSheetContext): string {
  return [
    context.schoolName ? `Établissement : ${escapeHtml(context.schoolName)}` : '',
    context.teacherName ? `Enseignant(e) : ${escapeHtml(context.teacherName)}` : '',
    `Filière : ${escapeHtml(context.filiereName)}`,
    context.academicYear ? `Année scolaire : ${escapeHtml(context.academicYear)}` : '',
    context.className
      ? `Classe : ${escapeHtml(context.className)}${context.classLevel ? ` · ${escapeHtml(context.classLevel)}` : ''}`
      : '',
  ]
    .filter(Boolean)
    .map((line) => `<p class="meta">${line}</p>`)
    .join('');
}

export function generateTeacherSessionSheetHtml(
  session: TrainingPlanSession,
  location: TrainingSessionLocation,
  context: TrainingSheetContext,
): string {
  const duration = getSessionDurationHours(session);
  const body = `
    <div>
      <span class="badge">Fiche enseignant</span>
      <h1>${escapeHtml(session.title)}</h1>
      ${contextLines(context)}
      <p class="meta">Type : ${escapeHtml(SESSION_TYPE_LABELS[session.type])} · Durée de la séance : ${duration} h</p>
      ${session.objective ? `<p class="meta">Objectif : ${escapeHtml(session.objective)}</p>` : ''}
      <p class="meta">Projet : ${escapeHtml(location.project.title)}</p>
      ${location.studyObject ? `<p class="meta">Objet d’étude : ${escapeHtml(location.studyObject.title)}</p>` : ''}
      ${location.sequenceTitle ? `<p class="meta">Séquence : ${escapeHtml(location.sequenceTitle)}</p>` : ''}
      <h2>Déroulement</h2>
      <div class="box">La durée par activité interne n’est pas définie. À compléter par l’enseignant.</div>
      <h2>Compétences visées</h2>
      <div class="box">Liste des compétences de séquence non fournie par l’étude. À compléter.</div>
      <h2>Notes de séance</h2>
      <div class="box"></div>
      <p class="footer">Document généré le ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>`;
  return sheetChrome(`Fiche enseignant — ${session.title}`, body);
}

export function generateDiagnosticPupilSheetHtml(
  session: TrainingPlanSession,
  location: TrainingSessionLocation,
  context: TrainingSheetContext,
  pupils: DiagnosticPupil[],
): string {
  const prerequisites = (location.studyObject?.prerequisites ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const rowsFor = (pupil: DiagnosticPupil) => {
    const criterionRows = (prerequisites.length
      ? prerequisites
      : ['Prérequis à compléter (non défini)']
    )
      .map(
        (criterion) =>
          `<tr><td>${escapeHtml(criterion)}</td><td class="mark"></td><td class="mark"></td><td class="mark"></td></tr>`,
      )
      .join('');
    const name = `${pupil.lastName} ${pupil.firstName}`.trim() || 'Nom de l’élève';
    return `
      <section class="page">
        <span class="badge">Fiche élève · diagnostic</span>
        <h1>${escapeHtml(session.title)}</h1>
        ${contextLines(context)}
        <p class="meta">Élève : ${escapeHtml(name)}${pupil.registrationNumber ? ` · Matricule : ${escapeHtml(pupil.registrationNumber)}` : ''}</p>
        <p class="meta">Objet d’étude : ${escapeHtml(location.studyObject?.title ?? '')}</p>
        <p class="meta">Durée : ${getSessionDurationHours(session)} h · Notation : à compléter</p>
        ${session.objective ? `<p class="meta">Objectif : ${escapeHtml(session.objective)}</p>` : ''}
        <table>
          <thead><tr><th>Prérequis</th><th class="mark">+</th><th class="mark">±</th><th class="mark">−</th></tr></thead>
          <tbody>${criterionRows}</tbody>
        </table>
        <h2>Remédiations notées par l’enseignant</h2>
        <div class="box"></div>
        <p class="footer">Les prérequis sont ceux définis pour l’objet d’étude. La forme de notation détaillée n’est pas figée.</p>
      </section>`;
  };
  const targetPupils = pupils.length ? pupils : [{ firstName: '', lastName: '' }];
  return sheetChrome(
    `Fiche élève — ${session.title}`,
    targetPupils.map((pupil) => rowsFor(pupil)).join(''),
  );
}

export function trainingSheetFileName(prefix: string, title: string): string {
  return `${prefix}_${title.replace(/[^\p{L}\p{N}-]+/gu, '_')}.pdf`;
}
