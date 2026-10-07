import React, { useState, useMemo } from 'react';
import { List, Search, ShieldCheck, ShieldAlert, Eye, ChevronLeft, ChevronRight, ArrowUpDown, Globe, Loader2 } from 'lucide-react';
import { formatBytes } from '../utils/fortigateParser';
import { isIPv4 } from '../utils/reverseDns';

export default function DetailedLogsTable({ records, onSelectLog, resolvedIpMap = {} }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sort State
  const [sortBy, setSortBy] = useState('timestamp'); // 'timestamp', 'user', 'site', 'totalBytes', 'action'
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSortClick = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = records.filter(r => {
      if (!term) return true;
      const rDomain = resolvedIpMap[r.site]?.domain || '';
      return (
        r.user.toLowerCase().includes(term) ||
        r.site.toLowerCase().includes(term) ||
        rDomain.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term) ||
        r.srcip.toLowerCase().includes(term) ||
        r.rawLine.toLowerCase().includes(term)
      );
    });

    return filtered.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'timestamp') {
        comp = (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity);
      } else if (sortBy === 'totalBytes') {
        comp = a.totalBytes - b.totalBytes;
      } else if (sortBy === 'user') {
        comp = a.user.localeCompare(b.user);
      } else if (sortBy === 'site') {
        comp = a.site.localeCompare(b.site);
      } else if (sortBy === 'action') {
        comp = a.action.localeCompare(b.action);
      }
      return sortOrder === 'desc' ? -comp : comp;
    });
  }, [records, searchTerm, sortBy, sortOrder, resolvedIpMap]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentRecords = filteredAndSorted.slice(startIndex, startIndex + pageSize);

  const renderSortIndicator = (targetField) => {
    if (sortBy !== targetField) return <ArrowUpDown className="w-3 h-3 text-slate-600 ml-1 inline opacity-50" />;
    return <span className="ml-1 text-forti font-bold">{sortOrder === 'desc' ? '▼' : '▲'}</span>;
  };

  const renderSiteCell = (site) => {
    if (!isIPv4(site)) {
      return <span className="font-semibold text-blue-300">{site}</span>;
    }

    const dnsInfo = resolvedIpMap[site];

    return (
      <div className="flex flex-col">
        <span className="font-mono font-bold text-slate-100">{site}</span>
        {dnsInfo ? (
          dnsInfo.status === 'resolved' && dnsInfo.domain ? (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 font-mono">
              <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
              {dnsInfo.domain}
            </span>
          ) : (
            <span className="text-xs text-slate-500">（無 PTR 紀錄）</span>
          )
        ) : (
          <span className="text-xs text-amber-400 flex items-center gap-1 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
            反查中...
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="logs-table-card">
      <div className="logs-table-header">
        <div className="flex items-center gap-2">
          <List className="w-5 h-5 text-forti" />
          <h3 className="text-lg font-bold text-slate-100">詳細 Log 明細紀錄 ({filteredAndSorted.length.toLocaleString()} 筆)</h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="input-with-icon">
            <Search className="w-4 h-4 input-icon text-slate-400" />
            <input 
              type="text"
              placeholder="關鍵字搜尋完整日誌內容..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="input-field pl-9 text-xs py-1.5 w-64"
            />
          </div>

          <select 
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="input-field text-xs py-1.5 w-24"
          >
            <option value={10}>10 筆/頁</option>
            <option value={20}>20 筆/頁</option>
            <option value={50}>50 筆/頁</option>
            <option value={100}>100 筆/頁</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="site-table">
          <thead>
            <tr>
              <th>#</th>
              <th onClick={() => handleSortClick('timestamp')} className="cursor-pointer hover:text-white">
                時間 (Timestamp) {renderSortIndicator('timestamp')}
              </th>
              <th onClick={() => handleSortClick('user')} className="cursor-pointer hover:text-white">
                用戶 (User) {renderSortIndicator('user')}
              </th>
              <th>來源 IP</th>
              <th onClick={() => handleSortClick('site')} className="cursor-pointer hover:text-white">
                目標網站 (Host / Domain) {renderSortIndicator('site')}
              </th>
              <th>FortiGate 類別</th>
              <th onClick={() => handleSortClick('action')} className="cursor-pointer hover:text-white">
                處置 (Action) {renderSortIndicator('action')}
              </th>
              <th onClick={() => handleSortClick('totalBytes')} className="text-right cursor-pointer text-emerald-400 hover:text-emerald-300">
                📶 傳輸流量 (Bytes) {renderSortIndicator('totalBytes')}
              </th>
              <th className="text-center">檢視 KV</th>
            </tr>
          </thead>
          <tbody>
            {currentRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400">
                  沒有找到符合搜尋條件的 Log 紀錄
                </td>
              </tr>
            ) : (
              currentRecords.map((r, idx) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs text-slate-500">{startIndex + idx + 1}</td>
                  <td className="font-mono text-xs text-slate-300">{r.formattedDateTime}</td>
                  <td className="font-bold text-slate-100">{r.user}</td>
                  <td className="font-mono text-xs text-emerald-400">{r.srcip}</td>
                  <td>{renderSiteCell(r.site)}</td>
                  <td className="text-xs text-amber-300">{r.category}</td>
                  <td>
                    {r.isAllowed ? (
                      <span className="status-badge badge-allow text-xs">
                        <ShieldCheck className="w-3 h-3" />
                        {r.action}
                      </span>
                    ) : (
                      <span className="status-badge badge-deny text-xs">
                        <ShieldAlert className="w-3 h-3" />
                        {r.action}
                      </span>
                    )}
                  </td>
                  <td className="text-right font-mono text-xs font-bold text-emerald-400">
                    {formatBytes(r.totalBytes)}
                  </td>
                  <td className="text-center">
                    <button 
                      onClick={() => onSelectLog(r)}
                      className="btn-icon"
                      title="查看這筆 FortiGate Log 的完整欄位"
                    >
                      <Eye className="w-4 h-4 text-forti" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="pagination-footer">
          <span className="text-xs text-slate-400">
            顯示第 {startIndex + 1} 至 {Math.min(startIndex + pageSize, filteredAndSorted.length)} 筆，共 {filteredAndSorted.length} 筆
          </span>

          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => p - 1)}
              className="btn-pagination"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>上一頁</span>
            </button>
            
            <span className="font-mono text-xs text-slate-300 px-2">
              {currentPage} / {totalPages}
            </span>

            <button 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(p => p + 1)}
              className="btn-pagination"
            >
              <span>下一頁</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
