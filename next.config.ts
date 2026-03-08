import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static image optimization
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
