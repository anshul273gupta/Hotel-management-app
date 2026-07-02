import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.29.4", "192.168.29.15", "*.lhr.life"],
  compress: true,
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  serverExternalPackages: ["bcryptjs", "firebase-admin"],
};

export default nextConfig;
