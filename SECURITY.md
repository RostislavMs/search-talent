# Security Policy

## Reporting a vulnerability

Please report security issues privately, not through public GitHub issues.

- **Preferred:** open a [private security advisory](https://github.com/RostislavMs/search-talent/security/advisories/new) on this repository.
- **Alternative:** email `support.searchtalent@gmail.com` with `SECURITY` in the subject.

Helpful details: the affected URL or endpoint, the steps to reproduce, what an attacker could achieve, and — if you have it — a minimal proof of concept. Screenshots or a short recording are welcome.

We aim to acknowledge a report within 5 working days and to keep you updated while we work on a fix. This is a small project without a bug bounty, so we cannot offer payment, but we are glad to credit you in the advisory if you want that.

## Scope

In scope: the deployed application and its API routes, authentication and session handling, row-level security and access control on user data, file upload and storage handling, and the content moderation and rating logic.

Out of scope: findings that only affect third-party providers (Supabase, Vercel, Cloudflare, GitHub, Google), reports produced solely by an automated scanner with no demonstrated impact, missing hardening headers with no exploitable consequence, denial of service through volume, and social engineering of the maintainers.

## Testing guidelines

Please test only against your own accounts and content. Do not run automated scans that generate significant load, do not access, modify, or exfiltrate data belonging to other users, and do not publish spam or abusive content as part of a test. If you accidentally reach someone else's data, stop, and tell us what happened in the report.

If you follow these guidelines, we will treat your research as authorized and will not pursue action over it.

## What we already run

Static analysis via CodeQL and lint, type, and test gates run on every push through GitHub Actions. Dependency updates arrive through Dependabot. Row-level security is enforced in the database rather than only in the application layer.
