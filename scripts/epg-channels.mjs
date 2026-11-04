// Builds a custom.channels.xml for the iptv-org/epg grabber that covers the
// channels Test TV shows. Run by .github/workflows/epg.yml.
//
//   node scripts/epg-channels.mjs <path-to-iptv-org-epg> <output.xml>
//
// It reads COUNTRIES from index.html, downloads those iptv-org playlists,
// collects their tvg-id values, and picks one guide source per channel from
// the epg project's sites/*/*.channels.xml files (working sites first).
import fs from "node:fs";
import path from "node:path";

const [epgDir, outFile] = process.argv.slice(2);
if (!epgDir || !outFile) {
  console.error("usage: node scripts/epg-channels.mjs <epg-dir> <output.xml>");
  process.exit(1);
}

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const m = html.match(/const COUNTRIES\s*=\s*(\{[^}]*\})/);
if (!m) throw new Error("COUNTRIES not found in index.html");
const countries = JSON.parse(m[1]);

// 1. tvg-ids used by Test TV's playlists
const ids = new Set();
for (const [name, code] of Object.entries(countries)) {
  const url = `https://iptv-org.github.io/iptv/countries/${code}.m3u`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("#EXTINF")) continue;
    const id = (line.match(/\btvg-id="([^"]*)"/) || [])[1];
    if (id) { ids.add(id); n++; }
  }
  console.log(`${name}: ${n} channels with a tvg-id`);
}
console.log(`${ids.size} unique channel ids`);

// 2. site status from SITES.md (🟢 ok, 🟡 partly working, 🔴 broken)
const status = {};
const sitesMd = fs.readFileSync(path.join(epgDir, "SITES.md"), "utf8");
for (const row of sitesMd.matchAll(/<a href="sites\/([^"]+)">[\s\S]*?<\/td><td[^>]*>[^<]*<\/td><td[^>]*>([^<]*)<\/td>/g)) {
  status[row[1]] = row[2].trim();
}
const rank = s => (status[s] === "🟢" ? 0 : status[s] === "🟡" ? 1 : status[s] === "🔴" ? 9 : 2);

// 3. every mapped channel in the epg project, indexed by xmltv_id and base id
const exact = new Map(), byBase = new Map();
const sitesDir = path.join(epgDir, "sites");
const attr = (a, n) => (a.match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1] || "";
for (const site of fs.readdirSync(sitesDir)) {
  const dir = path.join(sitesDir, site);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".channels.xml"))) {
    const xml = fs.readFileSync(path.join(dir, f), "utf8");
    for (const c of xml.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/g)) {
      const a = c[1], xid = attr(a, "xmltv_id");
      if (!xid) continue;
      const e = { site: attr(a, "site"), site_id: attr(a, "site_id"), lang: attr(a, "lang"), xid, name: c[2].trim() };
      if (!e.site || rank(e.site) === 9) continue;
      for (const [map, key] of [[exact, xid], [byBase, xid.split("@")[0]]]) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      }
    }
  }
}

// 4. pick the best source for each Test TV channel
const pick = list => [...list].sort((x, y) => rank(x.site) - rank(y.site) || (x.lang === "en" ? -1 : 0) - (y.lang === "en" ? -1 : 0))[0];
const chosen = new Map();
let missing = 0;
for (const id of [...ids].sort()) {
  const list = exact.get(id) || byBase.get(id.split("@")[0]);
  if (!list) { missing++; continue; }
  const e = pick(list), key = `${e.site}|${e.site_id}|${e.lang}`;
  if (!chosen.has(key)) chosen.set(key, { ...e, xid: exact.has(id) ? id : e.xid });
}
console.log(`guide sources found for ${ids.size - missing} of ${ids.size} channel ids (${chosen.size} entries)`);

const out = ['<?xml version="1.0" encoding="UTF-8"?>', "<channels>"];
for (const e of chosen.values()) {
  out.push(`  <channel site="${e.site}" lang="${e.lang}" xmltv_id="${e.xid}" site_id="${e.site_id}">${e.name}</channel>`);
}
out.push("</channels>", "");
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, out.join("\n"));
console.log(`wrote ${outFile}`);
