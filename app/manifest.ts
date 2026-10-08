import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "CSE Scholarship Command Center", short_name: "Scholarships", description: "Private scholarship tracking, official-source monitoring and deadline reminders.", start_url: "/", display: "standalone", background_color: "#07110f", theme_color: "#0b1714", orientation: "any", icons: [
    { src: "/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/favicon.svg?v=2", sizes: "any", type: "image/svg+xml", purpose: "any" },
  ] };
}
