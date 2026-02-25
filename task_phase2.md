# Phase 2: Custom Checklists & AI Analysis

## Database Updates
- [x] Add `checklists` table to schema
- [x] Update `rig_checks` table for dynamic JSONB answers and AI severity
- [x] Configure Supabase Storage buckets for `checklists` (PDFs) and `damage_photos`

## Manager Capabilities
- [x] Create `/dashboard/checklists` page
- [x] Implement manual Question builder UI
- [x] Implement PDF upload UI

## Auth & Core
- [x] Migrate Auth from email to generic `username` + `password`
- [ ] Implement "Forgot Password" flow (via optional `recovery_email` or Manager reset)
- [x] Create `/login` page suitable for both EMT and Managers
- [x] Update `users` table to rely on `username` (unique) instead of email

## EMT Mobile Portal Updates
- [ ] Fetch active checklist dynamically instead of hardcoded Oxygen/BLS
- [x] Add Camera/Photo attach functionality for Damage Notes

## AI Integration (Google Gemini)
- [x] Install Google GenAI SDK
- [x] Write prompt for analyzing damage severity based on image & text (under the hood)
- [x] Create server action for processing EMT submissions
- [x] Update Manager Dashboard to highlight AI-flagged vehicles
