import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const privateHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "no-store, max-age=0" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "postgres"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/members/:path*", headers: privateHeaders },
      { source: "/members", headers: privateHeaders },
      { source: "/admin/:path*", headers: privateHeaders },
      { source: "/admin", headers: privateHeaders },
      { source: "/login/:path*", headers: privateHeaders },
      { source: "/login", headers: privateHeaders },
      { source: "/join", headers: privateHeaders },
      { source: "/setup", headers: privateHeaders },
    ];
  },
  async rewrites() {
    // Serve the existing static landing page and blog exactly as before.
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/blog", destination: "/blog/index.html" },
        { source: "/blog/:slug([^/.]+)", destination: "/blog/:slug/index.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
