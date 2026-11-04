# test-tv
## TV guide

The guide (what's on now and next) comes from `epg/guide.xml.gz`. The
**Update TV guide** workflow (`.github/workflows/epg.yml`) rebuilds it every
day with [iptv-org/epg](https://github.com/iptv-org/epg): it reads the
countries in `index.html`, finds a guide source for each channel
(`scripts/epg-channels.mjs`), downloads two days of listings and commits the
file. To run it right away, open the **Actions** tab, pick
**Update TV guide** and press **Run workflow**.
