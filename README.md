# RDC Employee Claims Management

Custom employee claims workflow for an Indian company, built with Next.js, TypeScript, Prisma, PostgreSQL and Tailwind CSS.

## Features

- Company employee ID and password login
- Employee claim drafts, submission, line items and secure document uploads
- Accounts audit before approval routing
- Financial-limit approval up to Level 1, Level 2 and Level 3
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
- `ACCOUNTS_EMAIL`

Optional for email and uploads:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
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

| Role | Employee ID | Password |
| --- | --- | --- |
| Admin | ADMIN001 | Admin@123 |
| Accounts | ACC001 | Accounts@123 |
| Employee | EMP001 | Employee@123 |
| Manager L1 | MGR001 | Manager@123 |
| HOD L2 | HOD001 | Hod@123 |
| Director L3 | DIR001 | Director@123 |

## Railway Deployment

1. Push this repository to GitHub.
2. Create a new Railway project.
3. Connect the GitHub repository.
4. Add a Railway PostgreSQL service.
5. Set environment variables in the web service, especially `DATABASE_URL`, `NEXTAUTH_SECRET`, `APP_URL`, `ACCOUNTS_EMAIL`, and SMTP settings if email is required.
6. Deploy the app.
7. Run migrations:

```bash
npm run prisma:migrate
```

8. Seed the database:

```bash
npm run prisma:seed
```

9. Test login with `ADMIN001 / Admin@123`.

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

`employee_id`, `employee_name`, `email`, `mobile`, `department`, `location`, `plant`, `cost_center`, `reporting_manager_id`, `level_2_approver_id`, `level_3_approver_id`, `role`, `is_active`

Roles allowed: `EMPLOYEE`, `ACCOUNTS`, `APPROVER`, `ADMIN`.

## Notes

- Uploaded documents are stored in the local `uploads` directory for MVP. For long-term Railway production use, move uploads to durable object storage.
- Email is skipped in development if SMTP settings are absent.
- Accounts must pass claims before financial-limit approval routing begins.
