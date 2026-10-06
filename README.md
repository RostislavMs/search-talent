# SearchTalent

A bilingual (Ukrainian / English) community and portfolio platform for IT specialists. Authors publish profiles, projects, technical articles, and community polls — optionally with co-authors — while visitors discover, follow, and react to content. The product is built around creator portfolios, rating, and community signal. Specialists mark what they are open to (freelance, a job, an internship, collaboration, mentoring), and visitors reach them through a "Contact" button. Companies create pages with their team and its work, and post vacancies — jobs, internships and paid freelance tasks — that people apply to with their portfolio and can follow by email (hiring, part 8 of the plan).

---

## Tech Stack

| Tool | Version | Role |
| --- | --- | --- |
| Next.js | 16.3.5 | React framework, App Router, server components |
| React | 19.2.3 | UI library |
| TypeScript | 5 | Type system |
| Tailwind CSS | 4 | Utility-first styling, design tokens via CSS vars |
| Supabase | `@supabase/supabase-js` 2.99, `@supabase/ssr` 0.9 | Postgres, Auth, Storage, RLS |
| Zod | 4.3 | Runtime validation for forms and API payloads |
| Google Gemini | `@google/genai` 2.6 | AI-assisted profile summaries and GitHub project drafts |
| Resend | optional | Email notifications (follows, mentions) — skipped if unset |
| Vitest | 2.1 | Unit tests |
| Vercel Speed Insights | 2.0 | Real-user performance metrics |

**Package manager:** pnpm. **Node:** 20+.

---

## Project layout

```text
search-talent/
├── public/                           Static assets (favicon, llms.txt, og fallbacks)
├── tests/unit/                       Vitest unit tests
├── src/
│   ├── app/
│   │   ├── (auth)/                   Legacy non-localized auth routes
│   │   ├── [locale]/                 All user-facing pages — uk | en
│   │   │   ├── (auth)/               login, signup, verify, forgot/reset-password
│   │   │   ├── about/  faq/  feedback/  rating-guide/  legal/  terms/  privacy/  cookies/
│   │   │   ├── talents/              Talent search & filters
│   │   │   ├── projects/             Project catalogue + create/edit
│   │   │   ├── articles/             Article feed + composer + edit
│   │   │   ├── polls/                 Poll feed + composer + edit
│   │   │   ├── u/[username]/         Public profile, /projects, /articles, /polls
│   │   │   ├── profile/edit/         Profile editor (sections, presentation, GitHub link)
│   │   │   ├── notifications/        Notifications inbox
│   │   │   ├── my-space/             Personal stats & quick actions
│   │   │   │   ├── followers/        People who follow you
│   │   │   │   ├── following/        Authors you follow + their feed
│   │   │   │   └── saved/            Bookmarked profiles & projects
│   │   │   ├── analytics/            Platform-wide analytics
│   │   │   └── admin/                Admin console (gated by platform_admins)
│   │   │       ├── audit/  content/{articles,projects,comments}/
│   │   │       ├── feedback/  moderation/  users/
│   │   ├── api/                      Route handlers (see API reference below)
│   │   ├── project-media/            Public proxy for project media URLs
│   │   ├── layout.tsx                Root layout, fonts, metadata defaults
│   │   ├── sitemap.ts                Dynamic XML sitemap
│   │   ├── robots.txt/               robots.txt route handler
│   │   └── globals.css               Tailwind v4 setup + design tokens
│   ├── components/                   Feature components (server + client)
│   │   └── ui/                       Primitives: Button, FormSelect, OptimizedImage, …
│   ├── lib/
│   │   ├── ai/                       Gemini prompts & wrappers
│   │   ├── auth/                     Auth schemas, error normalisation
│   │   ├── db/                       Server-side data access (one file per domain)
│   │   ├── email/                    Resend transport, templates
│   │   ├── i18n/                     Locale config, dictionaries, hooks
│   │   ├── integrations/             GitHub OAuth + repo sync
│   │   ├── security/                 CSP, headers
│   │   ├── supabase/                 client / server / admin factories
│   │   ├── validation/               Shared Zod schemas
│   │   └── *.ts                      Domain utilities (rating, moderation, seo, …)
│   └── types/                        Shared TS types
```

