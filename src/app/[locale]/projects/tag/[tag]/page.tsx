import type { Metadata } from "next";
import ProjectCard from "@/components/project-card";
import { ButtonLink } from "@/components/ui/Button";
import {
  getProjectsBySkillId,
  getTechnologyBySlug,
  getTechnologyDirectory,
} from "@/lib/db/marketing";
import { locales, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getProjectsByTechnologyIntro } from "@/lib/marketing-content";
import { buildProjectsTagMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

export const revalidate = 21600;

const MIN_PROJECTS_FOR_TAG_PAGE = 5;

export async function generateStaticParams() {
  const items = await getTechnologyDirectory(200);
  const eligible = items.filter(
    (item) => item.count >= MIN_PROJECTS_FOR_TAG_PAGE,
  );

  return locales.flatMap((locale) =>
    eligible.map((item) => ({ locale, tag: item.slug })),
  );
}

async function getRouteParams(
  params: Promise<{ locale: string; tag: string }>,
) {
  const { locale, tag } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return {
    locale: locale as Locale,
    tag,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tag: string }>;
}): Promise<Metadata> {
  const { locale, tag } = await getRouteParams(params);
  const technology = await getTechnologyBySlug(tag);

  if (!technology) {
    notFound();
  }

  return buildProjectsTagMetadata({
    locale,
    pathname: `/projects/tag/${tag}`,
    technology: technology.name,
    count: technology.count,
    noindex: technology.count < MIN_PROJECTS_FOR_TAG_PAGE,
  });
}

export default async function ProjectsByTagPage({
  params,
}: {
  params: Promise<{ locale: string; tag: string }>;
}) {
  const { locale, tag } = await getRouteParams(params);
  const technology = await getTechnologyBySlug(tag);

  if (!technology) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const intro = getProjectsByTechnologyIntro(locale, technology.name);

  const [projects, allTech] = await Promise.all([
    getProjectsBySkillId(technology.id, 24),
    getTechnologyDirectory(50),
  ]);

  const relatedTech = allTech
    .filter((item) => item.slug !== technology.slug && item.count > 0)
    .slice(0, 8);

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-hero app-card p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
          {locale === "uk" ? "Стек" : "Stack"}
        </p>
        <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
          {locale === "uk"
            ? `IT-проєкти на ${technology.name}`
            : `IT projects built with ${technology.name}`}
        </h1>
        <p className="mt-3 text-sm app-muted">
          {projects.length}
          {locale === "uk" ? " публічних проєктів" : " public projects"}
        </p>
        <div className="mt-5 space-y-4 text-sm leading-7 app-muted sm:text-base sm:leading-8">
          {intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="mt-6 sm:mt-8">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              dictionary={dictionary}
              project={{
                id: project.id,
                title: project.title,
                slug: project.slug || "",
                description: project.description,
                ownerName: project.ownerName,
                ownerUsername: project.ownerUsername,
                score: project.score,
                cover_url: project.coverUrl,
              }}
            />
          ))}
        </div>
      </section>

      {relatedTech.length > 0 && (
        <section className="mt-6 rounded-hero app-card p-5 sm:mt-8 sm:p-7">
          <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
            {locale === "uk" ? "Інші технології" : "Other technologies"}
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {relatedTech.map((item) => (
              <ButtonLink
                key={item.id}
                href={`/projects/tag/${item.slug}`}
                variant="secondary"
                className="rounded-full"
              >
                <span>{item.name}</span>
                <span className="ml-2 rounded-full bg-black/8 px-2 py-0.5 text-xs">
                  {item.count}
                </span>
              </ButtonLink>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
