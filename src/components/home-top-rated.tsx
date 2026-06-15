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
    <span className="font-display rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-on-soft">
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
    <div className="space-y-6 sm:space-y-8">
      <section className="bg-brand-hero rounded-2xl border app-border p-5 text-center text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] sm:rounded-hero sm:p-7 sm:text-left md:p-8">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/70 sm:text-sm">
          {dictionary.home.topRatedEyebrow}
        </p>
        <h2 className="font-display mt-3 text-3xl font-medium leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
          {dictionary.home.topRatedTitle}
        </h2>
        <p className="mt-3 text-sm leading-7 text-white/78 sm:text-base sm:leading-7">
          {dictionary.home.topRatedDescription}
        </p>

        <div className="mt-5">
          <LocalizedLink
            href="/rating-guide"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm.85 9.6h-1.7v-1.7h1.7v1.7Zm.7-4.3c-.2.3-.6.6-1 .9-.3.2-.4.4-.5.6-.05.15-.1.4-.1.7H6.45c0-.6.05-1 .2-1.3.15-.3.45-.55.85-.85.25-.2.45-.35.55-.5a.85.85 0 0 0 .2-.55.7.7 0 0 0-.25-.55c-.15-.15-.35-.25-.6-.25a.95.95 0 0 0-.7.27.95.95 0 0 0-.3.72H4.65c0-.65.25-1.2.75-1.65a2.8 2.8 0 0 1 1.85-.7c.7 0 1.3.2 1.75.6.45.4.7.95.7 1.6 0 .35-.1.7-.3 1.05Z" />
            </svg>
            <span>{dictionary.home.topRatedGuideCta}</span>
          </LocalizedLink>
        </div>

        <div className="mt-5 grid gap-3 text-left sm:mt-6 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.values(dictionary.home.ratingSignals).map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur"
            >
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-white/72">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl app-card p-4 sm:rounded-hero sm:p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl">
              {dictionary.home.topCreatorsTitle}
            </h2>
            <p className="mt-1.5 text-sm app-muted sm:mt-2 sm:text-base">
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
          <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-2">
            {creatorItems.map((creator, index) => (
              <LocalizedLink
                key={creator.id}
                href={`/u/${creator.username}`}
                className={`group rounded-2xl border app-border bg-[color:var(--surface)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-xl sm:rounded-panel sm:p-4 ${
                  index < 2 ? "lg:col-span-2" : ""
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 sm:gap-3.5">
                    <div
                      className={`font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold sm:h-10 sm:w-10 sm:rounded-2xl sm:text-sm ${
                        index < 3
                          ? "bg-brand text-brand-foreground"
                          : "border app-border bg-[color:var(--surface-muted)] text-[color:var(--muted-foreground)]"
                      }`}
                    >
                      #{index + 1}
                    </div>

                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)] text-sm font-semibold text-[color:var(--foreground)] sm:h-12 sm:w-12 sm:text-base">
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

                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-[color:var(--foreground)] sm:text-lg">
                          {creator.name || creator.username}
                        </h3>
                        <p className="truncate text-sm app-muted">@{creator.username}</p>
                      </div>
                      <LeaderboardScore score={creator.rating} dictionary={dictionary} />
                    </div>
                  </div>

                  {creator.headline && (
                    <p className="line-clamp-2 text-sm leading-6 app-muted">
                      {creator.headline}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs app-soft">
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
              </LocalizedLink>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-panel app-panel-dashed p-6 text-sm app-muted sm:mt-8 sm:p-8">
            {dictionary.home.leaderboardEmpty}
          </div>
        )}
      </section>

      <section className="rounded-2xl app-card p-4 sm:rounded-hero sm:p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl">
              {dictionary.home.topProjectsTitle}
            </h2>
            <p className="mt-1.5 text-sm app-muted sm:mt-2 sm:text-base">
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
          <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-2">
            {projectItems.map((project, index) => (
              <LocalizedLink
                key={project.id}
                href={buildProjectPath(project.id, project.slug)}
                className="group rounded-2xl border app-border bg-[color:var(--surface)] p-3 transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-xl sm:rounded-panel sm:p-3"
              >
                <div className="flex flex-col gap-3 md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:items-stretch md:gap-4">
                  <div className="relative h-44 w-full overflow-hidden rounded-2xl border app-border bg-[color:var(--surface-muted)] sm:h-52 md:h-full md:min-h-[8.5rem]">
                    <div
                      className={`font-display absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold shadow-sm ${
                        index < 3
                          ? "bg-brand text-brand-foreground"
                          : "border app-border bg-[color:var(--surface-muted)] text-[color:var(--muted-foreground)]"
                      }`}
                    >
                      #{index + 1}
                    </div>
                    {project.cover_url ? (
                      <OptimizedImage
                        src={project.cover_url}
                        alt={project.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 192px"
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

                  <div className="flex min-w-0 flex-col justify-center">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-[color:var(--foreground)]">
                          {project.title}
                        </h3>
                        <p className="mt-0.5 text-sm app-muted">
                          {project.ownerName || project.ownerUsername
                            ? `${dictionary.common.by} ${project.ownerName || project.ownerUsername}`
                            : dictionary.common.project}
                        </p>
                      </div>
                      <LeaderboardScore score={project.rating} dictionary={dictionary} />
                    </div>

                    {project.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-snug app-muted">
                        {project.description}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap gap-2 text-xs app-soft">
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
                </div>
              </LocalizedLink>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-panel app-panel-dashed p-6 text-sm app-muted sm:mt-8 sm:p-8">
            {dictionary.home.leaderboardEmpty}
          </div>
        )}
      </section>
    </div>
  );
}
