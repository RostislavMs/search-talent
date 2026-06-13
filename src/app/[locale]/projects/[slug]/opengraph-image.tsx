import { ImageResponse } from "next/og";
import { getPublicProjectPageData } from "@/lib/db/public";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
export const alt = "SearchTalent project";
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
  const data = await getPublicProjectPageData(slug);

  const title = data?.project.title || (isUk ? "Проєкт" : "Project");
  const authorLabel =
    data?.owner?.name || data?.owner?.username || "SearchTalent";
  const technologies = (data?.technologies || [])
    .slice(0, 6)
    .map((t) => t.name);

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
            "linear-gradient(135deg, #0b1120 0%, #1e293b 55%, #0f172a 100%)",
          color: "#f8fafc",
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
              background: "#f59e0b",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            S
          </div>
          <span>SearchTalent</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 22,
              color: "#94a3b8",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {isUk ? "Проєкт" : "Project"}
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#cbd5e1",
              fontWeight: 500,
            }}
          >
            {isUk ? "Автор" : "By"}: {authorLabel}
          </div>
        </div>

        {technologies.length > 0 ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {technologies.map((name) => (
              <div
                key={name}
                style={{
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: "rgba(248, 250, 252, 0.12)",
                  color: "#f8fafc",
                  fontSize: 22,
                  fontWeight: 600,
                  border: "1px solid rgba(248, 250, 252, 0.18)",
                }}
              >
                {name}
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              fontSize: 22,
              color: "#94a3b8",
            }}
          >
            searchtalent / projects
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
