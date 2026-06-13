import { ImageResponse } from "next/og";
import { getPublicProfilePageData } from "@/lib/db/public";
import { isLocale } from "@/lib/i18n/config";
import { ogLogoDataUri } from "@/lib/og-logo";

export const runtime = "nodejs";
export const alt = "SearchTalent profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const isUk = safeLocale === "uk";
  const data = await getPublicProfilePageData(username);

  const displayName =
    data?.profile.name || data?.profile.username || username;
  const role =
    data?.profile.headline || data?.profile.categoryName || null;
  const skills = (data?.technologies || [])
    .slice(0, 6)
    .map((t) => t.name)
    .filter(Boolean);
  const projectsLabel = isUk
    ? `${data?.projects.length ?? 0} проєктів`
    : `${data?.projects.length ?? 0} projects`;

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
            "linear-gradient(135deg, #ffffff 0%, #f1f5f9 55%, #e2e8f0 100%)",
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
            color: "#0f172a",
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ogLogoDataUri} width={30} height={30} alt="SearchTalent" />
          </div>
          <span>SearchTalent</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 24,
              color: "#475569",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {isUk ? "Портфоліо" : "Portfolio"}
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 1040,
            }}
          >
            {displayName}
          </div>
          {role ? (
            <div
              style={{
                fontSize: 36,
                color: "#334155",
                maxWidth: 1040,
                fontWeight: 500,
              }}
            >
              {role}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {skills.length > 0 ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {skills.map((name) => (
                <div
                  key={name}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 999,
                    background: "#0f172a",
                    color: "#f8fafc",
                    fontSize: 22,
                    fontWeight: 600,
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          ) : null}
          <div
            style={{
              fontSize: 22,
              color: "#64748b",
              fontWeight: 500,
            }}
          >
            @{username} · {projectsLabel}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
