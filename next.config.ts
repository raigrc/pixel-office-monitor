import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  ...(process.env.PIXEL_VERIFY_ISOLATED === "1" ? {
    distDir: "Temp/opencode/next-verification",
    typescript: { tsconfigPath: "Temp/opencode/verification.tsconfig.json" },
  } : {}),
};

export default nextConfig;
