import React, { useState, useMemo, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import FileUploader from './components/FileUploader';
import FilterBar from './components/FilterBar';
import UserWebsiteList from './components/UserWebsiteList';
import DetailedLogsTable from './components/DetailedLogsTable';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LogDetailModal from './components/LogDetailModal';
import { parseFortiGateLogsDetailed, buildUserWebsiteSummary, localDate } from './utils/fortigateParser';
import { generateSampleFortiGateLogs } from './utils/sampleLogs';
import { isIPv4, isPrivateIPv4, resolvableIps, batchResolveIps } from './utils/reverseDns';
import { Globe, List, PieChart, Sparkles, Upload, Loader2, CheckCircle2, RefreshCw, ShieldOff } from 'lucide-react';

export default function App() {
  const [allRecords, setAllRecords] = useState([]);
  // lines / parsed / skipped / untimed / format of the loaded file
  const [parseStats, setParseStats] = useState(null);
  const [sampleActive, setSampleActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [activeTab, setActiveTab] = useState('user-websites'); // 'user-websites' | 'detailed-logs' | 'analytics'
  const [selectedLog, setSelectedLog] = useState(null);
  
  // IP Reverse DNS Resolution State: { [ip]: { domain: string|null, status: 'resolved'|'no_ptr'|'error' } }
  const [resolvedIpMap, setResolvedIpMap] = useState({});
  const [dnsStatus, setDnsStatus] = useState({ isRunning: false, current: 0, total: 0 });

  // Hidden file input ref
  const hiddenFileInputRef = useRef(null);

  // Filters State
  const [filters, setFilters] = useState({
    startDate: '',
    startTime: '00:00',
    endDate: '',
    endTime: '23:59',
    selectedUser: '',
    domainSearch: '',
    category: '',
    actionStatus: 'all'
  });

  // Automatically load sample data on initial app mount
  useEffect(() => {
    loadSampleData();
  }, []);

  // Reverse DNS never starts by itself: a lookup sends the public IP
  // addresses in the file to dns.google. The person starts it with the
  // button in the banner; private addresses are never sent (reverseDns.js).
  const startDnsLookup = () => {
    const ips = resolvableIps(allRecords.map(r => r.site));
    if (ips.length === 0) return;
    setDnsStatus({ isRunning: true, current: 0, total: ips.length });
    batchResolveIps(ips, (ip, result, current, total) => {
      setResolvedIpMap(prev => ({ ...prev, [ip]: result }));
      setDnsStatus({ isRunning: current < total, current, total });
    });
  };

  const loadParsed = (rawText, name, isSample) => {
    const stats = parseFortiGateLogsDetailed(rawText);
    if (stats.records.length === 0) {
      alert('未成功解析到有效的 FortiGate 日誌紀錄，請確認檔案格式是否正確。');
      return;
    }
    setAllRecords(stats.records);
    setParseStats({ lines: stats.lines, parsed: stats.parsed, skipped: stats.skipped, untimed: stats.untimed, format: stats.format });
    setFileName(name);
    setSampleActive(isSample);
    setResolvedIpMap({});
    setDnsStatus({ isRunning: false, current: 0, total: 0 });
    initializeTimeFilters(stats.records);
  };

  const handleFileLoaded = (rawText, name = 'fortigate.log') => loadParsed(rawText, name, false);

  const loadSampleData = () => loadParsed(generateSampleFortiGateLogs(), 'sample_fortigate_utm.log', true);

  const clearLogs = () => {
    setAllRecords([]);
    setParseStats(null);
    setFileName('');
    setSampleActive(false);
    setResolvedIpMap({});
    setDnsStatus({ isRunning: false, current: 0, total: 0 });
  };

  const triggerFilePicker = () => {
    hiddenFileInputRef.current?.click();
  };

  const handleHiddenFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      handleFileLoaded(evt.target.result, file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Set default start/end dates based on parsed records (untimed ones excluded)
  const initializeTimeFilters = (records) => {
    const timestamps = (records || []).map(r => r.timestamp).filter(t => t !== null);
    if (timestamps.length === 0) return;
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);

    const minD = new Date(minTs);
    const maxD = new Date(maxTs);

    setFilters(prev => ({
      ...prev,
      startDate: localDate(minD),
      startTime: '00:00',
      endDate: localDate(maxD),
      endTime: '23:59',
      selectedUser: '',
      domainSearch: '',
      category: '',
      actionStatus: 'all'
    }));
  };

  // Sites that are bare IP addresses: public ones can be looked up, private ones never are
  const { ipOnlyCount, publicIpCount, privateIpCount } = useMemo(() => {
    const set = new Set();
    allRecords.forEach(r => { if (isIPv4(r.site)) set.add(r.site); });
    const all = Array.from(set);
    const priv = all.filter(isPrivateIPv4).length;
    return { ipOnlyCount: all.length, publicIpCount: all.length - priv, privateIpCount: priv };
  }, [allRecords]);

  // Min and Max dates from all records
  const { minDate, maxDate, availableUsers, availableCategories } = useMemo(() => {
    const timestamps = allRecords.map(r => r.timestamp).filter(t => t !== null);
    if (timestamps.length === 0) {
      return { minDate: null, maxDate: null, availableUsers: [], availableCategories: [] };
    }
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);

    const usersSet = new Set();
    const catSet = new Set();
    allRecords.forEach(r => {
      if (r.user) usersSet.add(r.user);
      if (r.category) catSet.add(r.category);
    });

    return {
      minDate: new Date(minTs),
      maxDate: new Date(maxTs),
      availableUsers: Array.from(usersSet).sort(),
      availableCategories: Array.from(catSet).sort()
    };
  }, [allRecords]);

  // Filter records based on active user filters
  const filteredRecords = useMemo(() => {
    if (allRecords.length === 0) return [];

    let startTs = 0;
    let endTs = Infinity;

    if (filters.startDate) {
      const sStr = `${filters.startDate}T${filters.startTime || '00:00'}:00`;
      startTs = new Date(sStr).getTime();
    }
    if (filters.endDate) {
      const eStr = `${filters.endDate}T${filters.endTime || '23:59'}:59`;
      endTs = new Date(eStr).getTime();
    }

    return allRecords.filter(rec => {
      // Time Filter: an untimed record is shown only when no time filter is set
      if (rec.timestamp === null) {
        if (filters.startDate || filters.endDate) return false;
      } else if (rec.timestamp < startTs || rec.timestamp > endTs) return false;

      // User Filter
      if (filters.selectedUser && rec.user !== filters.selectedUser) return false;

      // Domain / URL / Resolved Domain Keyword Filter
      if (filters.domainSearch) {
        const keyword = filters.domainSearch.toLowerCase();
        const siteMatch = rec.site.toLowerCase().includes(keyword);
        const urlMatch = rec.fullUrl.toLowerCase().includes(keyword);
        
        // Also match resolved domain under IP!
        const resolvedDomain = resolvedIpMap[rec.site]?.domain || '';
        const resolvedMatch = resolvedDomain.toLowerCase().includes(keyword);

        if (!siteMatch && !urlMatch && !resolvedMatch) return false;
      }

      // Category Filter
      if (filters.category && rec.category !== filters.category) return false;

      // Action Filter
      if (filters.actionStatus === 'allowed' && !rec.isAllowed) return false;
      if (filters.actionStatus === 'blocked' && rec.isAllowed) return false;

      return true;
    });
  }, [allRecords, filters, resolvedIpMap]);

  // Build User -> Website summary array
  const userWebsiteSummary = useMemo(() => {
    return buildUserWebsiteSummary(filteredRecords);
  }, [filteredRecords]);

  const handleResetFilters = () => {
    if (allRecords.length > 0) {
      initializeTimeFilters(allRecords);
    }
  };

  return (
    <div className="app-layout">
      {/* Hidden global file input triggered by Navbar or other upload buttons */}
      <input 
        type="file" 
        ref={hiddenFileInputRef} 
        onChange={handleHiddenFileChange} 
        accept=".log,.txt,.csv" 
        className="hidden" 
      />

      <Navbar 
        logCount={allRecords.length}
        onUploadClick={triggerFilePicker}
        onLoadSample={loadSampleData}
        onClearLogs={clearLogs}
        sampleActive={sampleActive}
      />

      <main className="main-content">
        {allRecords.length === 0 ? (
          <FileUploader 
            onFileLoaded={handleFileLoaded} 
            onLoadSample={loadSampleData} 
          />
        ) : (
          <div className="workspace-container">
            {/* Top Info Notice Banner */}
            <div className="sample-banner">
              <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
              <div className="flex-1 text-sm flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <strong>目前載入檔案：</strong> <code className="font-mono bg-slate-900 px-2 py-0.5 rounded text-amber-300">{fileName}</code>
                  {sampleActive ? '（示範資料）' : ''}，共 <strong>{allRecords.length.toLocaleString()}</strong> 筆紀錄。
                  {parseStats && (
                    <span className="ml-2 text-xs text-slate-300" title="非空白行 = 解析 + 略過；無時間的紀錄沒有 eventtime 也沒有 date/time">
                      {parseStats.format === 'csv' ? 'CSV' : 'key=value'}，{parseStats.lines.toLocaleString()} 行 = {parseStats.parsed.toLocaleString()} 解析 + {parseStats.skipped.toLocaleString()} 略過
                      {parseStats.untimed > 0 && <>，{parseStats.untimed.toLocaleString()} 筆無時間</>}
                    </span>
                  )}
                  {ipOnlyCount > 0 && (
                    <span className="ml-2 text-xs font-semibold text-blue-300">
                      (包含 {ipOnlyCount} 個 IP 站點{privateIpCount > 0 ? `，其中 ${privateIpCount} 個內網位址不反查` : ''})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Reverse DNS: opt-in, public addresses only */}
                  {publicIpCount > 0 && (
                    <div className="dns-status-pill">
                      {dnsStatus.isRunning ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span className="text-xs text-amber-300 font-semibold">
                            反查公開 IP 中... ({dnsStatus.current} / {dnsStatus.total})
                          </span>
                        </>
                      ) : dnsStatus.total > 0 ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-semibold">
                            已反查 {dnsStatus.total} 個公開 IP
                          </span>
                          <button onClick={startDnsLookup} className="btn-icon p-1 ml-1" title="重新反查">
                            <RefreshCw className="w-3 h-3 text-slate-400" />
                          </button>
                        </>
                      ) : (
                        <>
                          <ShieldOff className="w-3.5 h-3.5 text-slate-400" />
                          <button
                            onClick={startDnsLookup}
                            className="text-xs text-slate-200 font-semibold underline-offset-2 hover:underline"
                            title="會把這些公開 IP 以 DNS over HTTPS 送到 dns.google 查 PTR；內網位址不送"
                          >
                            反查 {publicIpCount} 個公開 IP（會連 dns.google）
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <button 
                    onClick={triggerFilePicker} 
                    className="btn btn-secondary-sm shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>選擇新的 Log 檔案</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <FilterBar 
              filters={filters}
              setFilters={setFilters}
              availableUsers={availableUsers}
              availableCategories={availableCategories}
              minDate={minDate}
              maxDate={maxDate}
              onResetFilters={handleResetFilters}
              totalRecords={allRecords.length}
              filteredCount={filteredRecords.length}
            />

            {/* View Navigation Tabs */}
            <div className="app-nav-tabs">
              <button 
                className={`nav-tab-btn ${activeTab === 'user-websites' ? 'active' : ''}`}
                onClick={() => setActiveTab('user-websites')}
              >
                <Globe className="w-4.5 h-4.5 text-blue-400" />
                <span>用戶存取網站列表 (User Websites)</span>
                <span className="tab-badge">{userWebsiteSummary.length} 位用戶</span>
              </button>

              <button 
                className={`nav-tab-btn ${activeTab === 'detailed-logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('detailed-logs')}
              >
                <List className="w-4.5 h-4.5 text-forti" />
                <span>詳細 Log 明細紀錄 ({filteredRecords.length.toLocaleString()})</span>
              </button>

              <button 
                className={`nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <PieChart className="w-4.5 h-4.5 text-emerald-400" />
                <span>統計圖表與數據分析</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="tab-viewport">
              {activeTab === 'user-websites' && (
                <UserWebsiteList 
                  userSummaryData={userWebsiteSummary} 
                  filteredRecords={filteredRecords}
                  resolvedIpMap={resolvedIpMap}
                />
              )}

              {activeTab === 'detailed-logs' && (
                <DetailedLogsTable 
                  records={filteredRecords} 
                  onSelectLog={(log) => setSelectedLog(log)} 
                  resolvedIpMap={resolvedIpMap}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsDashboard records={filteredRecords} />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Log Detail Modal */}
      {selectedLog && (
        <LogDetailModal 
          record={selectedLog} 
          onClose={() => setSelectedLog(null)} 
          resolvedIpMap={resolvedIpMap}
        />
      )}
    </div>
  );
}
