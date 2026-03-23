import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },

  async redirects() {
    return [
      // Old /products?category=X → new /category/X
      // Next.js matches query params with "has" + "value"
      ...[
        "gpus", "cpus", "ssds", "ram", "monitors", "keyboards", "mice",
        "laptops", "motherboards", "power-supplies", "cases", "coolers",
        "headphones", "speakers", "routers", "webcams", "external-storage",
        "hard-drives", "tvs", "tablets", "printers", "gaming-consoles",
        "smart-home", "ups-power", "network-switches", "case-fans",
        "desktops", "nas",
      ].map((cat) => ({
        source: "/products",
        has: [{ type: "query" as const, key: "category", value: cat }],
        destination: `/category/${cat}`,
        permanent: true,
      })),

      // /changes → homepage (price drops now live on homepage + category pages)
      {
        source: "/changes",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
