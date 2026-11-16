import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { Preloader } from "@/components/preloader/preloader";
import { CommandTerminal } from "@/components/terminal/command-terminal";
import { SiteCursor } from "@/components/cursor/site-cursor";
import { site } from "@/content/site";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const description = `${site.name} — ${site.role} in ${site.location}. ${site.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${site.name} — ${site.role}`, template: `%s — ${site.name}` },
  description,
  applicationName: `${site.name} — Portfolio`,
  authors: [{ name: site.name, url: site.contact.github.url }],
  creator: site.name,
  keywords: [site.name, "Frontend Engineer", "React", "Next.js", "TypeScript", "Portfolio", "Cairo", "Egypt"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    title: `${site.name} — ${site.role}`,
    description,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: `${site.name} — ${site.role}`, description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#EEF0F4",
  colorScheme: "light",
};

export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-preloading=""
      suppressHydrationWarning
      className={`${geistSans.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-[200] rounded-md bg-accent px-4 py-2 font-mono text-sm text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <noscript>
          <style>{`#preloader{display:none!important}html[data-preloading]{overflow:auto}html[data-preloading] main,html[data-preloading] [data-logo-target] svg{opacity:1}`}</style>
        </noscript>
        <SmoothScroll>
          <Preloader />
          {children}
          {modal}
          <CommandTerminal />
          <SiteCursor />
        </SmoothScroll>
      </body>
    </html>
  );
}
