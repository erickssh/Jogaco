import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Permite testar 2 jogadores localmente (localhost e 127.0.0.1 = navegadores "diferentes")
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
