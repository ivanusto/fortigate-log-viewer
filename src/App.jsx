import React, { useState, useMemo, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import FileUploader from './components/FileUploader';
import FilterBar from './components/FilterBar';
import UserWebsiteList from './components/UserWebsiteList';
import DetailedLogsTable from './components/DetailedLogsTable';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LogDetailModal from './components/LogDetailModal';
import { parseFortiGateLogs, buildUserWebsiteSummary } from './utils/fortigateParser';
import { generateSampleFortiGateLogs } from './utils/sampleLogs';
import { isIPv4, batchResolveIps } from './utils/reverseDns';
import { Globe, List, PieChart, Sparkles, Upload, Search, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';

export default function App() {
  const [allRecords, setAllRecords] = useState([]);
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

  // Whenever allRecords changes, automatically trigger background Reverse DNS resolution for all IP sites!
  useEffect(() => {
    if (allRecords.length === 0) return;

    const uniqueIpSites = Array.from(new Set(
      allRecords
        .map(r => r.site)
        .filter(isIPv4)
    ));

    if (uniqueIpSites.length === 0) {
      setDnsStatus({ isRunning: false, current: 0, total: 0 });
      return;
    }

    setDnsStatus({ isRunning: true, current: 0, total: uniqueIpSites.length });

    batchResolveIps(uniqueIpSites, (ip, result, current, total) => {
      setResolvedIpMap(prev => ({
        ...prev,
        [ip]: result
      }));
      setDnsStatus({ isRunning: current < total, current, total });
    });

  }, [allRecords]);

  const handleFileLoaded = (rawText, name = 'fortigate.log') => {
    const parsed = parseFortiGateLogs(rawText);
    if (parsed.length === 0) {
      alert('未成功解析到有效的 FortiGate 日誌紀錄，請確認檔案格式是否正確。');
      return;
    }
    setAllRecords(parsed);
    setFileName(name);
    setSampleActive(false);
    initializeTimeFilters(parsed);
  };

  const loadSampleData = () => {
    const sampleText = generateSampleFortiGateLogs();
    const parsed = parseFortiGateLogs(sampleText);
    setAllRecords(parsed);
    setFileName('sample_fortigate_utm.log');
    setSampleActive(true);
    initializeTimeFilters(parsed);
  };

  const clearLogs = () => {
    setAllRecords([]);
    setFileName('');
    setSampleActive(false);
    setResolvedIpMap({});
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

  // Manual re-trigger DNS lookup
  const retriggerDnsLookup = () => {
    const uniqueIpSites = Array.from(new Set(
      allRecords
        .map(r => r.site)
        .filter(isIPv4)
    ));

    if (uniqueIpSites.length === 0) return;
    setDnsStatus({ isRunning: true, current: 0, total: uniqueIpSites.length });

    batchResolveIps(uniqueIpSites, (ip, result, current, total) => {
      setResolvedIpMap(prev => ({
        ...prev,
        [ip]: result
      }));
      setDnsStatus({ isRunning: current < total, current, total });
    });
  };

  // Set default start/end dates based on parsed records
  const initializeTimeFilters = (records) => {
    if (!records || records.length === 0) return;
    const timestamps = records.map(r => r.timestamp);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);

    const minD = new Date(minTs);
    const maxD = new Date(maxTs);

    setFilters(prev => ({
      ...prev,
      startDate: minD.toISOString().substring(0, 10),
      startTime: '00:00',
      endDate: maxD.toISOString().substring(0, 10),
      endTime: '23:59',
      selectedUser: '',
      domainSearch: '',
      category: '',
      actionStatus: 'all'
    }));
  };

  // Count IP-only records
  const ipOnlyCount = useMemo(() => {
    const set = new Set();
    allRecords.forEach(r => {
      if (isIPv4(r.site)) set.add(r.site);
    });
    return set.size;
  }, [allRecords]);

  // Min and Max dates from all records
  const { minDate, maxDate, availableUsers, availableCategories } = useMemo(() => {
    if (allRecords.length === 0) {
      return { minDate: null, maxDate: null, availableUsers: [], availableCategories: [] };
    }
    const timestamps = allRecords.map(r => r.timestamp);
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
      // Time Filter
      if (rec.timestamp < startTs || rec.timestamp > endTs) return false;

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
                  {ipOnlyCount > 0 && (
                    <span className="ml-2 text-xs font-semibold text-blue-300">
                      (包含 {ipOnlyCount} 個 IP 站點)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Automated Reverse DNS Status Badge */}
                  {ipOnlyCount > 0 && (
                    <div className="dns-status-pill">
                      {dnsStatus.isRunning ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span className="text-xs text-amber-300 font-semibold">
                            自動反查 IP 域名中... ({dnsStatus.current} / {dnsStatus.total})
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-semibold">
                            IP 域名已全數反查完成 ({dnsStatus.total} 個)
                          </span>
                          <button 
                            onClick={retriggerDnsLookup}
                            className="btn-icon p-1 ml-1"
                            title="重新執行 IP 反查"
                          >
                            <RefreshCw className="w-3 h-3 text-slate-400" />
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
