/**
 * Reverse DNS for sites that are bare IP addresses.
 *
 * This is the only part of the viewer that talks to the network, and it
 * does so only when the person clicks the lookup button: each public IPv4
 * address is sent as a PTR query to Google Public DNS over HTTPS
 * (dns.google). Private, loopback, link-local, shared (100.64/10) and
 * multicast addresses are never sent; they are the site's own machines and
 * a public resolver cannot name them anyway.
 */

const cache = new Map();

export function isIPv4(str) {
  if (!str) return false;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(str.trim());
  return !!m && m.slice(1).every(o => Number(o) <= 255);
}

/** RFC 1918, loopback, link-local, 100.64/10 (RFC 6598), 0/8, multicast, 255. */
export function isPrivateIPv4(str) {
  if (!isIPv4(str)) return false;
  const [a, b] = str.trim().split('.').map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

/** Public IPv4 addresses among `sites`, de-duplicated. */
export function resolvableIps(sites) {
  return Array.from(new Set(sites.filter(s => isIPv4(s) && !isPrivateIPv4(s)).map(s => s.trim())));
}

/**
 * One PTR lookup. Returns { domain, status } with status one of
 * resolved | no_ptr | error | not_ip | private.
 */
export async function lookupIpDomain(ip) {
  if (!isIPv4(ip)) return { domain: ip, status: 'not_ip' };
  const clean = ip.trim();
  if (isPrivateIPv4(clean)) return { domain: null, status: 'private' };
  if (cache.has(clean)) return cache.get(clean);

  let res;
  try {
    const o = clean.split('.');
    const ptr = `${o[3]}.${o[2]}.${o[1]}.${o[0]}.in-addr.arpa`;
    const r = await fetch(`https://dns.google/resolve?name=${ptr}&type=PTR`, {
      method: 'GET', headers: { Accept: 'application/dns-json' }
    });
    if (!r.ok) {
      res = { domain: null, status: 'error' };
    } else {
      const data = await r.json();
      if (data.Answer && data.Answer.length > 0) {
        let name = data.Answer[0].data;
        if (name.endsWith('.')) name = name.slice(0, -1);
        res = { domain: name.toLowerCase(), status: 'resolved' };
      } else {
        res = { domain: null, status: 'no_ptr' };
      }
    }
  } catch {
    res = { domain: null, status: 'error' };
  }
  cache.set(clean, res);
  return res;
}

/**
 * Resolve many addresses, six at a time. Private addresses are filtered
 * out here as well, so a caller cannot send them by mistake.
 * onItemResolved(ip, result, done, total)
 */
export async function batchResolveIps(ipList, onItemResolved) {
  const ips = resolvableIps(ipList);
  const results = {};
  let done = 0;
  const batch = 6;
  for (let i = 0; i < ips.length; i += batch) {
    const chunk = ips.slice(i, i + batch);
    await Promise.all(chunk.map(async ip => {
      const res = await lookupIpDomain(ip);
      results[ip] = res;
      done++;
      if (onItemResolved) onItemResolved(ip, res, done, ips.length);
    }));
  }
  return results;
}
