import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppWrapper } from "@/components/app-wrapper";
import "./globals.css";

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
