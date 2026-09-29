# Teacher Competency Assessment — architecture handoff

## 1. Functional specification

The product is a structured competency-assessment system for teachers. The
database is the source of truth; the Word document is a report-layout
reference, not an editing surface.

### First release capabilities

- French-first teacher workspace with Arabic/Unicode-safe data.
- Academic year, school, class, and pupil records.
- Searchable pupil list and individual history.
- Assessment metadata, configurable objectives, and reusable templates.
- Evaluation values stored as `NotEvaluated`, `Acquired`, `PartiallyAcquired`,
  or `NotAcquired`, displayed as `·`, `+`, `±`, or `-`.
- Desktop/tablet evaluation matrix and mobile one-pupil workflow.
- Explicit save, local draft recovery, sync status, and guarded bulk actions.
- Per-objective statistics with evaluated-only percentages.
- Individual and class remediation decisions.
- DOCX/PDF/print generation from an `AssessmentReportDto`.

### Reference document findings

The supplied `notation.docx` is A4 portrait with one fixed-layout table:

- Page size: 11906 × 16838 twips (A4).
- Margins: top 284 twips; left/right/bottom 720 twips.
- One 27-row table: a three-row header, 23 pupil rows, and a totals row.
- Six objectives in the reference, each represented by three narrow value cells.
- First columns are `N°` and `Nom et Prénom`; the final report includes
  `Total`.
- Centered table content, fixed table layout, Times New Roman body runs, and
  an explicit `Décisions à prendre` section split into individual and class
  decisions.
- The production generator must calculate widths from the objective count and
  switch to landscape or a smaller readable font when portrait would clip.

## 2. Entity relationship diagram

```mermaid
erDiagram
  SCHOOL ||--o{ USER : employs
  SCHOOL ||--o{ CLASS : owns
  ACADEMIC_YEAR ||--o{ CLASS : contains
  USER ||--o{ CLASS : teaches
  CLASS ||--o{ PUPIL : contains
  CLASS ||--o{ ASSESSMENT : receives
  USER ||--o{ ASSESSMENT : creates
  ASSESSMENT ||--|{ ASSESSMENT_OBJECTIVE : defines
  ASSESSMENT ||--o{ EVALUATION : records
  PUPIL ||--o{ EVALUATION : receives
  ASSESSMENT_OBJECTIVE ||--o{ EVALUATION : measures
  ASSESSMENT_TEMPLATE ||--o{ TEMPLATE_OBJECTIVE : contains
  ASSESSMENT ||--o{ ASSESSMENT_REMEDIATION : documents
  REMEDIATION_TEMPLATE ||--o{ ASSESSMENT_REMEDIATION : suggests
  USER ||--o{ REFRESH_TOKEN : owns

  SCHOOL {
    uuid id PK
    string name
    string address
    string wilaya
    string logo
    boolean active
  }
  ACADEMIC_YEAR {
    uuid id PK
    string label
    date startDate
    date endDate
    boolean isActive
  }
  CLASS {
    uuid id PK
    string name
    string level
    uuid academicYearId FK
    uuid teacherId FK
    uuid schoolId FK
    boolean active
  }
  PUPIL {
    uuid id PK
    string registrationNumber
    string firstName
    string lastName
    date dateOfBirth
    string gender
    uuid classId FK
    boolean active
  }
  ASSESSMENT {
    uuid id PK
    string title
    date date
    uuid classId FK
    uuid teacherId FK
    string subject
    string competency
    string support
    string status
  }
  ASSESSMENT_OBJECTIVE {
    uuid id PK
    uuid assessmentId FK
    int order
    string description
    boolean active
  }
  EVALUATION {
    uuid id PK
    uuid assessmentId FK
    uuid pupilId FK
    uuid objectiveId FK
    string value
    datetime updatedAt
  }
```

## 3. Database schema rules

- PostgreSQL with UTF-8 data.
- Unique evaluation key: `(assessmentId, pupilId, objectiveId)`.
- Unique pupil registration number within a class.
- Unique objective order within an assessment.
- Foreign keys are required; completed assessments require explicit unlock
  confirmation before mutation.
- Index pupil last name, first name, registration number, assessment class/date,
  and evaluation assessment/pupil.
