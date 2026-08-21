import type React from "react";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppWrapper } from "@/components/app-wrapper";
import "./globals.css";

/**
 * How the page meets the screen — declared rather than defaulted.
 *
 * `viewportFit: 'cover'` is what makes `env(safe-area-inset-*)` report real
 * numbers. Without it the browser keeps the page inside the safe area and every
 * inset reads 0, so the bottom navigation's padding silently does nothing on
 * exactly the phones it exists for. Pi Browser is a mobile webview, so this is
 * the app's primary surface.
 *
 * **Zoom is left alone on purpose.** `maximumScale: 1` and `userScalable: false`
 * are the usual pair reached for to stop iOS zooming when a small input is
 * focused; they also take pinch-zoom away from every reader who needs it, which
 * is a real accessibility failure (WCAG 1.4.4) for a product whose readers span
 * every language and every age. The correct fix for the input zoom is a 16px
 * font on the input, not disabling a gesture.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "Lambda — Open-Source Intelligence",
  description:
    "A real, legal OSINT platform: passive, public-source intelligence with sources and confidence grades. Runs on Pi Network and standalone.",
  // The icons existed as files but were never declared, so every page load
  // asked for a favicon.ico that does not exist and got a 404.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <AppWrapper>{children}</AppWrapper>
        {/*
          Vercel Analytics was mounted here and is deliberately gone.

          It injects `/_vercel/insights/script.js`, which exists only on Vercel.
          This product's primary host is Netlify (charter §4), so on every page
          view, for every visitor, the browser fetched a **404** and then logged
          a MIME-type refusal because the 404 page is HTML. Two console errors
          per page, on every route, shipped to production.

          Nothing detected it: the page returns 200, the tests pass, and the
          server never sees a problem. It was found the first time anyone opened
          the product in a real browser and read the console
          (`scripts/walkthrough.ts`).

          Analytics belongs behind the same portability rule as everything else —
          an adapter chosen by host, not a vendor component hard-wired into the
          root layout of a codebase that deploys to three places.
        */}
      </body>
    </html>
  );
}