---

## Features

### Profiles

- Rich profile sections: bio, work experience, education, certificates, skills, languages, Q&A, contacts.
- "Open to…" status (freelance, job, internship, collaboration, mentoring) with a two-click toggle in My Space and a reminder after 60 days.
- "Contact" dialog: public channels for everyone; email and phone live in the owner-only `profile_private_details` table and reach signed-in visitors only through `open_profile_contacts()`, which counts the opening for the owner and caps new profiles at 20/hour and 60/day per account. A member of a verified company can open them on behalf of the company: the owner then sees which companies did (`my_contact_open_companies()`) and gets a notification the first time; the whole team shares an extra cap of 30/hour and 100/day. Salary expectations and the hourly rate (for freelance, "from N per hour") are hidden unless the owner shows them, each with its own switch.
- Per-section visibility controls and customisable presentation (palette, fonts, hero alignment, section order, sizes, cover/video background).
- AI-generated public summary (Gemini), opt-in regeneration with rate limits.
- PDF export of the current profile, with a link and a QR code to the portfolio.
- Sharing for the owner (onboarding, My Space, "Share" on their own profile): the link, a ready post for LinkedIn and Telegram, a QR code (PNG) and a README badge — `/api/badge/{username}.svg` with the portfolio score, cached by the CDN for an hour. The QR code, the badge link and the PDF carry `utm_source=qr|badge|resume&utm_medium=portfolio`, so `/admin/metrics` can count sign-ups through portfolios; the link people copy stays clean.
- The profile's OG image shows the rating (once there is a project), "Open to…" and up to three project covers.
- Verified-email badge, completeness meter, profile vote counters.
- GitHub OAuth link → import repos as projects.

### Companies (hiring, stage 8.1)

- Any signed-in person with a confirmed email creates a page for a company or an educational institution (`companies`) and stays a specialist too — there is no separate employer account. Up to 5 pages per creator; one person is in at most 3 teams at a time.
- Team with roles owner / admin / recruiter (`company_members`): invitations like co-authoring (pending → accepted/declined), at most 25 people, always at least one owner. Every change goes through SECURITY DEFINER functions (`invite_company_member`, `respond_company_invite`, `set_company_member_role`, `remove_company_member`); there are no direct write policies on the team.
- "Verified company": an owner or admin proves they can read mail on the website's domain — in one click if their account email is already there, otherwise with a 6-digit code sent (Resend) to any work address on that domain. Only the domain and an HMAC of the code are stored (`company_verification_codes`, service key only; 15 minutes, 5 attempts). Not for public mail services and not for schools, which a platform admin verifies in `/admin/companies`. A new name or website takes the mark off (`guard_company_columns`). Only verified pages are indexed and listed in the sitemap, with `Organization` JSON-LD.
- The page shows only the projects attached to the company (`company_projects`, up to 3 companies per project): a member's project appears at once, anyone else's waits as a request until an owner/admin accepts it. The company can also confirm a project ("Confirmed by the company", `confirm_company_project`). The author or the company's owners/admins take it off; projects stay when the author leaves the team, and the managers are notified (the removed person is notified too). The project page links back to the company. Auto-moderation holds a flagged page for review.
- Every project can say who it was made for (`projects.origin`: yourself, a client, an employer, studies, open source) and name the client or mark it under NDA — then the name is not stored at all. Client work can carry a budget (fixed or hourly) in owner-only `project_private_details`; it is shown only when the author turns it on (`project_public_budget()`).

### Vacancies (hiring, stage 8.2)

