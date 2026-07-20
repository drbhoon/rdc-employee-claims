# RDC Employee Claims Management - Authoritative Project Context

Last updated: 20 July 2026

## Project Identity

- Project name: `rdc-employee-claims`
- Business application: RDC Employee Claims Management System
- GitHub repository: `https://github.com/drbhoon/rdc-employee-claims`
- Local primary repository: `D:\RDC Drive\AI\Codex\rdc-employee-claims`
- This project has **no relationship to RDC BCA**.
- The appearance of Claims chats under the `RDC BCA` folder in the Codex sidebar is only a Codex workspace/chat-organization issue. It is not a GitHub, application, database, Azure, Docker, or domain relationship.

When starting a fresh Codex chat, attach this file and instruct Codex to treat it as the authoritative context. Do not infer project ownership from the Codex sidebar folder.

## Environment And Branch Policy

### Main - Railway staging/testing

- Git branch: `main`
- Purpose: integration, testing, and user acceptance on Railway.
- Railway project: `rdc-employee-claims`
- Railway application URL: `https://rdc-employee-claims-production.up.railway.app`
- Railway PostgreSQL contains staging/test data. It is not the live production database.
- Changes must be fully tested here before they are considered for production.

### Prod - live Azure application

- Git branch: `prod`
- Live URL: `https://claims.rdcc.ai`
- Hosting: Azure Linux server, Nginx reverse proxy, Docker Compose.
- Database: PostgreSQL running with the live Azure deployment and containing live claim records.
- Uploaded documents: production Docker volume on the Azure server.
- Deployment is manual from `prod` using `bash deploy.sh` on the Azure server.

### Non-negotiable safety rules

1. Never push, merge, rebase, force-push, or deploy `prod` without an explicit instruction from the project owner in the current chat.
2. Never run migrations, seeds, repair scripts, resets, or exploratory writes against the Azure production database without a verified backup and explicit approval.
3. Never treat the Railway database as the production database.
4. Never run production seed data with demo users. Production uses `SEED_DEMO_USERS=false`.
5. Test changes on `main` and Railway first. Production promotion is a separate, deliberate operation.
6. Before any production deployment, record the current server commit, back up PostgreSQL, and back up uploaded documents.
7. Do not combine application workflow fixes with infrastructure moves or database repair in one production change.

## Branch State At This Handoff

Remote references checked directly from GitHub on 20 July 2026 before synchronization:

- `origin/main`: `47632e4` - Fix upload limit handling and messaging
- `origin/prod`: `c54bd40` - Fix upload limit handling and messaging
- Common ancestor: `a6e3095` - Fix claim amendment and notifications

Although the latest commit messages look similar, `main` and `prod` diverged after the common ancestor. Several deployment fixes were independently applied to each branch with different commit hashes. `prod` also contains production fixes that were absent from `main`.

The agreed synchronization direction is:

```text
prod -> main -> Railway testing -> reviewed promotion to prod
```

Never reverse this automatically. There must be no workflow that pushes or opens an automatic deployment into `prod` merely because `main` changed.

Synchronization completed on 20 July 2026:

- `prod` was merged into `main` with merge commit `ff8ffa5`.
- GitHub `prod` remained unchanged at `c54bd40`.
- The obsolete GitHub workflow that automatically created production PRs from `main` was removed by the merge.
- Railway automatically deployed `main` commit `ff8ffa5` successfully.
- Railway deployment ID: `4d2c0fe3-438d-4275-a60d-ea64923057f1`.
- Railway applied migration `20260703000000_company_designation_cleanup` successfully.
- Railway seed and Next.js startup completed successfully.
- Public HTTP smoke tests passed for `/login`, `/forgot-password`, and `/upload-too-large.html`.
- Full authenticated role testing remains pending because the Railway staging database currently has only the retained superadmin/workflow user; do not reset credentials merely to manufacture test users.

## Current Technology And Deployment

- Next.js App Router
- React and TypeScript
- Prisma ORM
- PostgreSQL
- Tailwind CSS
- bcrypt credential authentication
- Nodemailer email notifications
- Excel/CSV employee import and report export
- Docker Compose for Azure production
- Nginx at `claims.rdcc.ai`

The production Compose stack contains:

- `claims-app`
- `claims-db`
- PostgreSQL data volume
- uploads data volume

## Current Business Workflow

1. Employee submits a claim.
2. Claim is assigned to the employee's mapped Accounts email.
3. Accounts passes, returns, or rejects the claim.
4. If passed, routing uses the employee approval mapping and financial rules.
5. RM may act as a recommending authority when mapped.
6. Level 1 and Level 2 approvals are applied according to the active financial rule and employee mappings.
7. Final-approved claims return to Accounts for payment download/processing.
8. Accounts marks Payment Downloaded and then Paid.

Expected ownership invariant:

| Status | Expected current owner |
| --- | --- |
| `SUBMITTED_TO_ACCOUNTS` | Employee's mapped Accounts email |
| `PENDING_LEVEL_1_APPROVAL` | Mapped RM or Level 1 email |
| `PENDING_LEVEL_2_APPROVAL` | Mapped Level 2 email |
| `FINAL_APPROVED` | Mapped Accounts email for external payment processing |
| `PAYMENT_DOWNLOADED` | Mapped Accounts email |
| `PAID` | No pending owner |

