import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { site } from "@/content/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${site.name} — ${site.role}`,
  description: site.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${jetbrainsMono.variable} antialiased`}>
      <body className="min-h-dvh">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
