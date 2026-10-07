import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseKvLine, parseFortiGateLogsDetailed, buildUserWebsiteSummary,
  eventtimeToMs, dateTimeToMs, looksLikeCsvHeader, splitCsvLine, extractCleanHost
} from '../src/utils/fortigateParser.js';
import { isIPv4, isPrivateIPv4, resolvableIps } from '../src/utils/reverseDns.js';

const fixture = readFileSync(new URL('./fixtures/sample-webfilter.log', import.meta.url), 'utf8');
const csv = readFileSync(new URL('./fixtures/sample.csv', import.meta.url), 'utf8');

test('key=value: quoted values keep spaces, keys are lower-cased', () => {
  const kv = parseKvLine('Date=2026-10-06 msg="URL belongs to a denied category in policy" catdesc="Gambling" cat=14');
  assert.equal(kv.date, '2026-10-06');
  assert.equal(kv.msg, 'URL belongs to a denied category in policy');
  assert.equal(kv.cat, '14');
});

test('eventtime scales s, ms, us, ns to ms', () => {
  assert.equal(eventtimeToMs('1791249123'), 1791249123000);
  assert.equal(eventtimeToMs('1791249123456'), 1791249123456);
  assert.equal(eventtimeToMs('1791249123456789'), 1791249123456);
  assert.equal(eventtimeToMs('1791249123456789012'), 1791249123456);
  assert.equal(eventtimeToMs('abc'), null);
  assert.equal(eventtimeToMs(''), null);
});

test('date+time+tz is absolute, independent of the browser zone', () => {
  // 2026-10-06 09:12:03 +0800 == 2026-10-06T01:12:03Z
  assert.equal(dateTimeToMs('2026-10-06', '09:12:03', '+0800'), Date.UTC(2026, 9, 6, 1, 12, 3));
  assert.equal(dateTimeToMs('2026/10/06', '09:12:03', '-0700'), Date.UTC(2026, 9, 6, 16, 12, 3));
  assert.equal(dateTimeToMs('2026-10-06', '', '+0800'), null);
});

test('fixture: banner skipped, six records, eventtime preferred, counts reconcile', () => {
  const r = parseFortiGateLogsDetailed(fixture);
  assert.equal(r.format, 'kv');
  assert.equal(r.lines, 7);
  assert.equal(r.skipped, 1);
  assert.equal(r.parsed, 6);
  assert.equal(r.lines, r.parsed + r.skipped);
  assert.equal(r.untimed, 0);
  const first = r.records[0];
  assert.equal(first.timeSource, 'eventtime');
  assert.equal(first.timestamp, 1791249123456);          // ns truncated to ms
  assert.equal(first.site, 'docs.victoriametrics.com');
  assert.equal(first.isAllowed, true);
  const blocked = r.records.filter(x => !x.isAllowed);
  assert.equal(blocked.length, 2);
  assert.deepEqual(blocked.map(x => x.category).sort(), ['Gambling', 'Phishing']);
  // the traffic line without eventtime falls back to date+time+tz
  const t = r.records.find(x => x.rawKv.dstport === '9428');
  assert.equal(t.timeSource, 'date+time+tz');
  assert.equal(t.timestamp, Date.UTC(2026, 9, 6, 1, 15, 30));
  assert.equal(t.site, '192.168.2.49');                   // no hostname: dstip is the site
  // srcname / srcmac are carried for the workstation question
  const ws = r.records.find(x => x.rawKv.srcname);
  assert.equal(ws.srcname, 'ws-23');
  assert.equal(ws.srcmac, 'aa:bb:cc:00:00:23');
  // sorted by time
  for (let i = 1; i < r.records.length; i++) assert.ok(r.records[i - 1].timestamp <= r.records[i].timestamp);
});

test('date+time without tz falls back to the local zone and says so', () => {
  const r = parseFortiGateLogsDetailed('date=2026-10-06 time=09:15:30 type="traffic" srcip=192.168.2.10 dstip=203.0.113.1 action="accept"');
  assert.equal(r.records[0].timeSource, 'date+time(local)');
  assert.equal(r.records[0].timestamp, new Date('2026-10-06T09:15:30').getTime());
});

test('a line with no time keeps timestamp null and is counted, never dated now', () => {
  const r = parseFortiGateLogsDetailed('type="utm" subtype="webfilter" srcip=192.168.2.5 hostname="a.example" action="passthrough"');
  assert.equal(r.parsed, 1);
  assert.equal(r.untimed, 1);
  assert.equal(r.records[0].timestamp, null);
  assert.equal(r.records[0].timeSource, 'none');
  assert.equal(r.records[0].formattedDateTime, '');
});

test('user per site summary', () => {
  const r = parseFortiGateLogsDetailed(fixture);
  const s = buildUserWebsiteSummary(r.records);
  const u23 = s.find(u => u.user === '192.168.2.23');
  assert.equal(u23.totalVisits, 3);
  assert.equal(u23.blockedCount, 2);
  assert.equal(u23.srcname, 'ws-23');
  assert.equal(u23.websiteList[0].visitCount, 1);
  const u10 = s.find(u => u.user === '192.168.2.10');
  assert.equal(u10.websiteCount, 3);
});

test('csv export with a header row', () => {
  assert.equal(looksLikeCsvHeader(csv.split('\n')[0]), true);
  assert.equal(looksLikeCsvHeader('date=2026-10-06 time=1,2,3'), false);
  assert.deepEqual(splitCsvLine('a,"b, c","d ""q""",,e'), ['a', 'b, c', 'd "q"', '', 'e']);
  const r = parseFortiGateLogsDetailed(csv);
  assert.equal(r.format, 'csv');
  assert.equal(r.lines, 4);
  assert.equal(r.skipped, 1);                              // the header
  assert.equal(r.parsed, 3);
  const phishing = r.records.find(x => x.category === 'Phishing');
  assert.equal(phishing.rawUrl, '/account/verify?x=1,2');  // comma inside quotes survives
  assert.equal(phishing.user, 'ivan, c');
  assert.equal(phishing.timeSource, 'date+time+tz');       // empty eventtime cell
  assert.equal(phishing.fullUrl, 'https://login-verify.example.org/account/verify?x=1,2');
});

test('site extraction', () => {
  assert.equal(extractCleanHost('Docs.Example.COM:8443', '', ''), 'docs.example.com');
  assert.equal(extractCleanHost('', 'https://a.example/x/y', ''), 'a.example');
  assert.equal(extractCleanHost('', 'b.example/path', ''), 'b.example');
  assert.equal(extractCleanHost('', '/', '203.0.113.1'), '203.0.113.1');
  assert.equal(extractCleanHost('', '', ''), 'Unknown Site');
});

test('private addresses are never handed to the resolver', () => {
  assert.equal(isIPv4('192.168.2.1'), true);
  assert.equal(isIPv4('256.1.1.1'), false);
  for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.2.49', '127.0.0.1', '169.254.1.1', '100.64.0.1', '224.0.0.1', '0.0.0.0'])
    assert.equal(isPrivateIPv4(ip), true, ip);
  for (const ip of ['172.32.0.1', '8.8.8.8', '203.0.113.7', '100.63.255.255', '192.167.1.1'])
    assert.equal(isPrivateIPv4(ip), false, ip);
  assert.deepEqual(resolvableIps(['192.168.2.49', '203.0.113.7', 'github.com', '203.0.113.7', '10.1.1.1']), ['203.0.113.7']);
});
