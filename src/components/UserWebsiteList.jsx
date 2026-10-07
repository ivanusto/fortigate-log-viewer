import React, { useState, useMemo } from 'react';
import { Globe, User, ExternalLink, Download, Copy, Check, ChevronDown, ChevronRight, ShieldCheck, ShieldAlert, ArrowUpDown, Tag, Loader2 } from 'lucide-react';
import { formatBytes, localDate } from '../utils/fortigateParser';
import { isIPv4 } from '../utils/reverseDns';

export default function UserWebsiteList({ userSummaryData, filteredRecords, resolvedIpMap = {} }) {
  const [groupBy, setGroupBy] = useState('domain'); // default to domain view as shown in user screenshot!
  const [expandedUser, setExpandedUser] = useState({});
  const [copied, setCopied] = useState(false);
  
  // Sort state for Group by Domain view
  const [domainSortBy, setDomainSortBy] = useState('totalBytes'); // Default to totalBytes sorting as shown in screenshot
  const [domainSortOrder, setDomainSortOrder] = useState('desc');

  // Sort state for Group by User view
  const [userSiteSortBy, setUserSiteSortBy] = useState('totalBytes');
  const [userSiteSortOrder, setUserSiteSortOrder] = useState('desc');

  // Toggle expand/collapse for a user card
  const toggleUserExpand = (user) => {
    setExpandedUser(prev => ({
      ...prev,
      [user]: prev[user] === undefined ? true : !prev[user]
    }));
  };

  // Handle column header click for Domain Group view
  const handleDomainSortClick = (field) => {
    if (domainSortBy === field) {
      setDomainSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setDomainSortBy(field);
      setDomainSortOrder('desc');
    }
  };

  // Handle column header click for User Site table view
  const handleUserSiteSortClick = (field) => {
    if (userSiteSortBy === field) {
      setUserSiteSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setUserSiteSortBy(field);
      setUserSiteSortOrder('desc');
    }
  };

  // Group by Domain View calculation
  const domainSummary = useMemo(() => {
    const domainMap = new Map();

    filteredRecords.forEach(rec => {
      if (!domainMap.has(rec.site)) {
        domainMap.set(rec.site, {
          domain: rec.site,
          category: rec.category,
          visitCount: 0,
          totalBytes: 0,
          allowedCount: 0,
          blockedCount: 0,
          users: new Set(),
          lastVisit: rec.formattedDateTime,
          sampleUrl: rec.fullUrl
        });
      }

      const d = domainMap.get(rec.site);
      d.visitCount++;
      d.totalBytes += rec.totalBytes;
      if (rec.isAllowed) d.allowedCount++;
      else d.blockedCount++;
      d.users.add(rec.user);
      if (rec.formattedDateTime > d.lastVisit) {
        d.lastVisit = rec.formattedDateTime;
        if (rec.fullUrl) d.sampleUrl = rec.fullUrl;
      }
    });

    const list = Array.from(domainMap.values()).map(d => ({
      ...d,
      uniqueUsersCount: d.users.size,
      userList: Array.from(d.users)
    }));

    return list.sort((a, b) => {
      let comp = 0;
      if (domainSortBy === 'domain') {
        comp = a.domain.localeCompare(b.domain);
      } else if (domainSortBy === 'lastVisit') {
        comp = a.lastVisit.localeCompare(b.lastVisit);
      } else if (domainSortBy === 'totalBytes') {
        comp = a.totalBytes - b.totalBytes;
      } else if (domainSortBy === 'users') {
        comp = a.uniqueUsersCount - b.uniqueUsersCount;
      } else {
        comp = a.visitCount - b.visitCount;
      }
      return domainSortOrder === 'desc' ? -comp : comp;
    });
  }, [filteredRecords, domainSortBy, domainSortOrder]);

  // Process User Summary Data with internal website sorting
  const processedUserData = useMemo(() => {
    return userSummaryData.map(u => {
      const sortedSites = [...u.websiteList].sort((a, b) => {
        let comp = 0;
        if (userSiteSortBy === 'site') {
          comp = a.site.localeCompare(b.site);
        } else if (userSiteSortBy === 'totalBytes') {
          comp = a.totalBytes - b.totalBytes;
        } else if (userSiteSortBy === 'lastVisit') {
          comp = a.lastVisit.localeCompare(b.lastVisit);
        } else {
          comp = a.visitCount - b.visitCount;
        }
        return userSiteSortOrder === 'desc' ? -comp : comp;
      });

      return {
        ...u,
        websiteList: sortedSites
      };
    });
  }, [userSummaryData, userSiteSortBy, userSiteSortOrder]);

  // Render Domain cell with IP on top line and Auto-Resolved Domain underneath
  const renderDomainCell = (site) => {
    const isIp = isIPv4(site);
    if (!isIp) {
      return (
        <div className="site-name-cell">
          <span className="site-domain font-bold text-blue-300">{site}</span>
        </div>
      );
    }

    const dnsInfo = resolvedIpMap[site];

    return (
      <div className="site-name-cell flex flex-col py-0.5">
        <span className="font-mono font-bold text-slate-100 text-sm">{site}</span>
        {dnsInfo ? (
          dnsInfo.status === 'resolved' && dnsInfo.domain ? (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mt-0.5 font-mono">
              <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
              {dnsInfo.domain}
            </span>
          ) : (
            <span className="text-xs text-slate-500 mt-0.5">（無 PTR 紀錄）</span>
          )
        ) : (
          <span className="text-xs text-amber-400 flex items-center gap-1 mt-0.5 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
            反查域名中...
          </span>
        )}
      </div>
    );
  };

  // Export CSV function for User Website Access Report
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    
    if (groupBy === 'user') {
      csvContent += '用戶 (User/IP),來源 IP,目標 IP/域名,反查 Domain,分類 (Category),存取次數,狀態 (Action),最後存取時間,總傳輸流量 (Bytes)\n';
      processedUserData.forEach(u => {
        u.websiteList.forEach(w => {
          const statusStr = w.blockedCount > 0 ? (w.allowedCount > 0 ? '部分阻擋' : '被阻擋 (Blocked)') : '允許 (Allowed)';
          const rDomain = resolvedIpMap[w.site]?.domain || '';
          csvContent += `"${u.user}","${u.srcip}","${w.site}","${rDomain}","${w.category}",${w.visitCount},"${statusStr}","${w.lastVisit}","${formatBytes(w.totalBytes)}"\n`;
        });
      });
    } else {
      csvContent += '目標 IP/域名,反查 Domain,分類 (Category),累積存取次數,造訪用戶數,狀態,最後存取時間,總傳輸流量 (Bytes)\n';
      domainSummary.forEach(d => {
        const statusStr = d.blockedCount > 0 ? (d.allowedCount > 0 ? '部分阻擋' : '被阻擋 (Blocked)') : '允許 (Allowed)';
        const rDomain = resolvedIpMap[d.domain]?.domain || '';
        csvContent += `"${d.domain}","${rDomain}","${d.category}",${d.visitCount},${d.uniqueUsersCount},"${statusStr}","${d.lastVisit}","${formatBytes(d.totalBytes)}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FortiGate_User_Websites_${groupBy}_${localDate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy site list to clipboard
  const handleCopyList = () => {
    let text = '';
    if (groupBy === 'user') {
      processedUserData.forEach(u => {
        text += `【用戶: ${u.user} (IP: ${u.srcip}) - 共 ${u.websiteCount} 個網站】\n`;
        u.websiteList.forEach(w => {
          const rDomain = resolvedIpMap[w.site]?.domain ? ` [Domain: ${resolvedIpMap[w.site].domain}]` : '';
          text += `  - ${w.site}${rDomain} (分類: ${w.category}, 流量: ${formatBytes(w.totalBytes)}, 次數: ${w.visitCount}, 最後時間: ${w.lastVisit})\n`;
        });
        text += '\n';
      });
    } else {
      text += `【特定時間範圍全體用戶造訪網站列表 (共 ${domainSummary.length} 個網站)】\n`;
      domainSummary.forEach(d => {
        const rDomain = resolvedIpMap[d.domain]?.domain ? ` [Domain: ${resolvedIpMap[d.domain].domain}]` : '';
        text += `- ${d.domain}${rDomain} [${d.category}] (總流量: ${formatBytes(d.totalBytes)}, 造訪次數: ${d.visitCount}, 使用者: ${d.userList.join(', ')})\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (processedUserData.length === 0) {
    return (
      <div className="empty-state">
        <Globe className="w-12 h-12 text-slate-500 mb-2" />
        <h3>無符合篩選條件的網站存取紀錄</h3>
        <p>請嘗試調整時間範圍、用戶或搜尋關鍵字。</p>
      </div>
    );
  }

  const renderSortIndicator = (currentSort, targetField, currentOrder) => {
    if (currentSort !== targetField) return <ArrowUpDown className="w-3 h-3 text-slate-600 ml-1 inline opacity-50" />;
    return <span className="ml-1 text-forti font-bold">{currentOrder === 'desc' ? '▼' : '▲'}</span>;
  };

  return (
    <div className="summary-section">
      {/* Controls Bar */}
      <div className="summary-controls">
        <div className="view-mode-tabs">
          <button 
            className={`tab-btn ${groupBy === 'user' ? 'active' : ''}`}
            onClick={() => setGroupBy('user')}
          >
            <User className="w-4 h-4" />
            <span>按「用戶」分組檢視 ({processedUserData.length} 位)</span>
          </button>
          <button 
            className={`tab-btn ${groupBy === 'domain' ? 'active' : ''}`}
            onClick={() => setGroupBy('domain')}
          >
            <Globe className="w-4 h-4" />
            <span>按「網站域名」分組檢視 ({domainSummary.length} 個)</span>
          </button>
        </div>

        <div className="action-buttons">
          <button onClick={handleCopyList} className="btn btn-secondary-sm">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '已複製至剪貼簿！' : '複製網站清單'}</span>
          </button>

          <button onClick={handleExportCSV} className="btn btn-emerald-sm">
            <Download className="w-4 h-4" />
            <span>匯出 CSV 報表</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: Group By User */}
      {groupBy === 'user' && (
        <div className="user-cards-container">
          {processedUserData.map(userData => {
            const isCollapsed = expandedUser[userData.user] === false;
            return (
              <div key={userData.user} className="user-summary-card">
                <div className="user-card-header" onClick={() => toggleUserExpand(userData.user)}>
                  <div className="flex items-center gap-3">
                    <button className="expand-icon-btn">
                      {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>

                    <div className="user-avatar-badge">
                      <User className="w-5 h-5 text-forti" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="user-name">{userData.user}</h3>
                        <span className="ip-badge">IP: {userData.srcip}</span>
                      </div>
                      <p className="user-meta-sub">
                        活動時間: {userData.firstSeen} ~ {userData.lastSeen}
                      </p>
                    </div>
                  </div>

                  <div className="user-stats-pills">
                    <div className="stat-pill">
                      <span className="stat-label">讀取網站數</span>
                      <span className="stat-value text-blue-400">{userData.websiteCount} 個</span>
                    </div>
                    <div className="stat-pill">
                      <span className="stat-label">總點擊 / 存取次數</span>
                      <span className="stat-value text-forti">{userData.totalVisits.toLocaleString()} 次</span>
                    </div>
                    <div className="stat-pill">
                      <span className="stat-label">總傳輸流量</span>
                      <span className="stat-value text-emerald-400 font-bold">{formatBytes(userData.totalBytes)}</span>
                    </div>
                  </div>
                </div>

                {/* Website List Table under User */}
                {!isCollapsed && (
                  <div className="table-responsive">
                    <table className="site-table">
                      <thead>
                        <tr>
                          <th onClick={() => handleUserSiteSortClick('site')} className="cursor-pointer hover:text-white">
                            造訪 IP / 域名 (Domain) {renderSortIndicator(userSiteSortBy, 'site', userSiteSortOrder)}
                          </th>
                          <th>FortiGate 類別 (Category)</th>
                          <th onClick={() => handleUserSiteSortClick('visitCount')} className="text-right cursor-pointer hover:text-white">
                            存取次數 (Visits) {renderSortIndicator(userSiteSortBy, 'visitCount', userSiteSortOrder)}
                          </th>
                          <th>處置狀態 (Action)</th>
                          <th onClick={() => handleUserSiteSortClick('lastVisit')} className="cursor-pointer hover:text-white">
                            最後讀取時間 {renderSortIndicator(userSiteSortBy, 'lastVisit', userSiteSortOrder)}
                          </th>
                          <th onClick={() => handleUserSiteSortClick('totalBytes')} className="text-right cursor-pointer text-emerald-400 hover:text-emerald-300">
                            傳輸流量 (Bytes) 📶 {renderSortIndicator(userSiteSortBy, 'totalBytes', userSiteSortOrder)}
                          </th>
                          <th className="text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userData.websiteList.map((siteItem, idx) => (
                          <tr key={`${userData.user}-${siteItem.site}-${idx}`}>
                            <td>
                              {renderDomainCell(siteItem.site)}
                            </td>
                            <td>
                              <span className="category-tag">
                                <Tag className="w-3 h-3 text-amber-400" />
                                {siteItem.category}
                              </span>
                            </td>
                            <td className="text-right font-mono font-bold text-slate-100">
                              {siteItem.visitCount.toLocaleString()}
                            </td>
                            <td>
                              {siteItem.blockedCount > 0 ? (
                                <span className="status-badge badge-deny">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  {siteItem.allowedCount > 0 ? `部分阻擋 (${siteItem.blockedCount})` : '阻擋 (Denied)'}
                                </span>
                              ) : (
                                <span className="status-badge badge-allow">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  允許 (Passthrough)
                                </span>
                              )}
                            </td>
                            <td className="font-mono text-sm text-slate-300">
                              {siteItem.lastVisit}
                            </td>
                            <td className="text-right font-mono text-sm font-bold text-emerald-400">
                              {formatBytes(siteItem.totalBytes)}
                            </td>
                            <td className="text-center">
                              <a 
                                href={`https://${siteItem.site}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="icon-link-btn"
                                title="在新視窗開啟該位址"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: Group By Domain */}
      {groupBy === 'domain' && (
        <div className="domain-view-card">
          <div className="domain-view-header">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              全體用戶存取網站排行榜 (已匯整網站域名)
            </h3>

            <div className="sort-controls flex items-center gap-2 text-xs text-slate-400">
              <span>排序依據:</span>
              <button 
                onClick={() => handleDomainSortClick('totalBytes')}
                className={`sort-btn ${domainSortBy === 'totalBytes' ? 'active-emerald' : ''}`}
                title="按傳輸流量高至低排序"
              >
                📶 傳輸流量 {domainSortBy === 'totalBytes' && (domainSortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button 
                onClick={() => handleDomainSortClick('visitCount')}
                className={`sort-btn ${domainSortBy === 'visitCount' ? 'active' : ''}`}
              >
                存取次數 {domainSortBy === 'visitCount' && (domainSortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button 
                onClick={() => handleDomainSortClick('domain')}
                className={`sort-btn ${domainSortBy === 'domain' ? 'active' : ''}`}
              >
                IP/域名 {domainSortBy === 'domain' && (domainSortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button 
                onClick={() => handleDomainSortClick('lastVisit')}
                className={`sort-btn ${domainSortBy === 'lastVisit' ? 'active' : ''}`}
              >
                最後時間 {domainSortBy === 'lastVisit' && (domainSortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="site-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th onClick={() => handleDomainSortClick('domain')} className="cursor-pointer hover:text-white">
                    網站 IP / 域名 (Domain) {renderSortIndicator(domainSortBy, 'domain', domainSortOrder)}
                  </th>
                  <th>FortiGate 類別 (Category)</th>
                  <th onClick={() => handleDomainSortClick('visitCount')} className="text-right cursor-pointer hover:text-white">
                    累積存取次數 {renderSortIndicator(domainSortBy, 'visitCount', domainSortOrder)}
                  </th>
                  <th onClick={() => handleDomainSortClick('users')} className="cursor-pointer hover:text-white">
                    造訪用戶 (Users) {renderSortIndicator(domainSortBy, 'users', domainSortOrder)}
                  </th>
                  <th>防火牆處置</th>
                  <th onClick={() => handleDomainSortClick('lastVisit')} className="cursor-pointer hover:text-white">
                    最後存取時間 {renderSortIndicator(domainSortBy, 'lastVisit', domainSortOrder)}
                  </th>
                  <th onClick={() => handleDomainSortClick('totalBytes')} className="text-right cursor-pointer text-emerald-400 hover:text-emerald-300">
                    📶 傳輸流量 (Bytes) {renderSortIndicator(domainSortBy, 'totalBytes', domainSortOrder)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {domainSummary.map((d, index) => (
                  <tr key={d.domain}>
                    <td className="font-mono text-xs text-slate-500">{index + 1}</td>
                    <td>
                      {renderDomainCell(d.domain)}
                    </td>
                    <td>
                      <span className="category-tag">
                        <Tag className="w-3 h-3 text-amber-400" />
                        {d.category}
                      </span>
                    </td>
                    <td className="text-right font-mono font-bold text-forti text-base">
                      {d.visitCount.toLocaleString()}
                    </td>
                    <td>
                      <div className="user-chips-list">
                        {d.userList.map(u => (
                          <span key={u} className="user-chip">
                            <User className="w-3 h-3 text-emerald-400" />
                            {u}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {d.blockedCount > 0 ? (
                        <span className="status-badge badge-deny">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {d.allowedCount > 0 ? `部分阻擋 (${d.blockedCount})` : '阻擋'}
                        </span>
                      ) : (
                        <span className="status-badge badge-allow">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          允許
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-xs text-slate-300">
                      {d.lastVisit}
                    </td>
                    <td className="text-right font-mono text-sm font-bold text-emerald-400">
                      {formatBytes(d.totalBytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
