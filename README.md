# Smart Rig Check MVP

## Overview
Smart Rig Check is a B2B SaaS MVP designed for EMS and private ambulance companies to replace outdated Google Forms with a fast, reliable, and mobile-friendly web application. EMTs use the **Rig Check Portal** from their phones, and Managers monitor the fleet's real-time status from the **Dashboard**.

## Tech Stack
* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS & shadcn/ui
* **Icons:** Lucide React
* **Database & Auth:** Supabase (PostgreSQL)

## Setup Instructions

### 1. Supabase Initialization
1. Go to your Supabase project dashboard.
2. Open the **SQL Editor**.
3. Copy the contents of `schema.sql` (found in the root of this project) and run it. This creates the required `users`, `vehicles`, and `rig_checks` tables along with the RLS policies and trigger functions.

### 2. Environment Variables
1. Rename or copy `.env.local` as `.env.local` if it doesn't exist.
2. Find your **Project URL** and **anon key** in your Supabase project settings `(Project Settings -> API)`.
3. Add them to `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

### 3. Run the Application
1. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features
* **Role-Based Access Placeholder**: Ready for integration with Supabase Auth for `emt` and `manager` roles.
* **EMT Mobile Portal (/rig-check)**: A clean, touch-friendly UI for inspecting rigs, reporting oxygen PSI, BLS bag status, and damage.
* **Manager Dashboard (/dashboard)**: A desktop-first overview of fleet health (color-coded Green/Yellow/Red based on rig status triggers).
