import React from 'react';
import { Shield, FileText, Upload, Trash2, CheckCircle2 } from 'lucide-react';

export default function Navbar({ logCount, onUploadClick, onLoadSample, onClearLogs, sampleActive }) {
  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="logo-icon">
            <Shield className="w-6 h-6 text-forti" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="navbar-title">FortiGate Log 網站檢視器</h1>
              <span className="badge-fortigate">FortiOS Log Analyzer</span>
            </div>
          </div>
        </div>

        <div className="navbar-actions">
          {logCount > 0 && (
            <div className="log-stats-badge">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>已載入 <strong>{logCount.toLocaleString()}</strong> 筆紀錄</span>
              {sampleActive && <span className="sample-pill">範例資料</span>}
            </div>
          )}

          <button 
            onClick={onLoadSample} 
            className="btn btn-secondary"
            title="載入系統內建的 FortiGate 範例 Log"
          >
            <FileText className="w-4 h-4" />
            <span>載入範例 Log</span>
          </button>

          <button 
            onClick={onUploadClick} 
            className="btn btn-primary"
            title="選擇或拖放 FortiGate 下載的 .log / .txt 檔案"
          >
            <Upload className="w-4 h-4" />
            <span>匯入 Log 檔案</span>
          </button>

          {logCount > 0 && (
            <button 
              onClick={onClearLogs} 
              className="btn btn-danger-outline"
              title="清除目前已載入的 Log"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