## Important Product Decisions From Earlier Work

- Login uses company login/email and password; no Google login.
- Users with Accounts or Approver roles are still employees and may submit their own claims.
- The employee claim form starts with one expense row and uses `+` to add more rows.
- Claim date is entered/displayed consistently in Indian local date handling.
- Supporting documents are optional unless a future business rule explicitly changes this.
- Employee-entered amount is GST-inclusive; there is no separate GST field in the employee form.
- Expense types are maintained centrally and selected from a dropdown.
- Accounts and approval actions disable while processing and server-side status guards prevent repeated processing.
- Successful Accounts actions return to the Accounts queue.
- Successful Approver actions return to the Approver queue.
- Reject/return actions require comments.
- Approval history must always be retained.

## Completed Functional Work

- Initial Next.js/Prisma application and migration structure.
- Employee, Accounts, Approver, and Admin authentication/navigation.
- Employee claim form and dynamic line entry.
- Optional supporting-document uploads.
- Accounts audit flow.
- Financial approval routing.
- Role-aware login redirects.
- Action idempotency/status guards.
- Employee master Excel/CSV validation, preview, import, update, and delete controls.
- Claim type and approval rule masters.
- Reports and CSV export.
- Email notifications and background email handling.
- Password reset and superadmin controls.
- Company/designation employee master cleanup migration.
- Docker/Azure deployment instructions.
- Nginx upload-size handling and friendly large-upload messaging.

## Current Reported Dashboard Concern

An Accounts user reported:

- Vouchers visible in Accounts were not represented in the Main Dashboard Pending count.
- Vouchers currently awaiting another approver were still visible in the Accounts area.

Current interpretation:

1. The Main Employee Dashboard counts only claims owned/submitted by the logged-in employee. It is not currently a unified `My Pending Work` inbox.
2. The Accounts page loads claims mapped to that Accounts user across several statuses for tracking. Therefore, claims already pending with RM/Level 1/Level 2 can remain visible under `Passed by Accounts` even though Accounts has no current action.
3. This is not considered a major live outage. Do not alter production until the expected dashboard semantics are agreed and tested on Railway.
4. Any live claim showing a status/owner mismatch must be audited from the Azure production database and approval history before correction.

## Proposed Dashboard Improvement For Main/Railway

Keep these concepts separate:

- `My Claims`: claims submitted by the logged-in employee.
- `My Pending Work`: only vouchers requiring action from the logged-in Accounts/RM/Approver.
- `Processed / Tracking`: vouchers previously handled by the user but currently assigned elsewhere.

Suggested queue rules:

- Accounts Pending Audit: `SUBMITTED_TO_ACCOUNTS` and `currentPendingWith` equals the logged-in Accounts email.
- Approver Pending: approval status and `currentPendingWith` equals the logged-in approver email.
- Accounts Payment Processing: `FINAL_APPROVED` or `PAYMENT_DOWNLOADED` and assigned to the mapped Accounts email.
- Passed/Approved by Me: derived from immutable approval history, not current employee mapping.

## Safe Development Procedure

1. Refresh GitHub remote references.
2. Work from `main` or a feature branch created from current `main`.
3. Never work directly in the live `prod` checkout for feature development.
4. Run Prisma validation and the production Next.js build.
5. Deploy the candidate to Railway.
6. Run Railway database migrations only after reviewing the migration SQL.
7. Test Employee, Accounts, RM, Level 1, Level 2, Admin, imports, exports, and uploads.
8. Obtain user acceptance.
9. Prepare a separate production promotion plan and backup checklist.
10. Merge into `prod` only after explicit approval.

## Azure Production Checklist

Before a future production deployment:

```bash
git branch --show-current
git rev-parse HEAD
docker compose ps
docker compose logs --tail=100 claims-app
```

Then:

1. Back up PostgreSQL with `pg_dump`.
2. Back up the uploads volume.
3. Confirm the candidate commit tested on Railway.
4. Pull only the approved `prod` commit.
5. Run `bash deploy.sh`.
6. Verify Nginx, login, claim submission, Accounts queue, Approver queue, reports, and uploads.
7. Retain backups and the previous image/commit for rollback.

## Codex Workspace / BCA Note

The Codex sidebar currently displays this Claims chat under an `RDC BCA` folder. That folder is misleading. Codex agents working on this project must ignore that grouping.

Correct identity:

```text
RDC Employee Claims Management
Repository: drbhoon/rdc-employee-claims
Staging: Railway from main
Production: Azure claims.rdcc.ai from prod
RDC BCA: unrelated project
```

If the sidebar tree cannot be reorganized, start a new chat in the correct workspace and attach this file before requesting any work.

## Handoff Instruction For A New Chat

Use this prompt with the attached file:

> Read PROJECT_CONTEXT.md completely before taking any action. This is the RDC Employee Claims Management project and has no relationship to RDC BCA. Work on main/Railway only unless I explicitly authorize prod. Do not touch the Azure live database or prod branch without explicit approval.
