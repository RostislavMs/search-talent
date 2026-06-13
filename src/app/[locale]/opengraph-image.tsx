import { ImageResponse } from "next/og";
import { isLocale } from "@/lib/i18n/config";
import { ogLogoDataUri } from "@/lib/og-logo";

export const runtime = "nodejs";
export const alt = "SearchTalent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const isUk = safeLocale === "uk";

  const headline = isUk
    ? "Платформа-спільнота для IT-талантів"
    : "A community platform for IT talent";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(145deg, #0f172a 0%, #0369a1 50%, #f59e0b 100%)",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.2)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ogLogoDataUri} width={40} height={40} alt="SearchTalent" />
          </div>
          <span>SearchTalent</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              width: 72,
              height: 8,
              borderRadius: 999,
              background: "#fbbf24",
            }}
          />
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              maxWidth: 960,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#e2e8f0",
              maxWidth: 960,
            }}
          >
            {isUk
              ? "Портфоліо, проєкти, статті та рейтинг спільноти."
              : "Portfolios, projects, articles, and community ratings."}
          </div>
        </div>

        <div
          style={{
            fontSize: 24,
            color: "#fde68a",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          searchtalent
        </div>
      </div>
    ),
    { ...size },
  );
}
