# RDC Employee Claims Management

Custom employee claims workflow for an Indian company, built with Next.js, TypeScript, Prisma, PostgreSQL and Tailwind CSS.

## Features

- Company email ID and password login
- Employee claim drafts, submission, line items and secure document uploads
- Accounts audit before approval routing
- Email-login approval matrix: Accounts verifier, Level1 approver up to Rs 25,000, and Level1 plus Level2 beyond Rs 25,000
- Admin employee master upload template and import
- Claim type and approval rule masters
- Accounts dashboards and approved-claims CSV export
- Manual payment states: Payment Downloaded and Paid
- Email notification service through Nodemailer

Bank payment integration, ERP integration, OCR and a separate mobile app are intentionally outside the MVP.

## Local Setup

```bash
npm install
cp .env.example .env
npm run prisma:dev
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

## PostgreSQL Setup

Create a PostgreSQL database locally or in Railway and set:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

The app uses `DATABASE_URL` as the primary connection variable. Railway PostgreSQL also exposes `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` and `PGDATABASE`, but Prisma should point to `DATABASE_URL`.

## Environment Variables

See [.env.example](./.env.example).

Required for production:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `APP_URL`
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`

Optional for email and uploads:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (use `noreply@rdc.in` in Railway)
- `DEFAULT_EMPLOYEE_PASSWORD`
- `MAX_UPLOAD_SIZE_MB`
- `RUN_DB_SEED` (keep `true` so migrations recreate superadmin and master data)
- `SEED_DEMO_USERS` (keep `false` in production)

## Prisma Commands

```bash
npm run prisma:dev
npm run prisma:migrate
npm run prisma:seed
```

Use `prisma:dev` locally to create and apply migrations. Use `prisma:migrate` on Railway to deploy committed migration files.

## Superadmin Login

Superadmin authority is attached to the configured superadmin email ID. This allows the same person to remain an employee and also manage the system.

| Role | Employee ID | Email ID | Password Source |
| --- | --- | --- | --- |
| Superadmin | Existing employee ID, or fallback `SUPERADMIN` | `SUPERADMIN_EMAIL` (default `ksbhoon@rdc.in`) | Existing password, reset email, or fallback `SUPERADMIN_PASSWORD` |

If an employee master row uses the configured `SUPERADMIN_EMAIL`, the app keeps that employee record and gives it superadmin rights. If the database is empty, startup creates a fallback `SUPERADMIN` login with that email. The Admin dashboard has a button to send the superadmin password reset link by email. Only this login can download, validate, import, add, update, or delete employee master records. Demo users are no longer seeded unless `SEED_DEMO_USERS=true`.

## Docker / Azure Server Deployment

1. Push the `prod` branch to GitHub.
2. On the Azure/Linux server, pull `prod`.
3. Set `.env` values for PostgreSQL, `NEXTAUTH_SECRET`, `APP_URL`, `SUPERADMIN_EMAIL`, and `SUPERADMIN_PASSWORD`.
4. Keep `RUN_DB_SEED=true` and `SEED_DEMO_USERS=false`.
5. Deploy with Docker Compose:

```bash
docker compose down
docker compose up -d --build
docker compose logs -f --tail=100
```

The Docker entrypoint runs `prisma migrate deploy` first. With `RUN_DB_SEED=true`, it then recreates the superadmin and master claim setup without demo users.

## GitHub Push

```bash
git init
git add .
git commit -m "Initial employee claims management app"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Employee Master Upload

Admin can download the template from the Admin dashboard. Upload columns:

`action`, `employee_id`, `employee_name`, `login_id`, `password`, `mobile`, `company`, `designation`, `location`, `plant`, `cost_center`, `accounts_name`, `accounts_email`, `rm_name`, `rm_email`, `level1_name`, `level1_email`, `level2_name`, `level2_email`, `role`, `is_active`

Actions allowed: `ADD`, `UPDATE`, `DELETE`. Accounts, Level1, and Level2 are mandatory. RM is optional; when present, RM receives the claim after Accounts as a recommending authority before Level1. DELETE rows are blocked when the employee has open claims.

For new employees, the login ID is the uploaded `login_id` email. If the row has a `password`, that password is imported. Otherwise the app uses the upload screen default password, then `DEFAULT_EMPLOYEE_PASSWORD`, then `Welcome@123`.

## Notes

- Uploaded documents are stored in the local `uploads` directory for MVP. For long-term Railway production use, move uploads to durable object storage.
- Email is skipped in development if SMTP settings are absent.
- Accounts must pass claims before financial-limit approval routing begins.
