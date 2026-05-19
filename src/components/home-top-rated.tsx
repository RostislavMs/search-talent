"use client";

import { useState } from "react";
import type { RankedCreator, RankedProject } from "@/lib/db/leaderboards";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { buildProjectPath } from "@/lib/projects";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";

type HomeTopRatedProps = {
  dictionary: Dictionary;
  creators: {
    all: RankedCreator[];
    month: RankedCreator[];
  };
  projects: {
    all: RankedProject[];
    month: RankedProject[];
  };
};

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
          : "border app-border bg-[color:var(--surface)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function LeaderboardScore({
  score,
  dictionary,
}: {
  score: number;
  dictionary: Dictionary;
}) {
  return (
    <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--foreground)]">
      {score} {dictionary.home.leaderboardScore}
    </span>
  );
}

export default function HomeTopRated({
  dictionary,
  creators,
  projects,
}: HomeTopRatedProps) {
  const [creatorTimeframe, setCreatorTimeframe] = useState<"all" | "month">("all");
  const [projectTimeframe, setProjectTimeframe] = useState<"all" | "month">("all");
  const creatorItems = creators[creatorTimeframe];
  const projectItems = projects[projectTimeframe];

  return (
    <div className="space-y-8 sm:space-y-12">
      <section className="rounded-2xl border app-border bg-[linear-gradient(145deg,_rgba(15,23,42,0.97),_rgba(29,78,216,0.92)_55%,_rgba(16,185,129,0.88))] p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] sm:rounded-[2.25rem] sm:p-8 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70 sm:text-sm">
          {dictionary.home.topRatedEyebrow}
        </p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight sm:mt-4 sm:text-4xl md:text-5xl">
          {dictionary.home.topRatedTitle}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/78 sm:mt-4 sm:text-lg sm:leading-8">
          {dictionary.home.topRatedDescription}
        </p>

        <div className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.values(dictionary.home.ratingSignals).map((item) => (
            <div
              key={item.title}
              className="rounded-[1.5rem] border border-white/12 bg-white/10 p-5 backdrop-blur"
            >
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-white/72">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl app-card p-4 sm:rounded-[2rem] sm:p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--foreground)] sm:text-2xl">
              {dictionary.home.topCreatorsTitle}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm app-muted sm:mt-2 sm:text-base">
              {dictionary.home.topCreatorsDescription}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ToggleButton
              active={creatorTimeframe === "all"}
              onClick={() => setCreatorTimeframe("all")}
            >
              {dictionary.home.allTime}
            </ToggleButton>
            <ToggleButton
              active={creatorTimeframe === "month"}
              onClick={() => setCreatorTimeframe("month")}
            >
              {dictionary.home.thisMonth}
            </ToggleButton>
          </div>
        </div>

        {creatorItems.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-2">
            {creatorItems.map((creator, index) => (
              <LocalizedLink
                key={creator.id}
                href={`/u/${creator.username}`}
                className="group rounded-2xl border app-border bg-[color:var(--surface)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-xl sm:rounded-[1.75rem] sm:p-5"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--foreground)] text-xs font-semibold text-[color:var(--background)] sm:h-11 sm:w-11 sm:rounded-2xl sm:text-sm">
                    #{index + 1}
                  </div>

                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)] text-sm font-semibold text-[color:var(--foreground)] sm:h-14 sm:w-14 sm:text-base">
                    {creator.avatar_url ? (
                      <OptimizedImage
                        src={creator.avatar_url}
                        alt={creator.name || creator.username}
                        fill
                        sizes="(max-width: 640px) 44px, 56px"
                        className="object-cover"
                      />
                    ) : (
                      <span>
                        {(creator.name || creator.username || dictionary.common.creator)
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-[color:var(--foreground)]">
                          {creator.name || creator.username}
                        </h3>
                        <p className="truncate text-sm app-muted">@{creator.username}</p>
                      </div>
                      <LeaderboardScore score={creator.rating} dictionary={dictionary} />
                    </div>

                    {creator.headline && (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 app-muted">
                        {creator.headline}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 text-xs app-soft">
                      <span className="rounded-full app-panel px-3 py-1">
                        {dictionary.home.profileCompletionLabel}: {creator.profileCompleteness}%
                      </span>
                      <span className="rounded-full app-panel px-3 py-1">
                        {dictionary.home.projectsCountLabel}: {creator.projectCount}
                      </span>
                      {creator.topProjectTitle && (
                        <span className="rounded-full app-panel px-3 py-1">
                          {dictionary.home.topProjectLabel}: {creator.topProjectTitle}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </LocalizedLink>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.75rem] app-panel-dashed p-8 text-sm app-muted">
            {dictionary.home.leaderboardEmpty}
          </div>
        )}
      </section>

      <section className="rounded-2xl app-card p-4 sm:rounded-[2rem] sm:p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--foreground)] sm:text-2xl">
              {dictionary.home.topProjectsTitle}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm app-muted sm:mt-2 sm:text-base">
              {dictionary.home.topProjectsDescription}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ToggleButton
              active={projectTimeframe === "all"}
              onClick={() => setProjectTimeframe("all")}
            >
              {dictionary.home.allTime}
            </ToggleButton>
            <ToggleButton
              active={projectTimeframe === "month"}
              onClick={() => setProjectTimeframe("month")}
            >
              {dictionary.home.thisMonth}
            </ToggleButton>
          </div>
        </div>

        {projectItems.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:mt-8 sm:gap-4">
            {projectItems.map((project, index) => (
              <LocalizedLink
                key={project.id}
                href={buildProjectPath(project.id, project.slug)}
                className="group rounded-2xl border app-border bg-[color:var(--surface)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-xl sm:rounded-[1.75rem] sm:p-5"
              >
                <div className="grid gap-4 sm:gap-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--foreground)] text-xs font-semibold text-[color:var(--background)] sm:h-11 sm:w-11 sm:rounded-2xl sm:text-sm">
                      #{index + 1}
                    </div>

                    <div className="relative h-16 w-24 overflow-hidden rounded-2xl border app-border bg-[color:var(--surface-muted)] sm:h-20 sm:w-28 sm:rounded-[1.25rem]">
                      {project.cover_url ? (
                        <OptimizedImage
                          src={project.cover_url}
                          alt={project.title}
                          fill
                          sizes="(max-width: 640px) 96px, 112px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-end bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.14),_transparent_45%),linear-gradient(135deg,_rgba(148,163,184,0.28),_rgba(255,255,255,0.8))] p-3">
                          <span className="rounded-full bg-white/85 px-2 py-1 text-[10px] font-medium text-slate-700 shadow-sm">
                            {dictionary.common.project}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold text-[color:var(--foreground)]">
                          {project.title}
                        </h3>
                        <p className="mt-1 text-sm app-muted">
                          {project.ownerName || project.ownerUsername
                            ? `${dictionary.common.by} ${project.ownerName || project.ownerUsername}`
                            : dictionary.common.project}
                        </p>
                      </div>
                      <LeaderboardScore score={project.rating} dictionary={dictionary} />
                    </div>

                    {project.description && (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 app-muted">
                        {project.description}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 text-xs app-soft">
                      <span className="rounded-full app-panel px-3 py-1">
                        {dictionary.projectPage.likes}: {project.likes}
                      </span>
                      <span className="rounded-full app-panel px-3 py-1">
                        {dictionary.home.projectMediaLabel}: {project.mediaCount}
                      </span>
                      <span className="rounded-full app-panel px-3 py-1">
                        {dictionary.home.technologyCountLabel}: {project.technologyCount}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <span className="rounded-full border app-border px-4 py-2 text-sm font-medium app-muted transition group-hover:bg-[color:var(--surface-muted)] group-hover:text-[color:var(--foreground)]">
                      {dictionary.common.viewProject}
                    </span>
                  </div>
                </div>
              </LocalizedLink>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[1.75rem] app-panel-dashed p-8 text-sm app-muted">
            {dictionary.home.leaderboardEmpty}
          </div>
        )}
      </section>
    </div>
  );
}
