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

`playlist.m3u` is built from these [iptv-org](https://github.com/iptv-org/iptv)
lists:

- the USA, Canada and Iran country lists
- the Persian (Farsi) language list, every channel
- the region lists that include these countries (North America, Americas,
  Middle East, MENA, West Asia, Central Asia, Asia, EMEA, Worldwide), keeping
  only channels from the US, Canada or Iran
- every iptv-org channel with "24/7" in its name

Duplicates are removed (same stream URL or same channel id). Channels are
grouped as `USA | News`, `Canada | Sports`, `Iran | Movies`, `24/7 | Series`
and so on, sorted A–Z. Persian-language channels go in the Iran groups and
24/7 channels in the 24/7 groups. Both `http://` and `https://` streams are
kept; adult channels are left out. The state, province and city lists aren't
used because they only repeat channels from the country lists, and iptv-org
has no video-on-demand (movies/series library) lists.

Paste this link into an IPTV app:

    https://raw.githubusercontent.com/learntests/test-tv/main/playlist.m3u

The **Update playlist** workflow (`.github/workflows/playlist.yml`) rebuilds it
every day with `scripts/build-playlist.mjs`. To run it right away, open the
**Actions** tab, pick **Update playlist** and press **Run workflow**.