- Only company pages post vacancies (`vacancies`, `vacancy_skills`): any accepted member of the team writes, publishes, closes and extends them; the author or an owner/admin deletes. Kinds follow "Open to" (job, internship, freelance, collaboration); a job or an internship must state its pay (an amount or a range, UAH/EUR/USD, per month or hour; freelance per hour or for the project).
- Life cycle in the database (`guard_vacancy_columns`): draft → published → closed or expired; the dates are stamped by the database — open for 60 days from going out, "extend" means 60 days from now, the first publication date stays. At most 5 new vacancies per company a day. The daily cron `/api/cron/expire-vacancies` marks ended ones and notifies the author (the same run sends the job alerts); pages treat a vacancy past `expires_at` as ended even before that.
- Moderation: a verified company's vacancy goes live at once (auto-moderation still screens it, with extra rules against "pay for training" and "write to us on Telegram" scams); an unverified company's vacancy waits in `/admin/content/vacancies` when it first goes out and again whenever its text changes. A report of a scam hides a vacancy until a moderator decides. Reports and moderation actions now target companies and vacancies too.
- `/jobs` is rendered on the server with filters in the address (type, format, level, field, country, skill, "with pay", title search). It stays out of the menu and search engines until there are 5 open vacancies from 3 companies (`SECTION_VISIBILITY_THRESHOLDS.jobs`). A vacancy page is indexed, listed in the sitemap and carries `JobPosting` JSON-LD only while it is open and its company is verified, and only in the language it is written in.

### Applications (hiring, stage 8.3)

- A candidate applies with their portfolio, not a CV (`vacancy_applications`): 1–3 of their published projects (own or co-authored), a message up to 1 000 characters, and consent to hand this company their email and phone. It takes a confirmed email and a public profile; once per vacancy, 20 a day, never to one's own company's vacancy.
- Everything is written through SECURITY DEFINER functions (`apply_to_vacancy`, `withdraw_vacancy_application`, `set_vacancy_application_status`, `mark_vacancy_applications_viewed`); the table has no write grants. The candidate sees their own applications, the company's team those to its vacancies, platform admins none.
- The team's funnel in `/my-space/vacancies/[id]`: new → viewed (stamped when the list is on screen) → shortlisted → rejected or hired; a decision can be taken back. The candidate gets a notification for the first look and each decision, and an email for decisions — a rejection is a short, kind note. The vacancy's author gets a notification and an email for every new application.
- Contacts reach the team only through `vacancy_application_contacts()`: the profile's contact email (or the account email) and phone, nothing for withdrawn applications, and nothing while the vacancy or the company is hidden by moderation.
- Withdrawing wipes the message and the projects and cannot be followed by a new application to the same vacancy. Applications are deleted 12 months after their vacancy closed or ran out (the same daily cron, `purge_old_vacancy_applications()`).

### Job alerts (hiring, stage 8.4)

- A saved search of vacancies (`saved_searches` in mode `vacancies`): "Follow this search" on `/jobs` stores the filters exactly as the address carries them, and "Vacancies that fit me" (`{"match": "profile"}`, switched on under "Open to…" in My Space) matches the kinds the person is open to, their skills and work format. Up to 10 per person, the same filters once; once saved, only the name and the email switch change.
- Every morning the daily cron finds vacancies that went live since the alert was made (published, or approved by a moderator later; a reopened one is not news) and sends each person one `vacancy_match` notification and, for alerts with email on, one email — only to a confirmed address, through Resend's batch API. `job_alert_deliveries` remembers what each alert sent (written by the server, read by the owner, kept 90 days), so nothing arrives twice; vacancies of the person's own company are skipped; if an email fails, that person's matches wait for the next run.
- Every email has a one-click unsubscribe (`List-Unsubscribe` + `List-Unsubscribe-Post`, an HMAC token, no sign-in) that turns the emails off and leaves the alerts in notifications. `/my-space/job-alerts` lists the alerts, the latest vacancies each sent, the email switches and "Remove".
- `/admin/metrics` has a hiring section: open vacancies and companies, applications per week, the share viewed within 7 days (the health number), the share of vacancies with an application within 14 days, the median time to the first application, job alerts and contacts opened by companies.

### Projects

- Title, description, technologies, links (repo + live), media gallery (images & video), pinning.
- Up/down voting with Wilson confidence interval; per-project score (all-time and 30-day).
- Comments with mentions, emoji reactions, soft moderation.
- Optional GitHub draft: fetch README + repo metadata via Gemini to pre-fill a project.

### Articles

- Rich-text composer (sanitised HTML), category, cover image, excerpt, reading time.
- Likes, view counter, threaded comments, mentions, reactions.
- Draft / published states; admins moderate from the admin console.

### Polls

- Single-choice, multiple-choice, and rating questions; voting requires sign-in.
- Category, cover image, optional close date, threaded comments, likes, reactions, view & response counters.
- Draft / published states; grouped with articles under the **Community** navigation.

