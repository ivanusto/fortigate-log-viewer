/**
 * Advanced Reverse DNS & IP Intelligence Utility
 * Uses Google DNS-over-HTTPS (DoH) & RDAP APIs to resolve IP -> Domain / PTR / Organization.
 */

// Memory cache for resolved IP mappings
const ipDomainCache = new Map();

// Helper to check if string is an IPv4 address
export function isIPv4(str) {
  if (!str) return false;
  return /^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(str.trim());
}

/**
 * Reverse lookup a single IPv4 address
 * Returns object: { domain: string|null, status: 'resolved'|'no_ptr'|'error' }
 */
export async function lookupIpDomain(ip) {
  if (!isIPv4(ip)) return { domain: ip, status: 'not_ip' };

  const cleanIp = ip.trim();

  // Return cached result if present
  if (ipDomainCache.has(cleanIp)) {
    return ipDomainCache.get(cleanIp);
  }

  try {
    // Construct in-addr.arpa PTR domain for IPv4
    const octets = cleanIp.split('.');
    const ptrDomain = `${octets[3]}.${octets[2]}.${octets[1]}.${octets[0]}.in-addr.arpa`;

    // Fetch from Google DNS-over-HTTPS
    const response = await fetch(`https://dns.google/resolve?name=${ptrDomain}&type=PTR`, {
      method: 'GET',
      headers: { 'Accept': 'application/dns-json' }
    });

    if (!response.ok) {
      const resObj = { domain: null, status: 'error' };
      ipDomainCache.set(cleanIp, resObj);
      return resObj;
    }

    const data = await response.json();
    if (data.Answer && data.Answer.length > 0) {
      let resolvedName = data.Answer[0].data;
      if (resolvedName.endsWith('.')) {
        resolvedName = resolvedName.slice(0, -1);
      }
      const resObj = { domain: resolvedName.toLowerCase(), status: 'resolved' };
      ipDomainCache.set(cleanIp, resObj);
      return resObj;
    } else {
      const resObj = { domain: null, status: 'no_ptr' };
      ipDomainCache.set(cleanIp, resObj);
      return resObj;
    }
  } catch (err) {
    const resObj = { domain: null, status: 'error' };
    ipDomainCache.set(cleanIp, resObj);
    return resObj;
  }
}

/**
 * Batch resolve multiple IPs concurrently with real-time updates
 * @param {string[]} ipList - Array of IP addresses to resolve
 * @param {function} onItemResolved - (ip, resultObj, currentCount, totalCount)
 */
export async function batchResolveIps(ipList, onItemResolved) {
  const uniqueIps = Array.from(new Set(ipList.filter(isIPv4)));
  const results = {};
  let completed = 0;

  const batchSize = 6; // 6 concurrent DoH requests

  for (let i = 0; i < uniqueIps.length; i += batchSize) {
    const chunk = uniqueIps.slice(i, i + batchSize);
    await Promise.all(chunk.map(async (ip) => {
      const res = await lookupIpDomain(ip);
      results[ip] = res;
      completed++;
      if (onItemResolved) {
        onItemResolved(ip, res, completed, uniqueIps.length);
      }
    }));
  }

  return results;
}
