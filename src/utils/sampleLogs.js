/**
 * Sample FortiGate Log Generator
 * Generates realistic FortiGate webfilter and traffic log lines for demonstration.
 */

export function generateSampleFortiGateLogs() {
  const users = [
    { name: 'alex_wang', ip: '192.168.1.102', dept: 'Engineering' },
    { name: 'boss_chen', ip: '192.168.1.88', dept: 'Management' },
    { name: 'dev_sarah', ip: '192.168.1.115', dept: 'Engineering' },
    { name: 'hr_mary', ip: '192.168.1.140', dept: 'Human Resources' },
    { name: '192.168.1.205', ip: '192.168.1.205', dept: 'Guest Network' }
  ];

  const sites = [
    { domain: 'www.google.com', url: 'https://www.google.com/search?q=fortigate+log+filter', cat: 'Search Engines and Portals', action: 'passthrough' },
    { domain: 'github.com', url: 'https://github.com/reactjs/react', cat: 'Information Technology', action: 'passthrough' },
    { domain: 'chatgpt.com', url: 'https://chatgpt.com/c/6789-0123', cat: 'Artificial Intelligence', action: 'passthrough' },
    { domain: 'www.youtube.com', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', cat: 'Streaming Media', action: 'passthrough' },
    { domain: 'www.facebook.com', url: 'https://www.facebook.com/feed', cat: 'Social Networking', action: 'passthrough' },
    { domain: 'stackoverflow.com', url: 'https://stackoverflow.com/questions/12345/javascript', cat: 'Information Technology', action: 'passthrough' },
    { domain: 'docs.microsoft.com', url: 'https://docs.microsoft.com/en-us/azure/', cat: 'Business', action: 'passthrough' },
    { domain: 'mail.google.com', url: 'https://mail.google.com/mail/u/0/#inbox', cat: 'Web Chat and Webmail', action: 'passthrough' },
    { domain: 'crypto-gambling-casino.net', url: 'http://crypto-gambling-casino.net/play', cat: 'Gambling', action: 'deny' },
    { domain: 'phishing-login-fake.org', url: 'http://phishing-login-fake.org/verify', cat: 'Malicious Websites', action: 'deny' },
    { domain: 'news.yahoo.co.jp', url: 'https://news.yahoo.co.jp/articles/12345', cat: 'General News', action: 'passthrough' }
  ];

  const now = new Date();
  const logLines = [];

  // Generate logs spanning over the last 3 days
  const timeOffsets = [
    // Today
    0.1, 0.5, 1.2, 2.5, 3.8, 5.0, 6.5, 8.2, 9.5, 11.0, 14.2, 18.0,
    // Yesterday
    24.5, 26.0, 28.3, 30.5, 33.0, 36.5, 40.0, 42.5, 45.0,
    // 2 Days ago
    50.0, 52.5, 55.0, 60.0, 64.2, 68.0
  ];

  let lineCount = 0;

  timeOffsets.forEach((hoursAgo) => {
    const logTime = new Date(now.getTime() - hoursAgo * 3600 * 1000);
    
    // Add random minute variance
    logTime.setMinutes(logTime.getMinutes() + Math.floor(Math.random() * 50));
    logTime.setSeconds(Math.floor(Math.random() * 60));

    const dateStr = logTime.toISOString().substring(0, 10);
    const timeStr = logTime.toTimeString().substring(0, 8);

    // Pick 2-4 entries per timestamp
    const numEntries = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numEntries; i++) {
      lineCount++;
      const userObj = users[Math.floor(Math.random() * users.length)];
      const siteObj = sites[Math.floor(Math.random() * sites.length)];
      const sent = Math.floor(200 + Math.random() * 3500);
      const rcvd = Math.floor(1000 + Math.random() * 45000);
      const policyId = 1 + Math.floor(Math.random() * 5);
      const sessionId = 100000 + Math.floor(Math.random() * 900000);

      // FortiGate UTM Webfilter standard syslog log line format
      const line = `date=${dateStr} time=${timeStr} devname="FGT-HQ-OFFICE" devid="FG200E4Q19001234" logid="0317013312" type="utm" subtype="webfilter" eventtype="ftgd_allow" level="notice" vd="root" policyid=${policyId} sessionid=${sessionId} srcip=${userObj.ip} srcport=${50000 + Math.floor(Math.random() * 15000)} srcintf="lan" dstip=${104 + Math.floor(Math.random() * 50)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)} dstport=443 dstintf="wan1" proto=6 service="HTTPS" hostname="${siteObj.domain}" profile="WebFilter_Corporate" user="${userObj.name}" group="${userObj.dept}" msg="URL belongs to an allowed category in policy" action="${siteObj.action}" reqtype="direct" url="${siteObj.url}" sentbyte=${sent} rcvdbyte=${rcvd} catdesc="${siteObj.cat}"`;

      logLines.push(line);
    }
  });

  return logLines.join('\n');
}
