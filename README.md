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

Optional for email and uploads:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (use `noreply@rdc.in` in Railway)
- `DEFAULT_EMPLOYEE_PASSWORD`
- `MAX_UPLOAD_SIZE_MB`

## Prisma Commands

```bash
npm run prisma:dev
npm run prisma:migrate
npm run prisma:seed
```

Use `prisma:dev` locally to create and apply migrations. Use `prisma:migrate` on Railway to deploy committed migration files.

## Seed Logins

| Role | Email ID | Employee ID | Password |
| --- | --- | --- | --- |
| Admin | admin@rdc.test | ADMIN001 | Admin@123 |
| Accounts Verifier | accounts.verifier@rdc.test | ACC001 | Accounts@123 |
| User | employee@rdc.test | EMP001 | Employee@123 |
| Level1 Approver | level1@rdc.test | LVL1001 | Level1@123 |
| Level2 Approver | level2@rdc.test | LVL2001 | Level2@123 |

## Railway Deployment

1. Push this repository to GitHub.
2. Create a new Railway project.
3. Connect the GitHub repository.
4. Add a Railway PostgreSQL service.
5. Set environment variables in the web service, especially `DATABASE_URL`, `NEXTAUTH_SECRET`, `APP_URL`, and SMTP settings if email is required.
6. Deploy the app.
7. Railway uses `railway:start`, which runs migrations and seeds the test users before starting Next.js.
8. Test login with `admin@rdc.test / Admin@123`.

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

`action`, `employee_id`, `employee_name`, `login_id`, `password`, `mobile`, `department`, `location`, `plant`, `cost_center`, `accounts_name`, `accounts_email`, `rm_name`, `rm_email`, `level1_name`, `level1_email`, `level2_name`, `level2_email`, `role`, `is_active`

Actions allowed: `ADD`, `UPDATE`, `DELETE`. Accounts, Level1, and Level2 are mandatory. RM is optional and informational only. DELETE rows are blocked when the employee has open claims.

## Notes

- Uploaded documents are stored in the local `uploads` directory for MVP. For long-term Railway production use, move uploads to durable object storage.
- Email is skipped in development if SMTP settings are absent.
- Accounts must pass claims before financial-limit approval routing begins.
