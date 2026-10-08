import { neonConfig } from "@neondatabase/serverless";
import { enableWindowsTransport } from "./windows-fetch.mjs";
enableWindowsTransport();
const pages = [
  ["commonwealth", "https://cscuk.fcdo.gov.uk/"],
  ["erasmus", "https://erasmus-plus.ec.europa.eu/"],
  ["emai", "https://www.emai-master.eu/"],
  ["cybersure", "https://www.cybersure-master.eu/"],
  ["ediss", "https://www.master-ediss.eu/"],
  ["deai", "https://deai.ulb.be/"],
  ["gks", "https://www.studyinkorea.go.kr/en/main.do"],
  ["stipendium", "https://stipendiumhungaricum.hu/"],
  ["daad", "https://www.daad.de/en/"],
  ["mext", "https://www.mext.go.jp/en/"],
  ["fulbright", "https://foreign.fulbrightonline.org/"],
  ["bangladesh", "https://shed.gov.bd/"],
  ["chevening", "https://www.chevening.org/toolkit/chevening-scholarship-media-toolkit/"],
  ["turkiye", "https://www.turkiyeburslari.gov.tr/"],
  ["kaist", "https://admission.kaist.ac.kr/intl-graduate/"],
  ["knight", "https://knight-hennessy.stanford.edu/"],
  ["si", "https://si.se/en/"],
];
const request = neonConfig.fetchFunction ?? fetch;
const selected = process.argv.slice(2).length ? pages.filter(([id]) => process.argv.slice(2).includes(id)) : pages;
for (let offset = 0; offset < selected.length; offset += 4) {
  await Promise.all(selected.slice(offset, offset + 4).map(async ([id, page]) => {
    try {
      const response = await request(page, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(45000) });
      const html = await response.text();
      const tags = [...html.matchAll(/<(?:img|link)\b[^>]*>/gi)].map((match) => match[0]);
      const candidates = tags.filter((tag) => /logo|favicon|apple-touch|rel=["'](?:shortcut )?icon/i.test(tag)).slice(0, 22).map((tag) => {
        const url = tag.match(/(?:src|href)=["']([^"']+)/i)?.[1];
        const alt = tag.match(/alt=["']([^"']*)/i)?.[1] ?? "";
        return { url: url ? new URL(url.replaceAll("&amp;", "&"), page).href : "", alt, tag: tag.slice(0, 420) };
      }).filter((candidate) => candidate.url.startsWith("https:"));
      console.log(JSON.stringify({ id, page, status: response.status, candidates }));
    } catch { console.log(JSON.stringify({ id, page, error: "Source could not be fetched" })); }
  }));
}
