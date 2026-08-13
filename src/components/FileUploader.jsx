import React, { useRef, useState } from 'react';
import { UploadCloud, FileCode2, Play, Lock, CheckCircle2, Sparkles, FileText } from 'lucide-react';

export default function FileUploader({ onFileLoaded, onLoadSample }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const processFile = (file) => {
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      onFileLoaded(content, file.name);
      setLoading(false);
    };
    reader.onerror = () => {
      alert('讀取檔案失敗，請確認檔案格式是否正確。');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  return (
    <div className="upload-container">
      <div 
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept=".log,.txt,.csv" 
          className="hidden" 
        />

        <div className="upload-icon-wrapper">
          <UploadCloud className="w-12 h-12 text-forti" />
        </div>

        <h3 className="upload-title">
          {loading ? '解析 FortiGate Log 中...' : '拖放 FortiGate Log 檔案至此，或點擊選擇檔案'}
        </h3>
        
        <p className="upload-desc">
          支援由 FortiGate 防火牆、FortiAnalyzer 或 Syslog 匯出的 <code>.log</code>, <code>.txt</code>, <code>.csv</code> 純文字日誌
        </p>

        <div className="security-privacy-tag">
          <Lock className="w-3.5 h-3.5" />
          <span>100% 本地瀏覽器端解析，日誌數據絕不上傳伺服器，安全無虞</span>
        </div>

        <div className="upload-actions" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            className="btn btn-primary"
          >
            <FileCode2 className="w-4 h-4" />
            <span>選擇 Log 檔案</span>
          </button>

          <span className="or-divider">或</span>

          <button 
            type="button" 
            onClick={onLoadSample} 
            className="btn btn-emerald"
          >
            <Sparkles className="w-4 h-4" />
            <span>一鍵載入示範 Log 體驗功能</span>
          </button>
        </div>
      </div>
    </div>
  );
}
