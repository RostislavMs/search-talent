# SearchTalent

A bilingual (Ukrainian / English) community and portfolio platform for IT specialists. Authors publish profiles, projects, technical articles, and community polls — optionally with co-authors — while visitors discover, follow, and react to content. The product is **not** a recruiting/hiring marketplace — it is built around creator portfolios, rating, and community signal.

---

## Tech Stack

| Tool | Version | Role |
| --- | --- | --- |
| Next.js | 16.2.3 | React framework, App Router, server components |
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
├── supabase/                         Numbered SQL schema files (run in order)
├── database/                         Incremental dated migrations applied on top of supabase/
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
│   │   │   ├── search/               Global search results
│   │   │   ├── u/[username]/         Public profile, /projects, /articles, /polls
│   │   │   ├── profile/edit/         Profile editor (sections, presentation, GitHub link)
│   │   │   ├── notifications/        Notifications inbox
│   │   │   ├── dashboard/            Personal analytics
│   │   │   │   ├── followers/        People who follow you
│   │   │   │   ├── following/        Authors you follow + their feed
│   │   │   │   └── saved/            Bookmarked profiles & projects
│   │   │   └── admin/                Admin console (gated by platform_admins)
│   │   │       ├── audit/  content/{articles,projects,comments}/
│   │   │       ├── feedback/  moderation/  users/
│   │   ├── api/                      Route handlers (see API reference below)
│   │   ├── project-media/            Public proxy for project media URLs
│   │   ├── layout.tsx                Root layout, fonts, metadata defaults
│   │   ├── sitemap.ts                Dynamic XML sitemap
│   │   ├── robots.ts                 robots.txt generator
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
- Per-section visibility controls and customisable presentation (palette, fonts, hero alignment, section order, sizes, cover/video background).
- AI-generated public summary (Gemini), opt-in regeneration with rate limits.
- PDF export of the current profile.
- Verified-email badge, completeness meter, profile vote counters.
- GitHub OAuth link → import repos as projects.

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

- `/talents` filters by skills, experience, country, work format, salary range.
- Saved searches per user.
- Top-rated leaderboards (creators, projects) on the home page.

### Social graph

- Follow / unfollow with email digest (Resend, optional).
- `/dashboard/following` — personal feed of new articles & projects from followed authors.
- `/dashboard/followers` — list of people who follow you.
- Bookmarks for both profiles and projects in `/dashboard/saved`.
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

- User-submitted reports with reasons (copyright, abuse, spam, harassment, …) and auto-priority (normal / high / urgent).
- Statuses: `approved`, `under_review`, `restricted`, `removed`.
- Single admin console at `/admin` (overview, content tables, moderation queue, users, audit log, feedback inbox). Article moderation lives under `/admin/content/articles`.

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
| `/search` | Global search |
| `/rating-guide` | How the rating system works |
| `/about`, `/faq`, `/feedback` | Marketing & support |
| `/terms`, `/privacy`, `/cookies`, `/legal` | Legal hub |

### Auth

| Route | Description |
| --- | --- |
| `/login`, `/signup` | Email/password, Google, GitHub |
| `/verify` | Email verification landing |
| `/forgot-password`, `/reset-password` | Password recovery |

### Authenticated

| Route | Description |
| --- | --- |
| `/dashboard` | Personal analytics & quick actions |
| `/dashboard/followers` | People who follow the current user |
| `/dashboard/following` | Feed of authors the user follows + manage list |
| `/dashboard/saved` | Bookmarked profiles and projects |
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
| `/admin/moderation` | Reports queue |
| `/admin/users` | User management |
| `/admin/feedback` | Inbound feedback |
| `/admin/audit` | Audit log |

> All localised routes are prefixed with `/[locale]/` (e.g. `/uk/talents`, `/en/projects`).

---

## API reference

### Auth

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/auth/callback` | OAuth callback (Google, GitHub) |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/email-verification` | Re-send / confirm verification |

### Profile & social

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST/PATCH | `/api/profile` | Read & update own profile |
| POST | `/api/profile-vote` | Up/down-vote a profile |
| GET/POST/DELETE | `/api/follows` | Follow graph |
| GET/POST/DELETE | `/api/bookmarks` | Bookmark profiles & projects |

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
| GET | `/api/top-projects` | Leaderboards |

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
| GET | `/api/search` | Global search |
| GET | `/api/top-creators` | Leaderboards |
| GET | `/api/saved-searches` | Saved talent filters |
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
| POST | `/api/admin/refresh-scores` | Recalculate ratings |

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

Password policy: 8–72 chars, mixed case, digits. Protected routes redirect to `/login`. A Postgres profile row is auto-provisioned on the first authenticated page load with a username derived from the email local-part (`ensureProfileForUser`).

---

## Security

- **Row-Level Security** on every Supabase table; admin operations go through the service-role client.
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
3. Configure the Supabase Auth redirect URLs to point at `${NEXT_PUBLIC_APP_URL}/api/auth/callback` and `${NEXT_PUBLIC_APP_URL}/verify`.
4. Configure the GitHub OAuth callback at `${NEXT_PUBLIC_APP_URL}/api/integrations/github/callback`.
5. First deploy → run the SQL files in order against the production Supabase project.

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
