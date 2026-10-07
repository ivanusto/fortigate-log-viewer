import React, { useMemo } from 'react';
import { Activity, ShieldCheck, ShieldAlert, Globe, User } from 'lucide-react';
import { formatBytes } from '../utils/fortigateParser';

export default function AnalyticsDashboard({ records }) {
  const analytics = useMemo(() => {
    if (!records || records.length === 0) return null;

    let allowed = 0;
    let blocked = 0;
    let totalBytes = 0;
    const domainCounts = {};
    const userCounts = {};
    const categoryCounts = {};

    records.forEach(r => {
      if (r.isAllowed) allowed++;
      else blocked++;
      totalBytes += r.totalBytes;

      domainCounts[r.site] = (domainCounts[r.site] || 0) + 1;
      userCounts[r.user] = (userCounts[r.user] || 0) + 1;
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    });

    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const maxDomainHits = topDomains[0] ? topDomains[0][1] : 1;
    const maxUserHits = topUsers[0] ? topUsers[0][1] : 1;

    return {
      total: records.length,
      allowed,
      blocked,
      allowedPercent: Math.round((allowed / records.length) * 100),
      blockedPercent: Math.round((blocked / records.length) * 100),
      totalBytes,
      topDomains,
      topUsers,
      topCategories,
      maxDomainHits,
      maxUserHits
    };
  }, [records]);

  if (!analytics) return null;

  return (
    <div className="analytics-grid">
      {/* Metric Cards Row */}
      <div className="metric-card">
        <div className="flex items-center justify-between">
          <span className="metric-title">總分析點擊 Log 數</span>
          <Activity className="w-5 h-5 text-forti" />
        </div>
        <div className="metric-value">{analytics.total.toLocaleString()}</div>
        <div className="metric-subtitle">總共傳輸: {formatBytes(analytics.totalBytes)}</div>
      </div>

      <div className="metric-card">
        <div className="flex items-center justify-between">
          <span className="metric-title">防火牆允許 (Passthrough)</span>
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="metric-value text-emerald-400">{analytics.allowed.toLocaleString()}</div>
        <div className="metric-subtitle">佔總比重: {analytics.allowedPercent}%</div>
      </div>

      <div className="metric-card">
        <div className="flex items-center justify-between">
          <span className="metric-title">防火牆阻擋 (Blocked)</span>
          <ShieldAlert className="w-5 h-5 text-rose-400" />
        </div>
        <div className="metric-value text-rose-400">{analytics.blocked.toLocaleString()}</div>
        <div className="metric-subtitle">佔總比重: {analytics.blockedPercent}%</div>
      </div>

      {/* Top Domains Chart */}
      <div className="chart-card col-span-2">
        <div className="chart-header">
          <Globe className="w-5 h-5 text-blue-400" />
          <h3>熱門瀏覽網站 Top 8 (Domain Hits)</h3>
        </div>
        <div className="bar-chart-list">
          {analytics.topDomains.map(([domain, count]) => {
            const pct = Math.round((count / analytics.maxDomainHits) * 100);
            return (
              <div key={domain} className="chart-bar-item">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200">{domain}</span>
                  <span className="font-mono text-forti">{count.toLocaleString()} 次</span>
                </div>
                <div className="progress-bg">
                  <div className="progress-fill fill-blue" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Users Chart */}
      <div className="chart-card col-span-2">
        <div className="chart-header">
          <User className="w-5 h-5 text-emerald-400" />
          <h3>活躍用戶排行榜 Top 8 (User Requests)</h3>
        </div>
        <div className="bar-chart-list">
          {analytics.topUsers.map(([user, count]) => {
            const pct = Math.round((count / analytics.maxUserHits) * 100);
            return (
              <div key={user} className="chart-bar-item">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200">{user}</span>
                  <span className="font-mono text-emerald-400">{count.toLocaleString()} 次</span>
                </div>
                <div className="progress-bg">
                  <div className="progress-fill fill-emerald" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
