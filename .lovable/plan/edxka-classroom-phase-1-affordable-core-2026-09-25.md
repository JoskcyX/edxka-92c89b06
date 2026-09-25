# EDxKa Classroom — Phase 1 (affordable core)

Build the class system first, without paid live-video infrastructure. Live video (200+ viewers) is designed for but deferred to a later phase.

## What gets built

### 1. Classes (the home base)
- Tutors create a **class** from the dashboard: title, subject, description, optional cover.
- Each class gets a shareable join link/code (like quizzes today).
- Class page shows: announcements, resources, upcoming/past sessions, quizzes.

### 2. Join requests (no student accounts needed)
- Students open the class link, fill in name + phone (stored in the database for future use), and request to join.
- Tutor sees pending requests and can **approve or reject**; approved students appear on the class roster.
- Returning students are remembered on their device (localStorage), so they skip the form.

### 3. Resources
- Tutors upload/share materials per class: links, notes, and video URLs (YouTube/Vimeo embeds reuse the existing course lesson player).
- Students see resources once approved.

### 4. In-class pop quizzes (synchronous)
- During a session, the tutor picks a quiz and hits **"Push to class"** — every approved student viewing the class page gets the quiz instantly (Realtime), answers it, and the tutor sees live results.
- Reuses the existing quiz engine, host controls, and leaderboard.

### 5. Async quizzes (anytime)
- Tutor publishes a quiz with a **time window** (opens/closes) or manual unpublish.
- Anyone with the link takes it within the window; everyone gets the same per-question time limits.
- Adds `opens_at` / `closes_at` to quizzes; joining is blocked outside the window.

## Database changes (one migration)
- `classes` (tutor_id, title, subject, description, join_code)
- `class_members` (class_id, name, phone, status: pending/approved/rejected)
- `class_resources` (class_id, title, kind: link/note/video, url/body)
- `class_quizzes` (class_id, quiz_id, mode: pop/async, pushed_at)
- `quizzes` gains `opens_at`, `closes_at` (nullable = no window)
- RLS + GRANTs on all new tables; anon can request to join and read approved content via security-definer RPCs (same pattern as the quiz board).

## Pages
- Dashboard: new "Classes" section alongside Quizzes and Courses.
- `_authenticated/class.$classId.tsx` — tutor control room: roster + approvals, resources, push-quiz button, linked quizzes.
- `class.$code.tsx` — public student view: join form → pending state → approved view (resources, active pop quiz, async quiz links).
- Reuse existing quiz play screen for both pop and async modes.

## Explicitly deferred (Phase 2, needs budget)
- Live video rooms for 200+ viewers (Daily.co or similar paid service).
- Session recording storage + streaming.
- Paid-class recording downloads (paid students download, unpaid watch on-platform) — depends on video + payments.
- AI tutor for post-class questions.

## Verification
- Build passes; Playwright walkthrough of: create class → student requests join → tutor approves → push pop quiz → student answers → async quiz window open/closed behavior.
