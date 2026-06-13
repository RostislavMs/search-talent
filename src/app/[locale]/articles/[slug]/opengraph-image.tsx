import { ImageResponse } from "next/og";
import { getArticleDetail } from "@/lib/db/articles";
import { isLocale } from "@/lib/i18n/config";
import { ogLogoDataUri } from "@/lib/og-logo";

export const runtime = "nodejs";
export const alt = "SearchTalent article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const isUk = safeLocale === "uk";
  const data = await getArticleDetail(slug, safeLocale);

  const title = data?.article.title || (isUk ? "Стаття" : "Article");
  const authorLabel = data?.article.authorDeleted
    ? isUk
      ? "Видалений користувач"
      : "Deleted user"
    : data?.article.author?.name ||
      data?.article.author?.username ||
      "SearchTalent";
  const excerpt = (data?.article.excerpt || "").slice(0, 160);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #fef3c7 0%, #fde68a 45%, #f5d0fe 100%)",
          color: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
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

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 22,
              color: "#7c2d12",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            {isUk ? "Стаття" : "Article"}
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          {excerpt ? (
            <div
              style={{
                fontSize: 28,
                color: "#334155",
                lineHeight: 1.3,
                maxWidth: 1040,
              }}
            >
              {excerpt}
              {data?.article.excerpt && data.article.excerpt.length > 160
                ? "…"
                : ""}
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontSize: 26,
            color: "#0f172a",
            fontWeight: 600,
          }}
        >
          {isUk ? "Автор" : "By"}: {authorLabel}
        </div>
      </div>
    ),
    { ...size },
  );
}
