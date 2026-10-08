# CSE Scholarship Command Center

A responsive scholarship tracker built with Next.js, Clerk, Neon Postgres and Drizzle, deployed using Vercel Functions. GitHub stores the source; GitHub Pages cannot run its authenticated server APIs.

## Features

- Scholarship filters, official-source monitoring and a review queue for ambiguous changes.
- Administrator-only editing, shared private assessments, notes, checklists and application statuses.
- Administrator-managed invitations; approved viewers receive shared scholarship facts, not the administrators' private profile or progress.
- Deadline timeline, calendar exports, backup/restore, reminder catch-up and delivery history.
- Responsive themes, favicons and a limited offline PWA view.
- Unattended daily official-source checks and email catch-up using a Vercel server cron, independent of browser sessions.
- Durable private profile editing with revision conflicts protected across devices; administrators share a profile, invited users have isolated profiles.

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
| `OWNER_PROFILE_JSON` | Server-only initial administrator profile fallback. Saved edits take precedence in Neon. Never use a `NEXT_PUBLIC_` prefix. |
| `RESEND_API_KEY` | Optional server-only email credential. |
| `REMINDER_FROM_EMAIL` | Approved sender address. |
| `REMINDER_VERIFIED_DOMAIN` | `true` only after verifying the sender domain. |
| `REMINDER_SITE_URL` | Dashboard URL included in reminders. |
| `CRON_SECRET` | Server-only random secret of at least 32 characters; Vercel authenticates cron requests with it. Store as a Secret. |
| `SCHOLARSHIP_CRON_ENABLED` | Set to `true` after deploying the schedule in `vercel.json`; enables the schedule indicator. |

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

### Unattended scholarship watch

`vercel.json` defines one daily server job at `03:00 UTC` (`09:00` Bangladesh time). On the current Hobby plan, Vercel runs it within the hour, approximately **09:00–09:59 Asia/Dhaka**. No visit, signed-in browser or button click is required. The exact cron endpoint alone bypasses Clerk and instead verifies `Authorization: Bearer CRON_SECRET` in constant time; other APIs retain their existing session/access checks.

The job rechecks active official-source links older than 18 hours, oldest first, in bounded concurrent batches. Each run handles up to 60 sources; larger lists rotate across daily runs. Explicit, unambiguous dates from established official domains may update; conflicting rounds/dates and funding, eligibility, English, work-experience, portal and programme evidence enter the owner review queue. Failed/blocked/PDF-only sources retain their last known facts rather than fabricating a verification. A source check is not a guarantee that every programme fact has been independently verified.

After the refresh, the server dispatches only enabled, eligible, previously-unsent reminders. Deadline catch-up still runs if source research fails. Archived scholarships are excluded. Durable database leases prevent concurrent browser/cron work, stable event keys prevent repeat messages and Resend idempotency keys protect retries. Personal profiles, notes, fit assessments, statuses and checklists are never modified by source monitoring.

Reminders shows the last server job, next daily window, job result, source-review count and provider-accepted email history. Test the deployed machine-authenticated job using `vercel crons run /api/cron/scholarship-watch`, inspect the saved `background_jobs` record, and repeat to verify a quiet duplicate check. Vercel scheduling is best-effort and has no automatic failed-invocation retry; a later daily run catches up pending reminders while the deadline is still upcoming. Keep the hosting, database and email accounts active. Neither permanent availability nor inbox delivery is guaranteed.

This does not create a second Codex/ChatGPT scheduled task or change the existing `CSE Scholarship Watch` automation. That legacy browser-based watch is not required for the server job; if it still runs, both paths share deduplicated data. Do not claim future scheduled executions have been observed just because a manual cron test passed.

### Email connection

Set `RESEND_API_KEY` as a Vercel production **Secret**, not a browser-public variable. Configure the sender and dashboard URL, then redeploy; environment changes do not modify already-running deployments. A Resend Sending-access key is sufficient for sending. `scripts/check-email-provider.mjs` is a read-only domain check: a `restricted_api_key` response may mean Sending-only permissions, not an expired key. Verify sending with the authenticated Reminders test button.

For `onboarding@resend.dev`, keep `REMINDER_VERIFIED_DOMAIN=false` and ensure `OWNER_EMAIL` is the Resend account email. Test emails go to that owner even when a co-administrator presses the button. Both administrators can see their shared delivery audit; ordinary viewers see only their own history. Test attempts are persisted as pending, failed or sent. `sent` means the provider returned a message ID, not guaranteed inbox delivery.

For additional recipients, verify an owned domain in Resend, configure `REMINDER_FROM_EMAIL` on that domain and only then set `REMINDER_VERIFIED_DOMAIN=true`. Do not opt viewers into reminders on their behalf. Emails never include private profile, notes, assessments or application checklists.

Explicit date signals from established official sources may update automatically. Heuristic text snippets for funding, eligibility, English, work experience, portals and programmes require administrator review before replacing verified facts. Application years never redefine intake years. Retracted extractions stay in the audit log but are excluded from verified-change alerts.

## Privacy and verification

Private administrator profile values are server-only and passed only to explicitly allowlisted administrators. Approved viewers receive sanitized scholarship facts and their own isolated private profile. Profile GET/PATCH derives its data key from the verified account, never a client-provided email. The editor cannot change account email or permissions; simultaneous stale saves return a conflict without overwriting the newer profile. Notes and checklists are stored in Neon, not bundled into public assets. Seeds retain their original verification dates; do not treat historical dates as current deadlines without an official-source check.

Environment files, API keys, SQLite databases, build outputs and login cookies must not be committed. The original `.openai/hosting.json` association is retained for historical source compatibility, but excluded from Vercel deployments. The active Vercel app does not depend on Sites authentication or D1.

```bash
npm run test:unit
npm run lint
```

The legacy D1 integration test is skipped unless explicitly configured; it is not evidence of Postgres verification. The database smoke test can be run separately with `node --env-file=.env.local --import=tsx scripts/verify-database.ts`. It creates isolated fixtures and removes only those fixtures after the check.

Profile persistence, viewer isolation, optimistic concurrency and background-job leases can be checked with `node --env-file=.env.local --import=tsx scripts/verify-background-profile.ts`. On Windows, set `CSE_WINDOWS_TRANSPORT=1` if necessary. Both scripts clean up only their own UUID-scoped fixtures.

No source license has been selected.

## Mobile dialogs and official branding

Reminder settings, viewer access and scholarship details/editing use a shared portal with background scroll locking, keyboard focus containment, Escape handling and focus restoration. Phone layouts use the dynamic viewport and safe-area insets; reminder Close/Save actions remain outside the scrollable content.

The 18 initial scholarships display official programme/provider images served locally from `public/scholarships/`. The source page, exact original asset and branding verification date are recorded in `branding.json`; this date verifies the image only, not scholarship deadlines or eligibility. Marks retain their original colours and proportions, and remain the property of their respective organisations. They identify tracked programmes and do not imply endorsement. Added programmes without a mapped image, or failed images, receive a text fallback.

`scripts/research-logos.mjs` inspects official pages; `scripts/download-logos.mjs` deliberately refreshes the selected assets. These scripts are maintenance helpers, not part of automatic scholarship refresh. Windows may need `CSE_WINDOWS_TRANSPORT=1`; source assets behind bot protection can instead be downloaded from the visible official page and normalized locally. No private application data is included in the image manifest.
