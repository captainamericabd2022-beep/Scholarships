# CSE Scholarship Command Center

A responsive scholarship tracker for CSE and related master's programmes, built with React, TypeScript, Vinext, Cloudflare D1 and Drizzle.

This source includes the latest owner scholarship editor and favicon fixes. Uploading this repository stores the source code; it does not deploy a working dashboard through GitHub Pages.

## Features

- Scholarship table with filters generated from the tracked data.
- Official-source research and monitoring, with an owner review queue for ambiguous changes.
- Owner-only scholarship edits, persistent manual overrides and concurrent-edit protection.
- Private fit assessments, application statuses, notes and document checklists.
- Viewer invitations and read-only scholarship access.
- Deadline timelines, reminders with catch-up and duplicate prevention, and email delivery history.
- ICS calendar, Google Calendar links, CSV/JSON backup and restore.
- Dark/light themes, SVG/ICO favicons, mobile home-screen icons and a limited offline PWA view.

## What is included

`app/` contains the UI and server routes; `lib/` contains scholarship seeds and monitoring/reminder logic; `db/` and `drizzle/` contain the schema and migrations. Tests, public assets, configuration, and the dependency lockfile are included.

The original database, login cookies, API keys, build output, dependencies and Git history are excluded. The public seed file uses neutral fit assessments. Personal profile values are read only on the server from `OWNER_PROFILE_JSON` and passed only to the owner. Your original local project has not been changed.

Scholarship facts retain their original verification dates. They are a seed snapshot; use the official-source refresh on a correctly configured deployment before relying on them.

## Local development

Requires Node.js 22.13.0 or later and npm.

```bash
npm ci
npm run db:local
npm run dev
```

Open the Local URL printed by the server, normally `http://localhost:3000/`. Localhost provides an owner preview for development. The local database lives in ignored `.wrangler/` files and is separate from production.

For private local configuration, copy `.dev.vars.example` to `.dev.vars` and fill in only the settings you need. Leave `OWNER_EMAIL` empty for the default local preview. Keep `RESEND_API_KEY` empty while testing if you do not want to send emails.

```bash
npm test
npm run lint
npm run build
```

The D1 integration test is optional and writes only to local test storage. With the dev server running, enable it using `CSE_TEST_ORIGIN=http://localhost:3000`. For PowerShell:

```powershell
$env:CSE_TEST_ORIGIN = "http://localhost:3000"
npx tsx --test tests/scholarship-edits.integration.test.ts
```

## Production hosting

This project uses the Sites dispatcher's trusted authentication headers and Sign in with ChatGPT routes. A production deployment requires a Cloudflare Workers-compatible runtime, a D1 database bound as `DB`, all included migrations, and a trusted authentication layer.

The existing `.openai/hosting.json` retains the original Sites project association. Publishing there requires access to that Site's owning account/workspace. GitHub uploads do not grant that access.

GitHub Pages is static hosting and cannot run these server APIs, authentication or D1 storage. Deployment to another provider requires adapting the authentication and database integration first. Never trust user-supplied identity headers on an ordinary public server.

Configure these values as server secrets/settings, never in committed files:

| Setting | Purpose |
| --- | --- |
| `OWNER_EMAIL` | Email of the authenticated dashboard administrator. Required in production. |
| `OWNER_PROFILE_JSON` | Optional private profile object: `country`, `degree`, `intake`, `cgpa`, `graduation`, `ieltsTarget`, `priority`. |
| `RESEND_API_KEY` | Resend API key used only on the server. |
| `REMINDER_FROM_EMAIL` | Approved sender address. |
| `REMINDER_VERIFIED_DOMAIN` | Set to `true` only after the sending domain is verified. |
| `REMINDER_SITE_URL` | Public URL used in reminder links. |

The Resend testing sender is restricted to the account owner's recipient address. A verified sending domain is needed for reminders to invited users.

Source refresh currently runs when the owner visits the dashboard or starts a manual check. This repository does not include a connected unattended scheduler. Set up and test a scheduled workflow separately if reminders must run while nobody visits.

## Upload to your GitHub repository

Destination: [captainamericabd2022-beep/Scholarships](https://github.com/captainamericabd2022-beep/Scholarships).

In GitHub, choose **Add file → Upload files**, then drag the contents of this folder into the upload area. Include `.gitignore` and `.openai/`. Upload the extracted source files, not the ZIP as a single file.

Or run these commands from this folder while signed into an account with write access:

```bash
git init
git add .
git commit -m "Add CSE Scholarship Command Center"
git branch -M main
git remote add origin https://github.com/captainamericabd2022-beep/Scholarships.git
git push -u origin main
```

These commands assume the destination repository is empty. If it has acquired commits, fetch and inspect them before pushing; do not force-push.

## License

No license has been selected. Add a license only after deciding how others may use this source.
