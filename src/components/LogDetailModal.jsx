import React from 'react';
import { X, Copy, Check, FileText, Server, Code } from 'lucide-react';
import { isIPv4 } from '../utils/reverseDns';

export default function LogDetailModal({ record, onClose, resolvedIpMap = {} }) {
  const [copied, setCopied] = React.useState(false);

  if (!record) return null;

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(record.rawLine).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const resolvedDomain = isIPv4(record.site) ? resolvedIpMap[record.site]?.domain : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-forti" />
            <h3 className="modal-title">FortiGate Log 完整欄位詳細資訊</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body">
          {/* Quick Summary Grid */}
          <div className="modal-summary-grid">
            <div>
              <span className="summary-label">時間 (Timestamp)</span>
              <p className="summary-val">{record.formattedDateTime}</p>
            </div>
            <div>
              <span className="summary-label">用戶 (User)</span>
              <p className="summary-val font-bold text-slate-100">{record.user}</p>
            </div>
            <div>
              <span className="summary-label">來源 IP (Src IP)</span>
              <p className="summary-val font-mono text-emerald-400">{record.srcip}</p>
            </div>
            <div>
              <span className="summary-label">目標 IP / 網站</span>
              <p className="summary-val font-bold text-blue-300 font-mono">
                {record.site}
                {resolvedDomain && (
                  <span className="block text-xs font-semibold text-emerald-400 font-mono mt-0.5">
                    🌐 {resolvedDomain}
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="summary-label">分類 (Category)</span>
              <p className="summary-val text-amber-300">{record.category}</p>
            </div>
            <div>
              <span className="summary-label">防火牆處置 (Action)</span>
              <p className={`summary-val ${record.isAllowed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {record.action} ({record.isAllowed ? '允許' : '阻擋'})
              </p>
            </div>
          </div>

          {/* Raw Key-Value Pair Inspector */}
          <div className="kv-inspector-card">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Code className="w-4 h-4 text-forti" />
                解析欄位鍵值對 (Key-Value Breakdown)
              </h4>
              <span className="text-xs text-slate-400">共 {Object.keys(record.rawKv).length} 個 Key-Value 欄位</span>
            </div>

            <div className="kv-grid">
              {Object.entries(record.rawKv).map(([k, v]) => (
                <div key={k} className="kv-item">
                  <span className="kv-key">{k}</span>
                  <span className="kv-val">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Raw Log Line */}
          <div className="raw-log-section">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                原始 FortiGate 日誌單行 (Raw Log Line)
              </span>
              <button onClick={handleCopyRaw} className="btn-text-xs">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已複製！' : '複製日誌'}</span>
              </button>
            </div>
            <pre className="raw-log-code">{record.rawLine}</pre>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary-sm">
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
}
