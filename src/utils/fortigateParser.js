/**
 * FortiGate log parser.
 *
 * Input: the text of a file exported from a FortiGate (Log & Report ->
 * download), from FortiAnalyzer, or copied out of a syslog collector. Each
 * line is key=value pairs; a CSV export with a header row is accepted too.
 * Output: one record per parsed line with the fields the viewer needs, plus
 * counts of what was NOT parsed, so the total can be reconciled with the
 * file ("lines = parsed + skipped").
 *
 * Time. Every record's timestamp is taken, in this order, from
 *   1. eventtime   (FortiOS 6.2+, an epoch in s/ms/us/ns, auto-scaled)
 *   2. date + time + tz   (tz="+0800" as written by FortiOS 7.x)
 *   3. date + time        in the browser's local time zone (no tz field)
 * A line without any of these keeps timestamp = null and is counted as
 * "untimed"; it is never given the current time.
 *
 * Nothing here talks to the network.
 */

const KV_RE = /([A-Za-z0-9_.-]+)=(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
const DENIED_ACTIONS = new Set(['deny', 'block', 'blocked', 'dropped', 'reject', 'drop']);
const TZ_RE = /^([+-])(\d{2}):?(\d{2})$/;

/** Parse one key=value line into an object with lower-case keys. */
export function parseKvLine(line) {
  if (!line || typeof line !== 'string') return null;
  const kv = {};
  KV_RE.lastIndex = 0;
  let m;
  while ((m = KV_RE.exec(line)) !== null) {
    const key = m[1].toLowerCase();
    kv[key] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
  }
  return kv;
}

/** Split one CSV line (RFC 4180 quoting). */
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** A CSV header row: comma separated, no '=', and it names FortiGate fields. */
export function looksLikeCsvHeader(line) {
  if (!line || line.includes('=')) return false;
  const cols = splitCsvLine(line).map(c => c.trim().toLowerCase());
  if (cols.length < 3) return false;
  const known = ['srcip', 'dstip', 'date', 'time', 'logid', 'type', 'subtype', 'action', 'eventtime', 'hostname', 'url', 'catdesc'];
  return cols.filter(c => known.includes(c)).length >= 2;
}

/** Epoch in seconds, milliseconds, microseconds or nanoseconds -> ms. */
export function eventtimeToMs(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const digits = s.length;
  // 2001-2286 in seconds is 10 digits; FortiOS writes ns (19 digits)
  if (digits >= 18) return Math.floor(Number(BigInt(s) / 1000000n));
  if (digits >= 15) return Math.floor(Number(BigInt(s) / 1000n));
  if (digits >= 12) return Number(s);
  return Number(s) * 1000;
}

/** "YYYY-MM-DD", "HH:MM:SS", "+0800" -> ms; tz missing -> browser local. */
export function dateTimeToMs(dateStr, timeStr, tz) {
  if (!dateStr || !timeStr) return null;
  const d = dateStr.replace(/\//g, '-');
  const m = tz ? TZ_RE.exec(tz.trim()) : null;
  const t = m ? new Date(`${d}T${timeStr}${m[1]}${m[2]}:${m[3]}`).getTime()
              : new Date(`${d}T${timeStr}`).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * YYYY-MM-DD of a Date in the browser's zone. The date inputs and the time
 * filter read dates as local, so a default range must not come from
 * toISOString() (UTC): east of UTC that drops the hours between local
 * midnight and the UTC date change.
 */
export function localDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmt(ms) {
  if (ms === null) return '';
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * The site a record is about: hostname, else dstip. url is deliberately not
 * used (the same rule as onprem-logs' aup-report.py): under certificate
 * inspection it carries nothing hostname does not, and "/" and a full URL
 * must not become two sites.
 */
export function extractCleanHost(hostname, url, dstip) {
  if (hostname && hostname !== 'N/A' && hostname !== 'null') {
    return hostname.split(':')[0].toLowerCase().trim();
  }
  if (dstip) return dstip;
  return 'Unknown Site';
}

function recordFromKv(kv, lineIndex, line) {
  let timestamp = eventtimeToMs(kv.eventtime);
  let timeSource = 'eventtime';
  if (timestamp === null) {
    timestamp = dateTimeToMs(kv.date, kv.time, kv.tz);
    timeSource = kv.tz ? 'date+time+tz' : 'date+time(local)';
  }
  if (timestamp === null) timeSource = 'none';

  const user = (kv.user || kv.srcuser || kv.unauthuser || kv.srcip || 'Unknown User').trim();
  const rawHostname = kv.hostname || '';
  const rawUrl = kv.url || '';
  const dstip = kv.dstip || '';
  const site = extractCleanHost(rawHostname, rawUrl, dstip);
  const fullUrl = rawUrl && rawUrl !== '/' ? (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawHostname || ''}${rawUrl}`)
                : (rawHostname ? `https://${rawHostname}` : dstip);
  const rawAction = (kv.action || kv.eventtype || 'accept').toLowerCase();
  const sentbyte = parseInt(kv.sentbyte || '0', 10) || 0;
  const rcvdbyte = parseInt(kv.rcvdbyte || '0', 10) || 0;

  return {
    id: `log-${lineIndex}`,
    lineIndex,
    timestamp,
    timeSource,
    formattedDateTime: fmt(timestamp),
    date: kv.date || (timestamp === null ? '' : fmt(timestamp).slice(0, 10)),
    time: kv.time || (timestamp === null ? '' : fmt(timestamp).slice(11)),
    user,
    srcip: kv.srcip || 'N/A',
    srcmac: kv.srcmac || kv.mastersrcmac || '',
    srcname: kv.srcname || '',
    site,
    rawHostname,
    rawUrl,
    fullUrl,
    dstip,
    dstport: kv.dstport || '',
    action: rawAction,
    isAllowed: !DENIED_ACTIONS.has(rawAction),
    category: kv.catdesc || 'Unrated',   // no FortiGuard rating (no licence, or a traffic line)
    type: kv.type || 'traffic',
    subtype: kv.subtype || 'forward',
    level: kv.level || 'notice',
    sentbyte,
    rcvdbyte,
    totalBytes: sentbyte + rcvdbyte,
    policyid: kv.policyid || 'N/A',
    devname: kv.devname || 'FortiGate',
    rawKv: kv,
    rawLine: line
  };
}

/**
 * Parse a whole file. Returns { records, lines, parsed, skipped, untimed,
 * format } where lines counts non-empty lines, skipped the lines that held
 * no key=value pair (banners, headers, junk), untimed the records without
 * any usable time field. records are sorted by time; untimed ones last.
 */
export function parseFortiGateLogsDetailed(rawText) {
  const result = { records: [], lines: 0, parsed: 0, skipped: 0, untimed: 0, format: 'kv' };
  if (!rawText) return result;
  const lines = rawText.split(/\r?\n/);
  let header = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    result.lines++;
    let kv;
    if (header === null && result.parsed === 0 && looksLikeCsvHeader(line)) {
      header = splitCsvLine(line).map(c => c.trim().toLowerCase());
      result.format = 'csv';
      result.skipped++; // the header row is not a record
      continue;
    }
    if (header) {
      const cells = splitCsvLine(line);
      kv = {};
      header.forEach((h, j) => { if (h && cells[j] !== undefined && cells[j] !== '') kv[h] = cells[j]; });
    } else {
      kv = parseKvLine(line);
    }
    if (!kv || Object.keys(kv).length === 0) { result.skipped++; continue; }
    const rec = recordFromKv(kv, i + 1, line);
    if (rec.timestamp === null) result.untimed++;
    result.records.push(rec);
    result.parsed++;
  }
  result.records.sort((a, b) => {
    if (a.timestamp === null && b.timestamp === null) return a.lineIndex - b.lineIndex;
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return a.timestamp - b.timestamp || a.lineIndex - b.lineIndex;
  });
  return result;
}

/** Records only (same as before v0.1.0). */
export function parseFortiGateLogs(rawText) {
  return parseFortiGateLogsDetailed(rawText).records;
}

/** Group records by user, then by site. */
export function buildUserWebsiteSummary(records) {
  const userMap = new Map();
  records.forEach(rec => {
    if (!userMap.has(rec.user)) {
      userMap.set(rec.user, {
        user: rec.user, srcip: rec.srcip, srcname: rec.srcname, srcmac: rec.srcmac,
        totalVisits: 0, totalBytes: 0, allowedCount: 0, blockedCount: 0,
        websites: new Map(), firstSeen: rec.formattedDateTime, lastSeen: rec.formattedDateTime
      });
    }
    const u = userMap.get(rec.user);
    u.totalVisits++;
    u.totalBytes += rec.totalBytes;
    if (rec.isAllowed) u.allowedCount++; else u.blockedCount++;
    if (rec.formattedDateTime && (!u.firstSeen || rec.formattedDateTime < u.firstSeen)) u.firstSeen = rec.formattedDateTime;
    if (rec.formattedDateTime > u.lastSeen) u.lastSeen = rec.formattedDateTime;
    if (!u.srcname && rec.srcname) u.srcname = rec.srcname;
    if (!u.srcmac && rec.srcmac) u.srcmac = rec.srcmac;

    if (!u.websites.has(rec.site)) {
      u.websites.set(rec.site, {
        site: rec.site, category: rec.category, visitCount: 0, totalBytes: 0,
        allowedCount: 0, blockedCount: 0, lastVisit: rec.formattedDateTime, sampleUrl: rec.fullUrl
      });
    }
    const s = u.websites.get(rec.site);
    s.visitCount++;
    s.totalBytes += rec.totalBytes;
    if (rec.isAllowed) s.allowedCount++; else s.blockedCount++;
    if (rec.formattedDateTime > s.lastVisit) {
      s.lastVisit = rec.formattedDateTime;
      if (rec.fullUrl) s.sampleUrl = rec.fullUrl;
    }
  });
  const result = [];
  userMap.forEach(u => {
    const websiteList = Array.from(u.websites.values()).sort((a, b) => b.visitCount - a.visitCount || a.site.localeCompare(b.site));
    result.push({ ...u, websiteCount: websiteList.length, websiteList });
  });
  return result.sort((a, b) => b.totalVisits - a.totalVisits || a.user.localeCompare(b.user));
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
