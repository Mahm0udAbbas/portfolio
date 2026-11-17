import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/projects`, changeFrequency: "monthly", priority: 0.8 },
    ...site.projects.map((p) => ({
      url: `${SITE_URL}/projects/${p.slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
