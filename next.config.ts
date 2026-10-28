import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // E2E builds into its own folder (see playwright.config.ts) so they never fight a running dev server over .next
  // Self-contained server bundle for the container image (see Dockerfile)
  output: "standalone",
  // Vercel only ships traced files; the 3D models are read from disk at request time
  outputFileTracingIncludes: {
    "/api/models/[...path]": ["./storage/3dmodels/**/*"],
    "/office-3d": ["./storage/3dmodels/**/*"],
  },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  experimental: {
    authInterrupts: true, // enables forbidden() / unauthorized()
    // Every page reads the session (request-time data), so the dev-only instant-navigation insight would flag all of
    // them; validate only the segments that opt in with `export const instant`
    instantInsights: { validationLevel: "manual-warning" },
    // Attachments are uploaded one file per request (max 10 MB + multipart overhead)
    serverActions: { bodySizeLimit: "11mb" },
    proxyClientMaxBodySize: "11mb",
  },
  partialPrefetching: true,
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
