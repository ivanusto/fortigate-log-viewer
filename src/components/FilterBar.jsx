import React from 'react';
import { Search, Calendar, Clock, User, Globe, Filter, RotateCcw, ShieldAlert, ListFilter } from 'lucide-react';

export default function FilterBar({ 
  filters, 
  setFilters, 
  availableUsers, 
  availableCategories, 
  minDate, 
  maxDate,
  onResetFilters,
  totalRecords,
  filteredCount
}) {
  const handleQuickTime = (type) => {
    if (!maxDate) return;
    const end = new Date(maxDate);
    let start = new Date(minDate);

    if (type === '1h') {
      start = new Date(end.getTime() - 3600 * 1000);
    } else if (type === '24h') {
      start = new Date(end.getTime() - 24 * 3600 * 1000);
    } else if (type === 'today') {
      start = new Date(end);
      start.setHours(0, 0, 0, 0);
    } else if (type === 'yesterday') {
      const yDay = new Date(end);
      yDay.setDate(yDay.getDate() - 1);
      yDay.setHours(0, 0, 0, 0);
      start = yDay;
      const yEnd = new Date(yDay);
      yEnd.setHours(23, 59, 59, 999);
      
      setFilters(prev => ({
        ...prev,
        startDate: yDay.toISOString().substring(0, 10),
        startTime: '00:00',
        endDate: yEnd.toISOString().substring(0, 10),
        endTime: '23:59'
      }));
      return;
    } else if (type === 'all') {
      if (minDate && maxDate) {
        const dMin = new Date(minDate);
        const dMax = new Date(maxDate);
        setFilters(prev => ({
          ...prev,
          startDate: dMin.toISOString().substring(0, 10),
          startTime: dMin.toTimeString().substring(0, 5),
          endDate: dMax.toISOString().substring(0, 10),
          endTime: dMax.toTimeString().substring(0, 5)
        }));
      }
      return;
    }

    setFilters(prev => ({
      ...prev,
      startDate: start.toISOString().substring(0, 10),
      startTime: start.toTimeString().substring(0, 5),
      endDate: end.toISOString().substring(0, 10),
      endTime: end.toTimeString().substring(0, 5)
    }));
  };

  return (
    <div className="filter-card">
      <div className="filter-card-header">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-forti" />
          <h2 className="filter-card-title">檢視條件與時間範圍篩選</h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="filter-match-count">
            符合條件: <strong>{filteredCount.toLocaleString()}</strong> / {totalRecords.toLocaleString()} 筆
          </span>
          <button onClick={onResetFilters} className="btn-text-sm">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重設篩選</span>
          </button>
        </div>
      </div>

      {/* Quick Time Presets */}
      <div className="quick-time-bar">
        <span className="quick-label">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          快速時間選擇:
        </span>
        <button onClick={() => handleQuickTime('all')} className="btn-preset">全部時間</button>
        <button onClick={() => handleQuickTime('1h')} className="btn-preset">最近 1 小時</button>
        <button onClick={() => handleQuickTime('24h')} className="btn-preset">最近 24 小時</button>
        <button onClick={() => handleQuickTime('today')} className="btn-preset">今天</button>
        <button onClick={() => handleQuickTime('yesterday')} className="btn-preset">昨天</button>
      </div>

      <div className="filter-grid">
        {/* Date Time Range */}
        <div className="filter-group col-span-2">
          <label className="filter-label">
            <Calendar className="w-3.5 h-3.5 text-forti" />
            開始時間 Range (Start Time)
          </label>
          <div className="flex gap-2">
            <input 
              type="date" 
              value={filters.startDate} 
              onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="input-field" 
            />
            <input 
              type="time" 
              value={filters.startTime} 
              onChange={e => setFilters(prev => ({ ...prev, startTime: e.target.value }))}
              className="input-field time-input" 
            />
          </div>
        </div>

        <div className="filter-group col-span-2">
          <label className="filter-label">
            <Calendar className="w-3.5 h-3.5 text-forti" />
            結束時間 Range (End Time)
          </label>
          <div className="flex gap-2">
            <input 
              type="date" 
              value={filters.endDate} 
              onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="input-field" 
            />
            <input 
              type="time" 
              value={filters.endTime} 
              onChange={e => setFilters(prev => ({ ...prev, endTime: e.target.value }))}
              className="input-field time-input" 
            />
          </div>
        </div>

        {/* User Select / Search */}
        <div className="filter-group">
          <label className="filter-label">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            特定用戶 / IP 篩選
          </label>
          <select 
            value={filters.selectedUser} 
            onChange={e => setFilters(prev => ({ ...prev, selectedUser: e.target.value }))}
            className="input-field"
          >
            <option value="">-- 全部用戶 ({availableUsers.length} 位) --</option>
            {availableUsers.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>

        {/* Domain Search */}
        <div className="filter-group">
          <label className="filter-label">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            網站 / 關鍵字 (Domain / URL)
          </label>
          <div className="input-with-icon">
            <Search className="w-4 h-4 input-icon" />
            <input 
              type="text" 
              placeholder="例如 google.com / facebook" 
              value={filters.domainSearch}
              onChange={e => setFilters(prev => ({ ...prev, domainSearch: e.target.value }))}
              className="input-field pl-9"
            />
          </div>
        </div>

        {/* Category */}
        <div className="filter-group">
          <label className="filter-label">
            <ListFilter className="w-3.5 h-3.5 text-amber-400" />
            FortiGate 分類 (Category)
          </label>
          <select 
            value={filters.category} 
            onChange={e => setFilters(prev => ({ ...prev, category: e.target.value }))}
            className="input-field"
          >
            <option value="">-- 全部類別 --</option>
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Action Status */}
        <div className="filter-group">
          <label className="filter-label">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            防火牆處置 (Action)
          </label>
          <select 
            value={filters.actionStatus} 
            onChange={e => setFilters(prev => ({ ...prev, actionStatus: e.target.value }))}
            className="input-field"
          >
            <option value="all">全部 (Allowed & Blocked)</option>
            <option value="allowed">僅顯示允許 (Allowed / Passthrough)</option>
            <option value="blocked">僅顯示阻擋 (Blocked / Denied)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
