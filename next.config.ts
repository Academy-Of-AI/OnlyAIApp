import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript is still checked (tsc is our gate). ESLint is skipped at build
  // time so lint nits don't block deploys during the onramp rebuild.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
