# Teacher Competency Assessment

A French-first Android and Web workspace for teachers to manage classes and competency-based pupil evaluations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/teacher-assessment` — shared Expo Router app for Android and Web.
- `artifacts/teacher-assessment/context/AppDataContext.tsx` — first-build local
  assessment state, seed data, and offline draft persistence.
- `artifacts/teacher-assessment/app/assessments/[assessmentId].tsx` — responsive
  evaluation matrix and mobile one-pupil workflow.
- `docs/architecture.md` — functional contract, ERD, report reference analysis,
  navigation map, sync strategy, and roadmap.
- `lib/api-spec/openapi.yaml` — shared API contract source of truth.

## Architecture decisions

- One Expo Router app serves Android and React Native Web; there is no separate
  web frontend.
- Evaluation values are stored as semantic enum values and only rendered as
  `+`, `±`, `-`, or an empty marker at the UI/report boundary.
- The supplied Word file is treated as a report-layout reference; structured
  application data remains the source of truth.
- The first build persists a structured local draft so the evaluation surface
  remains usable without a network connection.

## Product

Teachers can review their active class, search pupils, inspect pupil history,
continue an assessment on mobile or desktop, save evaluation drafts locally,
and identify objectives needing attention.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/teacher-assessment run typecheck` after Expo
  changes.
- If the API contract changes, update `lib/api-spec/openapi.yaml` and run
  `pnpm --filter @workspace/api-spec run codegen` before consuming new hooks.
- Restart only the managed Expo workflow after dependency or Metro changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
