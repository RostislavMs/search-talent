import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import UserRowActions from "@/components/admin/user-row-actions";
import { buildProjectPath } from "@/lib/projects";
import { getAdminUserDetail } from "@/lib/db/admin-content";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { getModerationCopy } from "@/lib/moderation-copy";
import { buildMetadata } from "@/lib/seo";

async function resolveLocale(
  params: Promise<{ locale: string; id: string }>,
): Promise<{ locale: Locale; id: string }> {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, id };
}

function formatDate(value: string | null, locale: Locale) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  const detail = await getAdminUserDetail(id);
  const name =
    detail?.displayName || detail?.username || detail?.email || id;
  return buildMetadata({
    locale,
    pathname: `/admin/users/${id}`,
    title: `${name} · ${dictionary.admin.users.title} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.users.description,
    noindex: true,
  });
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  const detailCopy = dictionary.admin.userDetail;
  const usersCopy = dictionary.admin.users;
  const moderationCopy = getModerationCopy(locale);

  const [detail, viewer] = await Promise.all([
    getAdminUserDetail(id),
    getCurrentViewerRole(),
  ]);

  if (!detail) {
    notFound();
  }

  const auditActionLabels = dictionary.admin.audit.actionLabels as Record<
    string,
    string
  >;

  const displayName =
    detail.displayName || detail.username || detail.email || detailCopy.unknown;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={createLocalePath(locale, "/admin/users")}
          className="text-sm app-soft underline decoration-[color:var(--border)] underline-offset-4"
        >
          ← {detailCopy.backToUsers}
        </Link>
      </div>

      <section className="rounded-hero app-card p-5 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-5">
            {detail.avatarUrl ? (
              <div className="relative h-20 w-20 overflow-hidden rounded-full border border-[color:var(--border)]">
                <Image
                  src={detail.avatarUrl}
                  alt={displayName}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-2xl font-semibold text-[color:var(--foreground)]">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
                {detailCopy.profileHeading}
              </p>
              <h2 className="font-display mt-2 text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
                {displayName}
              </h2>
              {detail.username ? (
                <p className="mt-1 app-soft">@{detail.username}</p>
              ) : null}
              {detail.headline ? (
                <p className="mt-3 max-w-xl app-muted">{detail.headline}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {detail.username ? (
              <Link
                href={createLocalePath(locale, `/u/${detail.username}`)}
                className="text-sm font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
              >
                {usersCopy.actions.openProfile}
              </Link>
            ) : null}
            <UserRowActions
              userId={detail.userId}
              profileId={detail.profileId}
              isAdmin={detail.isAdmin}
              isSelf={viewer.user?.id === detail.userId}
              labels={usersCopy.actions}
            />
          </div>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl app-panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {detailCopy.fields.email}
            </dt>
            <dd className="mt-2 break-all text-sm text-[color:var(--foreground)]">
              {detail.email || "—"}
            </dd>
          </div>
          <div className="rounded-2xl app-panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {detailCopy.fields.role}
            </dt>
            <dd className="mt-2 text-sm text-[color:var(--foreground)]">
              {detail.isAdmin ? usersCopy.role.admin : usersCopy.role.user}
            </dd>
          </div>
          <div className="rounded-2xl app-panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {detailCopy.fields.status}
            </dt>
            <dd className="mt-2 text-sm text-[color:var(--foreground)]">
              {detail.moderationStatus
                ? moderationCopy.statusLabels[detail.moderationStatus]
                : moderationCopy.statusLabels.approved}
            </dd>
          </div>
          <div className="rounded-2xl app-panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {detailCopy.fields.joined}
            </dt>
            <dd className="mt-2 text-sm text-[color:var(--foreground)]">
              {formatDate(detail.createdAt, locale)}
            </dd>
          </div>
          <div className="rounded-2xl app-panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {detailCopy.fields.lastSeen}
            </dt>
            <dd className="mt-2 text-sm text-[color:var(--foreground)]">
              {formatDate(detail.lastSignInAt, locale)}
            </dd>
          </div>
          <div className="rounded-2xl app-panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {detailCopy.fields.country}
            </dt>
            <dd className="mt-2 text-sm text-[color:var(--foreground)]">
              {detail.countryName || "—"}
            </dd>
          </div>
        </dl>

        {detail.bio ? (
          <p className="mt-6 max-w-3xl whitespace-pre-wrap text-sm leading-7 app-muted">
            {detail.bio}
          </p>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: detailCopy.counts.projects,
              value: detail.counts.projects,
            },
            {
              label: detailCopy.counts.articles,
              value: detail.counts.articles,
            },
            {
              label: detailCopy.counts.comments,
              value: detail.counts.comments,
            },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-2xl app-panel p-5"
            >
              <p className="text-sm app-soft">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                {card.value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-hero app-card p-6">
        <h3 className="text-xl font-semibold text-[color:var(--foreground)]">
          {detailCopy.contentHeading}
        </h3>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {detailCopy.contentTabs.projects}
            </p>
            {detail.projects.length === 0 ? (
              <p className="mt-3 text-sm app-muted">{detailCopy.emptyContent}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {detail.projects.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between gap-3 rounded-[1rem] app-panel px-4 py-3"
                  >
                    <Link
                      href={createLocalePath(
                        locale,
                        buildProjectPath(project.id, null),
                      )}
                      className="truncate text-sm font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                    >
                      {project.title}
                    </Link>
                    <span className="text-xs app-soft">
                      {project.moderationStatus
                        ? moderationCopy.statusLabels[project.moderationStatus]
                        : moderationCopy.statusLabels.approved}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {detailCopy.contentTabs.articles}
            </p>
            {detail.articles.length === 0 ? (
              <p className="mt-3 text-sm app-muted">{detailCopy.emptyContent}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {detail.articles.map((article) => (
                  <li
                    key={article.id}
                    className="flex items-center justify-between gap-3 rounded-[1rem] app-panel px-4 py-3"
                  >
                    <Link
                      href={createLocalePath(locale, `/articles/${article.slug}`)}
                      className="truncate text-sm font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                    >
                      {article.title}
                    </Link>
                    <span className="text-xs app-soft">
                      {article.moderationStatus
                        ? moderationCopy.statusLabels[article.moderationStatus]
                        : moderationCopy.statusLabels.approved}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-hero app-card p-6">
        <h3 className="text-xl font-semibold text-[color:var(--foreground)]">
          {detailCopy.activityHeading}
        </h3>
        {detail.auditActions.length === 0 ? (
          <p className="mt-4 text-sm app-muted">{detailCopy.emptyActivity}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {detail.auditActions.map((action) => (
              <li
                key={action.id}
                className="rounded-[1rem] app-panel px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold">
                    {auditActionLabels[action.actionType] || action.actionType}
                  </span>
                  <span className="text-xs app-soft">
                    {formatDate(action.createdAt, locale)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--foreground)]">
                  {action.actorLabel}
                </p>
                {action.note ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm app-muted">
                    {action.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
