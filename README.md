# Shop Auditing Dashboard

A Turborepo monorepo for auditing shop logins and patient allowances.

## Tech Stack
- **Monorepo**: Turborepo + PNPM
- **Frontend**: React (Vite, TypeScript, Axios)
- **Backend**: Express (TypeScript, Node.js, PostgreSQL)
- **Styling**: Vanilla CSS (Modern, Premium Dark Mode)

## Getting Started

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Database Setup**:
   - Create a `.env` file in `apps/api/` (already initialized from `.env.example`).
   - Add your `DATABASE_URL` to `apps/api/.env`.
   - If no `DATABASE_URL` is provided, the API will return mock data for demonstration.

3. **Run the apps**:
   ```bash
   pnpm dev
   ```
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:3001](http://localhost:3001)

## Features
- **SQL-Powered Tracking**: Directly uses the requested SQL query to fetch patient login data.
- **Date Filtering**: Default to today's date with a premium date picker.
- **Email Masking**: Automatically masks emails (e.g., `user[at]example.com`) as per the SQL query.
- **Australia/Sydney Timezone**: Displays login times in the Sydney timezone.
