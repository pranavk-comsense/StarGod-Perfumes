import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabase = new URL(supabaseUrl);
const isDev = process.env.NODE_ENV !== "production";

const cashfree = {
  script: ["https://sdk.cashfree.com"],
  connect: ["https://api.cashfree.com", "https://sandbox.cashfree.com", "https://sdk.cashfree.com"],
  frame: [
    "https://sdk.cashfree.com",
    "https://api.cashfree.com",
    "https://sandbox.cashfree.com",
    "https://payments.cashfree.com",
    "https://payments-test.cashfree.com",
  ],
};

// Inline scripts are needed by Next's streaming runtime (a nonce would force every
// page to be dynamic and disable partial prerendering).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} ${cashfree.script.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase.origin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase.origin} ${supabase.origin.replace(/^http/, "ws")} ${cashfree.connect.join(" ")}`,
  `frame-src ${cashfree.frame.join(" ")}`,
  "form-action 'self' https://*.cashfree.com https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://sdk.cashfree.com\")" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: supabase.protocol.replace(":", "") as "http" | "https",
        hostname: supabase.hostname,
        port: supabase.port,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return ["men", "women", "unisex", "silver", "golden"].map((c) => ({
      source: `/${c}`,
      destination: `/shop?category=${c}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
