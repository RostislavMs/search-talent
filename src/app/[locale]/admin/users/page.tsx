import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import UserRowActions from "@/components/admin/user-row-actions";
import UsersFilterBar from "@/components/admin/users-filter-bar";
import { buttonStyles } from "@/components/ui/button-styles";
import {
  getAdminUsersList,
  type AdminUserRow,
  type UsersListParams,
} from "@/lib/db/admin";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import type { ModerationStatus } from "@/lib/moderation";
import { getModerationCopy } from "@/lib/moderation-copy";
import { buildMetadata } from "@/lib/seo";

const PER_PAGE = 25;

type SearchParamValue = string | string[] | undefined;

function firstValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function resolveLocale(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

function formatDate(value: string | null, locale: Locale) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  return buildMetadata({
    locale,
    pathname: "/admin/users",
    title: `${dictionary.admin.users.title} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.users.description,
    noindex: true,
  });
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const locale = await resolveLocale(params);
  const resolvedSearchParams = await searchParams;
  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.users;
  const moderationCopy = getModerationCopy(locale);
  const viewer = await getCurrentViewerRole();

  const search = firstValue(resolvedSearchParams.q) || "";
  const roleParam = firstValue(resolvedSearchParams.role);
  const statusParam = firstValue(resolvedSearchParams.status);
  const pageParam = Number.parseInt(firstValue(resolvedSearchParams.page) || "1", 10);

  const listParams: UsersListParams = {
    search,
    role:
      roleParam === "admin" || roleParam === "user"
        ? (roleParam as "admin" | "user")
        : "all",
    status:
      statusParam === "approved" ||
      statusParam === "under_review" ||
      statusParam === "restricted" ||
      statusParam === "removed"
        ? (statusParam as ModerationStatus)
        : "all",
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    perPage: PER_PAGE,
  };

  const result = await getAdminUsersList(listParams);

  const summaryCards = [
    { label: copy.summary.total, value: result.summary.totalUsers },
    { label: copy.summary.admins, value: result.summary.totalAdmins },
    { label: copy.summary.newThisWeek, value: result.summary.newThisWeek },
  ];

  const pageCount = Math.max(1, Math.ceil(result.total / result.perPage));

  function buildPageHref(nextPage: number) {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (listParams.role && listParams.role !== "all") qs.set("role", listParams.role);
    if (listParams.status && listParams.status !== "all") {
      qs.set("status", String(listParams.status));
    }
    if (nextPage > 1) qs.set("page", String(nextPage));
    const query = qs.toString();
    const path = createLocalePath(locale, "/admin/users");
    return query ? `${path}?${query}` : path;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-hero app-card p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-3xl app-muted">{copy.description}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {summaryCards.map((card) => (
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

        <div className="mt-6">
          <UsersFilterBar
            labels={{
              searchPlaceholder: copy.searchPlaceholder,
              filterRole: copy.filterRole,
              filterStatus: copy.filterStatus,
              filterAny: copy.filterAny,
              filterAdmins: copy.filterAdmins,
              filterUsers: copy.filterUsers,
              filterApproved: copy.filterApproved,
              filterUnderReview: copy.filterUnderReview,
              filterRestricted: copy.filterRestricted,
              filterRemoved: copy.filterRemoved,
            }}
          />
        </div>
      </section>

      <section className="rounded-hero app-card p-4 sm:p-6">
        {result.items.length === 0 ? (
          <div className="rounded-3xl app-panel-dashed p-8 text-center">
            <p className="text-sm app-muted">{copy.empty}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-eyebrow app-soft">
                  <th className="px-3 py-3">{copy.columns.user}</th>
                  <th className="px-3 py-3">{copy.columns.email}</th>
                  <th className="px-3 py-3">{copy.columns.role}</th>
                  <th className="px-3 py-3">{copy.columns.status}</th>
                  <th className="px-3 py-3">{copy.columns.joined}</th>
                  <th className="px-3 py-3 text-right">{copy.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((user: AdminUserRow) => (
                  <tr
                    key={user.userId}
                    className="border-t border-[color:var(--border)] align-top"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0">
                          <Link
                            href={createLocalePath(
                              locale,
                              `/admin/users/${user.userId}`,
                            )}
                            className="truncate font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                          >
                            {user.displayName ||
                              (user.username ? `@${user.username}` : user.email) ||
                              user.userId}
                          </Link>
                          {user.username ? (
                            <p className="truncate text-xs app-soft">
                              @{user.username}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="break-all app-muted">
                        {user.email || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                          user.isAdmin
                            ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                            : "border border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                        ].join(" ")}
                      >
                        {user.isAdmin ? copy.role.admin : copy.role.user}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="app-muted">
                        {user.moderationStatus
                          ? moderationCopy.statusLabels[user.moderationStatus]
                          : moderationCopy.statusLabels.approved}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="app-muted">
                        {formatDate(user.createdAt, locale)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-end gap-2">
                        {user.username ? (
                          <Link
                            href={createLocalePath(locale, `/u/${user.username}`)}
                            className="text-xs font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                          >
                            {copy.actions.openProfile}
                          </Link>
                        ) : null}
                        <UserRowActions
                          userId={user.userId}
                          profileId={user.profileId}
                          isAdmin={user.isAdmin}
                          isSelf={viewer.user?.id === user.userId}
                          labels={copy.actions}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 ? (
          <nav className="mt-6 flex items-center justify-between gap-3 text-sm app-muted">
            <span>
              {copy.pagination.page} {result.page} {copy.pagination.of} {pageCount}
            </span>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Link
                  href={buildPageHref(result.page - 1)}
                  className={buttonStyles({ variant: "ghost", size: "sm" })}
                >
                  {copy.pagination.previous}
                </Link>
              ) : null}
              {result.hasMore ? (
                <Link
                  href={buildPageHref(result.page + 1)}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  {copy.pagination.next}
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
