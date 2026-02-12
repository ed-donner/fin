import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  // Rewrites only apply in dev mode (ignored for static export build)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
