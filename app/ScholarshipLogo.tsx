"use client";

import Image from "next/image";
import { useState } from "react";
import manifest from "../public/scholarships/branding.json";

type Brand = { src: string; label: string; source: string; asset: string; verified: string; dark: boolean };
const brands: Record<string, Brand> = manifest;

export default function ScholarshipLogo({ id, fallback, outcome = "idle", large = false }: {
  id: string; fallback: string; outcome?: string; large?: boolean;
}) {
  const brand = brands[id];
  const [failedSource, setFailedSource] = useState("");
  const hasImage = brand && failedSource !== brand.src;
  return <span className={`source-mark scholarship-logo source-mark-${outcome}${large ? " scholarship-logo-large" : ""}${hasImage && brand.dark ? " scholarship-logo-dark" : ""}${hasImage ? "" : " scholarship-logo-fallback"}`} title={hasImage ? `${brand.label} · Official source: ${brand.source}` : `${fallback} · Official image unavailable`}>
    {hasImage ? <Image src={brand.src} alt="" aria-hidden="true" width={384} height={192} unoptimized loading={large ? "eager" : "lazy"} onError={() => setFailedSource(brand.src)} /> : <span aria-hidden="true">{fallback.slice(0, 3).toUpperCase()}</span>}
  </span>;
}