- Store audit fields (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`) on
  mutable business records.
- Use server-side validation in addition to client schemas.

## 4. API contract outline

The current workspace uses the shared OpenAPI/codegen package. The next
backend increment should add these groups to `lib/api-spec/openapi.yaml`, then
regenerate before the Expo client consumes them:

```text
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/academic-years
GET    /api/classes
POST   /api/classes
GET    /api/classes/{classId}/pupils
POST   /api/classes/{classId}/pupils/import
GET    /api/classes/{classId}/assessments
POST   /api/assessments
GET    /api/assessments/{assessmentId}
GET    /api/assessments/{assessmentId}/objectives
POST   /api/assessments/{assessmentId}/objectives
GET    /api/assessments/{assessmentId}/evaluations
POST   /api/assessments/{assessmentId}/evaluations/bulk
GET    /api/assessments/{assessmentId}/statistics
GET    /api/pupils/{pupilId}/history
GET    /api/assessments/{assessmentId}/document/word
GET    /api/assessments/{assessmentId}/document/pdf
```

Bulk evaluation requests are transactional and idempotent. Server identity,
not a client-provided teacher ID, determines authorization.

## 5. React/Expo architecture

The app uses one Expo Router application for Android and React Native Web.

```text
app/                  route files and layouts
components/           shared mobile/web presentation
context/              local draft and assessment state
constants/             semantic color tokens
hooks/                theme and reusable hooks
lib/api-client-react/  generated API client (shared workspace package)
```

React Query is reserved for server state. The local assessment provider owns
draft edits and persists structured data with AsyncStorage in the first build;
the production offline layer should move this structured cache to Expo SQLite
with an outbox for synchronization.

## 6. Navigation map

```text
/                         Dashboard
/(tabs)/classes            Classes
/(tabs)/assessments        Assessments
/(tabs)/pupils             Pupils
/classes/:classId          Class detail
/assessments/:assessmentId Evaluation workflow
/pupils/:pupilId           Pupil history
/settings                  School and synchronization settings
```

Desktop/tablet uses the matrix evaluation surface. Mobile uses one pupil at a
time with explicit previous/next controls and three large value buttons.

## 7. Screen list

- Dashboard: class snapshot, current assessment progress, attention indicator,
  and quick actions.
- Classes: active academic year, class list, pupil count, and class entry.
- Class detail: class metadata, pupil preview, import action, and evaluation
  entry.
- Pupils: search by name or registration number.
- Pupil history: personal information, assessment history, objective values,
  and individual remediation.
- Assessments: recent assessments and six-step workflow state.
- Evaluation: bulk-capable matrix on larger screens and one-pupil flow on
  phones.
- Settings: school metadata, document format, and synchronization state.

## 8. Word/PDF report structure

The report generator should build an `AssessmentReportDto` with:

1. School, level, competency, session objectives, and support.
2. Ordered evaluation objectives.
3. Dynamic analysis grid with pupil number/name and objective values.
4. Per-objective totals/statistics.
5. `DÉCISIONS À PRENDRE`, split into `A) Au plan individuel` and
   `B) Au plan de la classe`.

The DOCX and PDF generators consume the same DTO. They do not read or mutate a
Word document at runtime. Word uses dynamic table cells; PDF repeats table
headers and chooses portrait or landscape based on objective count.

## 9. Offline and synchronization strategy

1. Hydrate the most recent synchronized class, pupils, objectives, and
   evaluations into SQLite.
2. Write evaluation edits to the local database immediately and enqueue an
   idempotency key in a sync outbox.
3. Expose `Synced` and `Modifications non synchronisées` in the shell.
4. Retry with backoff when the network returns.
5. Send bulk evaluation mutations rather than one request per cell.
6. Detect server version conflicts and present a resolution surface; never
   silently overwrite a newer server edit.
7. Keep the current evaluation usable when network requests fail.

The current first build demonstrates local draft persistence and recovery. The
server-backed outbox is the next infrastructure increment.

## 10. Development roadmap

1. **Phase 1 — shared app foundation:** Expo Router, French-first shell,
   local structured state, responsive evaluation workflow, and reference
   report contract. This is the current build.
2. **Phase 2 — backend contract and persistence:** OpenAPI, PostgreSQL schema,
   server validation, role boundaries, seeded school/class/pupils.
3. **Phase 3 — class administration:** academic years, pupil CRUD, Excel import
   wizard, duplicate report.
4. **Phase 4 — assessment authoring:** metadata, objectives, templates,
   reordering, remediation templates.
5. **Phase 5 — evaluation hardening:** bulk APIs, autosave, keyboard support,
   tablet layout, explicit mass-action confirmation.
6. **Phase 6 — offline sync:** SQLite cache, outbox, retries, conflicts, PWA
   cache policy.
7. **Phase 7 — insight and documents:** statistics, history, remediation,
   faithful DOCX/PDF/print generation.
8. **Phase 8 — production readiness:** auth, authorization, audit trail,
   tests, performance, security, and deployment.