### Co-authorship

- Invite other members as co-authors when creating or editing a project, article, or poll — search by name or `@username`, up to 4 co-authors (5 authors total).
- Invitees confirm via an actionable in-app notification (Accept / Decline at `/notifications`). A work created for publication is held as a draft until every invitee responds, then auto-publishes — attributing only those who accepted.
- All authors are shown as an avatar stack with a "+N" overflow on cards, on detail pages (project hero + sidebar, article/poll bylines), and in every co-author's profile collections.
- Editing reconciles the set: newly added members are invited, removed ones lose attribution.
- Rating & badges currently credit **only the original creator** — co-authored work does not inflate anyone else's score. Weighted credit-sharing is a planned later phase.

### Talents discovery

- `/talents` filters by skills, experience, country, "Open to…" and work format; cards show the status.
- Saved searches per user.
- Top-rated leaderboards (creators, projects) on the home page.

### Social graph

- Follow / unfollow with email digest (Resend, optional).
- `/my-space/following` — personal feed of new articles & projects from followed authors.
- `/my-space/followers` — list of people who follow you.
- Bookmarks for both profiles and projects in `/my-space/saved`.
- @mentions notify the mentioned user.

### Badges

- 12 community badges across 4 categories × 3 tiers.
- Capped rating bonus of +5 points per profile.
- Awarded automatically by Postgres functions, surfaced via a notification.

### Notifications

- In-app inbox at `/notifications` plus a header bell with unread count.
- Triggers: follows, comments, reactions, mentions, moderation decisions, badge awards, new content from followed authors, and co-author invites / responses (the invite is actionable — accept or decline in place).
- Real-time-style polling via lightweight API; preferences respect cookie consent.

### Moderation & admin

