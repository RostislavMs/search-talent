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
};

export default nextConfig;
