# test-tv
## TV guide

The guide (what's on now and next) comes from `epg/guide.xml.gz`. The
**Update TV guide** workflow (`.github/workflows/epg.yml`) rebuilds it every
day with [iptv-org/epg](https://github.com/iptv-org/epg): it reads the
countries in `index.html`, finds a guide source for each channel
(`scripts/epg-channels.mjs`), downloads two days of listings and commits the
file. To run it right away, open the **Actions** tab, pick
**Update TV guide** and press **Run workflow**.

## Playlist

`playlist.m3u` holds the [iptv-org](https://github.com/iptv-org/iptv) channels
for the USA, Canada and Iran plus every 24/7 channel in iptv-org, with
duplicates removed (same stream URL or same channel id). Channels are grouped
as `USA | News`, `Canada | Sports`, `Iran | Movies`, `24/7 | Series` and so on,
sorted A–Z. Both `http://` and `https://` streams are kept; adult channels are
left out.

Paste this link into an IPTV app:

    https://raw.githubusercontent.com/learntests/test-tv/main/playlist.m3u

The **Update playlist** workflow (`.github/workflows/playlist.yml`) rebuilds it
every day with `scripts/build-playlist.mjs`. To run it right away, open the
**Actions** tab, pick **Update playlist** and press **Run workflow**.
