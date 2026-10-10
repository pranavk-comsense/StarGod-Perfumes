import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Nunito, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { NoticeToaster } from "@/components/notice-toaster";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Rounded sans to match the StarGod signboard lettering.
const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-nunito", display: "swap" });
// Elegant display serif for headings.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: `${site.name}: ${site.tagline}`, template: `%s | ${site.name}` },
  description: "24 hour long lasting 100 ml eau de parfums for men and women. Buy 1 Get 1 free on Silver & Golden collections, free shipping and COD across India.",
  openGraph: { siteName: site.name, locale: "en_IN", type: "website", images: [{ url: "/brand/og-square.png", width: 1200, height: 1200 }] },
};

export const viewport: Viewport = {
  themeColor: "#a357b7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${nunito.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster theme="light" position="top-center" richColors closeButton />
        <Suspense>
          <NoticeToaster />
        </Suspense>
      </body>
    </html>
  );
}
