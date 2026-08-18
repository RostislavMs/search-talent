import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHostname = supabaseUrl
  ? new URL(supabaseUrl).hostname
  : "*.supabase.co";

const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL ?? "";
const r2Hostname = r2PublicBaseUrl ? new URL(r2PublicBaseUrl).hostname : null;

type RemotePattern = {
  protocol: "https" | "http";
  hostname: string;
  pathname: string;
};

const remotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: supabaseHostname,
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "https",
    hostname: "lh3.googleusercontent.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "avatars.githubusercontent.com",
    pathname: "/**",
  },
  {
    // YouTube video thumbnails, used as the auto-cover for video projects
    // that only carry a YouTube link (no uploaded image).
    protocol: "https",
    hostname: "i.ytimg.com",
    pathname: "/vi/**",
  },
];

if (r2Hostname) {
  remotePatterns.push({
    protocol: "https",
    hostname: r2Hostname,
    pathname: "/**",
  });
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // Detail-page `generateMetadata` awaits a DB read, so Next streams the shell
  // first and flushes the metadata tags ~225KB into the body. Browsers and
  // Googlebot hoist them back into <head>; a crawler that only parses the real
  // <head> of the raw response sees a page with no title, description, canonical
  // or OG tags at all.
  //
  // Next blocks the response for user agents matched here instead of streaming.
  // Its built-in list already covers the social unfurlers (facebookexternalhit,
  // Twitterbot, LinkedInBot, Slackbot, Discordbot, WhatsApp, Bingbot, Applebot
  // and the Google crawlers), so this adds the ones it does not know about: the
  // AI/LLM fetchers that increasingly drive discovery, plus Telegram and the two
  // SEO crawlers we audit with. Keep the built-in patterns — overriding the
  // option replaces the default list rather than extending it.
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Amazonbot|Bytespider|meta-externalagent|meta-externalfetcher|cohere-ai|MistralAI-User|Applebot-Extended|DuckAssistBot|TelegramBot|AhrefsBot|SemrushBot/i,
};

export default nextConfig;
