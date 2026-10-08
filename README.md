# CSE Scholarship Command Center

A responsive scholarship tracker built with Next.js, Clerk, Neon Postgres and Drizzle, deployed using Vercel Functions. GitHub stores the source; GitHub Pages cannot run its authenticated server APIs.

## Features

- Scholarship filters, official-source monitoring and a review queue for ambiguous changes.
- Administrator-only editing, shared private assessments, notes, checklists and application statuses.
- Administrator-managed invitations; approved viewers receive shared scholarship facts, not the administrators' private profile or progress.
- Deadline timeline, calendar exports, backup/restore, reminder catch-up and delivery history.
- Responsive themes, favicons and a limited offline PWA view.

## Run locally

Requires Node.js 22.13 or later.

```bash
npm ci
vercel link
vercel env pull .env.local
npm run db:migrate
npm run dev
```

Authentication is required even on localhost. There is no identity-header or hostname bypass. Set `OWNER_EMAIL` to the verified primary email of the owner. Optional `ADMIN_EMAILS` is a comma-separated allowlist of explicitly approved co-administrators. These administrators share full access to the primary owner's private dashboard data; ordinary invited viewers do not. Creating a Clerk account alone does not grant dashboard access.

On Windows machines where direct Node HTTP connections are blocked but Windows HTTP works, the database migration/import scripts support the explicit local-only `CSE_WINDOWS_TRANSPORT=1` fallback. This is not enabled in deployed functions.

## Deployment configuration

Connect the existing Clerk and Neon resources to the Vercel project. Required environment settings:

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection for application queries. |
| `DATABASE_URL_UNPOOLED` | Direct connection used by the migration script. |
| `CLERK_SECRET_KEY` | Server-only Clerk credential. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk's intentionally public browser key. |
| `OWNER_EMAIL` | Verified owner primary email; required for administrative access. |
| `ADMIN_EMAILS` | Explicit co-administrator email allowlist; shares owner data and privileges. |
| `OWNER_PROFILE_JSON` | Server-only private profile object. Never use a `NEXT_PUBLIC_` prefix. |
| `RESEND_API_KEY` | Optional server-only email credential. |
| `REMINDER_FROM_EMAIL` | Approved sender address. |
| `REMINDER_VERIFIED_DOMAIN` | `true` only after verifying the sender domain. |
| `REMINDER_SITE_URL` | Dashboard URL included in reminders. |

Run the Drizzle migrations in `drizzle-postgres/` before deploying. `scripts/import-local-data.mjs` can copy existing local SQLite records without overwriting destination rows. It requires an explicit source path and preserves the original file.

```bash
npm run db:migrate
npm run build
npm run test:unit
npm run lint
vercel deploy --prod --skip-domain
# Inspect and test the exact deployment before promoting its alias.
vercel promote <verified-deployment-url>
```

The current online launch uses Clerk development authentication and is labelled a preview. Configure an owned domain and Clerk production credentials before treating it as a permanent production service.

Source refresh runs when the owner visits or manually checks. An unattended watch must be pointed at the new Vercel URL and tested separately; this repository does not claim a connected scheduler. Keep the existing watch rather than creating a duplicate. Email is unavailable until the sender is configured and tested. Never claim delivery without a recorded successful send.

Explicit date signals from established official sources may update automatically. Heuristic text snippets for funding, eligibility, English, work experience, portals and programmes require administrator review before replacing verified facts. Application years never redefine intake years. Retracted extractions stay in the audit log but are excluded from verified-change alerts.

## Privacy and verification

Private profile values are server-only and passed only to explicitly allowlisted administrators. Approved viewers receive sanitized facts. Notes and checklists are stored in Neon, not bundled into public assets. Seeds retain their original verification dates; do not treat historical dates as current deadlines without an official-source check.

Environment files, API keys, SQLite databases, build outputs and login cookies must not be committed. The original `.openai/hosting.json` association is retained for historical source compatibility, but excluded from Vercel deployments. The active Vercel app does not depend on Sites authentication or D1.

```bash
npm run test:unit
npm run lint
```

The legacy D1 integration test is skipped unless explicitly configured; it is not evidence of Postgres verification. The database smoke test can be run separately with `node --env-file=.env.local --import=tsx scripts/verify-database.ts`. It creates isolated fixtures and removes only those fixtures after the check.

No source license has been selected.
