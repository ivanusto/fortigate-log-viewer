# fortigate-log-viewer

[English](README.md) | 繁體中文

在瀏覽器裡讀 FortiGate 匯出的日誌。把 FortiGate（日誌與報表的下載）、FortiAnalyzer 或 syslog 收集端匯出的 `.log`、`.txt`、`.csv` 拖進來，用「哪台工作站在什麼時候去了哪個網站，有沒有被擋」的角度看它。給的情境是防火牆由別人代管，拿得到的只有匯出檔。檔案不會上傳，解析在瀏覽器分頁裡完成。

為 [onprem-ops-30days](https://github.com/ivanusto/onprem-ops-30days) 的 Day 24 寫的。線上那一條是 [onprem-logs/firewall/fortigate-webfilter.md](https://github.com/ivanusto/onprem-logs/blob/main/firewall/fortigate-webfilter.md) 的 LogsQL，同一份檔案兩邊的答案應該相同。

## 做什麼

| | |
|---|---|
| 輸入 | 每行 `key=value`（FortiOS 寫的樣子），或帶標題列、欄名是 FortiOS 欄位的 CSV。沒有任何一組鍵值的行（標語、分隔線）算「略過」，不會無聲消失，橫幅顯示 `行數 = 解析 + 略過` |
| 身份 | `user`，沒有就 `srcuser`、`unauthuser`，最後是 `srcip`。`srcname` 與 `srcmac` 保留並顯示，DHCP 的位址能對回工作站 |
| 網站 | `hostname`，沒有就 `url` 的主機部分，最後是 `dstip` |
| 時間 | 先用 `eventtime`（FortiOS 6.2 起，7.x 是奈秒），沒有就 `date` + `time` + `tz`，再沒有就 `date` + `time` 以瀏覽器的時區解讀。三者都沒有的行保留但沒有時間，計為「無時間」，不會被蓋上現在的時間。每筆紀錄記著它的時間是哪一條規則給的（`timeSource`） |
| 放行或擋下 | `action` 是 deny、block、blocked、dropped、reject、drop 算擋下，其餘（passthrough、accept、close、timeout 等）算放行 |
| 檢視 | 依使用者列網站、次數、位元組、放行與擋下、首末時間。原始行加細節視窗。幾張統計圖 |
| 篩選 | 時間範圍、使用者、網站或 URL 關鍵字、類別（`catdesc`）、放行或擋下 |

## 不做什麼

- **不上傳。** 解析、篩選、彙整都在頁面裡。Docker 映像裡的 nginx 只送靜態檔，看不到日誌。
- **反查 DNS 預設關閉。** 網站是裸 IP 的那些，可以用 DNS over HTTPS 向 Google Public DNS（`dns.google`）查 PTR。這會把那些公開 IP 送到 Google，所以只有按下「反查公開 IP」才開始，而且私有、loopback、link-local、100.64/10 與 multicast 位址不論按不按都不會送。
- **不保存。** 重新載入分頁檔案就沒了，不寫瀏覽器儲存。
- **不偵測。** 它列的是 FortiGate 已經記下的東西。政策上沒有掛網頁過濾 profile，就沒有 `hostname` 與 `catdesc` 可看，HTTPS 的 traffic 日誌最多給一個目的 IP。
- **CSV 依標題列解，測得少。** RFC 4180 的引號處理有做，但撰寫時沒有拿到 FortiAnalyzer 匯出的實際欄位，請先在自己的匯出檔上看 `行數 = 解析 + 略過` 有沒有對上。

## 跑

```sh
# 開發
npm ci && npm run dev            # http://localhost:5173

# 靜態建置放進容器
docker compose up -d --build     # http://127.0.0.1:5173

# 檢查
npm run lint && npm test && npm run build
```

Dockerfile 用 `node:22-alpine` 建、`nginx:alpine` 送，兩個都以 digest 釘住（為什麼要釘，見系列的 Day 3）。Node 20 已於 2026 年 4 月停止支援，CI 也是用 22。更新時以 `docker buildx imagetools inspect <映像>` 取新的 digest 換掉。

## 目錄

| 路徑 | 內容 |
|---|---|
| `src/utils/fortigateParser.js` | 解析、時間規則、使用者與網站彙整。不碰 DOM、不連網、有單元測試 |
| `src/utils/reverseDns.js` | 唯一會連網的地方，手動啟動，只送公開 IPv4 |
| `src/utils/sampleLogs.js` | 第一次開啟時載入的合成示範資料 |
| `src/App.jsx`、`src/components/` | 頁面 |
| `tests/parser.test.mjs`、`tests/fixtures/` | `node --test`。fixture 是合成的 FortiOS 7 樣式，位址用 RFC 5737 的測試網段 |

## 授權

Apache-2.0