- User-submitted reports with reasons (copyright, abuse, spam, harassment, …) on profiles, projects, articles, polls, comments, company pages and vacancies, through `submit_report()`: the database sets the owner and the priority (normal / high / urgent), refuses one's own content, hidden targets, duplicates and more than 5 reports a minute, and an urgent report puts the target on review at once.
- Statuses: `approved`, `under_review`, `restricted`, `removed`. Every change of status — from the review queue, the admin tables, bulk actions, auto-moderation or a report — is logged in `moderation_actions` and the owner is notified, by a trigger; `moderate_content()` takes an admin's decision together with the report. The log is written only by the database.
- Auto-moderation runs in the database: the blocklist is the `moderation_terms` table, `moderation_screen()` folds look-alike letters, leet and spaced-out words, counts links and capitals and, for vacancies, catches "pay first" scams. A flagged project, article or poll that goes out is removed, a company page or vacancy waits for a moderator, a comment is refused.
- Admin roles change only through `set_platform_admin()` (not one's own, never the last admin), and every change is in the audit log.
- Single admin console at `/admin` (overview, content tables, moderation queue, users, audit log, feedback inbox). Article moderation lives under `/admin/content/articles`.
- Trash: anything deleted (by its author, an admin, or with an account) waits 60 days in a database archive before it is erased for good, files included. A trigger captures every deleted row — a direct delete through the API is caught too — and whatever an FK cascade removed with it joins the same group, so a project comes back with its media, votes and comments. `/admin/trash` lists, restores and erases; the daily cron erases what is due.
- Account deletion moves everything the person owns into the trash in one transaction ("erase" removes articles and comments too; "anonymize" unlinks them and remembers which) and blocks sign-in; the auth user is deleted on day 60. Until then an admin can restore the account on request.

### Internationalisation

- Locales: **uk** (default) and **en**, resolved as `locale` cookie → `Accept-Language` → `uk`.
- URL shape: `/{locale}/{route}`.
- Dictionaries: `src/lib/i18n/dictionaries.ts`. Server: `getDictionary(locale)`. Client: `useDictionary()`.

---

## Routes

### Public

| Route | Description |
| --- | --- |
| `/` | Home — hero, top-rated creators & projects, CTA |
| `/talents` | Talent search with filters |
| `/projects`, `/projects/[slug]` | Project catalogue and detail |
| `/articles`, `/articles/[slug]` | Article feed and detail |
| `/polls`, `/polls/[slug]` | Poll feed and detail |
| `/u/[username]` | Public profile |
| `/u/[username]/projects`, `/u/[username]/articles`, `/u/[username]/polls` | Per-user collections (own + co-authored) |
| `/companies/[slug]` | Company page: the team and its work |
| `/for-companies` | Landing for employers |
| `/jobs`, `/jobs/[slug]` | Open vacancies with filters, vacancy page |
| `/rating-guide` | How the rating system works |
| `/about`, `/faq`, `/feedback` | Marketing & support |
| `/terms`, `/privacy`, `/cookies`, `/legal` | Legal hub |
| `/job-alerts/unsubscribe` | Turns job alert emails off from the link in an email (no sign-in) |

### Auth

| Route | Description |
| --- | --- |
| `/login`, `/signup` | Email/password, Google, GitHub |
| `/verify` | Email verification landing |
| `/forgot-password`, `/reset-password` | Password recovery |

### Authenticated

| Route | Description |
| --- | --- |
| `/my-space` | Personal stats & quick actions |
| `/my-space/followers` | People who follow the current user |
| `/my-space/following` | Feed of authors the user follows + manage list |
| `/my-space/saved` | Bookmarked profiles and projects |
| `/my-space/companies` | Your company pages and invitations to join |
| `/companies/new`, `/companies/edit/[id]` | Create a company page / edit it, team, verification |
| `/my-space/vacancies` | Vacancies of your companies: drafts, open, closed, views, applications |
| `/my-space/vacancies/[id]` | Applications to one vacancy: portfolio, message, contacts, status (company team) |
| `/my-space/applications` | Your applications and where each one stands; withdraw |
| `/my-space/job-alerts` | Searches you follow, "Vacancies that fit me", the email switch, the latest matches |
| `/jobs/new`, `/jobs/edit/[id]` | Vacancy form (company team) |
| `/analytics` | Platform-wide analytics |
| `/notifications` | Inbox |
| `/profile/edit` | Profile editor (sections, presentation, GitHub link, account) |
| `/projects/new`, `/projects/edit/[id]` | Project composer |
| `/articles/new`, `/articles/edit/[id]` | Article composer |
| `/polls/new`, `/polls/edit/[id]` | Poll composer |

### Admin (gated by `platform_admins`)

| Route | Description |
| --- | --- |
| `/admin` | Overview cards |
| `/admin/content/articles` | Article moderation table |
| `/admin/content/projects` | Project moderation table |
| `/admin/content/polls` | Poll moderation table |
| `/admin/content/comments` | Comment moderation |
| `/admin/content/vacancies` | Vacancies waiting for review, open and hidden ones |
| `/admin/moderation` | Reports queue |
| `/admin/users` | User management |
| `/admin/companies` | Verify company pages, moderation status |
| `/admin/feedback` | Inbound feedback |
| `/admin/audit` | Audit log |
| `/admin/trash` | Deleted items kept for 60 days: restore or erase now |

> All localised routes are prefixed with `/[locale]/` (e.g. `/uk/talents`, `/en/projects`).

---

## API reference

### Auth

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/auth/callback` | Finishes OAuth (Google, GitHub) and same-browser email links (`code`), then redirects to `next`, the onboarding or My Space |
| GET | `/api/auth/confirm` | The sign-up confirmation email link (`token_hash`): signs in on any device and opens the onboarding |
| GET | `/api/auth/continue` | Where the password login lands: same redirect rule as the callback |
| POST | `/api/auth/logout` | Sign out |
| PATCH/POST | `/api/onboarding` | Save the onboarding "who you are" step / record a milestone (`completed`, `link_shared`) |
| GET | `/api/onboarding/username` | Live nick availability check |

### Profile & social

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/badge/{username}.svg` | README badge with the portfolio score (public, cached) |
| GET/POST/PATCH | `/api/profile` | Read & update own profile |
| PATCH | `/api/profile/open-to` | Set or confirm the "Open to…" status |
| POST | `/api/profile-contacts` | Email & phone behind "Contact" (signed in, counted, rate limited); `companyId` opens them on behalf of a verified company |
| POST | `/api/profile-vote` | Up/down-vote a profile |
| GET/POST/DELETE | `/api/follows` | Follow graph |
| GET/POST/DELETE | `/api/bookmarks` | Bookmark profiles & projects |

### Companies

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/companies` | Create a company page (confirmed email, 5/hour) |
| PATCH/DELETE | `/api/companies/[id]` | Edit (owner/admin) / delete (owner) |
| PUT/DELETE | `/api/companies/[id]/logo` | Save the just-uploaded logo / remove it |
| POST | `/api/companies/[id]/verify/code` | Send a one-time code to a work address on the website's domain |
| POST | `/api/companies/[id]/verify` | Verify: by the account email (no body) or with `{ code }` |
| GET | `/api/companies/search` | Find company pages by name (signed in; the project form) |
| POST | `/api/companies/[id]/projects` | Attach your own published project (a member: shown at once; otherwise a request) |
| POST | `/api/companies/[id]/projects/[projectId]` | Owner/admin: accept a request or confirm the work |
| DELETE | `/api/companies/[id]/projects/[projectId]` | Take a project off the page, or decline a request |
| POST | `/api/companies/[id]/members` | Invite someone to the team (20/hour) |
| PATCH/DELETE | `/api/companies/[id]/members/[memberId]` | Change a role / remove, cancel an invitation, leave |
| GET | `/api/company-invitations` | Invitations waiting for the current user |
| PATCH | `/api/company-invitations/[id]` | Accept or decline |
| PATCH | `/api/admin/companies/[id]` | Admin: verified mark, moderation status |

### Vacancies

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/vacancies` | Write a vacancy for your company, as a draft or published (10/hour, 5 per company a day) |
| PATCH/DELETE | `/api/vacancies/[id]` | Edit (team) / delete (author, owner or admin) |
| POST | `/api/vacancies/[id]/status` | `publish` a draft, `close`, or `extend` for 60 days (also reopens) |
| POST | `/api/vacancies/[id]/applications` | Apply with 1–3 projects, a message and consent (20 a day, once per vacancy) |
| PATCH | `/api/applications/[id]` | Team: `viewed`, `shortlisted`, `rejected` or `hired`; the candidate is notified (10 changes an hour per application) |
| POST | `/api/applications/[id]/withdraw` | Candidate withdraws an application |
| POST | `/api/applications/viewed` | Team: mark the new applications on screen as viewed |
| POST | `/api/job-alerts` | Follow the `/jobs` filters, or switch on "Vacancies that fit me" (30/hour) |
| PATCH/DELETE | `/api/job-alerts/[id]` | Switch an alert's email / stop following |
| POST | `/api/job-alerts/unsubscribe` | Turn job alert emails off by the token from an email (RFC 8058 one-click) |
| GET | `/api/cron/expire-vacancies` | Daily cron: mark ended vacancies, notify authors, delete applications 12 months after their vacancy closed, send the morning job alerts (`CRON_SECRET`) |

### Projects

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/projects` | List & create |
| GET/PATCH/DELETE | `/api/projects/[id]` | Single project ops |
| POST | `/api/projects/[id]/pin` | Pin/unpin |
| POST | `/api/projects/[id]/comments` | Threaded comments |
| POST | `/api/projects/[id]/sync-github` | Refresh from GitHub repo |
| POST | `/api/projects/[id]/unlink-github` | Detach GitHub link |
| POST | `/api/vote` | Project up/down votes |

### Articles

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/articles` | List & create |
| GET/PATCH/DELETE | `/api/articles/[id]` | Single article ops |
| POST | `/api/articles/[id]/like` | Toggle like |
| POST | `/api/articles/[id]/view` | Increment view counter |
| GET/POST | `/api/articles/[id]/comments` | Threaded comments |

> `POST /api/projects`, `/api/articles`, `/api/polls` and their `PATCH`/`PUT` counterparts accept an optional `coAuthorUserIds` array (≤ 4, server-validated).

### Polls

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/polls` | List & create |
| GET/PUT/DELETE | `/api/polls/[id]` | Single poll ops |
| POST | `/api/polls/[id]/vote` | Cast a vote |
| POST | `/api/polls/[id]/like` | Toggle like |
| POST | `/api/polls/[id]/view` | Increment view counter |
| GET/POST | `/api/polls/[id]/comments` | Threaded comments |

### Co-author invitations

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/co-author-invitations` | Pending invitations for the current user |
| PATCH | `/api/co-author-invitations/[id]` | Accept / decline an invitation |

### Discovery & content

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/search` | Talent and project discovery |
| GET | `/api/saved-searches` | Saved talent and project filters |
| GET/POST | `/api/reactions` | Emoji reactions |
| GET | `/api/mentions/suggest` | Mention autocomplete |
| GET | `/api/notifications` | Inbox (+ `mark-read`, `unread-count`) |
| POST | `/api/reports` | Report content |
| POST | `/api/feedback` | Contact-form messages |
| GET | `/api/meta` | Site-wide metadata (categories, etc.) |

### AI & integrations

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/ai/profile-summary` | Generate / regenerate public profile summary |
| POST | `/api/ai/github-draft` | Draft a project from a GitHub repo |
| GET | `/api/integrations/github` | List linked repos |
| GET | `/api/integrations/github/callback` | GitHub OAuth callback |

### Admin

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/api/admin/moderation` | Moderation queue + decisions |
| PATCH | `/api/admin/articles/[id]` | Article moderation |
| PATCH | `/api/admin/projects/[id]` | Project moderation |
| PATCH | `/api/admin/profiles/[id]` | Profile moderation |
| PATCH | `/api/admin/comments/[id]` | Comment moderation |
| POST | `/api/admin/bulk` | Bulk moderation actions |
| GET/POST | `/api/admin/users` / `[id]` | User management |
| GET | `/api/admin/feedback` / `[id]` | Feedback inbox |
| POST/DELETE | `/api/admin/trash/[group]` | Restore a deleted item / erase it now |

---

## Rating system

Composite score (0–100), recomputed by Postgres functions and exposed in leaderboards.

**Profile score**

- Profile completeness — 25%
- Portfolio strength — 30%
- Community trust (votes) — 20%
- Productivity / freshness — 15%
- Technical breadth — 10%
- Badges — additive cap of +5

**Project score**

- Community trust — 35%
- Content quality — 30%
- Media — 15%
- Technical breadth — 10%
- Freshness — 10%

Votes are aggregated with the Wilson lower confidence bound; freshness uses time decay; both all-time and 30-day windows are stored.

See `/rating-guide` and `src/lib/leaderboards.ts` for the user-facing explanation and the implementation.

---

## Authentication

Supabase Auth with three methods:
- Email + password (verification required)
- Google OAuth
- GitHub OAuth (used both for sign-in and for project import)

Password policy: 8–72 chars, mixed case, digits. Protected routes redirect to `/login?next=…` and come back after signing in (only internal paths are accepted, see `src/lib/auth/redirect.ts`). A Postgres profile row is auto-provisioned on the first authenticated page load with a temporary `user-xxxxxx` nick (`ensureProfileForUser`); the person picks their own on the first onboarding step. The same helper turns on the "email verified" mark once Supabase Auth has confirmed the email.

The first sign-in opens `/onboarding` (three skippable steps: who you are, first project, share the link). State lives in the owner-only `user_onboarding` table.

---

## Security

- **Row-Level Security** on every Supabase table; admin operations go through the service-role client.
- **The database enforces the rules itself.** Guard triggers pin system columns (moderation, scores, counters, dates, the follower fan-out flag) and check comments, links, co-author invites, reports and feedback, so a direct PostgREST call with a user's own token cannot bypass what the API routes check. Toggle rows (likes, follows, reactions) and comments cannot be updated; OAuth tokens are written only by the server.
- **CSP** restricts script/style/connect sources to Supabase, Resend, Vercel, Gemini.
- **HSTS** enabled in production (2 years, includeSubDomains).
- **Permissions-Policy** disables camera / microphone / geolocation.
- **Zod** validates every API payload and form submission.
- **Rate limiting** on sensitive endpoints (sliding-window, in-memory).
- **HTML sanitisation** for user-generated rich-text content.

---

## Cookie consent

GDPR-style consent banner with four categories:

| Category | Purpose | Required |
| --- | --- | --- |
| Essential | Auth, security, CSRF | ✅ always on |
| Preferences | Theme, locale | optional |
| Analytics | Speed Insights & internal counters | optional |
| Marketing | Reserved | optional |

Options surfaced: reject non-essential, limited use, customise, allow all.

---

## Image pipeline

Next.js image optimisation with remote patterns for:

- Supabase Storage (`/storage/v1/object/public/**`)
- Google avatars (`lh3.googleusercontent.com`)
- GitHub avatars (`avatars.githubusercontent.com`)

Output formats: `avif`, `webp`. Cache TTL: 30 days. Client-side compression (`browser-image-compression`) before upload.

---

## SEO

- Per-page `title`, `description`, OpenGraph, Twitter cards.
- `/sitemap.xml` covers static routes plus dynamic profiles, projects, and articles.
- Schema.org JSON-LD: `Organization`, `WebSite` (with `SearchAction`), `Person`, `CreativeWork`, `Article`, `BreadcrumbList`, `ProfilePage`.
- Canonical URLs with `hreflang` alternates for both locales.
- Google site verification meta and `/llms.txt` for AI crawlers.

---

## Getting started

```bash
pnpm install
cp .env.example .env.local       # fill in keys (see below)
pnpm dev                         # http://localhost:3000
```

### Required environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | ✅ | Anon / publishable key |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL (used for OAuth callbacks, email links) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only; admin actions & notifications |
| `GEMINI_API_KEY` | optional | Enables AI summaries and GitHub drafts |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` | optional | Enables GitHub project sync |
| `GITLAB_OAUTH_CLIENT_ID` / `GITLAB_OAUTH_CLIENT_SECRET` | optional | Import a GitLab repo as a project + sync |

### Useful scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run the built app |
| `pnpm lint` | ESLint (errors only; `--max-warnings=0`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest watch mode |
| `pnpm test:run` | Single Vitest run |
| `pnpm test:coverage` | Vitest with V8 coverage |

---

## Testing

Unit tests live under `tests/unit/` and cover validation, rating math, moderation, AI prompts, GitHub sync, notifications presentation, mentions (incl. Unicode/Cyrillic search sanitisation), co-authorship (invite/accept/decline & publish-on-confirm logic, via a mocked Supabase client), rich-text sanitisation, and SEO helpers. Run them with `pnpm test:run`.

---

## Deployment

The app targets Vercel out of the box:

1. Import the repo into Vercel.
2. Set all required env vars (see table above) in the project settings.
3. Configure the Supabase Auth redirect URLs to allow `${NEXT_PUBLIC_APP_URL}/api/auth/callback` with any query string, set the Site URL to `${NEXT_PUBLIC_APP_URL}`, and set up the auth email templates.
4. Configure the GitHub OAuth callback at `${NEXT_PUBLIC_APP_URL}/api/integrations/github/callback`.
5. Before the first deploy, apply the database schema to the production Supabase project.

Speed Insights is wired automatically when running on Vercel.

---

## CI / CD

**CD** is handled by Vercel: every push to `main` triggers a production deploy, every PR gets its own preview URL. No deploy secrets live in GitHub.

**CI** runs in GitHub Actions on every push to `main` and every PR ([.github/workflows/ci.yml](.github/workflows/ci.yml)):

| Job | What it checks |
| --- | --- |
| `checks` | `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage` — coverage report uploaded as an artifact (retained 14 days). |
| `build` | `pnpm build` with placeholder envs — catches type/module errors invisible to `tsc`. Runs after `checks` passes. |
| `audit` | `pnpm audit --prod --audit-level high` — non-blocking, surfaces vulnerable transitive deps. |
| `dependency-review` | PR-only. Fails the PR if a new dep introduces a high-severity advisory or incompatible licence. |

**Security scanning** runs in a separate workflow ([.github/workflows/codeql.yml](.github/workflows/codeql.yml)) — CodeQL `security-and-quality` queries against `javascript-typescript`, executed on push/PR to `main` and weekly on Monday 06:00 UTC. Findings surface in the repo's *Security → Code scanning* tab.

Recommended branch protection on `main`:

- Require status checks: `checks`, `build`, `dependency-review`, `analyze (javascript-typescript)`.
- Require PRs before merging, dismiss stale approvals on push.
- Disallow force-push.
