import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;
  return {
    title: "CSE Scholarship Command Center",
    description:
      "An owner-only, durable scholarship tracker with official-source monitoring, smart deadlines, and application checklists.",
    icons: {
      icon: [
        { url: "/favicon.ico?v=2", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
        { url: "/favicon-32.png?v=2", sizes: "32x32", type: "image/png" },
        { url: "/favicon.svg?v=2", sizes: "any", type: "image/svg+xml" },
      ],
      shortcut: "/favicon.ico?v=2",
      apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      title: "CSE Scholarship Command Center",
      description: "Official sources, smart deadlines, and one private application workspace.",
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "CSE Scholarship Command Center source radar" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "CSE Scholarship Command Center",
      description: "Official sources, smart deadlines, and one private application workspace.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
