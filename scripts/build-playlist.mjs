// Builds playlist.m3u from iptv-org, without duplicates and grouped into
// categories. Run by .github/workflows/playlist.yml. Sources:
//   - the USA, Canada and Iran country lists
//   - the Persian (Farsi) language list, every channel (goes in Iran groups)
//   - the region lists that cover these countries (North America, Americas,
//     Middle East, MENA, West Asia, Central Asia, Asia, EMEA, Worldwide),
//     keeping only channels whose tvg-id says they are from the US, CA or IR
//   - every channel in iptv-org with 24/7 in its name
// The state/province/city lists are not fetched: they only repeat channels
// from the country lists. iptv-org has no video-on-demand lists.
//
//   node scripts/build-playlist.mjs [output.m3u]
//
// Groups look like "USA | News", "Canada | Sports", "Iran | Movies" and
// "24/7 | Series". A 24/7 channel (name contains 24/7, 24-7 or 24x7) goes in a
// 24/7 group even when it comes from one of the three countries, and a
// Persian-language channel goes in an Iran group wherever it is from.
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const outFile = path.resolve(process.argv[2] || path.join(root, "playlist.m3u"));

const COUNTRIES = [
  ["USA", "countries/us.m3u"],
  ["Canada", "countries/ca.m3u"],
  ["Iran", "countries/ir.m3u"],
];
const PERSIAN = "languages/fas.m3u";
const REGIONS = ["noram", "amer", "mideast", "mena", "was", "cas", "asia", "emea", "ww"]
  .map(r => `regions/${r}.m3u`);
const LABEL_BY_CC = { us: "USA", ca: "Canada", ir: "Iran" };
const ALL = "index.m3u";
const MIRRORS = [
  "https://iptv-org.github.io/iptv/",
  "https://raw.githubusercontent.com/iptv-org/iptv/gh-pages/",
];
const IS_247 = /24\s*[\/x×-]\s*7/i;
const ADULT = /\b(xxx|adult)\b/i;

async function download(file) {
  let lastErr;
  for (const base of MIRRORS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(base + file);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text.startsWith("#EXTM3U")) throw new Error("not an M3U file");
        return text;
      } catch (err) {
        lastErr = new Error(`${base + file}: ${err.message}`);
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }
  throw lastErr;
}

// Returns [{ info, opts, url, name, id, category }]
function parse(text) {
  const out = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#EXTM3U")) continue;
    if (line.startsWith("#EXTINF")) {
      const comma = line.indexOf(",", line.lastIndexOf('"') + 1);
      cur = {
        info: line.slice(0, comma < 0 ? line.length : comma),
        name: comma < 0 ? "" : line.slice(comma + 1).trim(),
        opts: [],
      };
    } else if (line.startsWith("#")) {
      if (cur) cur.opts.push(line); // #EXTVLCOPT referrer / user-agent lines
    } else if (cur) {
      cur.url = line;
      const attr = k => (cur.info.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1] || "";
      cur.id = attr("tvg-id");
      cur.category = categoryOf(attr("group-title"));
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

function categoryOf(group) {
  const first = group.split(";").map(s => s.trim()).filter(Boolean)[0] || "";
  return !first || first === "Undefined" ? "Other" : first;
}

const countryOf = id => (id.match(/\.([a-z]{2})(?:@|$)/i) || [])[1]?.toLowerCase() || "";
const normUrl = u => u.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
const normName = n => n.toLowerCase()
  .replace(/\[[^\]]*\]|\([^)]*\)/g, "") // "(720p)", "[Geo-blocked]"
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const seenUrl = new Set();
const seenChannel = new Set();
const groups = new Map(); // group name -> entries
let skipped = 0;

const persianKeys = new Set();
const keysOf = e => [normUrl(e.url), e.id ? "id:" + e.id.toLowerCase() : null].filter(Boolean);
const isPersian = e => keysOf(e).some(k => persianKeys.has(k));

function add(entry, prefix) {
  if (ADULT.test(entry.category) || ADULT.test(entry.info)) { skipped++; return; }
  const urlKey = normUrl(entry.url);
  const chanKey = entry.id ? "id:" + entry.id.toLowerCase() : "name:" + normName(entry.name);
  if (seenUrl.has(urlKey) || seenChannel.has(chanKey)) { skipped++; return; }
  seenUrl.add(urlKey);
  seenChannel.add(chanKey);
  const label = IS_247.test(entry.name) ? "24/7" : isPersian(entry) ? "Iran" : prefix;
  const group = `${label} | ${entry.category}`;
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(entry);
}

const persian = parse(await download(PERSIAN));
for (const e of persian) keysOf(e).forEach(k => persianKeys.add(k));

const count = () => [...groups.values()].reduce((n, g) => n + g.length, 0);
for (const [label, file] of COUNTRIES) {
  const entries = parse(await download(file));
  const before = count();
  for (const e of entries) add(e, label);
  console.log(`${label}: ${entries.length} streams, ${count() - before} added`);
}
{
  const before = count();
  for (const e of persian) add(e, "Iran");
  console.log(`Persian language: ${persian.length} streams, ${count() - before} added`);
}
for (const file of REGIONS) {
  const entries = parse(await download(file))
    .filter(e => LABEL_BY_CC[countryOf(e.id)]);
  const before = count();
  for (const e of entries) add(e, LABEL_BY_CC[countryOf(e.id)]);
  console.log(`${file}: ${entries.length} US/CA/IR streams, ${count() - before} added`);
}
const all = parse(await download(ALL));
const all247 = all.filter(e => IS_247.test(e.name));
{
  const before = count();
  for (const e of all247) add(e, "24/7");
  console.log(`24/7 (all countries): ${all247.length} streams, ${count() - before} added`);
}

// Sort: USA, Canada, Iran, then 24/7; categories A–Z with "Other" last;
// channels A–Z inside each group.
const order = ["USA", "Canada", "Iran", "24/7"];
const sortedGroups = [...groups.keys()].sort((a, b) => {
  const [pa, ca] = a.split(" | "), [pb, cb] = b.split(" | ");
  return order.indexOf(pa) - order.indexOf(pb)
    || (ca === "Other") - (cb === "Other")
    || ca.localeCompare(cb);
});

const lines = ["#EXTM3U"];
let total = 0;
for (const group of sortedGroups) {
  const entries = groups.get(group).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  for (const e of entries) {
    const info = /\bgroup-title="[^"]*"/.test(e.info)
      ? e.info.replace(/\bgroup-title="[^"]*"/, `group-title="${group}"`)
      : `${e.info} group-title="${group}"`;
    lines.push(`${info},${e.name}`, ...e.opts, e.url);
    total++;
  }
}

if (total < 500) throw new Error(`Only ${total} channels; refusing to write a broken playlist.`);
fs.writeFileSync(outFile, lines.join("\n") + "\n");
console.log(`${total} channels in ${sortedGroups.length} groups (${skipped} duplicates/adult skipped) -> ${outFile}`);
