import { ImageResponse } from "next/og";
import { getPublicProfilePageData } from "@/lib/db/public";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { loadOgCovers, pickOgCovers } from "@/lib/og-cover-images";
import { ogLogoDataUri } from "@/lib/og-logo";
import { formatOpenToList } from "@/lib/open-to";
import { getSiteUrl } from "@/lib/seo";

export const runtime = "nodejs";
export const alt = "SearchTalent profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PADDING = 64;
const COLUMN_GAP = 40;
const TILE_GAP = 12;
const WORKS_WIDTH = 472;
const INNER_HEIGHT = size.height - PADDING * 2;

/**
 * The card a shared portfolio link unfurls into (LinkedIn, Telegram, X…): who
 * it is, the rating, what they are open to and — the point of sharing a
 * portfolio — up to three project covers.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const isUk = safeLocale === "uk";
  const dictionary = getDictionary(safeLocale);
  const data = await getPublicProfilePageData(username, safeLocale);

  const displayName = data?.profile.name || data?.profile.username || username;
  const role = data?.profile.headline || data?.profile.categoryName || null;
  const projectCount = data?.projects.length ?? 0;
  const projectWord = isUk
    ? { one: "проєкт", few: "проєкти", many: "проєктів", other: "проєкту" }
    : { one: "project", few: "projects", many: "projects", other: "projects" };
  const pluralForm = new Intl.PluralRules(isUk ? "uk" : "en").select(projectCount);
  const projectsLabel = `${projectCount} ${projectWord[pluralForm as keyof typeof projectWord] ?? projectWord.many}`;
  // "Rating 2/100" on a link someone shares without a single project turns
  // people away; the number appears once there is work behind it.
  const rating = projectCount > 0 ? (data?.profileRating ?? null) : null;
  const openToList = data
    ? formatOpenToList(data.profile.open_to, dictionary.openTo.phrases)
    : null;
  const openToLine = openToList ? dictionary.openTo.badge.replace("{list}", openToList) : null;
  const skills = (data?.technologies || [])
    .slice(0, 5)
    .map((technology) => technology.name)
    .filter(Boolean);
  const covers = data
    ? await loadOgCovers(pickOgCovers(data.projects), getSiteUrl())
    : [];
  const hasWorks = covers.length > 0;
  const nameSize = displayName.length > 22 ? 54 : 68;

  const tile = (src: string, index: number, width: number, height: number) => (
    // eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser
    <img
      key={index}
      src={src}
      width={width}
      height={height}
      alt=""
      style={{ width, height, objectFit: "cover", borderRadius: 20 }}
    />
  );

  const works = !hasWorks ? null : covers.length === 1 ? (
    tile(covers[0], 0, WORKS_WIDTH, INNER_HEIGHT)
  ) : covers.length === 2 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: TILE_GAP }}>
      {covers.map((cover, index) => tile(cover, index, WORKS_WIDTH, (INNER_HEIGHT - TILE_GAP) / 2))}
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: TILE_GAP }}>
      {tile(covers[0], 0, WORKS_WIDTH, 290)}
      <div style={{ display: "flex", gap: TILE_GAP }}>
        {covers
          .slice(1, 3)
          .map((cover, index) =>
            tile(cover, index + 1, (WORKS_WIDTH - TILE_GAP) / 2, INNER_HEIGHT - 290 - TILE_GAP),
          )}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          gap: COLUMN_GAP,
          padding: PADDING,
          background: "linear-gradient(135deg, #ffffff 0%, #f5f5f4 60%, #e7e5e4 100%)",
          color: "#1c1917",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 700 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(28, 25, 23, 0.08)",
                boxShadow: "0 4px 12px rgba(28, 25, 23, 0.12)",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  backgroundImage: `url(${ogLogoDataUri})`,
                  backgroundSize: "30px 30px",
                  backgroundRepeat: "no-repeat",
                }}
              />
            </div>
            <span>SearchTalent</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                fontSize: 22,
                color: "#57534e",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {isUk ? "Портфоліо" : "Portfolio"}
            </div>
            <div
              style={{
                fontSize: nameSize,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
              }}
            >
              {displayName}
            </div>
            {role ? (
              <div style={{ fontSize: 30, color: "#44403c", fontWeight: 500, lineHeight: 1.25 }}>
                {role}
              </div>
            ) : null}
            {rating !== null || openToLine ? (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
                {rating !== null ? (
                  <div
                    style={{
                      display: "flex",
                      padding: "8px 18px",
                      borderRadius: 999,
                      background: "#c2532e",
                      color: "#ffffff",
                      fontSize: 24,
                      fontWeight: 700,
                    }}
                  >
                    {`${isUk ? "Рейтинг" : "Rating"} ${rating}/100`}
                  </div>
                ) : null}
                {openToLine ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, fontWeight: 600 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 999, background: "#10b981" }} />
                    {openToLine}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!hasWorks && skills.length > 0 ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {skills.map((name) => (
                  <div
                    key={name}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 999,
                      background: "#1c1917",
                      color: "#fafaf9",
                      fontSize: 22,
                      fontWeight: 600,
                    }}
                  >
                    {name}
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ fontSize: 22, color: "#78716c", fontWeight: 500 }}>
              {`@${username} · ${projectsLabel}`}
            </div>
          </div>
        </div>

        {works ? <div style={{ display: "flex", width: WORKS_WIDTH }}>{works}</div> : null}
      </div>
    ),
    { ...size },
  );
}
