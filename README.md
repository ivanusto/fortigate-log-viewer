# fortigate-log-viewer

English | [繁體中文](README.zh-TW.md)

A browser-side viewer for FortiGate log exports. Drop in a `.log`, `.txt` or `.csv` file from a FortiGate (Log & Report, download), from FortiAnalyzer, or copied out of a syslog collector, and read it as "which workstation went to which site, when, and was it allowed". Built for the case where the firewall is managed by someone else and all you get is the export: nothing is uploaded, the file is parsed in the browser tab.

Written for Day 24 of [onprem-ops-30days](https://github.com/ivanusto/onprem-ops-30days). The online twin of this tool is the LogsQL in [onprem-logs/firewall/fortigate-webfilter.md](https://github.com/ivanusto/onprem-logs/blob/main/firewall/fortigate-webfilter.md); both are meant to give the same answer for the same file.

## What it does

| | |
|---|---|
| Input | Lines of `key=value` pairs (what FortiOS writes), or a CSV with a header row naming the FortiOS fields. Lines with no pair at all (banners, separators) are counted as skipped, not dropped silently: the banner shows `lines = parsed + skipped` |
| Identity | `user`, else `srcuser`, else `unauthuser`, else `srcip`. `srcname` and `srcmac` are kept and shown, so a DHCP address can be tied back to a workstation |
| Site | `hostname`, else the host part of `url`, else `dstip` |
| Time | `eventtime` (FortiOS 6.2+, nanoseconds in 7.x) first; else `date` + `time` + `tz`; else `date` + `time` in the browser's zone. A line with none of these is kept with no time and counted as "untimed", it is never stamped with the current time. Each record says which rule gave it its time (`timeSource`) |
| Allowed or blocked | `action` in deny, block, blocked, dropped, reject, drop is blocked; anything else (passthrough, accept, close, timeout…) is allowed |
| Views | per user: sites, visits, bytes, allowed/blocked, first and last seen; the raw rows with a detail modal; a few charts |
| Filters | time range, user, site or URL keyword, category (`catdesc`), allowed/blocked |

## What it does not do

- **No upload.** Parsing, filtering and summaries run in the page. The server behind it (nginx in the Docker image) serves static files and sees nothing of the log.
- **Reverse DNS is off until you click it.** Sites that are bare IP addresses can be looked up with a PTR query to Google Public DNS over HTTPS (`dns.google`). That sends those public IP addresses to Google, so it starts only from the "反查公開 IP" button, and private, loopback, link-local, 100.64/10 and multicast addresses are never sent, whether you click or not.
- **No persistence.** Reload the tab and the file is gone. Nothing is written to the browser's storage.
- **No detection.** It lists what the FortiGate already logged. If the policy has no web-filter profile, there is no `hostname`/`catdesc` to show, and HTTPS traffic logs give a destination IP at best.
- **CSV is header-driven and lightly tested.** It handles RFC 4180 quoting; the exact column set a FortiAnalyzer export writes was not available when this was written, so check `lines = parsed + skipped` on your own export first.

## Run

```sh
# development
npm ci && npm run dev            # http://localhost:5173

# static build in a container
docker compose up -d --build     # http://127.0.0.1:5173

# checks
npm run lint && npm test && npm run build
```

The Dockerfile builds with `node:20-alpine` and serves with `nginx:alpine`, both by tag. Pin both to a digest before using the image anywhere that matters (see Day 3 of the series for the why and a script that does it).

## Layout

| Path | What |
|---|---|
| `src/utils/fortigateParser.js` | parsing, time rules, user/site summary; no DOM, no network, unit-tested |
| `src/utils/reverseDns.js` | the one network call, opt-in, public IPv4 only |
| `src/utils/sampleLogs.js` | synthetic demo data loaded on first open |
| `src/App.jsx`, `src/components/` | the page |
| `tests/parser.test.mjs`, `tests/fixtures/` | `node --test`; fixtures are synthetic FortiOS 7 shaped lines with RFC 5737 addresses |

## License

Apache-2.0
