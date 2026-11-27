import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Permite testar 2 jogadores localmente (localhost e 127.0.0.1 = navegadores "diferentes")
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/ocaso/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'",
          },
        ],
      },
      {
        source: "/ocaso/1.17.0/font.woff2",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
