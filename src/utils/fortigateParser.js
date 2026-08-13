/**
 * FortiGate Log Parser Utility
 * Parses FortiGate raw text/syslog/CSV log lines into structured web activity records.
 */

// Parse a single key-value line from FortiGate log
export function parseKvLine(line) {
  if (!line || typeof line !== 'string') return null;
  const kv = {};
  
  // Regex matches key="val with spaces", key='val', or key=val
  const kvRegex = /([a-zA-Z0-9_\-\.]+)=(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
  let match;
  while ((match = kvRegex.exec(line)) !== null) {
    const key = (match[1] || match[3] || match[5]).toLowerCase();
    const val = match[2] !== undefined ? match[2] : (match[4] !== undefined ? match[4] : match[6]);
    if (key) {
      kv[key] = val;
    }
  }

  return kv;
}

// Extract root domain or clean hostname from raw URL/hostname string
export function extractCleanHost(hostname, url, dstip) {
  if (hostname && hostname !== 'N/A' && hostname !== 'null') {
    // Remove port if present
    let host = hostname.split(':')[0].toLowerCase();
    // Strip trailing slashes
    return host.trim();
  }

  if (url && url !== 'N/A') {
    try {
      let fullUrl = url;
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = 'http://' + fullUrl;
      }
      const parsed = new URL(fullUrl);
      return parsed.hostname.toLowerCase();
    } catch {
      // Fallback regex for URL
      const match = url.match(/^(?:https?:\/\/)?([^\/\:\?#]+)/i);
      if (match && match[1]) return match[1].toLowerCase();
    }
  }

  if (dstip) return dstip;

  return 'Unknown Site';
}

// Parse entire raw log string into structured records
export function parseFortiGateLogs(rawText) {
  if (!rawText) return [];

  const lines = rawText.split(/\r?\n/);
  const records = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const kv = parseKvLine(line);
    if (!kv || Object.keys(kv).length === 0) continue;

    // Extract Date & Time
    let dateStr = kv.date || '';
    let timeStr = kv.time || '';
    let timestamp = null;
    let formattedDateTime = '';

    if (dateStr && timeStr) {
      // Standardize date format YYYY-MM-DD
      const cleanDate = dateStr.replace(/\//g, '-');
      formattedDateTime = `${cleanDate} ${timeStr}`;
      timestamp = new Date(formattedDateTime).getTime();
    } else if (kv.timestamp) {
      const tsNum = parseInt(kv.timestamp, 10);
      if (!isNaN(tsNum)) {
        timestamp = tsNum > 1e11 ? tsNum : tsNum * 1000;
        const d = new Date(timestamp);
        formattedDateTime = d.toISOString().replace('T', ' ').substring(0, 19);
      }
    }

    if (!timestamp || isNaN(timestamp)) {
      timestamp = Date.now();
      formattedDateTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    // Extract User Identity (user > srcuser > unauthuser > srcip)
    const user = (kv.user || kv.srcuser || kv.unauthuser || kv.srcip || 'Unknown User').trim();
    const srcip = kv.srcip || 'N/A';
    const srcmac = kv.srcmac || '';

    // Extract Destination Site & URL
    const rawHostname = kv.hostname || '';
    const rawUrl = kv.url || '';
    const dstip = kv.dstip || '';
    const site = extractCleanHost(rawHostname, rawUrl, dstip);
    const fullUrl = rawUrl || (rawHostname ? `https://${rawHostname}` : dstip);

    // Extract Action & Category
    const rawAction = (kv.action || kv.eventtype || 'accept').toLowerCase();
    let isAllowed = true;
    if (['deny', 'block', 'blocked', 'dropped', 'reject'].includes(rawAction)) {
      isAllowed = false;
    }

    const category = kv.catdesc || kv.cat || kv.service || 'General Web';
    const type = kv.type || 'traffic';
    const subtype = kv.subtype || 'forward';
    const level = kv.level || 'notice';
    const sentbyte = parseInt(kv.sentbyte || '0', 10);
    const rcvdbyte = parseInt(kv.rcvdbyte || '0', 10);
    const totalBytes = sentbyte + rcvdbyte;

    records.push({
      id: `log-${i}-${Math.random().toString(36).substr(2, 6)}`,
      lineIndex: i + 1,
      timestamp,
      formattedDateTime,
      date: dateStr || formattedDateTime.split(' ')[0],
      time: timeStr || formattedDateTime.split(' ')[1] || '',
      user,
      srcip,
      srcmac,
      site,
      rawHostname,
      rawUrl,
      fullUrl,
      dstip,
      dstport: kv.dstport || '443',
      action: rawAction,
      isAllowed,
      category,
      type,
      subtype,
      level,
      sentbyte,
      rcvdbyte,
      totalBytes,
      policyid: kv.policyid || 'N/A',
      devname: kv.devname || 'FortiGate',
      rawKv: kv,
      rawLine: line
    });
  }

  // Sort chronologically by timestamp ascending
  return records.sort((a, b) => a.timestamp - b.timestamp);
}

// Group records by user and website for the requested "User Visited Website List"
export function buildUserWebsiteSummary(records) {
  const userMap = new Map();

  records.forEach(rec => {
    if (!userMap.has(rec.user)) {
      userMap.set(rec.user, {
        user: rec.user,
        srcip: rec.srcip,
        totalVisits: 0,
        totalBytes: 0,
        allowedCount: 0,
        blockedCount: 0,
        websites: new Map(),
        firstSeen: rec.formattedDateTime,
        lastSeen: rec.formattedDateTime
      });
    }

    const userData = userMap.get(rec.user);
    userData.totalVisits++;
    userData.totalBytes += rec.totalBytes;
    if (rec.isAllowed) userData.allowedCount++;
    else userData.blockedCount++;

    if (rec.formattedDateTime < userData.firstSeen) userData.firstSeen = rec.formattedDateTime;
    if (rec.formattedDateTime > userData.lastSeen) userData.lastSeen = rec.formattedDateTime;

    // Update website details under user
    if (!userData.websites.has(rec.site)) {
      userData.websites.set(rec.site, {
        site: rec.site,
        category: rec.category,
        visitCount: 0,
        totalBytes: 0,
        allowedCount: 0,
        blockedCount: 0,
        lastVisit: rec.formattedDateTime,
        sampleUrl: rec.fullUrl
      });
    }

    const siteData = userData.websites.get(rec.site);
    siteData.visitCount++;
    siteData.totalBytes += rec.totalBytes;
    if (rec.isAllowed) siteData.allowedCount++;
    else siteData.blockedCount++;
    if (rec.formattedDateTime > siteData.lastVisit) {
      siteData.lastVisit = rec.formattedDateTime;
      if (rec.fullUrl) siteData.sampleUrl = rec.fullUrl;
    }
  });

  // Convert map to array format
  const result = [];
  userMap.forEach(userData => {
    const siteList = Array.from(userData.websites.values()).sort((a, b) => b.visitCount - a.visitCount);
    result.push({
      ...userData,
      websiteCount: siteList.length,
      websiteList: siteList
    });
  });

  return result.sort((a, b) => b.totalVisits - a.totalVisits);
}

// Format bytes into readable string (KB, MB, GB)
export function formatBytes(bytes) {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
