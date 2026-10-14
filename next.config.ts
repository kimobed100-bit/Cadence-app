import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* App 100 % locale : pas de prérendu strict, comportement classique */
  cacheComponents: false,
  // Export statique : dossier out/ déployable partout (Cloudflare Pages, Netlify…)
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
