import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/rayon/", "/product/", "/about", "/help", "/contact", "/legal/", "/supplier/register"],
        disallow: [
          "/admin/",
          "/supplier/",
          "/partner/",
          "/driver/",
          "/dashboard/",
          "/checkout/",
          "/order/",
          "/orders/",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
