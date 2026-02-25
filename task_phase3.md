# Phase 3: Supabase Integration & Production Readiness

## Supabase Project Setup
- [x] User needs to create a new project at [supabase.com](https://supabase.com).
- [x] User needs to provide `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [x] Add these credentials to `.env.local`.

## Database Deployment
- [ ] Run the SQL commands from `schema.sql` in the Supabase SQL Editor.
- [ ] Verify that tables (`users`, `vehicles`, `checklists`, `rig_checks`) and functions/triggers are created.
- [ ] Insert initial test vehicles into the `vehicles` table via SQL or Dashboard.
- [ ] Create Supabase Storage Buckets:
  - `checklists` (public, for PDFs)
  - `damage_photos` (public, for EMT photos)

## Codebase Cleanup
- [x] Remove `mockVehicles` and in-memory fallback logic from `src/app/actions.ts`.
- [x] Ensure `getVehicles()` strictly returns data from the `vehicles` table.
- [x] Ensure `submitRigCheck()` correctly inserts into `rig_checks` and handles Supabase errors properly.
- [ ] Update `submitRigCheck()` to actually upload `damage_photo` to Supabase Storage before calling Gemini (if applicable for phase 3 scope, or keep base64 for MVP).

## Testing
- [ ] Create a test user in the `users` table with a hashed password (or adjust `authenticate` to use real passwords).
- [ ] Test the full End-to-End flow: Login -> Submit Rig Check -> Check Dashboard. 
