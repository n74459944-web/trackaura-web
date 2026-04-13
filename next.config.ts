import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      // Canada Computers
      { protocol: "https", hostname: "ccimg1.canadacomputers.com" },
      { protocol: "https", hostname: "ccimg2.canadacomputers.com" },
      { protocol: "https", hostname: "www.canadacomputers.com" },
      // Newegg Canada
      { protocol: "https", hostname: "c1.neweggimages.com" },
      { protocol: "https", hostname: "c2.neweggimages.com" },
      { protocol: "https", hostname: "images10.newegg.com" },
      { protocol: "https", hostname: "images11.newegg.com" },
      // Vuugo (Cloudfront — subdomain may rotate, so wildcard)
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "www.vuugo.com" },
      { protocol: "https", hostname: "vuugo.com" },
    ],
  },

  async redirects() {
    return [
      // Old /products?category=X → new /category/X
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

      // /changes → homepage
      {
        source: "/changes",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
