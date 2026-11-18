# 金邊鍋貼｜網站與訂單系統

金邊鍋貼的官網（靜態網頁，可安裝為 PWA）與線上訂單後端（Google Apps Script，寫入試算表）。

線上網址：https://turtlekei.github.io/go/

## 專案結構

| 檔案 | 說明 |
|---|---|
| `index.html` | 網站本體（HTML、CSS、JavaScript 都在這個檔案中） |
| `manifest.json` | PWA 設定（名稱、圖示、主題色） |
| `sw.js` | Service Worker，提供離線快取 |
| `icons/` | PWA 與 iPhone 用的圖示 |
| `scripts/make_icons.py` | 從一張照片產生發光圖示（需要 Pillow） |
| `apps-script/Code.gs` | 訂單接收程式，貼到試算表的 Apps Script 使用 |
| `apps-script/README.md` | Apps Script 的部署步驟 |
| `.vscode/` | VS Code 推薦擴充與設定、預覽任務 |
| `金邊鍋貼.code-workspace` | VS Code 工作區檔，雙擊即可開啟 |

## 開始開發

1. 安裝 [VS Code](https://code.visualstudio.com/)。
2. 解壓縮後，雙擊 `金邊鍋貼.code-workspace`，或在 VS Code 選「檔案 → 開啟資料夾」。
3. VS Code 右下角會提示安裝推薦擴充，按「安裝」即可。

## 本機預覽

**方法一：Live Server（推薦）**
在 `index.html` 上按右鍵，選「Open with Live Server」，會開啟 `http://127.0.0.1:5500`。

**方法二：Python 伺服器**
1. 按 `Ctrl+Shift+P`（Mac 為 `Cmd+Shift+P`），輸入「Run Task」，選「預覽網站」。
2. 或在終端機執行：
   ```bash
   python3 -m http.server 8000
   ```
3. 瀏覽器打開 http://localhost:8000

## 測試 PWA

- Service Worker 只在 `https` 或 `localhost` 生效。用本機預覽即可測試。
- 修改網站後，若沒有看到新版內容，在瀏覽器按 `Ctrl+Shift+R` 強制重新整理。
- 修改 `sw.js` 後，快取版本名稱（`CACHE`）要換新，否則使用者可能看到舊檔案。

## 部署

本專案使用 GitHub Pages 發佈，推送到 `main` 分支後自動更新：

```bash
git add .
git commit -m "說明你做了什麼"
git push origin main
```

## 訂單系統（Apps Script）

- 結帳時，`index.html` 會把訂單 POST 到 `ORDER_API`（在 `index.html` 上方的設定區）。
- `ORDER_TOKEN` 同樣在 `index.html` 上方，必須與 Apps Script 的「指令碼屬性」`ORDER_TOKEN` 相同。
- 設定與部署步驟見 `apps-script/README.md`。
- 商品價格同時存在 `index.html` 的 `products` 與 `apps-script/Code.gs` 的 `CATALOG`，修改價格時兩邊都要改。
- 通知 Email 請設定在 Apps Script 的指令碼屬性 `NOTIFY_EMAIL`，不要寫進程式碼。

## 注意事項

- `ORDER_TOKEN` 會出現在網站原始碼中，只能防止隨意亂送，不是真正的密碼。
- 網站目前只收集訂單，不處理付款。
- 離線時，Tailwind 樣式、Google 字型與外部圖片可能無法載入。
- `.gitignore` 已忽略 `__pycache__/` 與 `*.pyc`。
