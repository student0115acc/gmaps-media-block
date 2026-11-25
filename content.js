// 畫面層：遮蔽本身由 content.css 處理，這裡負責
// 1. 依開關切換 html.gmb-off
// 2. 標記夠大的色塊以顯示「已隱藏」
// 3. 暫停並靜音影片
// 4. 隱藏 Ask Maps（AI 問答）的按鈕與選單項目

// Maps 的 class 名稱是混淆過的，改用按鈕文字或無障礙標籤判斷；涵蓋英文與中文介面可能的名稱
const ASK_MAPS_NAMES = 'ask maps|詢問地圖|询问地图|問問地圖|问问地图|向地圖提問|向地图提问';
const ASK_MAPS = new RegExp(`^(${ASK_MAPS_NAMES})$`, 'i');
const MENTIONS_ASK_MAPS = new RegExp(ASK_MAPS_NAMES, 'i');
const CONTROL_SELECTOR = 'button, a, [role="button"], [role="menuitem"], [role="link"]';

const MEDIA_HOSTS = ['googleusercontent.com', 'ggpht.com', 'streetviewpixels', 'encrypted-tbn'];
const IMG_SELECTOR = MEDIA_HOSTS.flatMap((h) => [`img[src*="${h}"]`, `img[srcset*="${h}"]`]).join(',');
const BG_SELECTOR = MEDIA_HOSTS.map((h) => `[style*="${h}"]`).join(',');
const BIG_W = 120;
const BIG_H = 80;

let enabled = true;

chrome.runtime.sendMessage('maps-tab').catch(() => {});

function apply() {
  document.documentElement.classList.toggle('gmb-off', !enabled);
  if (enabled) scan();
}

function scan() {
  for (const el of document.querySelectorAll(`${IMG_SELECTOR},${BG_SELECTOR}`)) {
    const { width, height } = el.getBoundingClientRect();
    el.toggleAttribute('data-gmb-big', width >= BIG_W && height >= BIG_H);
  }
  for (const v of document.querySelectorAll('video')) silence(v);
  hideAskMaps();
}

// 按鈕文字前面會有圖示字型的私用區字元（例如 U+F628），比對前先去掉
function clean(s) {
  return (s || '').replace(/[-]/g, '').replace(/\s+/g, ' ').trim();
}

function isAskMaps(el) {
  return ASK_MAPS.test(clean(el.getAttribute('aria-label'))) || ASK_MAPS.test(clean(el.textContent));
}

function hideAskMaps() {
  for (const el of document.querySelectorAll(CONTROL_SELECTOR)) {
    if (el.hasAttribute('data-gmb-hide') || !isAskMaps(el)) continue;
    // 選單項目外層是只包一個按鈕的 <li>，一起藏起來才不會留下空白列
    const li = el.parentElement?.tagName === 'LI' && el.parentElement.childElementCount === 1 ? el.parentElement : null;
    (li ?? el).setAttribute('data-gmb-hide', '');
  }
  hideAskMapsCards();
  hideAskMapsPanel();
}

// Ask Maps 對話面板：標題是「Ask Maps」，底下有提問用的 <textarea>。
// 回傳包住整個面板的那層，找不到就回傳 null
function askMapsPanelOf(textarea) {
  let box = textarea.parentElement;
  for (let i = 0; i < 8 && box && box !== document.body; i++, box = box.parentElement) {
    const hasTitle = [...box.querySelectorAll('div, span, h1, h2, h3')].some((e) =>
      e.childElementCount === 0 && !e.closest(CONTROL_SELECTOR) && ASK_MAPS.test(clean(e.textContent)));
    if (hasTitle) {
      // 再往外一層是左側面板的欄位，連背景一起蓋掉
      const slot = box.parentElement;
      return slot && slot !== document.body && slot.getBoundingClientRect().width < 500 ? slot : box;
    }
  }
  return null;
}

function hideAskMapsPanel() {
  // 面板欄位會被 Maps 重複使用（例如之後改放搜尋結果），已不是 Ask Maps 的就解除
  for (const el of document.querySelectorAll('[data-gmb-panel]')) {
    const stillAskMaps = [...el.querySelectorAll('textarea')].some((t) => askMapsPanelOf(t) === el);
    if (!stillAskMaps) el.removeAttribute('data-gmb-panel');
  }
  for (const textarea of document.querySelectorAll('textarea')) {
    if (textarea.closest('[data-gmb-panel]')) continue;
    askMapsPanelOf(textarea)?.setAttribute('data-gmb-panel', '');
  }
}

// 「Make plans with Ask Maps」這類推廣卡片：從提到 Ask Maps 的標題往外找，
// 找到同時包含 Ask Maps 按鈕的那層就是整張卡片，再越過只包著它的外框
function hideAskMapsCards() {
  for (const heading of document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')) {
    if (heading.closest('[data-gmb-hide]') || !MENTIONS_ASK_MAPS.test(clean(heading.textContent))) continue;
    let card = heading;
    for (let i = 0; i < 12 && card && ![...card.querySelectorAll(CONTROL_SELECTOR)].some(isAskMaps); i++) {
      card = card.parentElement;
    }
    // 往外找太多層、抓到整個側邊面板時就放棄，避免把其他內容一起藏掉
    if (!card || card === document.body || card.getBoundingClientRect().height > 300) continue;
    while (card.parentElement && card.parentElement !== document.body
      && card.parentElement.childElementCount === 1) {
      card = card.parentElement;
    }
    card.setAttribute('data-gmb-hide', '');
  }
}

function silence(video) {
  video.removeAttribute('autoplay');
  video.autoplay = false;
  video.muted = true;
  if (!video.paused) video.pause();
}

// 被網路層擋過的圖片在關閉遮蔽後重新要求一次
function reloadMedia() {
  for (const img of document.querySelectorAll(IMG_SELECTOR)) {
    if (img.complete && img.naturalWidth === 0) img.src = img.src;
  }
  for (const el of document.querySelectorAll(BG_SELECTOR)) {
    const style = el.getAttribute('style');
    el.setAttribute('style', '');
    el.setAttribute('style', style);
  }
}

// Maps 拖曳地圖時會大量改動 style，只在跟媒體有關的變動時才重新掃描
function isRelevant(record) {
  if (record.type === 'childList') return record.addedNodes.length > 0;
  return record.target.matches?.(`${IMG_SELECTOR},${BG_SELECTOR}`) ?? false;
}

let pending = false;
const observer = new MutationObserver((records) => {
  if (!enabled || pending || !records.some(isRelevant)) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    scan();
  });
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src', 'srcset', 'style'],
});

// 任何影片一開始播放就攔下
document.addEventListener('play', (e) => {
  if (enabled && e.target instanceof HTMLVideoElement) silence(e.target);
}, true);

chrome.storage.local.get('enabled').then(({ enabled: value = true }) => {
  enabled = value;
  apply();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !('enabled' in changes)) return;
  enabled = changes.enabled.newValue !== false;
  apply();
  // 等背景移除網路規則後再重新載入
  if (!enabled) setTimeout(reloadMedia, 500);
});
