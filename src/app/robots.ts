import type { MetadataRoute } from "next";
import { getMetadataBase } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getMetadataBase();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/",
          "/login",
          "/signup",
          "/verify",
          "/forgot-password",
          "/reset-password",
          "/profile",
          "/profile/",
          "/feedback",
          "/search",
          "/*/dashboard",
          "/*/dashboard/",
          "/*/login",
          "/*/signup",
          "/*/verify",
          "/*/forgot-password",
          "/*/reset-password",
          "/*/profile",
          "/*/profile/",
          "/*/feedback",
          "/*/search",
          "/*/projects/new",
          "/*/projects/edit/",
          "/*/articles/new",
          "/*/articles/edit/",
          "/*?*filter=",
          "/*?*sort=",
          "/*?*page=",
          "/*?*query=",
          "/*?*tag=",
        ],
      },
    ],
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base.toString(),
  };
}
