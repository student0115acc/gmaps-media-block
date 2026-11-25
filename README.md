# Google Maps遮蔽

把 Google Maps 上的地點照片、評論照片與影片、搜尋縮圖、廣告縮圖、頭像和街景預覽縮圖換成灰色色塊。同時隱藏 Ask Maps（AI 問答）的入口與對話面板。地圖底圖、衛星圖層，以及使用者自己點進去的全景街景不受影響。

## 安裝

1. 開啟 `chrome://extensions`，打開右上角「開發人員模式」
2. 按「載入未封裝項目」，選擇這個資料夾
3. 打開 Google Maps。安裝後預設就是開啟，點工具列的 M 圖示可以開關遮蔽

## 密碼

切換開關或變更密碼都要輸入密碼，可以在 popup 的「變更密碼」修改。密碼只防止從 popup 直接關閉，無法阻止有人到 `chrome://extensions` 停用或移除擴充功能。

## 運作方式

- **網路層**（`background.js`）：只在 Maps 分頁擋下 `googleusercontent.com`、`ggpht.com`、`streetviewpixels-pa.googleapis.com`、`encrypted-tbn*.gstatic.com` 的圖片和影片請求，讓圖片不會被下載
- **畫面層**（`content.css`、`content.js`）：依圖片來源網址把 `<img>`、背景圖、`<video>` 換成灰色色塊；夠大的色塊會顯示「已隱藏」。影片會被暫停並靜音

## Ask Maps

Google Maps 新增的 Ask Maps（AI 問答）也一併遮蔽，同樣受 popup 開關控制：

- 搜尋列旁的 Ask Maps 按鈕與選單項目會被隱藏
- 「Make plans with Ask Maps」這類推廣卡片會被隱藏
- 左側的 Ask Maps 對話面板內容會被蓋住，只留一行「Ask Maps 已隱藏」

Maps 的 class 名稱是混淆過的，所以依按鈕文字或無障礙標籤比對（英文與繁簡中文名稱）。Google 改名後要到 `content.js` 的 `ASK_MAPS_NAMES` 補上新名稱。

## 更新紀錄

### 1.0.1

- 新增：隱藏 Ask Maps 的按鈕、選單項目、推廣卡片與對話面板
- 變更：擴充功能名稱改為「Google Maps遮蔽」
- 修正：按鈕文字前有圖示字型字元時也能比對到

### 1.0.0

- 首次發佈：遮蔽地點與評論的照片和影片、搜尋縮圖、頭像、街景預覽縮圖；popup 開關需密碼

## 漏遮時

Google 改版後如果有圖片沒被遮住，用開發者工具查看那張圖的網址主機，把主機加到 `content.css`、`content.js` 的 `MEDIA_HOSTS`，以及 `background.js` 的 `BLOCKED_DOMAINS`。
